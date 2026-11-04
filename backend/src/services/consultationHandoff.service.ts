import { ROLES } from '../config/permissions.js';
import { Consultation } from '../models/Consultation.js';
import { Exam } from '../models/Exam.js';
import { Invoice } from '../models/Invoice.js';
import { PatientCharge } from '../models/PatientCharge.js';
import { Personnel } from '../models/Personnel.js';
import { Prescription } from '../models/Prescription.js';
import { ApiError } from '../utils/ApiError.js';
import { utcDayBounds } from '../utils/dates.js';
import type { AuthContext } from '../types/express.js';
import { finalizeInvoice } from './billing.service.js';
import { openDraftInvoice, quoteCatalogLine, recordCharge } from './charge.service.js';
import { listExamCatalog } from './exam.service.js';
import { notifyRoles } from './notification.service.js';

type ConsultationRow = {
  id: string;
  _id: { toString(): string };
  patientId: { toString(): string };
  patientName: string;
  doctorId: { toString(): string };
  doctorName: string;
  recommandationExamens?: string | null;
  prescription?: string | null;
  handoffAt?: Date | null;
  pharmacyReleasedAt?: Date | null;
  examInvoiceIds?: Array<{ toString(): string }>;
  set(path: string, value: unknown): unknown;
  save(): Promise<unknown>;
};

function sameName(left: string, right: string) {
  return left.localeCompare(right, 'fr', { sensitivity: 'accent' }) === 0;
}

function isUnpriced(error: unknown) {
  return error instanceof ApiError && (error.code === 'ACT_UNPRICED' || error.code === 'SERVICE_INACTIVE' || error.code === 'CURRENCY_MISMATCH');
}

async function sendPrescription(actor: AuthContext, organizationId: string, row: ConsultationRow) {
  const text = row.prescription?.trim();
  if (!text || row.pharmacyReleasedAt) return false;
  const doctor = await Personnel.findById(row.doctorId).select('userId');
  const created = await Prescription.create({
    organizationId,
    patientId: row.patientId,
    patientName: row.patientName,
    prescriberId: doctor?.userId || actor.id,
    prescriberName: row.doctorName,
    items: [{
      medication: text.slice(0, 160),
      dosage: 'Selon prescription',
      posology: 'Selon prescription',
      duration: 'Selon prescription',
      instructions: text.slice(0, 2000),
      quantityPrescribed: 1,
      quantityDispensed: 0,
    }],
    status: 'validated',
    pharmacyStatus: 'new',
    validatedAt: new Date(),
    history: [{ at: new Date(), userName: row.doctorName, action: 'VALIDATION', comment: 'Transmise après paiement des examens' }],
  });
  row.set('pharmacyReleasedAt', new Date());
  await row.save();
  await notifyRoles({
    organizationId,
    roles: [ROLES.PHARMACIST],
    type: 'pharmacy',
    relatedId: created.id,
    title: 'Patient orienté vers la pharmacie',
    message: `${row.patientName} a payé les examens. Ordonnance de ${row.doctorName} à préparer.`,
  });
  await notifyRoles({
    organizationId,
    roles: [ROLES.RECEPTIONIST, ROLES.HOSPITAL_ADMIN],
    type: 'pharmacy',
    relatedId: created.id,
    title: 'Orienter vers la pharmacie',
    message: `${row.patientName} peut maintenant aller à la pharmacie.`,
  });
  return true;
}

export async function releaseCompletedConsultation(actor: AuthContext, organizationId: string, row: ConsultationRow, ip?: string) {
  if (row.handoffAt) {
    return { examCount: 0, invoiceNumbers: [] as string[], unpriced: 0, pharmacyAfterPayment: false, pharmacyNow: false };
  }
  const names = (row.recommandationExamens || '').split('\n').map((name) => name.trim()).filter(Boolean);
  const catalog = names.length ? await listExamCatalog(actor, organizationId) : { items: [] as Array<{ id: string; kind: 'surgery' | 'service'; name: string; categoryName: string; type: 'laboratory' | 'imaging' }> };
  const used = new Set<string>();
  const matched = names.flatMap((name) => {
    const item = catalog.items.find((entry) => !used.has(`${entry.kind}:${entry.id}`) && sameName(entry.name, name));
    if (!item) return [];
    used.add(`${item.kind}:${item.id}`);
    return [item];
  });
  const marker = `Consultation ${row.id}`;
  let exams = await Exam.find({ organizationId, patientId: row.patientId, notes: marker });
  if (!exams.length) {
    exams = [];
    for (const item of matched) {
      const created = await Exam.create({
        organizationId,
        patientId: row.patientId,
        patientName: row.patientName,
        doctorId: row.doctorId,
        doctorName: row.doctorName,
        type: item.type === 'imaging' ? 'imaging' : 'laboratory',
        category: item.categoryName || (item.type === 'imaging' ? 'Imagerie' : 'Laboratoire'),
        name: item.name,
        date: utcDayBounds(new Date()).start,
        notes: marker,
        status: 'pending',
        labStatus: item.type === 'laboratory' ? 'EN_ATTENTE' : undefined,
        history: [{
          at: new Date(),
          userId: actor.id,
          userName: row.doctorName,
          action: 'VALIDATION',
          from: '',
          to: 'EN_ATTENTE',
          comment: 'Examen validé avec la consultation',
        }],
      });
      exams.push(created);
    }
  }
  const billable: Array<{ examId: string; kind: 'surgery' | 'service'; catalogItemId: string; currency: string }> = [];
  let unpriced = 0;
  for (const exam of exams) {
    const item = matched.find((entry) => sameName(entry.name, exam.name));
    if (!item) continue;
    try {
      const quote = await quoteCatalogLine(actor, organizationId, item.kind, item.id, ip);
      billable.push({ examId: exam.id, kind: item.kind, catalogItemId: item.id, currency: quote.currency });
    } catch (error) {
      if (!isUnpriced(error)) throw error;
      unpriced += 1;
    }
  }
  const invoiceIds = new Set<string>((row.examInvoiceIds ?? []).map((id) => id.toString()));
  const fresh: typeof billable = [];
  for (const line of billable) {
    const existing = await PatientCharge.findOne({ organizationId, originModule: 'exam', originId: line.examId }).select('invoiceId');
    if (existing?.invoiceId) {
      invoiceIds.add(String(existing.invoiceId));
    } else {
      fresh.push(line);
    }
  }
  const byCurrency = new Map<string, typeof billable>();
  for (const line of fresh) {
    const group = byCurrency.get(line.currency) ?? [];
    group.push(line);
    byCurrency.set(line.currency, group);
  }
  for (const [currency, group] of byCurrency) {
    const invoice = await openDraftInvoice(
      actor,
      organizationId,
      row.patientId.toString(),
      currency,
      'Examens validés avec la consultation. Après paiement, orienter le patient vers la pharmacie.',
      ip
    );
    for (const line of group) {
      await recordCharge(actor, organizationId, {
        patientId: row.patientId.toString(),
        originModule: 'exam',
        originId: line.examId,
        catalogKind: line.kind,
        catalogItemId: line.catalogItemId,
        quantity: 1,
        prescriberName: row.doctorName,
        invoiceId: invoice.id,
      }, ip);
    }
    invoiceIds.add(invoice.id);
  }
  const invoiceNumbers: string[] = [];
  for (const invoiceId of invoiceIds) {
    const current = await Invoice.findById(invoiceId).select('status items invoiceNumber');
    if (!current || !current.items.length) continue;
    const finalized = current.status === 'draft'
      ? await finalizeInvoice(actor, organizationId, invoiceId, ip)
      : { id: invoiceId, invoiceNumber: current.invoiceNumber };
    if (!invoiceNumbers.includes(finalized.invoiceNumber)) invoiceNumbers.push(finalized.invoiceNumber);
  }
  row.set('examInvoiceIds', [...invoiceIds]);
  row.set('handoffAt', new Date());
  await row.save();
  if (invoiceNumbers.length) {
    await notifyRoles({
      organizationId,
      roles: [ROLES.RECEPTIONIST, ROLES.HOSPITAL_ADMIN, ROLES.ACCOUNTANT],
      type: 'billing',
      title: 'Facture d\'examens à encaisser',
      message: `${row.patientName} : facture ${invoiceNumbers.join(', ')} envoyée à la réception.`,
    });
  } else if (row.prescription?.trim()) {
    await sendPrescription(actor, organizationId, row);
  }
  return {
    examCount: exams.length,
    invoiceNumbers,
    unpriced,
    pharmacyAfterPayment: Boolean(row.prescription?.trim()) && invoiceNumbers.length > 0,
    pharmacyNow: Boolean(row.prescription?.trim()) && invoiceNumbers.length === 0,
  };
}

export async function releasePharmacyForPaidInvoice(actor: AuthContext, organizationId: string, invoiceId: string) {
  const row = await Consultation.findOne({
    organizationId,
    examInvoiceIds: invoiceId,
    pharmacyReleasedAt: null,
  });
  if (!row) return false;
  const invoices = await Invoice.find({ _id: { $in: row.examInvoiceIds || [] } }).select('status');
  if (invoices.some((invoice) => invoice.status !== 'paid' && invoice.status !== 'cancelled')) return false;
  if (!row.prescription?.trim()) {
    row.pharmacyReleasedAt = new Date();
    await row.save();
    return false;
  }
  return sendPrescription(actor, organizationId, row as unknown as ConsultationRow);
}
