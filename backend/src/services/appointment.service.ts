import { ROLES } from '../config/permissions.js';
import { Appointment } from '../models/Appointment.js';
import { Organization } from '../models/Organization.js';
import { Patient } from '../models/Patient.js';
import { Personnel } from '../models/Personnel.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { dateOnly, timesOverlap, utcDayBounds } from '../utils/dates.js';
import { paginated, readPagination } from '../utils/pagination.js';
import type { AuthContext } from '../types/express.js';
import { actorPersonnel, ownPatientId, requireOwned, requireVisiblePatient } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { sendMail } from './mailer.js';
import { notifyUser } from './notification.service.js';
import { resolveClinicalDoctor } from './personnel.service.js';
import { issuePatientLogin } from './user.service.js';

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
  requestedBy?: string | null;
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
    requestedBy: row.requestedBy === 'patient' ? 'patient' : 'staff',
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
    patientId?: string;
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
  const requestedBy = actor.role === ROLES.PATIENT ? 'patient' : 'staff';
  const patientId = requestedBy === 'patient'
    ? (await ownPatientId(actor, organizationId))?.toString()
    : input.patientId;
  if (!patientId) {
    throw new ApiError(
      requestedBy === 'patient' ? 404 : 400,
      requestedBy === 'patient' ? 'Dossier patient introuvable' : 'Patient requis',
      requestedBy === 'patient' ? 'NOT_FOUND' : 'VALIDATION_ERROR',
    );
  }
  const patient = await requireVisiblePatient(actor, organizationId, patientId, ip);
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
    status: requestedBy === 'patient' ? 'pending' : (input.status ?? 'pending'),
    requestedBy,
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
  const patientMessage = requestedBy === 'patient'
    ? `Votre demande de rendez-vous avec ${row.doctorName} le ${when} a été envoyée.`
    : `${row.doctorName} vous propose un rendez-vous le ${when}. Vous pouvez l'accepter depuis votre espace.`;
  const doctorMessage = requestedBy === 'patient'
    ? `${row.patientName} demande un rendez-vous le ${when}. Vous pouvez l'accepter depuis votre espace.`
    : `Un rendez-vous avec ${row.patientName} est prévu le ${when}.`;
  const notice = await deliverAppointmentNotice({
    organizationId,
    patient,
    doctor,
    when,
    patientMessage,
    doctorMessage,
    relatedId: row.id,
    closing: requestedBy === 'patient'
      ? 'Le médecin confirmera ce créneau depuis MediCare.'
      : 'Connectez-vous à MediCare pour accepter ou refuser ce rendez-vous.',
  });
  const dto = toAppointmentDto(row);
  return notice ? { ...dto, notice } : dto;
}

async function attachPatientLogin(
  patient: {
    _id: unknown;
    email?: string | null;
    phone?: string | null;
    firstName: string;
    lastName: string;
    linkedUserId?: { toString(): string } | string | null;
    save: () => Promise<unknown>;
  },
  organizationId: string
) {
  if (patient.linkedUserId) return patient.linkedUserId;
  const email = patient.email?.toLowerCase().trim();
  if (!email) return null;

  const existing = await User.findOne({ email });
  if (existing) {
    const sameHospital = existing.role === ROLES.PATIENT && String(existing.organizationId ?? '') === organizationId;
    const taken = sameHospital
      ? await Patient.exists({ linkedUserId: existing._id, _id: { $ne: patient._id } })
      : true;
    if (!sameHospital || taken) return null;
    patient.linkedUserId = existing._id;
    await patient.save();
    return existing._id;
  }

  const organization = await Organization.findById(organizationId);
  const account = await issuePatientLogin({
    organizationId,
    organizationName: organization?.name || 'MediCare',
    firstName: patient.firstName,
    lastName: patient.lastName,
    email,
    phone: patient.phone || undefined,
  });
  patient.linkedUserId = account._id;
  await patient.save();
  return account._id;
}

async function deliverAppointmentNotice(input: {
  organizationId: string;
  patient: {
    _id: unknown;
    email?: string | null;
    phone?: string | null;
    firstName: string;
    lastName: string;
    linkedUserId?: { toString(): string } | string | null;
    save: () => Promise<unknown>;
  };
  doctor: { userId?: { toString(): string } | string | null; email?: string | null; firstName?: string; lastName?: string };
  when: string;
  patientMessage: string;
  doctorMessage: string;
  relatedId: string;
  closing?: string;
}) {
  const warnings: string[] = [];
  let patientUserId = input.patient.linkedUserId;
  if (!patientUserId && input.patient.email) {
    try {
      patientUserId = await attachPatientLogin(input.patient, input.organizationId);
    } catch {
      warnings.push("Le compte du patient n'a pas pu être créé : l'e-mail n'est pas parti.");
    }
  }

  await notifyUser({
    organizationId: input.organizationId,
    userId: patientUserId,
    title: 'Nouveau rendez-vous',
    message: input.patientMessage,
    relatedId: input.relatedId,
  });
  await notifyUser({
    organizationId: input.organizationId,
    userId: input.doctor.userId,
    title: 'Nouveau rendez-vous',
    message: input.doctorMessage,
    relatedId: input.relatedId,
  });

  const patientEmail = input.patient.email?.trim();
  if (!patientEmail) {
    warnings.push("Ce dossier n'a pas d'adresse e-mail : le patient n'a pas été prévenu.");
  } else {
    try {
      await sendMail({
        to: patientEmail,
        subject: 'Nouveau rendez-vous',
        text: [
          `Bonjour ${input.patient.firstName} ${input.patient.lastName},`,
          '',
          input.patientMessage,
          '',
          input.closing || 'Connectez-vous à MediCare pour accepter ou refuser ce rendez-vous.',
        ].join('\n'),
      });
    } catch {
      warnings.push("Le rendez-vous est enregistré, mais l'e-mail n'a pas pu être envoyé au patient.");
    }
  }

  const doctorEmail = input.doctor.email?.trim();
  if (doctorEmail) {
    try {
      await sendMail({
        to: doctorEmail,
        subject: 'Nouveau rendez-vous',
        text: input.doctorMessage,
      });
    } catch {
      warnings.push("L'e-mail n'a pas pu être envoyé au médecin.");
    }
  }

  return warnings.length ? warnings.join(' ') : undefined;
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

async function respondToAppointment(
  actor: AuthContext,
  organizationId: string,
  id: string,
  decision: 'confirmed' | 'cancelled',
  ip?: string
) {
  const row = await requireOwned(Appointment, id, organizationId, actor, 'appointment', ip);
  await assertReadable(actor, organizationId, row, ip);
  if (row.status !== 'pending') {
    throw new ApiError(409, 'Ce rendez-vous ne peut plus être modifié', 'APPOINTMENT_NOT_PENDING');
  }
  const requestedBy = row.requestedBy === 'patient' ? 'patient' : 'staff';
  const staffResponder = actor.role === ROLES.DOCTOR || actor.role === ROLES.HOSPITAL_ADMIN || actor.role === ROLES.RECEPTIONIST;
  if (requestedBy === 'staff' && actor.role !== ROLES.PATIENT) {
    throw new ApiError(403, 'Seul le patient peut répondre à ce rendez-vous', 'FORBIDDEN');
  }
  if (requestedBy === 'patient' && actor.role === ROLES.PATIENT && decision === 'confirmed') {
    throw new ApiError(403, 'Le médecin doit confirmer cette demande', 'FORBIDDEN');
  }
  if (requestedBy === 'patient' && !staffResponder && actor.role !== ROLES.PATIENT) {
    throw new ApiError(403, 'Vous ne pouvez pas répondre à cette demande', 'FORBIDDEN');
  }
  row.status = decision;
  await row.save();
  const when = `${dateOnly(row.date)} à ${row.time}`;
  const doctor = await Personnel.findOne({ _id: row.doctorId, organizationId });
  const patient = await Patient.findOne({ _id: row.patientId, organizationId });
  const patientCancelled = requestedBy === 'patient' && actor.role === ROLES.PATIENT;
  const title = decision === 'confirmed' ? 'Rendez-vous accepté' : 'Rendez-vous refusé';
  const message = patientCancelled
    ? `${row.patientName} a annulé sa demande de rendez-vous du ${when}.`
    : requestedBy === 'patient'
      ? (decision === 'confirmed'
        ? `${row.doctorName} a accepté votre demande de rendez-vous du ${when}.`
        : `${row.doctorName} a refusé votre demande de rendez-vous du ${when}.`)
      : (decision === 'confirmed'
        ? `${row.patientName} a accepté le rendez-vous du ${when}.`
        : `${row.patientName} a refusé le rendez-vous du ${when}.`);
  const recipientUserId = patientCancelled || requestedBy === 'staff' ? doctor?.userId : patient?.linkedUserId;
  const recipientEmail = patientCancelled || requestedBy === 'staff' ? doctor?.email : patient?.email;
  await notifyUser({
    organizationId,
    userId: recipientUserId,
    title,
    message,
    relatedId: row.id,
  });
  if (recipientEmail) {
    try {
      await sendMail({ to: recipientEmail, subject: title, text: message });
    } catch {
      // La réponse reste enregistrée même si l'e-mail n'est pas parti.
    }
  }
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
  return respondToAppointment(actor, organizationId, id, 'confirmed', ip);
}

export async function declineAppointment(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  return respondToAppointment(actor, organizationId, id, 'cancelled', ip);
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
