import { ROLES } from '../config/permissions.js';
import { Exam } from '../models/Exam.js';
import { Invoice } from '../models/Invoice.js';
import { Patient } from '../models/Patient.js';
import { PatientCharge } from '../models/PatientCharge.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { dateOnly, utcDayBounds } from '../utils/dates.js';
import type { AuthContext } from '../types/express.js';
import { requireOwned, requireVisiblePatient } from './access.service.js';
import { recordCharge, syncOriginStatus } from './charge.service.js';
import { notifyRoles, notifyUser } from './notification.service.js';
import { recordAudit } from './audit.service.js';
import { resolveClinicalDoctor } from './personnel.service.js';

const LAB_STATUSES = ['EN_ATTENTE', 'EN_COURS', 'BROUILLON', 'EN_ATTENTE_VALIDATION', 'CORRECTION_DEMANDEE', 'VALIDE', 'REJETE', 'ANNULE'] as const;
type LabStatus = (typeof LAB_STATUSES)[number];

type Attachment = { name: string; mimeType: string; data: string };
type Version = {
  version: number;
  results: string;
  technicalNotes?: string;
  submittedBy?: { toString(): string };
  submittedByName?: string;
  submittedAt?: Date;
  decision?: string;
  decisionByName?: string;
  decisionAt?: Date;
  comment?: string;
};

function mirror(status: LabStatus) {
  if (status === 'EN_ATTENTE') return 'pending';
  if (status === 'VALIDE') return 'completed';
  if (status === 'ANNULE') return 'cancelled';
  return 'in_progress';
}

function isOfficial(row: { type?: string; labStatus?: string | null; results?: string | null }) {
  if (row.type && row.type !== 'laboratory') return true;
  if (!row.labStatus) return Boolean(row.results);
  return Boolean(row.results) && row.labStatus !== 'ANNULE' && row.labStatus !== 'REJETE';
}

async function actorName(actor: AuthContext) {
  const user = await User.findById(actor.id).select('firstName lastName');
  return user ? `${user.firstName} ${user.lastName}` : actor.role;
}

function remember(row: { history?: unknown[]; set: (path: string, value: unknown) => unknown }, actor: AuthContext, name: string, action: string, from: string, to: string, comment?: string) {
  const history = Array.isArray(row.history) ? [...row.history] : [];
  history.push({ at: new Date(), userId: actor.id, userName: name, action, from, to, comment: comment || '' });
  row.set('history', history.slice(-40));
}

async function loadExam(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(Exam, id, organizationId, actor, 'exam', ip);
  if (row.type !== 'laboratory') throw new ApiError(404, 'Examen de laboratoire introuvable', 'NOT_FOUND');
  return row;
}

function canSeeDraft(actor: AuthContext) {
  return actor.role === ROLES.HOSPITAL_ADMIN || actor.role === ROLES.LABORANTIN || actor.role === ROLES.DOCTOR || actor.role === ROLES.NURSE;
}

function toDto(source: object, actor: AuthContext, billing?: { paymentStatus: string; invoiceId?: string; invoiceNumber?: string; total?: number; currency?: string }, includeFiles = false) {
  const row = source as {
    id: string;
    patientId: { toString(): string };
    patientName: string;
    doctorName: string;
    name: string;
    category: string;
    notes?: string | null;
    date: Date;
    status: string;
    labStatus?: string | null;
    results?: string | null;
    draftResults?: string | null;
    technicalNotes?: string | null;
    attachments?: Attachment[];
    versions?: Version[];
    history?: Array<{ at?: Date; userName?: string; action?: string; from?: string; to?: string; comment?: string }>;
  };
  const official = isOfficial(row);
  const draft = canSeeDraft(actor);
  return {
    id: row.id,
    patientId: row.patientId.toString(),
    patientName: row.patientName,
    doctorName: row.doctorName,
    name: row.name,
    category: row.category,
    instructions: row.notes || '',
    date: dateOnly(row.date),
    status: row.status,
    labStatus: row.labStatus || 'EN_ATTENTE',
    official,
    results: official || draft ? row.results || '' : '',
    draftResults: draft ? row.draftResults || '' : '',
    technicalNotes: draft ? row.technicalNotes || '' : '',
    attachments: (row.attachments || []).map((file) => ({
      name: file.name,
      mimeType: file.mimeType,
      ...(includeFiles && draft ? { data: file.data } : {}),
    })),
    versions: draft ? (row.versions || []).map((version) => ({
      version: version.version,
      results: version.results,
      technicalNotes: version.technicalNotes || '',
      submittedByName: version.submittedByName || '',
      submittedAt: version.submittedAt,
      decision: version.decision || '',
      decisionByName: version.decisionByName || '',
      decisionAt: version.decisionAt,
      comment: version.comment || '',
    })) : [],
    history: (row.history || []).map((entry) => ({
      at: entry.at,
      userName: entry.userName || '',
      action: entry.action || '',
      from: entry.from || '',
      to: entry.to || '',
      comment: entry.comment || '',
    })),
    paymentStatus: billing?.paymentStatus || 'unbilled',
    invoiceId: billing?.invoiceId,
    invoiceNumber: billing?.invoiceNumber,
    total: billing?.total,
    currency: billing?.currency,
  };
}

async function billingFor(organizationId: string, ids: string[]) {
  const charges = await PatientCharge.find({ organizationId, originModule: 'exam', originId: { $in: ids } });
  const invoiceIds = charges.map((charge) => charge.invoiceId).filter(Boolean);
  const invoices = await Invoice.find({ _id: { $in: invoiceIds } }).select('invoiceNumber status dueDate total currency');
  const byInvoice = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const byExam = new Map<string, { paymentStatus: string; invoiceId?: string; invoiceNumber?: string; total?: number; currency?: string }>();
  for (const charge of charges) {
    const invoice = charge.invoiceId ? byInvoice.get(String(charge.invoiceId)) : undefined;
    let paymentStatus = 'unbilled';
    if (invoice) {
      paymentStatus = invoice.status === 'pending' && invoice.dueDate < new Date() ? 'overdue' : invoice.status;
    }
    byExam.set(charge.originId, {
      paymentStatus,
      invoiceId: invoice?.id,
      invoiceNumber: invoice?.invoiceNumber,
      total: charge.total,
      currency: charge.currency,
    });
  }
  return byExam;
}

export async function listLabExams(actor: AuthContext, organizationId: string, labStatus?: string) {
  const filter: Record<string, unknown> = { organizationId, type: 'laboratory' };
  if (labStatus) filter.labStatus = labStatus;
  const rows = await Exam.find(filter).sort({ updatedAt: -1 }).limit(200);
  const billing = await billingFor(organizationId, rows.map((row) => row.id));
  return rows.map((row) => toDto(row, actor, billing.get(row.id)));
}

export async function getLabExam(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await loadExam(actor, organizationId, id, ip);
  const patient = await Patient.findById(row.patientId).select('firstName lastName dateOfBirth gender phone allergies');
  const billing = await billingFor(organizationId, [row.id]);
  return {
    ...toDto(row, actor, billing.get(row.id), true),
    patient: patient ? {
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth ? dateOnly(patient.dateOfBirth) : undefined,
      gender: patient.gender,
      phone: patient.phone,
      allergies: patient.allergies || [],
    } : undefined,
  };
}

export async function orderLabExams(
  actor: AuthContext,
  organizationId: string,
  input: {
    patientId: string;
    doctorId: string;
    instructions?: string;
    items: Array<{ kind: 'surgery' | 'service'; catalogItemId: string; name: string; category: string }>;
  },
  ip?: string
) {
  if (!input.items.length) throw new ApiError(400, 'Choisissez au moins un examen', 'VALIDATION_ERROR');
  const seen = new Set<string>();
  for (const item of input.items) {
    if (seen.has(item.catalogItemId)) throw new ApiError(409, 'Un examen est sélectionné deux fois', 'DUPLICATE_ACT');
    seen.add(item.catalogItemId);
  }
  const patient = await requireVisiblePatient(actor, organizationId, input.patientId, ip);
  const doctor = await resolveClinicalDoctor(actor, organizationId, input.doctorId, ip);
  const created = [];
  let invoiceId: string | undefined;
  let invoiceNumber: string | undefined;
  for (const item of input.items) {
    const row = await Exam.create({
      organizationId,
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      doctorId: doctor._id,
      doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
      type: 'laboratory',
      category: item.category.trim() || 'Laboratoire',
      name: item.name.trim(),
      date: utcDayBounds(new Date()).start,
      notes: input.instructions?.trim(),
      status: 'pending',
      labStatus: 'EN_ATTENTE',
      history: [{
        at: new Date(),
        userId: actor.id,
        userName: await actorName(actor),
        action: 'DEMANDE',
        from: '',
        to: 'EN_ATTENTE',
        comment: 'Demande transmise par la réception',
      }],
    });
    let billed = false;
    try {
      const recorded = await recordCharge(actor, organizationId, {
        patientId: patient.id,
        originModule: 'exam',
        originId: row.id,
        catalogKind: item.kind,
        catalogItemId: item.catalogItemId,
        quantity: 1,
        prescriberName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
      }, ip);
      billed = true;
      invoiceId = recorded.charge.invoiceId;
      invoiceNumber = recorded.charge.invoiceNumber;
    } catch (error) {
      const code = error instanceof ApiError ? error.code : '';
      if (code !== 'ACT_UNPRICED' && code !== 'SERVICE_INACTIVE') {
        await row.deleteOne();
        throw error;
      }
    }
    await notifyRoles({
      organizationId,
      roles: [ROLES.LABORANTIN],
      type: 'exam_result',
      relatedId: row.id,
      title: 'Nouvelle demande d\'examen',
      message: `${row.name} pour ${row.patientName} attend le laboratoire.`,
    });
    created.push({ ...toDto(row, actor), billed });
  }
  return { exams: created, invoiceId, invoiceNumber };
}

async function move(row: { labStatus?: string; status: string; set: (path: string, value: unknown) => unknown; save: () => Promise<unknown>; history?: unknown[] }, actor: AuthContext, to: LabStatus, action: string, comment?: string) {
  const from = row.labStatus || 'EN_ATTENTE';
  const name = await actorName(actor);
  row.set('labStatus', to);
  row.set('status', mirror(to));
  remember(row, actor, name, action, from, to, comment);
  await row.save();
  return name;
}

function storedStatus(row: { labStatus?: string | null; status?: string }) {
  if (row.labStatus) return row.labStatus;
  if (row.status === 'cancelled') return 'ANNULE';
  if (row.status === 'completed') return 'VALIDE';
  if (row.status === 'in_progress') return 'EN_COURS';
  return 'EN_ATTENTE';
}

export async function startLabExam(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await loadExam(actor, organizationId, id, ip);
  if (storedStatus(row) !== 'EN_ATTENTE') throw new ApiError(409, 'Cet examen n\'est pas en attente', 'LAB_STATUS');
  await move(row, actor, 'EN_COURS', 'DEMARRAGE');
  await syncOriginStatus(actor, organizationId, 'exam', row.id, 'pending', 'Examen en cours de réalisation', ip);
  return getLabExam(actor, organizationId, id, ip);
}

export async function saveLabDraft(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: { results: string; technicalNotes?: string; attachments?: Attachment[] },
  ip?: string
) {
  const row = await loadExam(actor, organizationId, id, ip);
  const allowed = ['EN_COURS', 'BROUILLON', 'CORRECTION_DEMANDEE', 'REJETE'];
  if (!row.labStatus || !allowed.includes(row.labStatus)) {
    throw new ApiError(409, 'Les résultats ne peuvent pas être saisis à cette étape', 'LAB_STATUS');
  }
  row.draftResults = input.results.trim();
  row.technicalNotes = input.technicalNotes?.trim() || '';
  if (input.attachments) {
    row.attachments = input.attachments.map((file) => ({ name: file.name.trim(), mimeType: file.mimeType, data: file.data }));
  }
  await move(row, actor, 'BROUILLON', 'BROUILLON');
  return getLabExam(actor, organizationId, id, ip);
}

export async function submitLabExam(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await loadExam(actor, organizationId, id, ip);
  if (row.labStatus !== 'BROUILLON') throw new ApiError(409, 'Enregistrez d\'abord un brouillon', 'LAB_STATUS');
  if (!row.draftResults?.trim()) throw new ApiError(400, 'Le résultat est vide', 'VALIDATION_ERROR');
  const name = await actorName(actor);
  const version = (row.versions?.length || 0) + 1;
  row.versions = [...(row.versions || []), {
    version,
    results: row.draftResults.trim(),
    technicalNotes: row.technicalNotes || '',
    submittedBy: actor.id,
    submittedByName: name,
    submittedAt: new Date(),
    decision: '',
    comment: '',
  }];
  await move(row, actor, 'EN_ATTENTE_VALIDATION', 'SOUMISSION');
  await notifyRoles({
    organizationId,
    roles: [ROLES.HOSPITAL_ADMIN],
    type: 'exam_result',
    relatedId: row.id,
    title: 'Résultats à valider',
    message: `${row.name} de ${row.patientName} est soumis par ${name}.`,
  });
  await recordAudit({ actorId: actor.id, actorRole: actor.role, organizationId, action: 'LAB_SUBMITTED', resourceType: 'exam', resourceId: row.id, success: true, ip });
  return getLabExam(actor, organizationId, id, ip);
}

function latestOpen(row: { versions?: Version[] }) {
  const versions = row.versions || [];
  return versions[versions.length - 1];
}

export async function decideLabExam(
  actor: AuthContext,
  organizationId: string,
  id: string,
  decision: 'VALIDE' | 'CORRECTION_DEMANDEE' | 'REJETE',
  comment: string | undefined,
  ip?: string
) {
  const row = await loadExam(actor, organizationId, id, ip);
  const note = comment?.trim() || '';
  if (decision !== 'VALIDE' && note.length < 3) {
    throw new ApiError(400, 'Un commentaire est obligatoire', 'VALIDATION_ERROR');
  }
  const current = latestOpen(row);
  if (!current) {
    throw new ApiError(409, 'Aucun résultat n\'a encore été soumis par le laborantin', 'LAB_STATUS');
  }
  if (String(current.submittedBy || '') === actor.id) {
    throw new ApiError(403, 'Vous ne pouvez pas valider vos propres résultats', 'LAB_SELF_VALIDATION');
  }
  if (decision === 'CORRECTION_DEMANDEE' && row.labStatus === 'VALIDE') {
    current.decision = 'CORRECTION_DEMANDEE';
    current.comment = note;
    current.decisionByName = await actorName(actor);
    current.decisionAt = new Date();
    row.markModified('versions');
    await move(row, actor, 'CORRECTION_DEMANDEE', 'CORRECTION', note);
  } else if (row.labStatus !== 'EN_ATTENTE_VALIDATION') {
    throw new ApiError(409, 'Ce dossier n\'est pas encore soumis. Le laborantin doit d\'abord envoyer le résultat.', 'LAB_STATUS');
  } else if (decision === 'REJETE' && row.results) {
    current.decision = 'REJETE';
    current.comment = note;
    current.decisionByName = await actorName(actor);
    current.decisionAt = new Date();
    row.markModified('versions');
    await move(row, actor, 'VALIDE', 'REJET_VERSION', note);
  } else {
    current.decision = decision;
    current.comment = note;
    current.decisionByName = await actorName(actor);
    current.decisionAt = new Date();
    row.markModified('versions');
    if (decision === 'VALIDE') {
      row.results = current.results;
      row.technicalNotes = current.technicalNotes || row.technicalNotes;
    }
    await move(row, actor, decision, decision, note);
  }
  if (row.labStatus === 'VALIDE' && decision === 'VALIDE') {
    await syncOriginStatus(actor, organizationId, 'exam', row.id, 'performed', 'Résultat validé. Le paiement n\'est pas modifié.', ip);
    await notifyRoles({
      organizationId,
      roles: [ROLES.RECEPTIONIST, ROLES.LABORANTIN],
      type: 'exam_result',
      relatedId: row.id,
      title: 'Résultat validé',
      message: `${row.name} de ${row.patientName} est disponible.`,
    });
    const patient = await Patient.findById(row.patientId).select('linkedUserId');
    await notifyUser({
      organizationId,
      userId: patient?.linkedUserId,
      type: 'exam_result',
      relatedId: row.id,
      title: 'Résultat d\'examen',
      message: `Votre résultat pour ${row.name} est disponible.`,
    });
  }
  if (decision === 'CORRECTION_DEMANDEE') {
    await notifyRoles({
      organizationId,
      roles: [ROLES.LABORANTIN],
      type: 'exam_result',
      relatedId: row.id,
      title: 'Correction demandée',
      message: `${row.name} : ${note}`,
    });
  }
  if (decision === 'REJETE') {
    await notifyRoles({
      organizationId,
      roles: [ROLES.LABORANTIN],
      type: 'exam_result',
      relatedId: row.id,
      title: 'Résultat rejeté',
      message: `${row.name} : ${note}`,
    });
  }
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: `LAB_${decision}`,
    resourceType: 'exam',
    resourceId: row.id,
    success: true,
    ip,
  });
  return getLabExam(actor, organizationId, id, ip);
}

export async function cancelLabExam(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await loadExam(actor, organizationId, id, ip);
  if (row.labStatus === 'VALIDE' || row.labStatus === 'ANNULE') {
    throw new ApiError(409, 'Cet examen ne peut plus être annulé', 'LAB_STATUS');
  }
  await move(row, actor, 'ANNULE', 'ANNULATION');
  await syncOriginStatus(actor, organizationId, 'exam', row.id, 'cancelled', 'Demande d\'examen annulée', ip);
  return getLabExam(actor, organizationId, id, ip);
}

export { LAB_STATUSES };
