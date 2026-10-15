import { ROLES } from '../config/permissions.js';
import { Appointment } from '../models/Appointment.js';
import { Personnel } from '../models/Personnel.js';
import { ApiError } from '../utils/ApiError.js';
import { dateOnly, timesOverlap, utcDayBounds } from '../utils/dates.js';
import { paginated, readPagination } from '../utils/pagination.js';
import type { AuthContext } from '../types/express.js';
import { actorPersonnel, ownPatientId, requireOwned, requireVisiblePatient } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { notifyUser } from './notification.service.js';
import { resolveClinicalDoctor } from './personnel.service.js';

function toAppointmentDto(row: {
  id?: string;
  _id: { toString(): string };
  patientId: { toString(): string };
  patientName: string;
  doctorId: { toString(): string };
  doctorName: string;
  date: Date;
  time: string;
  duration: number;
  type: string;
  status: string;
  notes?: string | null;
  createdAt?: Date;
}) {
  return {
    id: row.id ?? row._id.toString(),
    patientId: row.patientId.toString(),
    patientName: row.patientName,
    doctorId: row.doctorId.toString(),
    doctorName: row.doctorName,
    date: dateOnly(row.date),
    time: row.time,
    duration: row.duration,
    type: row.type,
    status: row.status,
    notes: row.notes || undefined,
    createdAt: row.createdAt,
  };
}

async function assertNoOverlap(
  organizationId: string,
  doctorId: unknown,
  date: Date,
  time: string,
  duration: number,
  ignoreId?: string
) {
  const { start, end } = utcDayBounds(date);
  const existing = await Appointment.find({
    organizationId,
    doctorId,
    date: { $gte: start, $lt: end },
    status: { $ne: 'cancelled' },
    ...(ignoreId ? { _id: { $ne: ignoreId } } : {}),
  });
  const clash = existing.some((row) => timesOverlap(time, duration, row.time, row.duration));
  if (clash) {
    throw new ApiError(409, 'Ce médecin a déjà un rendez-vous sur ce créneau', 'SCHEDULE_CONFLICT');
  }
}

async function scopeFilter(actor: AuthContext, organizationId: string) {
  if (actor.role === ROLES.DOCTOR) {
    const mine = await actorPersonnel(actor);
    if (!mine) {
      return null;
    }
    return { doctorId: mine._id };
  }
  if (actor.role === ROLES.PATIENT) {
    const patientId = await ownPatientId(actor, organizationId);
    if (!patientId) {
      return null;
    }
    return { patientId };
  }
  return {};
}

async function assertReadable(actor: AuthContext, organizationId: string, row: { doctorId: { toString(): string }; patientId: { toString(): string } }, ip?: string) {
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

export async function listAppointments(
  actor: AuthContext,
  organizationId: string,
  query: { page?: number; limit?: number; date?: string; doctorId?: string; patientId?: string; status?: string }
) {
  const { page, limit, skip } = readPagination(query);
  const scope = await scopeFilter(actor, organizationId);
  if (!scope) {
    return paginated([], 0, page, limit);
  }
  const filter: Record<string, unknown> = { organizationId, ...scope };
  if (query.status) filter.status = query.status;
  if (query.date) {
    const bounds = utcDayBounds(query.date);
    filter.date = { $gte: bounds.start, $lt: bounds.end };
  }
  if (actor.role !== ROLES.DOCTOR && query.doctorId) filter.doctorId = query.doctorId;
  if (actor.role !== ROLES.PATIENT && query.patientId) filter.patientId = query.patientId;
  const [rows, total] = await Promise.all([
    Appointment.find(filter).sort({ date: 1, time: 1 }).skip(skip).limit(limit),
    Appointment.countDocuments(filter),
  ]);
  return paginated(rows.map((row) => toAppointmentDto(row)), total, page, limit);
}

export async function getAppointment(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(Appointment, id, organizationId, actor, 'appointment', ip);
  await assertReadable(actor, organizationId, row, ip);
  return toAppointmentDto(row);
}

export async function createAppointment(
  actor: AuthContext,
  organizationId: string,
  input: {
    patientId: string;
    doctorId: string;
    date: Date;
    time: string;
    duration: number;
    type: 'consultation' | 'followup' | 'exam' | 'emergency';
    notes?: string;
    status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  },
  ip?: string
) {
  const patient = await requireVisiblePatient(actor, organizationId, input.patientId, ip);
  const doctor = await resolveClinicalDoctor(actor, organizationId, input.doctorId, ip);
  if (input.status !== 'cancelled') {
    await assertNoOverlap(organizationId, doctor._id, input.date, input.time, input.duration);
  }
  const row = await Appointment.create({
    organizationId,
    patientId: patient._id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    doctorId: doctor._id,
    doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
    date: utcDayBounds(input.date).start,
    time: input.time,
    duration: input.duration,
    type: input.type,
    status: input.status ?? 'pending',
    notes: input.notes?.trim(),
  });
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'APPOINTMENT_CREATED',
    resourceType: 'appointment',
    resourceId: row.id,
    success: true,
    ip,
  });
  const when = `${dateOnly(row.date)} à ${row.time}`;
  await notifyUser({
    organizationId,
    userId: patient.linkedUserId,
    title: 'Nouveau rendez-vous',
    message: `${row.doctorName} vous propose un rendez-vous le ${when}. Vous pouvez l'accepter depuis votre espace.`,
    relatedId: row.id,
  });
  await notifyUser({
    organizationId,
    userId: doctor.userId,
    title: 'Nouveau rendez-vous',
    message: `Un rendez-vous avec ${row.patientName} est prévu le ${when}.`,
    relatedId: row.id,
  });
  return toAppointmentDto(row);
}

export async function updateAppointment(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: Partial<{
    patientId: string;
    doctorId: string;
    date: Date;
    time: string;
    duration: number;
    type: 'consultation' | 'followup' | 'exam' | 'emergency';
    notes: string;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  }>,
  ip?: string
) {
  const row = await requireOwned(Appointment, id, organizationId, actor, 'appointment', ip);
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
  if (input.date) row.date = utcDayBounds(input.date).start;
  if (input.time) row.time = input.time;
  if (input.duration) row.duration = input.duration;
  if (input.type) row.type = input.type;
  if (input.notes !== undefined) row.notes = input.notes.trim();
  if (input.status) row.status = input.status;
  if (row.status !== 'cancelled') {
    await assertNoOverlap(organizationId, row.doctorId, row.date, row.time, row.duration, row.id);
  }
  await row.save();
  return toAppointmentDto(row);
}

async function respondAsPatient(
  actor: AuthContext,
  organizationId: string,
  id: string,
  decision: 'confirmed' | 'cancelled',
  ip?: string
) {
  if (actor.role !== ROLES.PATIENT) {
    throw new ApiError(403, 'Seul le patient peut répondre à ce rendez-vous', 'FORBIDDEN');
  }
  const row = await requireOwned(Appointment, id, organizationId, actor, 'appointment', ip);
  await assertReadable(actor, organizationId, row, ip);
  if (row.status !== 'pending') {
    throw new ApiError(409, 'Ce rendez-vous ne peut plus être modifié par le patient', 'APPOINTMENT_NOT_PENDING');
  }
  row.status = decision;
  await row.save();
  const when = `${dateOnly(row.date)} à ${row.time}`;
  const doctor = await Personnel.findOne({
    _id: row.doctorId,
    organizationId,
  });
  await notifyUser({
    organizationId,
    userId: doctor?.userId,
    title: decision === 'confirmed' ? 'Rendez-vous accepté' : 'Rendez-vous refusé',
    message: decision === 'confirmed'
      ? `${row.patientName} a accepté le rendez-vous du ${when}.`
      : `${row.patientName} a refusé le rendez-vous du ${when}.`,
    relatedId: row.id,
  });
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: decision === 'confirmed' ? 'APPOINTMENT_ACCEPTED' : 'APPOINTMENT_DECLINED',
    resourceType: 'appointment',
    resourceId: row.id,
    success: true,
    ip,
  });
  return toAppointmentDto(row);
}

export async function acceptAppointment(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  return respondAsPatient(actor, organizationId, id, 'confirmed', ip);
}

export async function declineAppointment(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  return respondAsPatient(actor, organizationId, id, 'cancelled', ip);
}

export async function updateAppointmentStatus(
  actor: AuthContext,
  organizationId: string,
  id: string,
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled',
  ip?: string
) {
  return updateAppointment(actor, organizationId, id, { status }, ip);
}

export async function deleteAppointment(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(Appointment, id, organizationId, actor, 'appointment', ip);
  await assertReadable(actor, organizationId, row, ip);
  await row.deleteOne();
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'APPOINTMENT_DELETED',
    resourceType: 'appointment',
    resourceId: id,
    success: true,
    ip,
  });
}

export async function appointmentsByDate(actor: AuthContext, organizationId: string, date: string) {
  const result = await listAppointments(actor, organizationId, { date, limit: 100, page: 1 });
  return result.data;
}

export async function appointmentsByDoctor(actor: AuthContext, organizationId: string, doctorId: string, ip?: string) {
  const result = await listAppointments(actor, organizationId, { doctorId, limit: 100, page: 1 });
  if (actor.role !== ROLES.DOCTOR) {
    await requireOwned((await import('../models/Personnel.js')).Personnel, doctorId, organizationId, actor, 'personnel', ip);
  }
  return result.data;
}

export async function appointmentsByPatient(actor: AuthContext, organizationId: string, patientId: string, ip?: string) {
  await requireVisiblePatient(actor, organizationId, patientId, ip);
  const result = await listAppointments(actor, organizationId, { patientId, limit: 100, page: 1 });
  return result.data;
}
