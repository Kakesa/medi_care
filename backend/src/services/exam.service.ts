import { ROLES } from '../config/permissions.js';
import { Exam } from '../models/Exam.js';
import { ApiError } from '../utils/ApiError.js';
import { dateOnly, utcDayBounds } from '../utils/dates.js';
import { paginated, readPagination } from '../utils/pagination.js';
import type { AuthContext } from '../types/express.js';
import { actorPersonnel, ownPatientId, requireOwned, requireVisiblePatient } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { resolveClinicalDoctor } from './personnel.service.js';

function toExamDto(row: {
  id?: string;
  _id: { toString(): string };
  patientId: { toString(): string };
  patientName: string;
  doctorId: { toString(): string };
  doctorName: string;
  type: string;
  category: string;
  name: string;
  date: Date;
  status: string;
  results?: string | null;
  files?: string[];
  notes?: string | null;
  createdAt?: Date;
}) {
  return {
    id: row.id ?? row._id.toString(),
    patientId: row.patientId.toString(),
    patientName: row.patientName,
    doctorId: row.doctorId.toString(),
    doctorName: row.doctorName,
    type: row.type,
    category: row.category,
    name: row.name,
    date: dateOnly(row.date),
    status: row.status,
    results: row.results || undefined,
    files: row.files ?? [],
    notes: row.notes || undefined,
    createdAt: row.createdAt,
  };
}

async function scopeFilter(actor: AuthContext, organizationId: string) {
  if (actor.role === ROLES.DOCTOR) {
    const mine = await actorPersonnel(actor);
    return mine ? { doctorId: mine._id } : null;
  }
  if (actor.role === ROLES.PATIENT) {
    const patientId = await ownPatientId(actor, organizationId);
    return patientId ? { patientId } : null;
  }
  return {};
}

async function assertReadable(
  actor: AuthContext,
  organizationId: string,
  row: { doctorId: { toString(): string }; patientId: { toString(): string } },
  ip?: string
) {
  if (actor.role === ROLES.DOCTOR) {
    const mine = await actorPersonnel(actor);
    if (!mine || mine.id !== row.doctorId.toString()) {
      throw new ApiError(403, 'Dossier non autorisé', 'RECORD_FORBIDDEN');
    }
  }
  if (actor.role === ROLES.PATIENT) {
    await requireVisiblePatient(actor, organizationId, row.patientId.toString(), ip);
  }
}

export async function listExams(
  actor: AuthContext,
  organizationId: string,
  query: { page?: number; limit?: number; type?: string; status?: string; patientId?: string; doctorId?: string }
) {
  const { page, limit, skip } = readPagination(query);
  const scope = await scopeFilter(actor, organizationId);
  if (!scope) {
    return paginated([], 0, page, limit);
  }
  const filter: Record<string, unknown> = { organizationId, ...scope };
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (actor.role !== ROLES.PATIENT && query.patientId) filter.patientId = query.patientId;
  if (actor.role !== ROLES.DOCTOR && query.doctorId) filter.doctorId = query.doctorId;
  const [rows, total] = await Promise.all([
    Exam.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
    Exam.countDocuments(filter),
  ]);
  return paginated(rows.map((row) => toExamDto(row)), total, page, limit);
}

export async function getExam(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(Exam, id, organizationId, actor, 'exam', ip);
  await assertReadable(actor, organizationId, row, ip);
  return toExamDto(row);
}

export async function createExam(
  actor: AuthContext,
  organizationId: string,
  input: {
    patientId: string;
    doctorId: string;
    type: 'laboratory' | 'imaging' | 'biopsy' | 'other';
    category: string;
    name: string;
    date: Date;
    notes?: string;
    results?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  },
  ip?: string
) {
  const patient = await requireVisiblePatient(actor, organizationId, input.patientId, ip);
  const doctor = await resolveClinicalDoctor(actor, organizationId, input.doctorId, ip);
  const row = await Exam.create({
    organizationId,
    patientId: patient._id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    doctorId: doctor._id,
    doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
    type: input.type,
    category: input.category.trim(),
    name: input.name.trim(),
    date: utcDayBounds(input.date).start,
    notes: input.notes?.trim(),
    results: input.results?.trim(),
    status: input.status ?? 'pending',
  });
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'EXAM_CREATED',
    resourceType: 'exam',
    resourceId: row.id,
    success: true,
    ip,
  });
  return toExamDto(row);
}

export async function updateExam(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: Partial<{
    patientId: string;
    doctorId: string;
    type: 'laboratory' | 'imaging' | 'biopsy' | 'other';
    category: string;
    name: string;
    date: Date;
    notes: string;
    results: string;
    files: string[];
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  }>,
  ip?: string
) {
  const row = await requireOwned(Exam, id, organizationId, actor, 'exam', ip);
  await assertReadable(actor, organizationId, row, ip);
  if (input.patientId) {
    const patient = await requireVisiblePatient(actor, organizationId, input.patientId, ip);
    row.patientId = patient._id;
    row.patientName = `${patient.firstName} ${patient.lastName}`;
  }
  if (input.doctorId || actor.role === ROLES.DOCTOR) {
    const doctor = await resolveClinicalDoctor(actor, organizationId, input.doctorId ?? row.doctorId.toString(), ip);
    row.doctorId = doctor._id;
    row.doctorName = `Dr. ${doctor.firstName} ${doctor.lastName}`;
  }
  if (input.type) row.type = input.type;
  if (input.category !== undefined) row.category = input.category.trim();
  if (input.name !== undefined) row.name = input.name.trim();
  if (input.date) row.date = utcDayBounds(input.date).start;
  if (input.notes !== undefined) row.notes = input.notes.trim();
  if (input.results !== undefined) row.results = input.results.trim();
  if (input.files) row.files = input.files;
  if (input.status) row.status = input.status;
  await row.save();
  return toExamDto(row);
}

export async function updateExamStatus(
  actor: AuthContext,
  organizationId: string,
  id: string,
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled',
  ip?: string
) {
  return updateExam(actor, organizationId, id, { status }, ip);
}

export async function addExamResults(
  actor: AuthContext,
  organizationId: string,
  id: string,
  results: string,
  files: string[] | undefined,
  ip?: string
) {
  return updateExam(actor, organizationId, id, { results, files, status: 'completed' }, ip);
}

export async function deleteExam(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(Exam, id, organizationId, actor, 'exam', ip);
  await assertReadable(actor, organizationId, row, ip);
  await row.deleteOne();
}

export async function examsByPatient(actor: AuthContext, organizationId: string, patientId: string, ip?: string) {
  await requireVisiblePatient(actor, organizationId, patientId, ip);
  const result = await listExams(actor, organizationId, { patientId, page: 1, limit: 100 });
  return result.data;
}

export async function pendingExams(actor: AuthContext, organizationId: string) {
  const result = await listExams(actor, organizationId, { status: 'pending', page: 1, limit: 100 });
  return result.data;
}
