import mongoose from 'mongoose';
import { ROLES } from '../config/permissions.js';
import { Invoice } from '../models/Invoice.js';
import { PatientCharge } from '../models/PatientCharge.js';
import { PharmacyProduct } from '../models/PharmacyProduct.js';
import { Prescription } from '../models/Prescription.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthContext } from '../types/express.js';
import { requireOwned } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { finalizeInvoice } from './billing.service.js';
import { openDraftInvoice, recordCharge, syncOriginStatus } from './charge.service.js';
import { organizationCurrency } from './catalog.service.js';
import { notifyRoles } from './notification.service.js';
import { analyzePrescriptionDocument } from './prescriptionQuote.service.js';

function itemKey(item: { id?: string; _id?: { toString(): string } }, index: number) {
  return item.id || item._id?.toString() || String(index);
}

function chargeOriginId(prescriptionId: string, itemId: string) {
  return `rxline:${prescriptionId}:${itemId}`;
}

export async function confirmPrescriptionQuote(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: {
    lines?: Array<{ itemId: string; quantityValidated: number; productId?: string }>;
  } = {},
  ip?: string,
) {
  const row = await requireOwned(Prescription, id, organizationId, actor, 'prescription', ip);
  if (row.status !== 'validated') {
    throw new ApiError(409, 'L\'ordonnance n\'est pas validée', 'PRESCRIPTION_DRAFT');
  }
  if (row.billingStatus === 'paid') {
    throw new ApiError(409, 'Cette ordonnance est déjà payée', 'ALREADY_PAID');
  }
  if (row.billingStatus === 'awaiting_payment' || row.billingStatus === 'invoiced') {
    throw new ApiError(409, 'Une facture est déjà en attente de paiement pour cette ordonnance', 'ALREADY_INVOICED');
  }
  if (row.items.some((item) => item.quantityDispensed > 0)) {
    throw new ApiError(409, 'Impossible de facturer une ordonnance déjà partiellement délivrée', 'ALREADY_DISPENSED');
  }

  if (!row.quotedAt) {
    await analyzePrescriptionDocument(organizationId, row);
  }

  const overrides = new Map((input.lines || []).map((line) => [line.itemId, line]));
  const currency = await organizationCurrency(organizationId);
  const billable: Array<{
    itemId: string;
    productId: string;
    label: string;
    quantity: number;
    unitPrice: number;
  }> = [];

  for (let index = 0; index < row.items.length; index += 1) {
    const item = row.items[index];
    const idKey = itemKey(item, index);
    if (item.unavailable) continue;

    const override = overrides.get(idKey);
    const analysis = item.analysis;
    const quantity = override?.quantityValidated
      ?? analysis?.quantityValidated
      ?? analysis?.quantityProposed
      ?? item.quantityPrescribed;
    if (!quantity || quantity < 1) {
      throw new ApiError(409, `Quantité invalide pour ${item.medication}`, 'QUANTITY');
    }

    const productId = override?.productId || analysis?.matchedProductId?.toString() || '';
    if (!productId) {
      throw new ApiError(409, `Aucun produit catalogue pour ${item.medication}. Corrigez le devis avant facturation.`, 'PRODUCT_REQUIRED');
    }
    const product = await PharmacyProduct.findOne({
      _id: productId,
      organizationId,
      archivedAt: null,
      active: { $ne: false },
    });
    if (!product) throw new ApiError(404, `Produit introuvable pour ${item.medication}`, 'NOT_FOUND');
    if (!(product.price > 0)) {
      throw new ApiError(409, `Prix de vente manquant pour ${product.name}`, 'PRICE_MISSING');
    }

    item.quantityPrescribed = Math.max(item.quantityDispensed || 0, quantity);
    if (item.analysis) {
      item.analysis.quantityValidated = quantity;
      item.analysis.quantityProposed = quantity;
      item.analysis.matchedProductId = new mongoose.Types.ObjectId(product.id);
      item.analysis.matchedProductName = product.name;
      item.analysis.unitPrice = product.price;
      item.analysis.lineTotal = Number((product.price * quantity).toFixed(2));
      item.analysis.billable = true;
      item.analysis.needsPharmacistValidation = false;
      item.analysis.validationStatus = 'approved';
      item.analysis.matchConfidence = 'high';
    }
    billable.push({
      itemId: idKey,
      productId: product.id,
      label: product.name,
      quantity,
      unitPrice: product.price,
    });
  }

  if (!billable.length) {
    throw new ApiError(409, 'Aucune ligne facturable sur cette ordonnance', 'EMPTY_QUOTE');
  }

  row.billingStatus = 'awaiting_invoice';
  row.quoteStatus = 'ready';
  row.quotePendingLines = 0;
  row.quoteTotal = Number(billable.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0).toFixed(2));
  row.quoteCurrency = currency as typeof row.quoteCurrency;
  row.markModified('items');
  await row.save();

  const invoice = await openDraftInvoice(
    actor,
    organizationId,
    row.patientId.toString(),
    currency,
    `Ordonnance pharmaceutique ${row.id}`,
    ip,
  );

  for (const line of billable) {
    await recordCharge(actor, organizationId, {
      patientId: row.patientId.toString(),
      originModule: 'pharmacy',
      originId: chargeOriginId(row.id, line.itemId),
      quantity: line.quantity,
      catalogKind: 'pharmacy',
      pharmacyLine: {
        label: line.label,
        unitPrice: line.unitPrice,
        category: 'MEDICAMENT',
        productId: line.productId,
      },
      invoiceId: invoice.id,
      prescriberName: row.prescriberName,
    }, ip);
  }

  const finalized = await finalizeInvoice(actor, organizationId, invoice.id, ip);
  row.pharmacyInvoiceId = new mongoose.Types.ObjectId(finalized.id);
  row.pharmacyInvoiceNumber = finalized.invoiceNumber || '';
  row.billingStatus = 'awaiting_payment';
  row.history = [
    ...(row.history || []),
    {
      at: new Date(),
      userName: actor.role,
      action: 'QUOTE_CONFIRMED',
      comment: `Facture ${finalized.invoiceNumber} · ${row.quoteTotal} ${currency}`,
    },
  ];
  await row.save();

  await notifyRoles({
    organizationId,
    roles: [ROLES.RECEPTIONIST, ROLES.ACCOUNTANT, ROLES.HOSPITAL_ADMIN],
    type: 'billing',
    relatedId: finalized.id,
    title: 'Facture pharmacie à encaisser',
    message: `${row.patientName} : ordonnance ${row.pharmacyInvoiceNumber || finalized.invoiceNumber} — ${row.quoteTotal} ${currency}.`,
  });

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'PRESCRIPTION_QUOTE_CONFIRMED',
    resourceType: 'prescription',
    resourceId: row.id,
    success: true,
    ip,
    metadata: { invoiceId: finalized.id, total: row.quoteTotal },
  });

  return row;
}

export async function authorizeDispenseForPaidInvoice(
  actor: AuthContext,
  organizationId: string,
  invoiceId: string,
) {
  const row = await Prescription.findOne({
    organizationId,
    pharmacyInvoiceId: invoiceId,
    billingStatus: { $in: ['awaiting_payment', 'invoiced', 'paid'] },
  });
  if (!row) return null;

  const invoice = await Invoice.findOne({ _id: invoiceId, organizationId }).select('status invoiceNumber paidAt paymentReference paymentMethod');
  if (!invoice) return null;
  if (invoice.status !== 'paid') return null;

  if (row.billingStatus === 'paid' && row.dispenseAuthorizedAt) {
    return row;
  }

  row.billingStatus = 'paid';
  row.pharmacyPaidAt = invoice.paidAt || new Date();
  row.dispenseAuthorizedAt = new Date();
  row.pharmacyInvoiceNumber = invoice.invoiceNumber || row.pharmacyInvoiceNumber;
  row.history = [
    ...(row.history || []),
    {
      at: new Date(),
      userName: actor.role,
      action: 'PAYMENT_CONFIRMED',
      comment: `Facture ${invoice.invoiceNumber}${invoice.paymentReference ? ` · réf. ${invoice.paymentReference}` : ''}`,
    },
  ];
  await row.save();

  await notifyRoles({
    organizationId,
    roles: [ROLES.PHARMACIST, ROLES.HOSPITAL_ADMIN],
    type: 'pharmacy',
    relatedId: row.id,
    title: 'Ordonnance payée — délivrance autorisée',
    message: `${row.patientName} : paiement confirmé (${invoice.invoiceNumber}). Vous pouvez délivrer.`,
  });

  return row;
}

export async function assertDispenseAuthorized(row: InstanceType<typeof Prescription>) {
  if (row.billingStatus === 'cancelled') {
    throw new ApiError(409, 'Ordonnance annulée — délivrance impossible', 'PRESCRIPTION_CANCELLED');
  }
  if (row.billingStatus === 'awaiting_payment' || row.billingStatus === 'invoiced') {
    throw new ApiError(409, 'Le paiement de la facture pharmacie n\'est pas encore confirmé', 'PAYMENT_REQUIRED');
  }
  if (row.billingStatus === 'awaiting_invoice') {
    throw new ApiError(409, 'La facturation de l\'ordonnance n\'est pas terminée', 'INVOICE_PENDING');
  }
  // Legacy (avant phase 4) : pas de facture pharmacie → délivrance libre pour ne pas casser l’existant.
  if (row.billingStatus === 'none' || row.billingStatus === 'quoted') {
    return;
  }
  if (row.billingStatus !== 'paid' || !row.dispenseAuthorizedAt) {
    throw new ApiError(409, 'Délivrance non autorisée tant que le paiement n\'est pas confirmé', 'PAYMENT_REQUIRED');
  }
}

export async function markLineChargePerformed(
  actor: AuthContext,
  organizationId: string,
  prescriptionId: string,
  itemId: string,
  note: string,
  ip?: string,
) {
  await syncOriginStatus(actor, organizationId, 'pharmacy', chargeOriginId(prescriptionId, itemId), 'performed', note, ip);
}

export async function cancelPrescriptionBilling(
  actor: AuthContext,
  organizationId: string,
  id: string,
  reason: string,
  ip?: string,
) {
  const row = await requireOwned(Prescription, id, organizationId, actor, 'prescription', ip);
  if (row.billingStatus === 'paid' && row.items.some((item) => item.quantityDispensed > 0)) {
    throw new ApiError(409, 'Annulation impossible après délivrance d\'une ordonnance payée', 'ALREADY_DISPENSED');
  }
  if (row.pharmacyInvoiceId) {
    const invoice = await Invoice.findOne({ _id: row.pharmacyInvoiceId, organizationId });
    if (invoice?.status === 'paid') {
      throw new ApiError(409, 'Annulez ou remboursez d\'abord via la caisse — facture déjà payée', 'INVOICE_PAID');
    }
    if (invoice && (invoice.status === 'draft' || invoice.status === 'pending' || invoice.status === 'overdue')) {
      invoice.status = 'cancelled';
      await invoice.save();
    }
    await PatientCharge.updateMany(
      { organizationId, originModule: 'pharmacy', originId: { $regex: `^rxline:${row.id}:` } },
      { $set: { realizationStatus: 'cancelled' } },
    );
  }
  row.billingStatus = 'cancelled';
  row.dispenseAuthorizedAt = undefined;
  row.history = [
    ...(row.history || []),
    { at: new Date(), userName: actor.role, action: 'BILLING_CANCELLED', comment: reason.trim() || 'Annulation' },
  ];
  await row.save();
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'PRESCRIPTION_BILLING_CANCELLED',
    resourceType: 'prescription',
    resourceId: row.id,
    success: true,
    ip,
    metadata: { reason },
  });
  return row;
}

/** Après analyse auto, marquer le devis comme « quoted » s’il n’est pas déjà plus avancé. */
export function bumpQuotedStatus(row: InstanceType<typeof Prescription>) {
  if (row.billingStatus === 'none') row.billingStatus = 'quoted';
}
