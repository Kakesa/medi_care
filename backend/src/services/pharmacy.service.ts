import { PharmacyOrder } from '../models/PharmacyOrder.js';
import { PharmacyProduct } from '../models/PharmacyProduct.js';
import { StockLot } from '../models/StockLot.js';
import { StockMovement } from '../models/StockMovement.js';
import { ApiError } from '../utils/ApiError.js';
import { dateOnly } from '../utils/dates.js';
import { paginated, readPagination } from '../utils/pagination.js';
import type { AuthContext } from '../types/express.js';
import { requireOwned } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { organizationCurrency } from './catalog.service.js';
import { isExpired, postStock } from './stock.service.js';
import { receiveOrderQuantity } from './procurement.service.js';

function stockStatus(quantity: number, minStock: number, alertStock = 0) {
  if (quantity <= 0) return 'out_of_stock' as const;
  if (alertStock > 0 ? quantity <= alertStock : quantity < minStock) return 'low_stock' as const;
  return 'in_stock' as const;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertStockBounds(minStock: number, maxStock?: number, alertStock?: number) {
  if (maxStock && maxStock > 0 && maxStock < minStock) {
    throw new ApiError(400, 'Le stock maximum doit être au moins égal au stock minimum', 'VALIDATION_ERROR');
  }
  if (maxStock && alertStock && maxStock > 0 && alertStock > maxStock) {
    throw new ApiError(400, 'Le seuil d\'alerte ne peut pas dépasser le stock maximum', 'VALIDATION_ERROR');
  }
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
    barcode: 'barcode' in row ? String(row.barcode || '') : '',
    form: 'form' in row ? String(row.form || '') : '',
    packaging: 'packaging' in row ? String(row.packaging || '') : '',
    maxStock: 'maxStock' in row ? Number(row.maxStock || 0) : 0,
    alertStock: 'alertStock' in row ? Number(row.alertStock || 0) : 0,
    storageUnit: 'storageUnit' in row ? String(row.storageUnit || '') : '',
    saleUnit: 'saleUnit' in row ? String(row.saleUnit || '') : '',
    unitFactor: 'unitFactor' in row ? Number(row.unitFactor || 1) : 1,
    location: 'location' in row ? String(row.location || '') : '',
    description: 'description' in row ? String(row.description || '') : '',
    active: !('active' in row) || row.active !== false,
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

function productFilter(organizationId: string, query: {
  search?: string;
  category?: string;
  status?: string;
  kind?: string;
}) {
  const filter: Record<string, unknown> = { organizationId, archivedAt: null };
  const search = query.search?.trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { genericName: pattern }, { sku: pattern }, { barcode: pattern }];
  }
  if (query.category) filter.category = query.category;
  if (query.status) filter.status = query.status;
  if (query.kind) filter.kind = query.kind;
  return filter;
}

export async function listProducts(organizationId: string, query: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
  kind?: string;
}) {
  const { page, limit, skip } = readPagination(query);
  const filter = productFilter(organizationId, query);
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
    packaging?: string;
    barcode?: string;
    storageUnit?: string;
    saleUnit?: string;
    unitFactor?: number;
    maxStock?: number;
    alertStock?: number;
    location?: string;
    description?: string;
    prescriptionRequired?: boolean;
  },
  ip?: string
) {
  if (input.quantity > 0 && input.expiryDate instanceof Date && isExpired(input.expiryDate)) {
    throw new ApiError(409, 'Un lot périmé ne peut pas entrer dans le stock disponible', 'LOT_EXPIRED');
  }
  assertStockBounds(input.minStock, input.maxStock, input.alertStock);
  const row = await PharmacyProduct.create({
    organizationId,
    name: input.name.trim(),
    category: input.category.trim(),
    quantity: 0,
    minStock: input.minStock,
    maxStock: input.maxStock ?? 0,
    alertStock: input.alertStock ?? 0,
    unit: input.unit.trim(),
    storageUnit: input.storageUnit?.trim() || '',
    saleUnit: input.saleUnit?.trim() || '',
    unitFactor: input.unitFactor && input.unitFactor > 0 ? input.unitFactor : 1,
    price: input.price,
    purchasePrice: input.purchasePrice ?? 0,
    averageCost: input.purchasePrice ?? 0,
    currency: await organizationCurrency(organizationId),
    genericName: input.genericName?.trim() || '',
    sku: input.sku?.trim().toUpperCase() || '',
    barcode: input.barcode?.trim() || '',
    kind: input.kind || 'medication',
    dosage: input.dosage?.trim() || '',
    form: input.form?.trim() || '',
    packaging: input.packaging?.trim() || '',
    location: input.location?.trim() || '',
    description: input.description?.trim() || '',
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
    genericName: string;
    sku: string;
    barcode: string;
    dosage: string;
    form: string;
    packaging: string;
    storageUnit: string;
    saleUnit: string;
    unitFactor: number;
    maxStock: number;
    alertStock: number;
    location: string;
    description: string;
    purchasePrice: number;
    active: boolean;
  }>,
  ip?: string
) {
  const row = await requireOwned(PharmacyProduct, id, organizationId, actor, 'pharmacy_product', ip);
  if (row.archivedAt) throw new ApiError(404, 'Ressource introuvable', 'NOT_FOUND');
  if (input.name !== undefined) row.name = input.name.trim();
  if (input.category !== undefined) row.category = input.category.trim();
  if (input.minStock !== undefined) row.minStock = input.minStock;
  if (input.maxStock !== undefined) row.maxStock = input.maxStock;
  if (input.alertStock !== undefined) row.alertStock = input.alertStock;
  assertStockBounds(row.minStock, row.maxStock, row.alertStock);
  if (input.unit !== undefined) row.unit = input.unit.trim();
  if (input.genericName !== undefined) row.genericName = input.genericName.trim();
  if (input.sku !== undefined) row.sku = input.sku.trim().toUpperCase();
  if (input.barcode !== undefined) row.barcode = input.barcode.trim();
  if (input.dosage !== undefined) row.dosage = input.dosage.trim();
  if (input.form !== undefined) row.form = input.form.trim();
  if (input.packaging !== undefined) row.packaging = input.packaging.trim();
  if (input.storageUnit !== undefined) row.storageUnit = input.storageUnit.trim();
  if (input.saleUnit !== undefined) row.saleUnit = input.saleUnit.trim();
  if (input.unitFactor !== undefined) row.unitFactor = input.unitFactor > 0 ? input.unitFactor : 1;
  if (input.location !== undefined) row.location = input.location.trim();
  if (input.description !== undefined) row.description = input.description.trim();
  if (input.purchasePrice !== undefined) row.purchasePrice = input.purchasePrice;
  if (input.active !== undefined) row.active = input.active;
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
  row.status = stockStatus(row.quantity, row.minStock, row.alertStock || 0);
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

const exportColumns = [
  'nom', 'generique', 'code', 'codeBarres', 'categorie', 'dosage', 'forme', 'conditionnement',
  'unite', 'uniteAchat', 'uniteDelivrance', 'conversion', 'prixAchat', 'prixVente',
  'quantite', 'stockMin', 'stockMax', 'seuilAlerte', 'emplacement', 'description', 'fournisseur',
] as const;

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function exportProducts(organizationId: string, query: {
  search?: string;
  category?: string;
  status?: string;
  kind?: string;
}) {
  const rows = await PharmacyProduct.find(productFilter(organizationId, query)).sort({ name: 1 }).limit(2000);
  const lines = rows.map((row) => {
    const item = toProductDto(row);
    return [
      item.name, item.genericName, item.sku, item.barcode, item.category, item.dosage, item.form, item.packaging,
      item.unit, item.storageUnit, item.saleUnit, item.unitFactor, item.purchasePrice, item.price,
      item.quantity, item.minStock, item.maxStock, item.alertStock, item.location, item.description, item.supplier,
    ].map(csvCell).join(',');
  });
  return {
    filename: 'medicaments.csv',
    csv: `\uFEFF${exportColumns.join(',')}\n${lines.join('\n')}`,
  };
}

export async function importProducts(
  actor: AuthContext,
  organizationId: string,
  rows: Array<{
    name: string;
    category: string;
    unit: string;
    price: number;
    quantity?: number;
    minStock?: number;
    genericName?: string;
    sku?: string;
    barcode?: string;
    dosage?: string;
    form?: string;
    packaging?: string;
    storageUnit?: string;
    saleUnit?: string;
    unitFactor?: number;
    purchasePrice?: number;
    maxStock?: number;
    alertStock?: number;
    location?: string;
    description?: string;
    supplier?: string;
  }>,
  ip?: string
) {
  const created: string[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    try {
      const product = await createProduct(actor, organizationId, {
        ...row,
        quantity: row.quantity ?? 0,
        minStock: row.minStock ?? 0,
      }, ip);
      created.push(product.id);
    } catch (error) {
      const duplicate = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 11000;
      errors.push({
        row: index + 1,
        message: error instanceof ApiError ? error.message : duplicate ? 'Ce code existe déjà' : 'Ligne refusée',
      });
    }
  }
  return { created: created.length, errors };
}

export async function productStockSheet(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const product = await getProduct(actor, organizationId, id, ip);
  const [lots, movements] = await Promise.all([
    StockLot.find({ organizationId, productId: id }).sort({ expiresAt: 1, lotNumber: 1 }).limit(200),
    StockMovement.find({ organizationId, productId: id, status: 'validated' }).sort({ occurredAt: 1, createdAt: 1 }).limit(500),
  ]);
  const lotById = new Map(lots.map((lot) => [lot.id, lot]));
  return {
    product,
    lots: lots.map((lot) => ({
      id: lot.id,
      lotNumber: lot.lotNumber,
      warehouse: lot.warehouse,
      supplierName: lot.supplierName,
      receivedAt: lot.receivedAt,
      expiresAt: lot.expiresAt,
      quantityReceived: lot.quantityReceived,
      quantityRemaining: lot.quantityRemaining,
      purchasePrice: lot.purchasePrice,
      status: isExpired(lot.expiresAt) && lot.status === 'available' ? 'expired' : lot.status,
    })),
    lines: movements.map((movement) => {
      const lot = movement.lotId ? lotById.get(movement.lotId.toString()) : undefined;
      const inbound = movement.direction === 'in';
      return {
        date: movement.occurredAt,
        reference: movement.sourceId || movement.idempotencyKey,
        lotNumber: lot?.lotNumber || '',
        origin: inbound ? (lot?.supplierName || movement.reason || movement.warehouseTo || '') : '',
        destination: inbound ? '' : (movement.reason || movement.warehouseFrom || ''),
        quantityIn: inbound ? movement.quantity : 0,
        unitCost: lot?.purchasePrice ?? product.purchasePrice ?? 0,
        expiresAt: lot?.expiresAt || null,
        quantityOut: inbound ? 0 : movement.quantity,
        remaining: movement.quantityAfter,
      };
    }),
  };
}
