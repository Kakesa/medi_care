import { PharmacyProduct } from '../models/PharmacyProduct.js';
import { PharmacySale } from '../models/PharmacyOperations.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthContext } from '../types/express.js';
import { requireVisiblePatient } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { organizationCurrency } from './catalog.service.js';
import { createInvoice, finalizeInvoice } from './billing.service.js';
import { postStock } from './stock.service.js';

async function nextSaleNumber(organizationId: string) {
  const year = new Date().getUTCFullYear();
  const count = await PharmacySale.countDocuments({ organizationId, number: new RegExp(`^VTE-${year}-`) });
  return `VTE-${year}-${String(count + 1).padStart(3, '0')}`;
}

function saleDto(row: {
  id: string;
  number: string;
  kind: string;
  patientName?: string;
  wardName?: string;
  total: number;
  currency: string;
  settlement: string;
  paymentMethod?: string | null;
  invoiceId?: { toString(): string } | null;
  lines: Array<{ productName: string; lotNumber: string; quantity: number; unitPrice: number; unitCost: number; total: number }>;
}) {
  return {
    id: row.id,
    number: row.number,
    kind: row.kind,
    patientName: row.patientName || '',
    wardName: row.wardName || '',
    total: row.total,
    currency: row.currency,
    settlement: row.settlement,
    paymentMethod: row.paymentMethod || undefined,
    invoiceId: row.invoiceId?.toString(),
    lines: row.lines,
  };
}

export async function createSale(
  actor: AuthContext,
  organizationId: string,
  input: {
    kind: 'counter' | 'dispense' | 'ward';
    settlement: 'paid' | 'invoiced' | 'internal';
    paymentMethod?: 'cash' | 'card' | 'transfer' | 'insurance';
    patientId?: string;
    wardName?: string;
    idempotencyKey: string;
    lines: Array<{ productId: string; quantity: number; lotId?: string }>;
  },
  ip?: string
) {
  const existing = await PharmacySale.findOne({ organizationId, idempotencyKey: input.idempotencyKey });
  if (existing) return saleDto(existing);
  if (input.kind === 'ward' && input.settlement !== 'internal') {
    throw new ApiError(400, 'Une sortie de service est une délivrance interne', 'VALIDATION_ERROR');
  }
  if (input.settlement === 'invoiced' && !input.patientId) {
    throw new ApiError(400, 'Une vente facturée exige un patient', 'VALIDATION_ERROR');
  }
  if ((input.kind === 'dispense' || input.settlement === 'invoiced') && input.patientId) {
    await requireVisiblePatient(actor, organizationId, input.patientId, ip);
  }
  const currency = await organizationCurrency(organizationId);
  const priced: Array<{
    productId: unknown;
    productName: string;
    quantity: number;
    unitPrice: number;
    unitCost: number;
    lotId?: string;
  }> = [];
  for (const line of input.lines) {
    const product = await PharmacyProduct.findOne({ _id: line.productId, organizationId, archivedAt: null, active: { $ne: false } });
    if (!product) throw new ApiError(404, 'Produit introuvable', 'NOT_FOUND');
    if (product.currency && product.currency !== currency) {
      throw new ApiError(409, 'La devise du produit ne correspond pas à celle de l\'établissement', 'CURRENCY_MISMATCH');
    }
    if (product.prescriptionRequired && input.kind === 'counter' && input.settlement === 'paid' && !input.patientId) {
      throw new ApiError(409, 'Ce produit nécessite une délivrance au patient', 'PRESCRIPTION_REQUIRED');
    }
    priced.push({
      productId: product._id,
      productName: product.name,
      quantity: line.quantity,
      unitPrice: input.settlement === 'internal' ? 0 : product.price,
      unitCost: product.averageCost || product.purchasePrice || 0,
      lotId: line.lotId,
    });
  }

  const lines = [];
  for (const [index, line] of priced.entries()) {
    const posted = await postStock(actor, organizationId, {
      productId: String(line.productId),
      quantity: line.quantity,
      direction: 'out',
      type: input.kind === 'counter' ? 'sale' : input.kind === 'ward' ? 'ward_issue' : 'dispense',
      lotId: line.lotId,
      reason: input.idempotencyKey,
      sourceType: 'pharmacy_sale',
      sourceId: input.idempotencyKey,
      idempotencyKey: `sale:${input.idempotencyKey}:${index}`,
    }, ip);
    const lotNumber = 'lotNumber' in posted && posted.lotNumber ? String(posted.lotNumber) : '';
    const lotId = 'lotId' in posted ? posted.lotId : posted.movement.lotId;
    lines.push({
      productId: line.productId,
      productName: line.productName,
      lotId,
      lotNumber,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      unitCost: line.unitCost,
      total: line.unitPrice * line.quantity,
    });
  }
  const sale = await PharmacySale.create({
    organizationId,
    number: await nextSaleNumber(organizationId),
    kind: input.kind,
    patientId: input.patientId,
    wardName: input.wardName?.trim() || '',
    lines,
    total: lines.reduce((sum, line) => sum + line.total, 0),
    currency,
    settlement: input.settlement,
    paymentMethod: input.settlement === 'paid' ? input.paymentMethod || 'cash' : undefined,
    idempotencyKey: input.idempotencyKey,
    actorId: actor.id,
  });
  if (input.patientId) {
    const patient = await requireVisiblePatient(actor, organizationId, input.patientId, ip);
    sale.patientName = `${patient.firstName} ${patient.lastName}`;
  }
  if (input.settlement === 'invoiced' && input.patientId) {
    const invoice = await createInvoice(actor, organizationId, {
      patientId: input.patientId,
      items: lines.map((line) => ({
        description: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        category: 'MEDICAMENT',
        referenceId: sale.id,
      })),
      notes: `Pharmacie ${sale.number}`,
    }, ip);
    const finalized = await finalizeInvoice(actor, organizationId, invoice.id, ip);
    sale.invoiceId = finalized.id;
    await sale.save();
  }
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'PHARMACY_SALE',
    resourceType: 'pharmacy_sale', resourceId: sale.id, success: true, ip,
    metadata: { settlement: sale.settlement, total: sale.total },
  });
  return saleDto(sale);
}

export async function listSales(organizationId: string) {
  const rows = await PharmacySale.find({ organizationId }).sort({ createdAt: -1 }).limit(100);
  return rows.map((row) => saleDto(row));
}
