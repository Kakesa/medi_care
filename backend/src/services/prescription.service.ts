import mongoose from 'mongoose';
import { ROLES } from '../config/permissions.js';
import { Consultation } from '../models/Consultation.js';
import { PharmacyProduct } from '../models/PharmacyProduct.js';
import { MedicationAdministration } from '../models/MedicationAdministration.js';
import { Personnel } from '../models/Personnel.js';
import { Prescription } from '../models/Prescription.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthContext } from '../types/express.js';
import { requireOwned, requireVisiblePatient } from './access.service.js';
import { recordCharge } from './charge.service.js';
import { notifyRoles } from './notification.service.js';
import { recordAudit } from './audit.service.js';
import { organizationCurrency } from './catalog.service.js';
import { postStock } from './stock.service.js';
import { analysisToDto, applyPrescriptionQuote } from './prescriptionQuote.service.js';
import {
  assertDispenseAuthorized,
  cancelPrescriptionBilling,
  confirmPrescriptionQuote,
  markLineChargePerformed,
} from './prescriptionBilling.service.js';

type Item = {
  id?: string;
  _id?: { toString(): string };
  medication: string;
  dosage: string;
  posology: string;
  administrationRoute?: string;
  form?: string;
  frequency?: string;
  duration: string;
  treatmentStartDate?: string;
  treatmentEndDate?: string;
  administrationTimes?: string[];
  treatmentStatus?: 'active' | 'suspended' | 'completed' | 'interrupted';
  treatmentStatusHistory?: Array<{ status: string; changedAt: Date; changedBy: { toString(): string }; reason: string }>;
  instructions?: string;
  quantityPrescribed: number;
  quantityDispensed: number;
  unavailable?: boolean;
  unavailableNote?: string;
  analysis?: Record<string, unknown>;
};

function itemId(item: Item, index: number) {
  return item.id || item._id?.toString() || String(index);
}

function derivePharmacyStatus(items: Item[], preparing: boolean, closed: boolean) {
  if (closed) return 'closed';
  const touched = items.some((item) => item.quantityDispensed > 0 || item.unavailable);
  const done = items.every((item) => item.unavailable || item.quantityDispensed >= item.quantityPrescribed);
  if (done && touched) return 'delivered';
  if (touched) return 'partial';
  if (preparing) return 'preparing';
  return 'new';
}

function toDto(source: object) {
  const row = source as {
    id: string;
    patientId: { toString(): string };
    patientName: string;
    prescriberName: string;
    examId?: { toString(): string } | null;
    consultationId?: { toString(): string } | null;
    recommendations?: string;
    items: Item[];
    status: string;
    pharmacyStatus: string;
    quoteStatus?: string;
    quoteTotal?: number;
    quoteCurrency?: string;
    quotePendingLines?: number;
    quotedAt?: Date | null;
    validatedAt?: Date | null;
    history?: Array<{ at?: Date; userName?: string; action?: string; comment?: string }>;
    createdAt?: Date;
  };
  return {
    id: row.id,
    patientId: row.patientId.toString(),
    patientName: row.patientName,
    prescriberName: row.prescriberName,
    examId: row.examId?.toString(),
    consultationId: row.consultationId?.toString(),
    recommendations: row.recommendations || undefined,
    items: row.items.map((item, index) => ({
      id: itemId(item, index),
      medication: item.medication,
      dosage: item.dosage,
      posology: item.posology,
      administrationRoute: item.administrationRoute,
      form: item.form || undefined,
      frequency: item.frequency || undefined,
      duration: item.duration,
      treatmentStartDate: item.treatmentStartDate,
      treatmentEndDate: item.treatmentEndDate,
      administrationTimes: item.administrationTimes ?? [],
      treatmentStatus: item.treatmentStatus ?? 'active',
      treatmentStatusHistory: item.treatmentStatusHistory ?? [],
      actualTreatmentEndAt: item.treatmentStatusHistory?.findLast((change) => change.status === 'completed' || change.status === 'interrupted')?.changedAt,
      instructions: item.instructions || '',
      quantityPrescribed: item.quantityPrescribed,
      quantityDispensed: item.quantityDispensed,
      unavailable: Boolean(item.unavailable),
      unavailableNote: item.unavailableNote || '',
      analysis: analysisToDto(item.analysis),
    })),
    status: row.status,
    pharmacyStatus: row.pharmacyStatus,
    quoteStatus: row.quoteStatus || 'none',
    quoteTotal: row.quoteTotal || 0,
    quoteCurrency: row.quoteCurrency || 'EUR',
    quotePendingLines: row.quotePendingLines || 0,
    quotedAt: row.quotedAt || undefined,
    billingStatus: (row as { billingStatus?: string }).billingStatus || 'none',
    pharmacyInvoiceId: (row as { pharmacyInvoiceId?: { toString(): string } | null }).pharmacyInvoiceId?.toString() || undefined,
    pharmacyInvoiceNumber: (row as { pharmacyInvoiceNumber?: string }).pharmacyInvoiceNumber || undefined,
    dispenseAuthorizedAt: (row as { dispenseAuthorizedAt?: Date | null }).dispenseAuthorizedAt || undefined,
    pharmacyPaidAt: (row as { pharmacyPaidAt?: Date | null }).pharmacyPaidAt || undefined,
    validatedAt: row.validatedAt,
    history: row.history || [],
    createdAt: row.createdAt,
  };
}

async function actorName(actor: AuthContext) {
  const user = await User.findById(actor.id).select('firstName lastName role');
  if (!user) return actor.role;
  const title = user.role === ROLES.DOCTOR ? 'Dr. ' : '';
  return `${title}${user.firstName} ${user.lastName}`;
}

export async function listPrescriptions(actor: AuthContext, organizationId: string, query?: { patientId?: string; consultationId?: string }) {
  const filter: Record<string, unknown> = { organizationId };
  if (actor.role === ROLES.PHARMACIST) filter.status = 'validated';
  if (query?.patientId) filter.patientId = query.patientId;
  if (query?.consultationId) filter.consultationId = query.consultationId;
  const rows = await Prescription.find(filter).sort({ createdAt: -1 }).limit(200);
  return rows.map((row) => toDto(row));
}

export async function createPrescription(
  actor: AuthContext,
  organizationId: string,
  input: {
    patientId: string;
    examId?: string;
    items: Array<{ medication: string; dosage: string; posology: string;     administrationRoute?: string; form?: string; frequency?: string; duration: string; treatmentStartDate?: string; treatmentEndDate?: string; administrationTimes?: string[]; instructions?: string; quantityPrescribed: number }>;
  },
  ip?: string
) {
  const patient = await requireVisiblePatient(actor, organizationId, input.patientId, ip);
  const name = await actorName(actor);
  const row = await Prescription.create({
    organizationId,
    patientId: patient._id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    prescriberId: actor.id,
    prescriberName: name,
    examId: input.examId,
    items: input.items.map((item) => ({ ...item, instructions: item.instructions?.trim() || '', quantityDispensed: 0 })),
    status: 'draft',
    pharmacyStatus: 'new',
    history: [{ at: new Date(), userName: name, action: 'CREATION', comment: '' }],
  });
  await recordAudit({ actorId: actor.id, actorRole: actor.role, organizationId, action: 'PRESCRIPTION_CREATED', resourceType: 'prescription', resourceId: row.id, success: true, ip });
  return toDto(row);
}

type ConsultationItem = {
  medication: string;
  dosage: string;
  posology: string;
  administrationRoute?: string;
  form?: string;
  frequency?: string;
  duration: string;
  instructions?: string;
  quantityPrescribed: number;
};

export async function saveConsultationPrescription(
  actor: AuthContext,
  organizationId: string,
  input: { consultationId: string; recommendations?: string; items: ConsultationItem[] },
  ip?: string
) {
  const consultation = await Consultation.findOne({ _id: input.consultationId, organizationId });
  if (!consultation) throw new ApiError(404, 'Consultation introuvable');
  await requireVisiblePatient(actor, organizationId, consultation.patientId.toString(), ip);
  const current = await Prescription.findOne({ organizationId, consultationId: consultation._id });
  if (current?.items.some((item) => item.quantityDispensed > 0)) {
    throw new ApiError(409, 'Cette ordonnance a déjà été délivrée', 'PRESCRIPTION_DISPENSED');
  }
  const items = input.items.filter((item) => item.medication.trim());
  if (!items.length) {
    if (current?.status === 'draft') await current.deleteOne();
    if (current && current.status !== 'draft') {
      throw new ApiError(409, 'Une ordonnance déjà validée ne peut pas être vidée', 'PRESCRIPTION_VALIDATED');
    }
    return { cleared: true };
  }
  const doctor = await Personnel.findById(consultation.doctorId).select('userId');
  const recommendations = input.recommendations?.trim() || '';
  const mapped = items.map((item) => ({
    ...item,
    medication: item.medication.trim(),
    instructions: item.instructions?.trim() || '',
    quantityDispensed: 0,
  }));
  if (!current) {
    const created = await Prescription.create({
      organizationId,
      patientId: consultation.patientId,
      patientName: consultation.patientName,
      prescriberId: doctor?.userId || actor.id,
      prescriberName: consultation.doctorName,
      consultationId: consultation._id,
      recommendations,
      items: mapped,
      status: 'draft',
      pharmacyStatus: 'new',
      history: [{ at: new Date(), userName: consultation.doctorName, action: 'CREATION', comment: 'Ordonnance de consultation' }],
    });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, organizationId, action: 'PRESCRIPTION_CREATED', resourceType: 'prescription', resourceId: created.id, success: true, ip });
    return toDto(created);
  }
  current.patientName = consultation.patientName;
  current.prescriberName = consultation.doctorName;
  current.set('recommendations', recommendations);
  current.items = mapped as typeof current.items;
  current.history = [...(current.history || []), { at: new Date(), userName: consultation.doctorName, action: 'MODIFICATION', comment: '' }];
  await current.save();
  await recordAudit({ actorId: actor.id, actorRole: actor.role, organizationId, action: 'PRESCRIPTION_UPDATED', resourceType: 'prescription', resourceId: current.id, success: true, ip });
  return toDto(current);
}

export async function validatePrescription(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(Prescription, id, organizationId, actor, 'prescription', ip);
  if (row.status === 'validated') {
    if (!row.quotedAt) {
      await applyPrescriptionQuote(organizationId, row.id);
      const refreshed = await Prescription.findById(row.id);
      return toDto(refreshed || row);
    }
    return toDto(row);
  }
  row.status = 'validated';
  row.validatedAt = new Date();
  row.history = [...(row.history || []), { at: new Date(), userName: await actorName(actor), action: 'VALIDATION', comment: '' }];
  await row.save();
  await applyPrescriptionQuote(organizationId, row.id);
  await notifyRoles({
    organizationId,
    roles: [ROLES.PHARMACIST],
    type: 'pharmacy',
    relatedId: row.id,
    title: 'Nouvelle ordonnance',
    message: `Ordonnance de ${row.patientName} prescrite par ${row.prescriberName}.`,
  });
  await recordAudit({ actorId: actor.id, actorRole: actor.role, organizationId, action: 'PRESCRIPTION_VALIDATED', resourceType: 'prescription', resourceId: row.id, success: true, ip });
  const quoted = await Prescription.findById(row.id);
  return toDto(quoted || row);
}

export async function getPrescriptionQuoteDto(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const { getPrescriptionQuote } = await import('./prescriptionQuote.service.js');
  const row = await getPrescriptionQuote(actor, organizationId, id, ip);
  return toDto(row);
}

export async function refreshPrescriptionQuoteDto(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const { refreshPrescriptionQuote } = await import('./prescriptionQuote.service.js');
  const row = await refreshPrescriptionQuote(actor, organizationId, id, ip);
  return toDto(row);
}

export async function updatePrescriptionItemStatus(
  actor: AuthContext,
  organizationId: string,
  prescriptionId: string,
  itemId: string,
  input: { status: 'active' | 'suspended' | 'completed' | 'interrupted'; reason: string },
  ip?: string
) {
  const prescription = await Prescription.findOne({ _id: prescriptionId, organizationId, status: 'validated' });
  if (!prescription) throw new ApiError(404, 'Prescription validée introuvable', 'PRESCRIPTION_NOT_FOUND');
  await requireVisiblePatient(actor, organizationId, prescription.patientId.toString(), ip);
  const item = prescription.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new ApiError(404, 'Ligne de prescription introuvable', 'PRESCRIPTION_ITEM_NOT_FOUND');
  const currentStatus = item.treatmentStatus ?? 'active';
  if (currentStatus === input.status) return toDto(prescription);
  if (currentStatus === 'completed' || currentStatus === 'interrupted') {
    throw new ApiError(409, 'Un traitement terminé ou interrompu ne peut pas être réactivé', 'TREATMENT_CLOSED');
  }
  const now = new Date();
  item.treatmentStatus = input.status;
  item.treatmentStatusHistory.push({ status: input.status, changedAt: now, changedBy: new mongoose.Types.ObjectId(actor.id), reason: input.reason });
  prescription.history = [...(prescription.history || []), {
    at: now,
    userName: await actorName(actor),
    action: `TRAITEMENT_${input.status.toUpperCase()}`,
    comment: `${item.medication} · ${input.reason}`,
  }];
  await prescription.save();

  const futureFilter = {
    organizationId,
    prescriptionId: prescription._id,
    prescriptionItemId: item._id,
    scheduledAt: { $gte: now },
  };
  if (input.status === 'active') {
    await MedicationAdministration.updateMany({ ...futureFilter, status: 'suspended' }, {
      $set: { status: 'pending' },
      $push: { history: { actorId: actor.id, action: 'TREATMENT_RESUMED', at: now, reason: input.reason } },
    });
  } else {
    const nextDoseStatus = input.status === 'suspended'
      ? 'suspended'
      : input.status === 'completed' ? 'treatment_completed' : 'treatment_interrupted';
    await MedicationAdministration.updateMany({ ...futureFilter, status: { $in: ['pending', 'suspended'] } }, {
      $set: { status: nextDoseStatus },
      $push: { history: { actorId: actor.id, action: `TREATMENT_${input.status.toUpperCase()}`, at: now, reason: input.reason } },
    });
  }
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'PRESCRIPTION_ITEM_STATUS_CHANGED',
    resourceType: 'prescription', resourceId: prescription.id, success: true, ip,
    metadata: { itemId, from: currentStatus, to: input.status },
  });
  return toDto(prescription);
}

function refreshStatus(row: { items: Item[]; pharmacyStatus: string; set: (path: string, value: unknown) => unknown }) {
  const preparing = row.pharmacyStatus === 'preparing';
  const closed = row.pharmacyStatus === 'closed';
  row.set('pharmacyStatus', derivePharmacyStatus(row.items, preparing, closed));
}

export async function preparePrescription(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(Prescription, id, organizationId, actor, 'prescription', ip);
  if (row.status !== 'validated') throw new ApiError(409, 'L\'ordonnance n\'est pas validée', 'PRESCRIPTION_DRAFT');
  if (row.pharmacyStatus === 'new') row.pharmacyStatus = 'preparing';
  row.history = [...(row.history || []), { at: new Date(), userName: await actorName(actor), action: 'PREPARATION', comment: '' }];
  await row.save();
  return toDto(row);
}

export async function dispensePrescription(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: { itemIndex: number; productId: string; quantity: number },
  ip?: string
) {
  const row = await requireOwned(Prescription, id, organizationId, actor, 'prescription', ip);
  if (row.status !== 'validated') throw new ApiError(409, 'L\'ordonnance n\'est pas validée', 'PRESCRIPTION_DRAFT');
  await assertDispenseAuthorized(row);
  const item = row.items[input.itemIndex];
  if (!item) throw new ApiError(400, 'Ligne d\'ordonnance introuvable', 'VALIDATION_ERROR');
  if (item.unavailable) throw new ApiError(409, 'Ce médicament est signalé indisponible', 'UNAVAILABLE');
  const remaining = item.quantityPrescribed - item.quantityDispensed;
  if (input.quantity > remaining) throw new ApiError(409, 'La quantité dépasse l\'ordonnance', 'QUANTITY');
  const product = await PharmacyProduct.findOne({ _id: input.productId, organizationId, archivedAt: null, active: { $ne: false } });
  if (!product) throw new ApiError(404, 'Produit introuvable', 'NOT_FOUND');
  const currency = await organizationCurrency(organizationId);
  if (product.currency && product.currency !== currency) {
    throw new ApiError(409, 'La devise du produit ne correspond pas à celle de l\'établissement', 'CURRENCY_MISMATCH');
  }
  const nextQuantity = item.quantityDispensed + input.quantity;
  await postStock(actor, organizationId, {
    productId: product.id,
    quantity: input.quantity,
    direction: 'out',
    type: 'dispense',
    reason: `Ordonnance ${row.id}`,
    sourceType: 'prescription',
    sourceId: row.id,
    idempotencyKey: `rx:${row.id}:${input.itemIndex}:${nextQuantity}`,
  }, ip);
  item.quantityDispensed = nextQuantity;
  refreshStatus(row);
  row.markModified('items');
  row.history = [...(row.history || []), {
    at: new Date(),
    userName: await actorName(actor),
    action: 'DELIVRANCE',
    comment: `${product.name} × ${input.quantity}`,
  }];
  await row.save();

  const billedViaQuote = row.billingStatus === 'paid' && Boolean(row.pharmacyInvoiceId);
  if (billedViaQuote) {
    const lineId = item.id || item._id?.toString() || String(input.itemIndex);
    await markLineChargePerformed(
      actor,
      organizationId,
      row.id,
      lineId,
      `Délivrance ${product.name} × ${input.quantity}`,
      ip,
    );
  } else {
    // Ancien circuit (sans devis facturé) : charge à la délivrance, une seule fois via originId cumulatif.
    await recordCharge(actor, organizationId, {
      patientId: row.patientId.toString(),
      originModule: 'pharmacy',
      originId: `rx:${row.id}:${input.itemIndex}:${nextQuantity}`,
      quantity: input.quantity,
      catalogKind: 'pharmacy',
      pharmacyLine: {
        label: product.name,
        unitPrice: product.price,
        category: 'MEDICAMENT',
        productId: product.id,
      },
    }, ip);
  }
  return toDto(row);
}

export async function confirmQuoteDto(
  actor: AuthContext,
  organizationId: string,
  id: string,
  body: { lines?: Array<{ itemId: string; quantityValidated: number; productId?: string }> },
  ip?: string,
) {
  const row = await confirmPrescriptionQuote(actor, organizationId, id, body, ip);
  return toDto(row);
}

export async function cancelBillingDto(
  actor: AuthContext,
  organizationId: string,
  id: string,
  body: { reason?: string },
  ip?: string,
) {
  const row = await cancelPrescriptionBilling(actor, organizationId, id, body.reason || 'Annulation', ip);
  return toDto(row);
}

export async function markUnavailable(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: { itemIndex: number; note: string },
  ip?: string
) {
  const row = await requireOwned(Prescription, id, organizationId, actor, 'prescription', ip);
  if (row.status !== 'validated') throw new ApiError(409, 'L\'ordonnance n\'est pas validée', 'PRESCRIPTION_DRAFT');
  const item = row.items[input.itemIndex];
  if (!item) throw new ApiError(400, 'Ligne d\'ordonnance introuvable', 'VALIDATION_ERROR');
  item.unavailable = true;
  item.unavailableNote = input.note.trim();
  refreshStatus(row);
  row.markModified('items');
  row.history = [...(row.history || []), { at: new Date(), userName: await actorName(actor), action: 'INDISPONIBLE', comment: input.note.trim() }];
  await row.save();
  return toDto(row);
}

export async function closePrescription(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(Prescription, id, organizationId, actor, 'prescription', ip);
  if (row.status !== 'validated') throw new ApiError(409, 'L\'ordonnance n\'est pas validée', 'PRESCRIPTION_DRAFT');
  const open = row.items.some((item: Item) => !item.unavailable && item.quantityDispensed < item.quantityPrescribed);
  if (open) throw new ApiError(409, 'Il reste des médicaments à délivrer ou à signaler', 'PRESCRIPTION_OPEN');
  row.pharmacyStatus = 'closed';
  row.history = [...(row.history || []), { at: new Date(), userName: await actorName(actor), action: 'CLOTURE', comment: '' }];
  await row.save();
  return toDto(row);
}
