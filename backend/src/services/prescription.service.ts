import { ROLES } from '../config/permissions.js';
import { PharmacyProduct } from '../models/PharmacyProduct.js';
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

type Item = {
  id?: string;
  _id?: { toString(): string };
  medication: string;
  dosage: string;
  posology: string;
  administrationRoute?: string;
  duration: string;
  instructions?: string;
  quantityPrescribed: number;
  quantityDispensed: number;
  unavailable?: boolean;
  unavailableNote?: string;
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
    items: Item[];
    status: string;
    pharmacyStatus: string;
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
    items: row.items.map((item, index) => ({
      id: itemId(item, index),
      medication: item.medication,
      dosage: item.dosage,
      posology: item.posology,
      administrationRoute: item.administrationRoute,
      duration: item.duration,
      instructions: item.instructions || '',
      quantityPrescribed: item.quantityPrescribed,
      quantityDispensed: item.quantityDispensed,
      unavailable: Boolean(item.unavailable),
      unavailableNote: item.unavailableNote || '',
    })),
    status: row.status,
    pharmacyStatus: row.pharmacyStatus,
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

export async function listPrescriptions(actor: AuthContext, organizationId: string, patientId?: string) {
  const filter: Record<string, unknown> = { organizationId };
  if (actor.role === ROLES.PHARMACIST) filter.status = 'validated';
  if (patientId) filter.patientId = patientId;
  const rows = await Prescription.find(filter).sort({ createdAt: -1 }).limit(200);
  return rows.map((row) => toDto(row));
}

export async function createPrescription(
  actor: AuthContext,
  organizationId: string,
  input: {
    patientId: string;
    examId?: string;
    items: Array<{ medication: string; dosage: string; posology: string; administrationRoute?: string; duration: string; instructions?: string; quantityPrescribed: number }>;
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

export async function validatePrescription(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(Prescription, id, organizationId, actor, 'prescription', ip);
  if (row.status === 'validated') return toDto(row);
  row.status = 'validated';
  row.validatedAt = new Date();
  row.history = [...(row.history || []), { at: new Date(), userName: await actorName(actor), action: 'VALIDATION', comment: '' }];
  await row.save();
  await notifyRoles({
    organizationId,
    roles: [ROLES.PHARMACIST],
    type: 'pharmacy',
    relatedId: row.id,
    title: 'Nouvelle ordonnance',
    message: `Ordonnance de ${row.patientName} prescrite par ${row.prescriberName}.`,
  });
  await recordAudit({ actorId: actor.id, actorRole: actor.role, organizationId, action: 'PRESCRIPTION_VALIDATED', resourceType: 'prescription', resourceId: row.id, success: true, ip });
  return toDto(row);
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
