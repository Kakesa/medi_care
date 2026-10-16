import { PharmacyOrder } from '../models/PharmacyOrder.js';
import { PharmacyProduct } from '../models/PharmacyProduct.js';
import { ApiError } from '../utils/ApiError.js';
import { dateOnly } from '../utils/dates.js';
import { paginated, readPagination } from '../utils/pagination.js';
import type { AuthContext } from '../types/express.js';
import { requireOwned } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { organizationCurrency } from './catalog.service.js';
import { isExpired, postStock } from './stock.service.js';
import { receiveOrderQuantity } from './procurement.service.js';

function stockStatus(quantity: number, minStock: number) {
  if (quantity <= 0) return 'out_of_stock' as const;
  if (quantity < minStock) return 'low_stock' as const;
  return 'in_stock' as const;
}

function cleanDate(value?: Date | '' | null) {
  if (value == null || value === '') return undefined;
  return value;
}

function toProductDto(row: {
  id?: string;
  _id: { toString(): string };
  name: string;
  category: string;
  quantity: number;
  minStock: number;
  unit: string;
  price: number;
  supplier?: string | null;
  expiryDate?: Date | null;
  status: string;
  lastRestocked?: Date | null;
}) {
  return {
    id: row.id ?? row._id.toString(),
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    minStock: row.minStock,
    unit: row.unit,
    price: row.price,
    purchasePrice: 'purchasePrice' in row ? Number(row.purchasePrice || 0) : 0,
    currency: 'currency' in row && row.currency ? String(row.currency) : 'EUR',
    genericName: 'genericName' in row ? String(row.genericName || '') : '',
    sku: 'sku' in row ? String(row.sku || '') : '',
    kind: 'kind' in row ? String(row.kind || 'medication') : 'medication',
    dosage: 'dosage' in row ? String(row.dosage || '') : '',
    prescriptionRequired: 'prescriptionRequired' in row ? Boolean(row.prescriptionRequired) : false,
    available: Math.max(0, row.quantity - ('reservedQuantity' in row ? Number(row.reservedQuantity || 0) : 0)),
    supplier: row.supplier || '',
    expiryDate: dateOnly(row.expiryDate),
    status: row.status,
    lastRestocked: dateOnly(row.lastRestocked),
  };
}

function toOrderDto(row: {
  id?: string;
  _id: { toString(): string };
  productId: { toString(): string };
  productName: string;
  quantity: number;
  supplier?: string | null;
  orderDate: Date;
  expectedDelivery?: Date | null;
  status: string;
  totalCost: number;
  notes?: string | null;
}) {
  return {
    id: row.id ?? row._id.toString(),
    productId: row.productId.toString(),
    productName: row.productName,
    quantity: row.quantity,
    supplier: row.supplier || '',
    orderDate: dateOnly(row.orderDate) || '',
    expectedDelivery: dateOnly(row.expectedDelivery),
    status: row.status,
    totalCost: row.totalCost,
    receivedQuantity: 'receivedQuantity' in row ? Number(row.receivedQuantity || 0) : 0,
    notes: row.notes || undefined,
  };
}

export async function listProducts(organizationId: string, query: { page?: number; limit?: number }) {
  const { page, limit, skip } = readPagination(query);
  const filter = { organizationId, archivedAt: null };
  const [rows, total] = await Promise.all([
    PharmacyProduct.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    PharmacyProduct.countDocuments(filter),
  ]);
  return paginated(rows.map((row) => toProductDto(row)), total, page, limit);
}

export async function getProduct(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(PharmacyProduct, id, organizationId, actor, 'pharmacy_product', ip);
  if (row.archivedAt) throw new ApiError(404, 'Ressource introuvable', 'NOT_FOUND');
  return toProductDto(row);
}

export async function createProduct(
  actor: AuthContext,
  organizationId: string,
  input: {
    name: string;
    category: string;
    quantity: number;
    minStock: number;
    unit: string;
    price: number;
    supplier?: string;
    expiryDate?: Date | '';
    purchasePrice?: number;
    genericName?: string;
    sku?: string;
    kind?: 'medication' | 'consumable' | 'device';
    dosage?: string;
    form?: string;
    prescriptionRequired?: boolean;
  },
  ip?: string
) {
  if (input.quantity > 0 && input.expiryDate instanceof Date && isExpired(input.expiryDate)) {
    throw new ApiError(409, 'Un lot périmé ne peut pas entrer dans le stock disponible', 'LOT_EXPIRED');
  }
  const row = await PharmacyProduct.create({
    organizationId,
    name: input.name.trim(),
    category: input.category.trim(),
    quantity: 0,
    minStock: input.minStock,
    unit: input.unit.trim(),
    price: input.price,
    purchasePrice: input.purchasePrice ?? 0,
    averageCost: input.purchasePrice ?? 0,
    currency: await organizationCurrency(organizationId),
    genericName: input.genericName?.trim() || '',
    sku: input.sku?.trim().toUpperCase() || '',
    kind: input.kind || 'medication',
    dosage: input.dosage?.trim() || '',
    form: input.form?.trim() || '',
    prescriptionRequired: input.prescriptionRequired ?? false,
    supplier: input.supplier?.trim() || '',
    expiryDate: cleanDate(input.expiryDate),
    status: 'out_of_stock',
  });
  if (input.quantity > 0) {
    await postStock(actor, organizationId, {
      productId: row.id,
      quantity: input.quantity,
      direction: 'in',
      type: 'inventory_adjustment',
      lotNumber: 'OUVERTURE',
      expiresAt: cleanDate(input.expiryDate) || null,
      purchasePrice: input.purchasePrice ?? 0,
      reason: 'Stock d\'ouverture',
      idempotencyKey: `opening:${row.id}`,
      supplierName: input.supplier,
    }, ip);
  }
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'PRODUCT_CREATED',
    resourceType: 'pharmacy_product',
    resourceId: row.id,
    success: true,
    ip,
  });
  const saved = await PharmacyProduct.findById(row._id);
  return toProductDto(saved || row);
}

export async function updateProduct(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: Partial<{
    name: string;
    category: string;
    quantity: number;
    minStock: number;
    unit: string;
    price: number;
    supplier: string;
    expiryDate: Date | '';
  }>,
  ip?: string
) {
  const row = await requireOwned(PharmacyProduct, id, organizationId, actor, 'pharmacy_product', ip);
  if (row.archivedAt) throw new ApiError(404, 'Ressource introuvable', 'NOT_FOUND');
  if (input.name !== undefined) row.name = input.name.trim();
  if (input.category !== undefined) row.category = input.category.trim();
  if (input.minStock !== undefined) row.minStock = input.minStock;
  if (input.unit !== undefined) row.unit = input.unit.trim();
  if (input.price !== undefined && input.price !== row.price) {
    await recordAudit({
      actorId: actor.id,
      actorRole: actor.role,
      organizationId,
      action: 'PRODUCT_PRICE_UPDATED',
      resourceType: 'pharmacy_product',
      resourceId: id,
      success: true,
      ip,
      metadata: { previous: row.price, next: input.price },
    });
    row.price = input.price;
  }
  if (input.supplier !== undefined) row.supplier = input.supplier.trim();
  if (input.expiryDate !== undefined) row.expiryDate = cleanDate(input.expiryDate);
  row.status = stockStatus(row.quantity, row.minStock);
  await row.save();
  return toProductDto(row);
}

export async function updateStock(actor: AuthContext, organizationId: string, id: string, quantity: number, ip?: string) {
  const row = await requireOwned(PharmacyProduct, id, organizationId, actor, 'pharmacy_product', ip);
  const delta = quantity - row.quantity;
  if (delta === 0) return toProductDto(row);
  const pending = actor.role !== 'HOSPITAL_ADMIN';
  await postStock(actor, organizationId, {
    productId: id,
    quantity: Math.abs(delta),
    direction: delta > 0 ? 'in' : 'out',
    type: 'inventory_adjustment',
    reason: 'Ajustement demandé',
    idempotencyKey: `adjust:${id}:${quantity}:${pending ? 'pending' : 'now'}:${actor.id}`,
    pending,
  }, ip);
  const saved = await PharmacyProduct.findById(id);
  return toProductDto(saved || row);
}

export async function archiveProduct(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(PharmacyProduct, id, organizationId, actor, 'pharmacy_product', ip);
  row.archivedAt = new Date();
  await row.save();
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'PRODUCT_ARCHIVED',
    resourceType: 'pharmacy_product',
    resourceId: id,
    success: true,
    ip,
  });
}

export async function lowStockProducts(organizationId: string) {
  const rows = await PharmacyProduct.find({
    organizationId,
    archivedAt: null,
    status: { $in: ['low_stock', 'out_of_stock'] },
  }).sort({ name: 1 });
  return rows.map((row) => toProductDto(row));
}

export async function listOrders(organizationId: string, query: { page?: number; limit?: number }) {
  const { page, limit, skip } = readPagination(query);
  const filter = { organizationId };
  const [rows, total] = await Promise.all([
    PharmacyOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    PharmacyOrder.countDocuments(filter),
  ]);
  return paginated(rows.map((row) => toOrderDto(row)), total, page, limit);
}

export async function getOrder(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(PharmacyOrder, id, organizationId, actor, 'pharmacy_order', ip);
  return toOrderDto(row);
}

export async function createOrder(
  actor: AuthContext,
  organizationId: string,
  input: { productId: string; quantity: number; supplier?: string; expectedDelivery?: Date | ''; notes?: string },
  ip?: string
) {
  const product = await requireOwned(PharmacyProduct, input.productId, organizationId, actor, 'pharmacy_product', ip);
  if (product.archivedAt) throw new ApiError(404, 'Ressource introuvable', 'NOT_FOUND');
  const row = await PharmacyOrder.create({
    organizationId,
    productId: product._id,
    productName: product.name,
    quantity: input.quantity,
    supplier: input.supplier?.trim() || product.supplier,
    orderDate: new Date(),
    expectedDelivery: cleanDate(input.expectedDelivery),
    status: 'pending',
    purchasePrice: product.purchasePrice || 0,
    totalCost: (product.purchasePrice || product.price) * input.quantity,
    notes: input.notes?.trim(),
  });
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'ORDER_CREATED',
    resourceType: 'pharmacy_order',
    resourceId: row.id,
    success: true,
    ip,
  });
  return toOrderDto(row);
}

export async function updateOrderStatus(
  actor: AuthContext,
  organizationId: string,
  id: string,
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled',
  ip?: string
) {
  const row = await requireOwned(PharmacyOrder, id, organizationId, actor, 'pharmacy_order', ip);
  if (row.stockApplied && status !== 'delivered') {
    throw new ApiError(409, 'Une commande livrée ne peut plus changer de statut', 'ORDER_LOCKED');
  }
  if (status === 'delivered') {
    const received = await receiveOrderQuantity(actor, organizationId, row, row.quantity - (row.receivedQuantity || 0), {
      lotNumber: `CMD-${row.id}`,
      idempotencyKey: `order-deliver:${row.id}`,
    }, ip);
    return received;
  }
  if (status === 'cancelled' && (row.receivedQuantity || 0) > 0) {
    throw new ApiError(409, 'Une commande déjà réceptionnée ne peut pas être annulée', 'ORDER_LOCKED');
  }
  row.status = status;
  await row.save();
  return toOrderDto(row);
}

export async function cancelOrder(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  return updateOrderStatus(actor, organizationId, id, 'cancelled', ip);
}

export async function pendingOrders(organizationId: string) {
  const rows = await PharmacyOrder.find({ organizationId, status: { $in: ['pending', 'confirmed'] } }).sort({ createdAt: -1 });
  return rows.map((row) => toOrderDto(row));
}
