import { PharmacyProduct } from '../models/PharmacyProduct.js';
import { StockLot } from '../models/StockLot.js';
import { StockMovement } from '../models/StockMovement.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthContext } from '../types/express.js';
import { requireOwned } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { organizationCurrency } from './catalog.service.js';

export function startOfToday() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

export function isExpired(value?: Date | null) {
  if (!value) return false;
  return value < startOfToday();
}

function stockStatus(quantity: number, minStock: number) {
  if (quantity <= 0) return 'out_of_stock' as const;
  if (quantity < minStock) return 'low_stock' as const;
  return 'in_stock' as const;
}

async function refreshStatus(productId: string) {
  const product = await PharmacyProduct.findById(productId);
  if (!product) return;
  if (product.quantity < 0) product.quantity = 0;
  product.status = stockStatus(product.quantity, product.minStock);
  await product.save();
}

export async function releaseExpired(organizationId: string, actor: AuthContext) {
  const lots = await StockLot.find({
    organizationId,
    status: 'available',
    expiresAt: { $lt: startOfToday() },
    quantityRemaining: { $gt: 0 },
  });
  for (const lot of lots) {
    const claimed = await StockLot.findOneAndUpdate(
      { _id: lot._id, status: 'available' },
      { status: 'expired' },
      { new: true }
    );
    if (!claimed || claimed.quantityRemaining <= 0) continue;
    const product = await PharmacyProduct.findOneAndUpdate(
      { _id: claimed.productId, quantity: { $gte: claimed.quantityRemaining } },
      { $inc: { quantity: -claimed.quantityRemaining } },
      { new: true }
    );
    if (!product) continue;
    await refreshStatus(product.id);
    const key = `expiry:${claimed.id}`;
    const existing = await StockMovement.findOne({ organizationId, idempotencyKey: key });
    if (existing) continue;
    await StockMovement.create({
      organizationId,
      productId: claimed.productId,
      lotId: claimed._id,
      type: 'expiry',
      direction: 'out',
      quantity: claimed.quantityRemaining,
      unit: product.unit,
      warehouseFrom: claimed.warehouse,
      occurredAt: new Date(),
      reason: 'Lot périmé retiré du disponible',
      actorId: actor.id,
      sourceType: 'lot',
      sourceId: claimed.id,
      quantityBefore: product.quantity + claimed.quantityRemaining,
      quantityAfter: product.quantity,
      lotQuantityBefore: claimed.quantityRemaining,
      lotQuantityAfter: claimed.quantityRemaining,
      status: 'validated',
      idempotencyKey: key,
      validatedBy: actor.id,
      validatedAt: new Date(),
    });
  }
}

async function materializeLegacy(product: { _id: unknown; id: string; quantity: number; expiryDate?: Date | null; price: number; averageCost?: number; purchasePrice?: number; supplier?: string; unit: string; currency?: string }, organizationId: string) {
  const count = await StockLot.countDocuments({ productId: product._id });
  if (count > 0 || product.quantity <= 0) return;
  await StockLot.create({
    organizationId,
    productId: product._id,
    lotNumber: 'EXISTANT',
    warehouse: 'principal',
    supplierName: product.supplier || '',
    receivedAt: new Date(),
    expiresAt: product.expiryDate || undefined,
    quantityReceived: product.quantity,
    quantityRemaining: product.quantity,
    purchasePrice: product.averageCost || product.purchasePrice || 0,
    currency: product.currency || 'EUR',
    status: 'available',
  });
}

export interface StockPostInput {
  productId: string;
  quantity: number;
  direction: 'in' | 'out';
  type: string;
  lotNumber?: string;
  lotId?: string;
  expiresAt?: Date | null;
  purchasePrice?: number;
  reason?: string;
  warehouse?: string;
  supplierName?: string;
  supplierId?: string;
  receiptDocument?: string;
  sourceType?: string;
  sourceId?: string;
  idempotencyKey: string;
  pending?: boolean;
}

function movementDto(row: {
  id: string;
  productId: { toString(): string };
  lotId?: { toString(): string } | null;
  type: string;
  direction: string;
  quantity: number;
  unit: string;
  reason?: string;
  status: string;
  occurredAt: Date;
  quantityBefore: number;
  quantityAfter: number;
  idempotencyKey: string;
  sourceType?: string;
  sourceId?: string;
}) {
  return {
    id: row.id,
    productId: row.productId.toString(),
    lotId: row.lotId?.toString(),
    type: row.type,
    direction: row.direction,
    quantity: row.quantity,
    unit: row.unit,
    reason: row.reason || '',
    status: row.status,
    occurredAt: row.occurredAt,
    quantityBefore: row.quantityBefore,
    quantityAfter: row.quantityAfter,
    idempotencyKey: row.idempotencyKey,
    sourceType: row.sourceType || '',
    sourceId: row.sourceId || '',
  };
}

export async function postStock(actor: AuthContext, organizationId: string, input: StockPostInput, ip?: string) {
  const existing = await StockMovement.findOne({ organizationId, idempotencyKey: input.idempotencyKey });
  if (existing) return { movement: movementDto(existing), duplicate: true };

  const product = await requireOwned(PharmacyProduct, input.productId, organizationId, actor, 'pharmacy_product', ip);
  if (product.archivedAt || product.active === false) throw new ApiError(404, 'Produit introuvable', 'NOT_FOUND');
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new ApiError(400, 'Quantité invalide', 'VALIDATION_ERROR');
  }
  await materializeLegacy(product, organizationId);
  await releaseExpired(organizationId, actor);
  const fresh = await PharmacyProduct.findById(product._id);
  if (!fresh) throw new ApiError(404, 'Produit introuvable', 'NOT_FOUND');

  if (input.pending) {
    const movement = await StockMovement.create({
      organizationId,
      productId: fresh._id,
      type: input.type,
      direction: input.direction,
      quantity: input.quantity,
      unit: fresh.unit,
      warehouseTo: input.direction === 'in' ? (input.warehouse || 'principal') : '',
      warehouseFrom: input.direction === 'out' ? (input.warehouse || 'principal') : '',
      occurredAt: new Date(),
      reason: input.reason?.trim() || '',
      actorId: actor.id,
      sourceType: input.sourceType || '',
      sourceId: input.sourceId || '',
      quantityBefore: fresh.quantity,
      quantityAfter: fresh.quantity,
      status: 'pending',
      idempotencyKey: input.idempotencyKey,
    });
    return { movement: movementDto(movement), duplicate: false };
  }

  const currency = fresh.currency || await organizationCurrency(organizationId);
  if (input.direction === 'in') {
    return receiveInto(actor, organizationId, fresh, input, currency, ip);
  }
  return issueFrom(actor, organizationId, fresh, input, ip);
}

async function receiveInto(
  actor: AuthContext,
  organizationId: string,
  product: {
    _id: unknown;
    id: string;
    quantity: number;
    reservedQuantity?: number;
    minStock: number;
    unit: string;
    averageCost?: number;
    purchasePrice?: number;
  },
  input: StockPostInput,
  currency: string,
  ip?: string
) {
  const lotNumber = (input.lotNumber || 'SANS-LOT').trim();
  const warehouse = input.warehouse || 'principal';
  if (input.expiresAt && isExpired(input.expiresAt)) {
    throw new ApiError(409, 'Un lot périmé ne peut pas entrer dans le stock disponible', 'LOT_EXPIRED');
  }
  const cost = input.purchasePrice ?? product.purchasePrice ?? product.averageCost ?? 0;
  const beforeQty = product.quantity;
  const beforeValue = beforeQty * (product.averageCost || 0);
  const nextQty = beforeQty + input.quantity;
  const averageCost = nextQty > 0 ? (beforeValue + input.quantity * cost) / nextQty : cost;

  let lot = await StockLot.findOne({ organizationId, productId: product._id, lotNumber, warehouse });
  if (!lot) {
    lot = await StockLot.create({
      organizationId,
      productId: product._id,
      lotNumber,
      warehouse,
      supplierName: input.supplierName || '',
      supplierId: input.supplierId || undefined,
      receivedAt: new Date(),
      expiresAt: input.expiresAt || undefined,
      quantityReceived: input.quantity,
      quantityRemaining: input.quantity,
      purchasePrice: cost,
      currency,
      receiptDocument: input.receiptDocument || '',
      status: 'available',
    });
  } else {
    if (lot.status === 'expired' || isExpired(lot.expiresAt)) {
      throw new ApiError(409, 'Ce lot est périmé', 'LOT_EXPIRED');
    }
    const lotBefore = lot.quantityRemaining;
    lot.quantityReceived += input.quantity;
    lot.quantityRemaining += input.quantity;
    lot.purchasePrice = cost;
    lot.status = 'available';
    if (input.expiresAt) lot.expiresAt = input.expiresAt;
    await lot.save();
    lot.set('lotQuantityBefore', lotBefore);
  }

  const updated = await PharmacyProduct.findOneAndUpdate(
    { _id: product._id, quantity: beforeQty },
    {
      $inc: { quantity: input.quantity },
      $set: {
        averageCost,
        purchasePrice: cost,
        lastRestocked: new Date(),
        status: stockStatus(nextQty, product.minStock),
        currency,
      },
    },
    { new: true }
  );
  if (!updated) throw new ApiError(409, 'Le stock a changé, recommencez l\'opération', 'STOCK_CONFLICT');

  try {
    const movement = await StockMovement.create({
      organizationId,
      productId: product._id,
      lotId: lot._id,
      type: input.type,
      direction: 'in',
      quantity: input.quantity,
      unit: product.unit,
      warehouseTo: warehouse,
      occurredAt: new Date(),
      reason: input.reason?.trim() || '',
      actorId: actor.id,
      sourceType: input.sourceType || '',
      sourceId: input.sourceId || '',
      quantityBefore: beforeQty,
      quantityAfter: updated.quantity,
      lotQuantityBefore: lot.quantityRemaining - input.quantity,
      lotQuantityAfter: lot.quantityRemaining,
      status: 'validated',
      idempotencyKey: input.idempotencyKey,
      validatedBy: actor.id,
      validatedAt: new Date(),
    });
    await recordAudit({
      actorId: actor.id,
      actorRole: actor.role,
      organizationId,
      action: 'STOCK_RECEIVED',
      resourceType: 'stock_movement',
      resourceId: movement.id,
      success: true,
      ip,
      metadata: { productId: product.id, quantity: input.quantity, lotNumber },
    });
    return { movement: movementDto(movement), lotId: lot.id, duplicate: false };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      const movement = await StockMovement.findOne({ organizationId, idempotencyKey: input.idempotencyKey });
      if (movement) return { movement: movementDto(movement), lotId: lot.id, duplicate: true };
    }
    throw error;
  }
}

async function pickLot(
  organizationId: string,
  productId: unknown,
  input: StockPostInput
) {
  if (input.lotId) {
    const lot = await StockLot.findOne({ _id: input.lotId, organizationId, productId });
    if (!lot) throw new ApiError(404, 'Lot introuvable', 'NOT_FOUND');
    return lot;
  }
  const lots = await StockLot.find({
    organizationId,
    productId,
    status: 'available',
    quantityRemaining: { $gt: 0 },
    warehouse: input.warehouse || 'principal',
  }).sort({ expiresAt: 1, receivedAt: 1 });
  const usable = lots.find((lot) => !isExpired(lot.expiresAt));
  if (!usable) throw new ApiError(409, 'Stock insuffisant', 'INSUFFICIENT_STOCK');
  return usable;
}

async function issueFrom(
  actor: AuthContext,
  organizationId: string,
  product: { _id: unknown; id: string; quantity: number; reservedQuantity?: number; minStock: number; unit: string },
  input: StockPostInput,
  ip?: string
) {
  const available = product.quantity - (product.reservedQuantity || 0);
  if (available < input.quantity) throw new ApiError(409, 'Stock insuffisant', 'INSUFFICIENT_STOCK');
  const chosen = await pickLot(organizationId, product._id, input);
  if (chosen.status === 'expired' || chosen.status === 'blocked' || isExpired(chosen.expiresAt)) {
    throw new ApiError(409, 'Ce lot est périmé ou bloqué', 'LOT_EXPIRED');
  }
  const lot = await StockLot.findOneAndUpdate(
    { _id: chosen._id, status: 'available', quantityRemaining: { $gte: input.quantity } },
    { $inc: { quantityRemaining: -input.quantity } },
    { new: true }
  );
  if (!lot) throw new ApiError(409, 'Stock insuffisant', 'INSUFFICIENT_STOCK');
  if (lot.quantityRemaining === 0) {
    lot.status = 'depleted';
    await lot.save();
  }
  const updated = await PharmacyProduct.findOneAndUpdate(
    { _id: product._id, quantity: { $gte: input.quantity } },
    { $inc: { quantity: -input.quantity } },
    { new: true }
  );
  if (!updated) {
    await StockLot.updateOne({ _id: lot._id }, { $inc: { quantityRemaining: input.quantity }, $set: { status: 'available' } });
    throw new ApiError(409, 'Stock insuffisant', 'INSUFFICIENT_STOCK');
  }
  updated.status = stockStatus(updated.quantity, product.minStock);
  await updated.save();

  try {
    const movement = await StockMovement.create({
      organizationId,
      productId: product._id,
      lotId: lot._id,
      type: input.type,
      direction: 'out',
      quantity: input.quantity,
      unit: product.unit,
      warehouseFrom: lot.warehouse,
      occurredAt: new Date(),
      reason: input.reason?.trim() || '',
      actorId: actor.id,
      sourceType: input.sourceType || '',
      sourceId: input.sourceId || '',
      quantityBefore: updated.quantity + input.quantity,
      quantityAfter: updated.quantity,
      lotQuantityBefore: lot.quantityRemaining + input.quantity,
      lotQuantityAfter: lot.quantityRemaining,
      status: 'validated',
      idempotencyKey: input.idempotencyKey,
      validatedBy: actor.id,
      validatedAt: new Date(),
    });
    await recordAudit({
      actorId: actor.id,
      actorRole: actor.role,
      organizationId,
      action: 'STOCK_ISSUED',
      resourceType: 'stock_movement',
      resourceId: movement.id,
      success: true,
      ip,
      metadata: { productId: product.id, quantity: input.quantity, lotNumber: lot.lotNumber },
    });
    return { movement: movementDto(movement), lotId: lot.id, lotNumber: lot.lotNumber, duplicate: false };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      const movement = await StockMovement.findOne({ organizationId, idempotencyKey: input.idempotencyKey });
      if (movement) return { movement: movementDto(movement), lotId: lot.id, lotNumber: lot.lotNumber, duplicate: true };
    }
    throw error;
  }
}

export async function listLots(organizationId: string, productId?: string) {
  const filter: Record<string, unknown> = { organizationId };
  if (productId) filter.productId = productId;
  const rows = await StockLot.find(filter).sort({ expiresAt: 1, lotNumber: 1 }).limit(200);
  return rows.map((row) => ({
    id: row.id,
    productId: row.productId.toString(),
    lotNumber: row.lotNumber,
    warehouse: row.warehouse,
    supplierName: row.supplierName,
    receivedAt: row.receivedAt,
    expiresAt: row.expiresAt,
    quantityReceived: row.quantityReceived,
    quantityRemaining: row.quantityRemaining,
    purchasePrice: row.purchasePrice,
    currency: row.currency,
    status: isExpired(row.expiresAt) && row.status === 'available' ? 'expired' : row.status,
  }));
}

export async function listMovements(organizationId: string) {
  const rows = await StockMovement.find({ organizationId }).sort({ createdAt: -1 }).limit(200);
  return rows.map((row) => movementDto(row));
}

export async function decideAdjustment(
  actor: AuthContext,
  organizationId: string,
  id: string,
  decision: 'approve' | 'reject',
  ip?: string
) {
  const movement = await requireOwned(StockMovement, id, organizationId, actor, 'stock_movement', ip);
  if (movement.status !== 'pending') throw new ApiError(409, 'Ce mouvement est déjà traité', 'MOVEMENT_LOCKED');
  if (String(movement.actorId) === actor.id) {
    throw new ApiError(403, 'Vous ne pouvez pas valider votre propre demande', 'SELF_APPROVAL');
  }
  if (decision === 'reject') {
    movement.status = 'rejected';
    movement.validatedBy = actor.id;
    movement.validatedAt = new Date();
    await movement.save();
    return movementDto(movement);
  }
  const applied = await postStock(actor, organizationId, {
    productId: movement.productId.toString(),
    quantity: movement.quantity,
    direction: movement.direction,
    type: movement.type,
    reason: movement.reason,
    warehouse: movement.direction === 'in' ? movement.warehouseTo : movement.warehouseFrom,
    idempotencyKey: `${movement.idempotencyKey}:validated`,
    sourceType: 'adjustment',
    sourceId: movement.id,
  }, ip);
  movement.status = 'validated';
  movement.validatedBy = actor.id;
  movement.validatedAt = new Date();
  movement.quantityAfter = applied.movement.quantityAfter;
  await movement.save();
  return movementDto(movement);
}
