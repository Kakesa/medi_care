import { BILLING_CATEGORIES, type BillingCurrency } from '../domain/billingCategories.js';
import { BillableService } from '../models/BillableService.js';
import { Invoice } from '../models/Invoice.js';
import { PatientCharge } from '../models/PatientCharge.js';
import { SurgicalAct } from '../models/SurgicalAct.js';
import { SurgicalCategory } from '../models/SurgicalCategory.js';
import { User } from '../models/User.js';
import { ROLES } from '../config/permissions.js';
import { ApiError } from '../utils/ApiError.js';
import { fromMinorUnits } from '../utils/money.js';
import type { AuthContext } from '../types/express.js';
import { requireOwned, requireVisiblePatient } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { organizationCurrency } from './catalog.service.js';
import { ensureSurgicalSeed, priceSurgicalAct } from './surgery.service.js';

const ORIGINS = ['acts', 'consultation', 'exam', 'pharmacy', 'hospitalization'] as const;
type OriginModule = (typeof ORIGINS)[number];
type Realization = 'recommended' | 'pending' | 'performed' | 'cancelled';

type ChargeRow = {
  id?: string;
  _id: { toString(): string };
  patientId: { toString(): string };
  patientName: string;
  originModule: OriginModule;
  originId: string;
  catalogKind: string;
  catalogItemId?: { toString(): string } | null;
  label: string;
  detail?: string;
  category: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  currency: string;
  prescriberId?: { toString(): string } | null;
  prescriberName: string;
  prescribedAt: Date;
  realizationStatus: Realization;
  invoiceId?: { toString(): string } | null;
  history?: Array<{ at: Date; actorName: string; action: string; from?: string; to?: string; note?: string }>;
  save(): Promise<unknown>;
  set(path: string, value: unknown): unknown;
};

export type RecordChargeInput = {
  patientId: string;
  originModule: OriginModule;
  originId: string;
  quantity?: number;
  prescriberName?: string;
  catalogKind: 'surgery' | 'service' | 'pharmacy';
  catalogItemId?: string;
  pharmacyLine?: { label: string; unitPrice: number; category: string; productId?: string };
};

function idOf(row: { id?: string; _id: { toString(): string } }) {
  return row.id ?? row._id.toString();
}

function duplicateKey(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 11000);
}

function paymentStatus(invoice?: { status: string; dueDate?: Date | null } | null) {
  if (!invoice) return 'unbilled';
  if (invoice.status === 'pending' && invoice.dueDate && invoice.dueDate < new Date()) return 'overdue';
  return invoice.status;
}

function toDto(row: ChargeRow, invoice?: { id?: string; _id: { toString(): string }; invoiceNumber: string; status: string; dueDate?: Date | null } | null) {
  return {
    id: idOf(row),
    patientId: row.patientId.toString(),
    patientName: row.patientName,
    originModule: row.originModule,
    originId: row.originId,
    catalogKind: row.catalogKind,
    catalogItemId: row.catalogItemId ? String(row.catalogItemId) : undefined,
    label: row.label,
    detail: row.detail || '',
    category: row.category,
    unit: row.unit || 'acte',
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    total: row.total,
    currency: row.currency,
    prescriberName: row.prescriberName,
    prescribedAt: row.prescribedAt,
    realizationStatus: row.realizationStatus,
    paymentStatus: paymentStatus(invoice),
    invoiceId: invoice ? idOf(invoice) : row.invoiceId ? String(row.invoiceId) : undefined,
    invoiceNumber: invoice?.invoiceNumber,
    history: (row.history ?? []).slice(-20).map((entry) => ({
      at: entry.at,
      actorName: entry.actorName,
      action: entry.action,
      from: entry.from || '',
      to: entry.to || '',
      note: entry.note || '',
    })),
  };
}

async function actorLabel(actor: AuthContext) {
  const user = await User.findById(actor.id).select('firstName lastName');
  return user ? `${user.firstName} ${user.lastName}` : 'Professionnel';
}

function remember(
  charge: ChargeRow,
  actorId: string,
  actorName: string,
  action: string,
  from: string,
  to: string,
  note: string
) {
  const history = [...(charge.history ?? []), { at: new Date(), actorId, actorName, action, from, to, note }];
  charge.set('history', history.slice(-40));
}

async function nextNumber(organizationId: string) {
  const year = new Date().getUTCFullYear();
  const count = await Invoice.countDocuments({
    organizationId,
    invoiceNumber: new RegExp(`^FAC-${year}-`),
  });
  return `FAC-${year}-${String(count + 1).padStart(3, '0')}`;
}

function lineFrom(charge: ChargeRow) {
  return {
    description: charge.label,
    detail: charge.detail || '',
    quantity: charge.quantity,
    unitPrice: charge.unitPrice,
    total: charge.total,
    type: 'service',
    category: charge.category,
    catalogItemId: charge.catalogKind === 'service' ? charge.catalogItemId : undefined,
    surgicalActId: charge.catalogKind === 'surgery' ? charge.catalogItemId : undefined,
    unit: charge.unit || 'acte',
    source: charge.catalogKind === 'surgery' ? 'surgery' : charge.catalogKind === 'pharmacy' ? 'pharmacy' : 'catalog',
    chargeId: charge._id,
    prescriberName: charge.prescriberName,
    prescribedAt: charge.prescribedAt,
    realizationStatus: charge.realizationStatus,
    originModule: charge.originModule,
    referenceId: charge.originId,
  };
}

function applyTotals(invoice: { items: Array<{ total: number }>; subtotal: number; tax: number; discount: number; total: number }) {
  const subtotal = invoice.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  invoice.subtotal = subtotal;
  invoice.tax = 0;
  invoice.discount = 0;
  invoice.total = subtotal;
}

async function attach(actor: AuthContext, organizationId: string, charge: ChargeRow) {
  if (charge.realizationStatus === 'cancelled') return charge;
  const current = charge.invoiceId
    ? await Invoice.findOne({ _id: charge.invoiceId, organizationId })
    : null;
  if (current && current.status !== 'cancelled') return charge;

  let invoice = await Invoice.findOne({
    organizationId,
    patientId: charge.patientId,
    status: 'draft',
    currency: charge.currency,
  }).sort({ createdAt: -1 });

  const line = lineFrom(charge);
  if (!invoice) {
    invoice = await Invoice.create({
      organizationId,
      invoiceNumber: await nextNumber(organizationId),
      patientId: charge.patientId,
      patientName: charge.patientName,
      date: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: [line],
      subtotal: line.total,
      tax: 0,
      discount: 0,
      total: line.total,
      currency: charge.currency,
      status: 'draft',
      notes: 'Opérations transmises par les modules de soins.',
      createdBy: actor.id,
    });
  } else if (!invoice.items.some((item) => String(item.chargeId ?? '') === idOf(charge))) {
    invoice.items.push(line);
    applyTotals(invoice);
    await invoice.save();
  }

  const saved = invoice.items.find((item) => String(item.chargeId ?? '') === idOf(charge));
  charge.set('invoiceId', invoice._id);
  charge.set('invoiceItemId', saved?._id);
  await charge.save();
  return charge;
}

async function pricedLine(
  actor: AuthContext,
  organizationId: string,
  input: RecordChargeInput,
  quantity: number,
  ip?: string
) {
  if (input.catalogKind === 'pharmacy') {
    const line = input.pharmacyLine;
    if (!line) throw new ApiError(400, 'Ligne de pharmacie incomplète', 'VALIDATION_ERROR');
    const currency = await organizationCurrency(organizationId);
    return {
      label: line.label,
      detail: '',
      category: line.category || 'MEDICAMENT',
      unit: 'unite',
      unitPrice: line.unitPrice,
      total: line.unitPrice * quantity,
      currency,
      catalogItemId: line.productId,
    };
  }
  if (!input.catalogItemId) throw new ApiError(400, 'Acte du catalogue requis', 'VALIDATION_ERROR');
  if (input.catalogKind === 'surgery') {
    const priced = await priceSurgicalAct(actor, organizationId, input.catalogItemId, quantity, ip);
    const currency = await organizationCurrency(organizationId);
    return {
      label: priced.description,
      detail: priced.detail || '',
      category: priced.category,
      unit: priced.unit,
      unitPrice: priced.unitPrice,
      total: priced.total,
      currency,
      catalogItemId: input.catalogItemId,
    };
  }
  const service = await requireOwned(BillableService, input.catalogItemId, organizationId, actor, 'billable_service', ip);
  if (!service.active) throw new ApiError(409, `La prestation ${service.code} n'est plus active`, 'SERVICE_INACTIVE');
  const currency = await organizationCurrency(organizationId);
  if (service.currency !== currency) {
    throw new ApiError(409, `La prestation ${service.code} est tarifée en ${service.currency}. Mettez à jour son prix dans la devise de l'établissement.`, 'CURRENCY_MISMATCH');
  }
  return {
    label: service.name as string,
    detail: (service.description as string) || '',
    category: service.category as string,
    unit: service.unit as string,
    unitPrice: service.unitPrice as number,
    total: quantity * (service.unitPrice as number),
    currency,
    catalogItemId: input.catalogItemId,
  };
}

async function rejectOpenDuplicate(
  organizationId: string,
  patientId: string,
  catalogKind: string,
  catalogItemId: string
) {
  const open = await PatientCharge.find({
    organizationId,
    patientId,
    originModule: 'acts',
    catalogKind,
    catalogItemId,
    realizationStatus: { $ne: 'cancelled' },
  });
  for (const row of open) {
    if (!row.invoiceId) {
      throw new ApiError(409, 'Cet acte est déjà transmis pour ce patient. Modifiez la quantité au lieu de le renvoyer.', 'DUPLICATE_ACT');
    }
    const invoice = await Invoice.findById(row.invoiceId).select('status');
    if (!invoice || (invoice.status !== 'paid' && invoice.status !== 'cancelled')) {
      throw new ApiError(409, 'Cet acte est déjà transmis pour ce patient. Modifiez la quantité au lieu de le renvoyer.', 'DUPLICATE_ACT');
    }
  }
}

export async function listCatalog(actor: AuthContext, organizationId: string) {
  await ensureSurgicalSeed(actor, organizationId);
  const currency = await organizationCurrency(organizationId);
  const [acts, services, categories] = await Promise.all([
    SurgicalAct.find({ organizationId, active: true, currency, priceMinor: { $ne: null } }).sort({ name: 1 }),
    BillableService.find({ organizationId, active: true, currency }).sort({ name: 1 }),
    SurgicalCategory.find({ organizationId }),
  ]);
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const items = [
    ...acts.filter((act) => act.priceMinor != null).map((act) => ({
      id: act.id,
      kind: 'surgery' as const,
      name: act.name,
      category: 'CHIRURGIE',
      categoryLabel: names.get(String(act.categoryId)) || 'Chirurgie',
      description: act.description || '',
      unitPrice: fromMinorUnits(act.priceMinor ?? 0),
      unit: 'acte',
      currency,
    })),
    ...services.map((service) => ({
      id: service.id,
      kind: 'service' as const,
      name: service.name,
      category: service.category,
      categoryLabel: BILLING_CATEGORIES.find((category) => category.code === service.category)?.label || service.category,
      description: service.description || '',
      unitPrice: service.unitPrice,
      unit: service.unit,
      currency,
    })),
  ];
  return { currency, items };
}

export async function listCharges(
  actor: AuthContext,
  organizationId: string,
  query: { patientId?: string; realizationStatus?: Realization },
  ip?: string
) {
  if (actor.role === ROLES.DOCTOR && !query.patientId) {
    throw new ApiError(400, 'Indiquez le patient', 'VALIDATION_ERROR');
  }
  if (query.patientId) await requireVisiblePatient(actor, organizationId, query.patientId, ip);
  const filter: Record<string, unknown> = { organizationId };
  if (query.patientId) filter.patientId = query.patientId;
  if (query.realizationStatus) filter.realizationStatus = query.realizationStatus;
  const rows = await PatientCharge.find(filter).sort({ prescribedAt: -1 }).limit(100);
  const invoiceIds = rows.map((row) => row.invoiceId).filter(Boolean);
  const invoices = await Invoice.find({ _id: { $in: invoiceIds } }).select('invoiceNumber status dueDate');
  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  return rows.map((row) => toDto(row as unknown as ChargeRow, row.invoiceId ? byId.get(String(row.invoiceId)) : null));
}

export async function recordCharge(
  actor: AuthContext,
  organizationId: string,
  input: RecordChargeInput,
  ip?: string
) {
  const patient = await requireVisiblePatient(actor, organizationId, input.patientId, ip);
  const quantity = input.quantity ?? 1;
  const existing = await PatientCharge.findOne({
    organizationId,
    originModule: input.originModule,
    originId: input.originId,
  });
  if (existing) {
    if (String(existing.patientId) !== patient.id) {
      throw new ApiError(409, 'Cette transmission est déjà liée à un autre patient', 'DUPLICATE_ACT');
    }
    const attached = await attach(actor, organizationId, existing as unknown as ChargeRow);
    const invoice = attached.invoiceId ? await Invoice.findById(attached.invoiceId).select('invoiceNumber status dueDate') : null;
    return { charge: toDto(attached, invoice), created: false };
  }

  const priced = await pricedLine(actor, organizationId, input, quantity, ip);
  if (input.originModule === 'acts' && input.catalogItemId) {
    await rejectOpenDuplicate(organizationId, patient.id, input.catalogKind, input.catalogItemId);
  }
  const name = input.prescriberName?.trim() || await actorLabel(actor);
  let charge: ChargeRow;
  try {
    charge = await PatientCharge.create({
      organizationId,
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      originModule: input.originModule,
      originId: input.originId,
      catalogKind: input.catalogKind,
      catalogItemId: priced.catalogItemId,
      label: priced.label,
      detail: priced.detail,
      category: priced.category,
      unit: priced.unit,
      quantity,
      unitPrice: priced.unitPrice,
      total: priced.total,
      currency: priced.currency,
      prescriberId: actor.id,
      prescriberName: name,
      prescribedAt: new Date(),
      realizationStatus: 'recommended',
      history: [{
        at: new Date(),
        actorId: actor.id,
        actorName: name,
        action: 'recommended',
        from: '',
        to: 'recommended',
        note: 'Acte recommandé. Il n’est pas marqué comme réalisé.',
      }],
    }) as unknown as ChargeRow;
  } catch (error) {
    if (!duplicateKey(error)) throw error;
    const raced = await PatientCharge.findOne({ organizationId, originModule: input.originModule, originId: input.originId });
    if (!raced) throw error;
    const attached = await attach(actor, organizationId, raced as unknown as ChargeRow);
    const invoice = attached.invoiceId ? await Invoice.findById(attached.invoiceId).select('invoiceNumber status dueDate') : null;
    return { charge: toDto(attached, invoice), created: false };
  }

  const attached = await attach(actor, organizationId, charge);
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'CHARGE_RECORDED',
    resourceType: 'patient_charge',
    resourceId: idOf(attached),
    success: true,
    ip,
    metadata: { patientId: patient.id, originModule: input.originModule, originId: input.originId },
  });
  const invoice = attached.invoiceId ? await Invoice.findById(attached.invoiceId).select('invoiceNumber status dueDate') : null;
  return { charge: toDto(attached, invoice), created: true };
}

async function withdraw(charge: ChargeRow, invoice: any) {
  if (!invoice || invoice.status === 'cancelled') return;
  const lines = invoice.items.map((item: { chargeId?: unknown; realizationStatus?: string; total: number }) => item);
  const target = lines.find((item: { chargeId?: unknown; realizationStatus?: string }) => String(item.chargeId ?? '') === idOf(charge));
  if (target) target.realizationStatus = 'cancelled';
  if (invoice.status !== 'draft') {
    invoice.markModified('items');
    await invoice.save();
    return;
  }
  if (lines.length <= 1) {
    invoice.set('status', 'cancelled');
    invoice.markModified('items');
    await invoice.save();
    return;
  }
  invoice.set('items', lines.filter((item: { chargeId?: unknown }) => String(item.chargeId ?? '') !== idOf(charge)));
  applyTotals(invoice);
  await invoice.save();
  charge.set('invoiceItemId', undefined);
}

export async function updateCharge(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: { realizationStatus?: Realization; quantity?: number; note?: string },
  ip?: string
) {
  const charge = await requireOwned(PatientCharge, id, organizationId, actor, 'patient_charge', ip) as ChargeRow;
  await requireVisiblePatient(actor, organizationId, charge.patientId.toString(), ip);
  if (charge.realizationStatus === 'cancelled' && input.realizationStatus && input.realizationStatus !== 'cancelled') {
    throw new ApiError(409, 'Un acte annulé reste annulé. Recommandez-le de nouveau si besoin.', 'CHARGE_CANCELLED');
  }
  const invoice = charge.invoiceId
    ? await Invoice.findOne({ _id: charge.invoiceId, organizationId })
    : null;
  const locked = Boolean(invoice && invoice.status !== 'draft' && invoice.status !== 'cancelled');
  const name = await actorLabel(actor);

  if (input.quantity && input.quantity !== charge.quantity) {
    if (locked) {
      throw new ApiError(409, 'La facture est déjà émise. Le montant ne peut plus être corrigé ici.', 'INVOICE_LOCKED');
    }
    const previous = String(charge.quantity);
    charge.set('quantity', input.quantity);
    charge.set('total', input.quantity * charge.unitPrice);
    remember(charge, actor.id, name, 'correction', previous, String(input.quantity), input.note || 'Quantité corrigée');
    if (invoice && invoice.status === 'draft') {
      const line = invoice.items.find((item) => String(item.chargeId ?? '') === idOf(charge));
      if (line) {
        line.quantity = input.quantity;
        line.total = input.quantity * charge.unitPrice;
        applyTotals(invoice);
        invoice.markModified('items');
        await invoice.save();
      }
    }
  }

  if (input.realizationStatus && input.realizationStatus !== charge.realizationStatus) {
    const previous = charge.realizationStatus;
    charge.set('realizationStatus', input.realizationStatus);
    const note = input.realizationStatus === 'cancelled'
      ? (locked
        ? 'Annulation enregistrée. La facture déjà émise conserve son montant jusqu’à son annulation.'
        : 'Acte annulé avant encaissement.')
      : (input.note || 'Statut de réalisation mis à jour. Le paiement n’est pas modifié.');
    remember(charge, actor.id, name, input.realizationStatus, previous, input.realizationStatus, note);
    if (input.realizationStatus === 'cancelled') {
      await withdraw(charge, invoice);
    } else if (invoice) {
      const line = invoice.items.find((item) => String(item.chargeId ?? '') === idOf(charge));
      if (line) {
        line.realizationStatus = input.realizationStatus;
        invoice.markModified('items');
        await invoice.save();
      }
    }
  }

  await charge.save();
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'CHARGE_UPDATED',
    resourceType: 'patient_charge',
    resourceId: idOf(charge),
    success: true,
    ip,
    metadata: { realizationStatus: charge.realizationStatus, quantity: charge.quantity },
  });
  const freshInvoice = charge.invoiceId ? await Invoice.findById(charge.invoiceId).select('invoiceNumber status dueDate') : null;
  return toDto(charge, freshInvoice);
}

export async function syncOriginStatus(
  actor: AuthContext,
  organizationId: string,
  originModule: OriginModule,
  originId: string,
  realizationStatus: Realization,
  note: string,
  ip?: string
) {
  const charge = await PatientCharge.findOne({ organizationId, originModule, originId });
  if (!charge || charge.realizationStatus === realizationStatus) return;
  await updateCharge(actor, organizationId, idOf(charge), { realizationStatus, note }, ip);
}

export async function recordStayIfTariff(
  actor: AuthContext,
  organizationId: string,
  stay: { patientId: string; stayId: string },
  ip?: string
) {
  const currency = await organizationCurrency(organizationId);
  const services = await BillableService.find({
    organizationId,
    active: true,
    currency,
    category: { $in: ['HOSPITALISATION', 'OCCUPATION_LIT'] },
  });
  if (services.length !== 1) return null;
  return recordCharge(actor, organizationId, {
    patientId: stay.patientId,
    originModule: 'hospitalization',
    originId: stay.stayId,
    catalogKind: 'service',
    catalogItemId: services[0].id,
    quantity: 1,
  }, ip);
}

export async function syncStayQuantity(
  actor: AuthContext,
  organizationId: string,
  stayId: string,
  quantity: number,
  ip?: string
) {
  const charge = await PatientCharge.findOne({ organizationId, originModule: 'hospitalization', originId: stayId });
  if (!charge || charge.realizationStatus === 'cancelled') return;
  if (charge.unit !== 'jour' && charge.unit !== 'nuit') return;
  if (charge.quantity === quantity) return;
  try {
    await updateCharge(actor, organizationId, idOf(charge), { quantity, note: 'Durée de séjour mise à jour à la sortie.' }, ip);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) return;
    throw error;
  }
}

export type { BillingCurrency };
