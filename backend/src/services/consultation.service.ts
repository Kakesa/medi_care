import { ROLES } from '../config/permissions.js';
import { Consultation } from '../models/Consultation.js';
import { ApiError } from '../utils/ApiError.js';
import { dateOnly, utcDayBounds } from '../utils/dates.js';
import { paginated, readPagination } from '../utils/pagination.js';
import type { AuthContext } from '../types/express.js';
import { actorPersonnel, ownPatientId, requireOwned, requireVisiblePatient } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { resolveClinicalDoctor } from './personnel.service.js';

function cleanDate(value?: Date | '' | null) {
  if (value == null || value === '') {
    return undefined;
  }
  return value;
}

function toConsultationDto(row: {
  id?: string;
  _id: { toString(): string };
  patientId: { toString(): string };
  patientName: string;
  doctorId: { toString(): string };
  doctorName: string;
  appointmentId?: { toString(): string } | null;
  date: Date;
  diagnosis: string;
  symptoms?: string[];
  treatment?: string | null;
  prescription?: string | null;
  notes?: string | null;
  followUpDate?: Date | null;
  status: string;
}) {
  return {
    id: row.id ?? row._id.toString(),
    patientId: row.patientId.toString(),
    patientName: row.patientName,
    doctorId: row.doctorId.toString(),
    doctorName: row.doctorName,
    appointmentId: row.appointmentId ? row.appointmentId.toString() : undefined,
    date: dateOnly(row.date),
    diagnosis: row.diagnosis,
    symptoms: row.symptoms ?? [],
    treatment: row.treatment || '',
    prescription: row.prescription || undefined,
    notes: row.notes || undefined,
    followUpDate: dateOnly(row.followUpDate),
    status: row.status,
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

export async function listConsultations(actor: AuthContext, organizationId: string, query: { page?: number; limit?: number }) {
  const { page, limit, skip } = readPagination(query);
  const scope = await scopeFilter(actor, organizationId);
  if (!scope) {
    return paginated([], 0, page, limit);
  }
  const filter = { organizationId, ...scope };
  const [rows, total] = await Promise.all([
    Consultation.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
    Consultation.countDocuments(filter),
  ]);
  return paginated(rows.map((row) => toConsultationDto(row)), total, page, limit);
}

export async function getConsultation(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(Consultation, id, organizationId, actor, 'consultation', ip);
  await assertReadable(actor, organizationId, row, ip);
  return toConsultationDto(row);
}

export async function createConsultation(
  actor: AuthContext,
  organizationId: string,
  input: {
    patientId: string;
    doctorId: string;
    appointmentId?: string;
    diagnosis?: string;
    symptoms?: string[];
    treatment?: string;
    prescription?: string;
    notes?: string;
    followUpDate?: Date | '';
    date?: Date;
    status?: 'in_progress' | 'completed';
  },
  ip?: string
) {
  const patient = await requireVisiblePatient(actor, organizationId, input.patientId, ip);
  const doctor = await resolveClinicalDoctor(actor, organizationId, input.doctorId, ip);
  const row = await Consultation.create({
    organizationId,
    patientId: patient._id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    doctorId: doctor._id,
    doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
    appointmentId: input.appointmentId,
    date: input.date ? utcDayBounds(input.date).start : utcDayBounds(new Date()).start,
    diagnosis: input.diagnosis?.trim() || '',
    symptoms: (input.symptoms ?? []).map((item) => item.trim()).filter(Boolean),
    treatment: input.treatment?.trim() || '',
    prescription: input.prescription?.trim(),
    notes: input.notes?.trim(),
    followUpDate: cleanDate(input.followUpDate),
    status: input.status ?? 'in_progress',
  });
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'CONSULTATION_CREATED',
    resourceType: 'consultation',
    resourceId: row.id,
    success: true,
    ip,
    metadata: { patientId: patient.id },
  });
  return toConsultationDto(row);
}

export async function updateConsultation(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: Partial<{
    patientId: string;
    doctorId: string;
    diagnosis: string;
    symptoms: string[];
    treatment: string;
    prescription: string;
    notes: string;
    followUpDate: Date | '';
    status: 'in_progress' | 'completed';
  }>,
  ip?: string
) {
  const row = await requireOwned(Consultation, id, organizationId, actor, 'consultation', ip);
  await assertReadable(actor, organizationId, row, ip);
  if (actor.role === ROLES.DOCTOR) {
    const mine = await actorPersonnel(actor);
    if (!mine || mine.id !== row.doctorId.toString()) {
      throw new ApiError(403, 'Dossier non autorisé', 'RECORD_FORBIDDEN');
    }
  }
  if (input.patientId) {
    const patient = await requireVisiblePatient(actor, organizationId, input.patientId, ip);
    row.patientId = patient._id;
    row.patientName = `${patient.firstName} ${patient.lastName}`;
  }
  if (input.doctorId) {
    const doctor = await resolveClinicalDoctor(actor, organizationId, input.doctorId, ip);
    row.doctorId = doctor._id;
    row.doctorName = `Dr. ${doctor.firstName} ${doctor.lastName}`;
  }
  if (input.diagnosis !== undefined) row.diagnosis = input.diagnosis.trim();
  if (input.symptoms) row.symptoms = input.symptoms.map((item) => item.trim()).filter(Boolean);
  if (input.treatment !== undefined) row.treatment = input.treatment.trim();
  if (input.prescription !== undefined) row.prescription = input.prescription.trim();
  if (input.notes !== undefined) row.notes = input.notes.trim();
  if (input.followUpDate !== undefined) row.followUpDate = cleanDate(input.followUpDate);
  if (input.status) row.status = input.status;
  await row.save();
  return toConsultationDto(row);
}

export async function completeConsultation(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  return updateConsultation(actor, organizationId, id, { status: 'completed' }, ip);
}

export async function deleteConsultation(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(Consultation, id, organizationId, actor, 'consultation', ip);
  await assertReadable(actor, organizationId, row, ip);
  await row.deleteOne();
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'CONSULTATION_DELETED',
    resourceType: 'consultation',
    resourceId: id,
    success: true,
    ip,
  });
}

export async function consultationsByDoctor(actor: AuthContext, organizationId: string, doctorId: string) {
  const result = await listConsultations(actor, organizationId, { page: 1, limit: 100 });
  if (actor.role === ROLES.DOCTOR) {
    return result.data;
  }
  return result.data.filter((row) => row.doctorId === doctorId);
}

export async function consultationsByPatient(actor: AuthContext, organizationId: string, patientId: string, ip?: string) {
  await requireVisiblePatient(actor, organizationId, patientId, ip);
  const rows = await Consultation.find({ organizationId, patientId }).sort({ date: -1 });
  const visible = [];
  for (const row of rows) {
    try {
      await assertReadable(actor, organizationId, row, ip);
      visible.push(toConsultationDto(row));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        continue;
      }
      throw error;
    }
  }
  return visible;
}
