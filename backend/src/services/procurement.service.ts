import { PharmacyOrder } from '../models/PharmacyOrder.js';
import { PharmacyProduct } from '../models/PharmacyProduct.js';
import { PharmacySupplier, PurchaseRequest, SupplierInvoice } from '../models/PharmacyProcurement.js';
import { ApiError } from '../utils/ApiError.js';
import { dateOnly } from '../utils/dates.js';
import type { AuthContext } from '../types/express.js';
import { requireOwned } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { organizationCurrency } from './catalog.service.js';
import { postStock } from './stock.service.js';

function orderDto(row: {
  id: string;
  productId: { toString(): string };
  productName: string;
  quantity: number;
  supplier?: string | null;
  orderDate: Date;
  expectedDelivery?: Date | null;
  status: string;
  totalCost: number;
  receivedQuantity?: number;
  notes?: string | null;
}) {
  return {
    id: row.id,
    productId: row.productId.toString(),
    productName: row.productName,
    quantity: row.quantity,
    supplier: row.supplier || '',
    orderDate: dateOnly(row.orderDate) || '',
    expectedDelivery: dateOnly(row.expectedDelivery),
    status: row.status,
    totalCost: row.totalCost,
    receivedQuantity: row.receivedQuantity || 0,
    notes: row.notes || undefined,
  };
}

export async function receiveOrderQuantity(
  actor: AuthContext,
  organizationId: string,
  order: {
    id: string;
    _id: unknown;
    productId: { toString(): string };
    quantity: number;
    receivedQuantity?: number;
    purchasePrice?: number;
    supplier?: string;
    status: string;
    save(): Promise<unknown>;
  },
  quantity: number,
  options: { lotNumber: string; idempotencyKey: string; expiresAt?: Date | null; purchasePrice?: number },
  ip?: string
) {
  if (order.status === 'cancelled') throw new ApiError(409, 'Commande annulée', 'ORDER_LOCKED');
  const remaining = order.quantity - (order.receivedQuantity || 0);
  if (quantity < 1 || remaining < 1) return orderDto(order as never);
  if (quantity > remaining) throw new ApiError(409, 'La quantité reçue dépasse la commande', 'OVER_RECEIPT');
  const cost = options.purchasePrice ?? order.purchasePrice ?? 0;
  const posted = await postStock(actor, organizationId, {
    productId: order.productId.toString(),
    quantity,
    direction: 'in',
    type: 'purchase_receipt',
    lotNumber: options.lotNumber,
    expiresAt: options.expiresAt,
    purchasePrice: cost,
    supplierName: order.supplier,
    reason: 'Réception de commande',
    sourceType: 'pharmacy_order',
    sourceId: order.id,
    idempotencyKey: options.idempotencyKey,
    receiptDocument: options.idempotencyKey,
  }, ip);
  if (!posted.duplicate) {
    order.receivedQuantity = (order.receivedQuantity || 0) + quantity;
    if (cost > 0) {
      const currency = await organizationCurrency(organizationId);
      await SupplierInvoice.findOneAndUpdate(
        { organizationId, orderId: order._id },
        {
          $inc: { amount: cost * quantity },
          $setOnInsert: {
            organizationId,
            orderId: order._id,
            supplierName: order.supplier || '',
            currency,
            paidAmount: 0,
            status: 'open',
          },
        },
        { upsert: true }
      );
    }
  }
  order.status = (order.receivedQuantity || 0) >= order.quantity ? 'delivered' : 'partial';
  if (order.status === 'delivered') {
    (order as { stockApplied?: boolean }).stockApplied = true;
  }
  await order.save();
  const saved = await PharmacyOrder.findById(order._id);
  return orderDto(saved as never);
}

function supplierDto(row: {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTerms?: string;
  leadDays?: number;
  active: boolean;
}) {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contactName || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    taxId: row.taxId || '',
    paymentTerms: row.paymentTerms || '',
    leadDays: row.leadDays || 0,
    active: row.active,
  };
}

export async function listSuppliers(organizationId: string) {
  const rows = await PharmacySupplier.find({ organizationId }).sort({ name: 1 });
  return rows.map((row) => supplierDto(row));
}

export async function createSupplier(actor: AuthContext, organizationId: string, input: {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTerms?: string;
  leadDays?: number;
}, ip?: string) {
  const row = await PharmacySupplier.create({
    organizationId,
    name: input.name.trim(),
    contactName: input.contactName?.trim() || '',
    phone: input.phone?.trim() || '',
    email: input.email?.trim() || '',
    address: input.address?.trim() || '',
    taxId: input.taxId?.trim() || '',
    paymentTerms: input.paymentTerms?.trim() || '',
    leadDays: input.leadDays ?? 0,
  });
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'SUPPLIER_CREATED',
    resourceType: 'pharmacy_supplier', resourceId: row.id, success: true, ip,
  });
  return supplierDto(row);
}

async function nextNumber(organizationId: string, prefix: string, model: { countDocuments(filter: object): Promise<number> }) {
  const year = new Date().getUTCFullYear();
  const count = await model.countDocuments({ organizationId, number: new RegExp(`^${prefix}-${year}-`) });
  return `${prefix}-${year}-${String(count + 1).padStart(3, '0')}`;
}

export async function createPurchaseRequest(actor: AuthContext, organizationId: string, input: {
  priority?: 'low' | 'normal' | 'urgent';
  note?: string;
  lines: Array<{ productId: string; quantity: number; reason?: string }>;
}, ip?: string) {
  const lines = [];
  for (const line of input.lines) {
    const product = await requireOwned(PharmacyProduct, line.productId, organizationId, actor, 'pharmacy_product', ip);
    if (product.archivedAt) throw new ApiError(404, 'Produit introuvable', 'NOT_FOUND');
    lines.push({ productId: product._id, productName: product.name, quantity: line.quantity, reason: line.reason?.trim() || '' });
  }
  const row = await PurchaseRequest.create({
    organizationId,
    number: await nextNumber(organizationId, 'DA', PurchaseRequest),
    requestedBy: actor.id,
    priority: input.priority || 'normal',
    lines,
    note: input.note?.trim() || '',
  });
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'PURCHASE_REQUESTED',
    resourceType: 'purchase_request', resourceId: row.id, success: true, ip,
  });
  return requestDto(row);
}

function requestDto(row: {
  id: string;
  number: string;
  requestedBy: { toString(): string };
  priority: string;
  status: string;
  note?: string;
  reviewNote?: string;
  lines: Array<{ productId: { toString(): string }; productName: string; quantity: number; reason?: string }>;
}) {
  return {
    id: row.id,
    number: row.number,
    requestedBy: row.requestedBy.toString(),
    priority: row.priority,
    status: row.status,
    note: row.note || '',
    reviewNote: row.reviewNote || '',
    lines: row.lines.map((line) => ({
      productId: line.productId.toString(),
      productName: line.productName,
      quantity: line.quantity,
      reason: line.reason || '',
    })),
  };
}

export async function listPurchaseRequests(organizationId: string) {
  const rows = await PurchaseRequest.find({ organizationId }).sort({ createdAt: -1 }).limit(100);
  return rows.map((row) => requestDto(row));
}

export async function decidePurchaseRequest(
  actor: AuthContext,
  organizationId: string,
  id: string,
  decision: 'approve' | 'reject' | 'return',
  note: string | undefined,
  ip?: string
) {
  const row = await requireOwned(PurchaseRequest, id, organizationId, actor, 'purchase_request', ip);
  if (String(row.requestedBy) === actor.id) {
    throw new ApiError(403, 'Vous ne pouvez pas approuver votre propre demande', 'SELF_APPROVAL');
  }
  if (row.status !== 'submitted' && row.status !== 'returned') {
    throw new ApiError(409, 'Cette demande est déjà traitée', 'REQUEST_LOCKED');
  }
  row.status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'returned';
  row.reviewedBy = actor.id;
  row.reviewedAt = new Date();
  row.reviewNote = note?.trim() || '';
  await row.save();
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'PURCHASE_REVIEWED',
    resourceType: 'purchase_request', resourceId: id, success: true, ip, metadata: { decision },
  });
  return requestDto(row);
}

export async function orderFromRequest(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const request = await requireOwned(PurchaseRequest, id, organizationId, actor, 'purchase_request', ip);
  if (request.status !== 'approved') throw new ApiError(409, 'La demande doit être approuvée', 'REQUEST_NOT_APPROVED');
  const orders = [];
  for (const line of request.lines) {
    const product = await PharmacyProduct.findOne({ _id: line.productId, organizationId, archivedAt: null });
    if (!product) continue;
    const order = await PharmacyOrder.create({
      organizationId,
      productId: product._id,
      productName: product.name,
      quantity: line.quantity,
      supplier: product.supplier,
      orderDate: new Date(),
      status: 'confirmed',
      purchasePrice: product.purchasePrice || 0,
      totalCost: (product.purchasePrice || product.price) * line.quantity,
      requestId: request._id,
      receivedQuantity: 0,
    });
    orders.push(orderDto(order));
  }
  return orders;
}
