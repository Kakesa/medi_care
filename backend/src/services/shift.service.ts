import mongoose from 'mongoose';
import { MedicationAdministration } from '../models/MedicationAdministration.js';
import { NurseShift } from '../models/NurseShift.js';
import { User } from '../models/User.js';
import { ROLES } from '../config/permissions.js';
import { ApiError } from '../utils/ApiError.js';
import { recordAudit } from './audit.service.js';
import { notifyUser } from './notification.service.js';
import { sendPush } from './push.service.js';
import type { AuthContext } from '../types/express.js';
import {
  addDays, facilityDate, formatShiftDate, rangesOverlap, restDates, rotationDates, shiftBounds,
} from './shift.logic.js';

type ShiftInput = {
  nurseIds: string[];
  date: string;
  startTime: string;
  endTime: string;
  type: 'morning' | 'afternoon' | 'night' | 'full_day';
  ward: string;
};

const typeLabels = {
  morning: 'matin',
  afternoon: 'après-midi',
  night: 'nuit',
  full_day: 'journée complète',
};

async function nursesInOrganization(organizationId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const rows = await User.find({
    _id: { $in: unique }, organizationId, role: ROLES.NURSE, isActive: true,
  }).select('firstName lastName');
  if (rows.length !== unique.length) {
    throw new ApiError(400, 'Un infirmier sélectionné est introuvable dans l’établissement', 'NURSE_NOT_FOUND');
  }
  return new Map(rows.map((row) => [row.id, `${row.firstName} ${row.lastName}`]));
}

async function assertNoConflict(organizationId: string, nurseId: string, date: string, startTime: string, endTime: string, ignoreId?: string) {
  const wanted = shiftBounds(date, startTime, endTime);
  const rows = await NurseShift.find({
    organizationId,
    nurseId,
    status: { $ne: 'cancelled' },
    date: { $in: [addDays(date, -1), date, addDays(date, 1)] },
    ...(ignoreId ? { _id: { $ne: ignoreId } } : {}),
  });
  const clash = rows.find((row) => rangesOverlap(wanted, shiftBounds(row.date, row.startTime, row.endTime)));
  if (clash) throw new ApiError(409, 'Cet infirmier a déjà une garde sur ce créneau', 'SHIFT_CONFLICT');
}

async function tell(organizationId: string, userId: string, title: string, message: string, relatedId: string) {
  await notifyUser({ organizationId, userId, title, message, type: 'shift', relatedId });
  await sendPush(userId, { title, body: message, url: '/dashboard' });
}

function assignmentMessage(date: string, startTime: string, endTime: string, ward: string) {
  return `Bonjour, vous êtes programmé(e) pour une garde le ${formatShiftDate(date)}, de ${startTime} à ${endTime}, au service ${ward}.`;
}

async function toDto(row: InstanceType<typeof NurseShift>, names: Map<string, string>) {
  return {
    id: row.id,
    nurseId: row.nurseId.toString(),
    nurseName: names.get(row.nurseId.toString()) ?? 'Infirmier',
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    type: row.type,
    ward: row.ward,
    status: row.status,
    absent: row.absent,
    absenceReason: row.absenceReason,
    actualStartedAt: row.actualStartedAt,
    actualEndedAt: row.actualEndedAt,
    handoverNote: row.handoverNote,
    handoverSummary: row.handoverSummary,
    history: row.history.map((entry) => ({
      at: entry.at,
      action: entry.action,
      reason: entry.reason,
      fromNurseId: entry.fromNurseId?.toString(),
      toNurseId: entry.toNurseId?.toString(),
    })),
  };
}

async function namesFor(organizationId: string, ids: string[]) {
  const rows = await User.find({ _id: { $in: [...new Set(ids)] }, organizationId }).select('firstName lastName');
  return new Map(rows.map((row) => [row.id, `${row.firstName} ${row.lastName}`]));
}

export async function listStaff(organizationId: string) {
  const rows = await User.find({ organizationId, role: ROLES.NURSE, isActive: true }).sort({ lastName: 1, firstName: 1 }).select('firstName lastName');
  return rows.map((row) => ({ id: row.id, name: `${row.firstName} ${row.lastName}` }));
}

export async function listShifts(organizationId: string, query: { from?: string; to?: string }) {
  const from = query.from || facilityDate();
  const to = query.to || addDays(from, 6);
  const rows = await NurseShift.find({ organizationId, date: { $gte: from, $lte: to } }).sort({ date: 1, startTime: 1 });
  const names = await namesFor(organizationId, rows.map((row) => row.nurseId.toString()));
  return Promise.all(rows.map((row) => toDto(row, names)));
}

export async function createShifts(actor: AuthContext, organizationId: string, input: ShiftInput, ip?: string) {
  const names = await nursesInOrganization(organizationId, input.nurseIds);
  for (const nurseId of names.keys()) {
    await assertNoConflict(organizationId, nurseId, input.date, input.startTime, input.endTime);
  }
  const created = [];
  for (const nurseId of names.keys()) {
    const row = await NurseShift.create({
      organizationId,
      nurseId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      type: input.type,
      ward: input.ward.trim(),
      status: 'scheduled',
      history: [{ at: new Date(), actorId: actor.id, action: 'CREATED', reason: '' }],
    });
    created.push(row);
    await tell(organizationId, nurseId, 'Nouvelle garde', assignmentMessage(input.date, input.startTime, input.endTime, input.ward.trim()), row.id);
  }
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'SHIFT_CREATED',
    resourceType: 'nurse-shift', success: true, ip,
    metadata: { count: created.length, date: input.date, type: typeLabels[input.type] },
  });
  const nameMap = await namesFor(organizationId, [...names.keys()]);
  return Promise.all(created.map((row) => toDto(row, nameMap)));
}

export async function createRotation(actor: AuthContext, organizationId: string, input: ShiftInput & {
  from: string; to: string; workDays: number; restDays: number;
}, ip?: string) {
  const names = await nursesInOrganization(organizationId, input.nurseIds);
  const plan: Array<{ nurseId: string; date: string }> = [];
  let offset = 0;
  for (const nurseId of names.keys()) {
    for (const date of rotationDates(input.from, input.to, input.workDays, input.restDays, offset)) {
      plan.push({ nurseId, date });
    }
    offset += input.workDays;
  }
  for (const item of plan) {
    await assertNoConflict(organizationId, item.nurseId, item.date, input.startTime, input.endTime);
  }
  const created = [];
  for (const item of plan) {
    created.push(await NurseShift.create({
      organizationId, nurseId: item.nurseId, date: item.date,
      startTime: input.startTime, endTime: input.endTime, type: input.type, ward: input.ward.trim(),
      status: 'scheduled',
      history: [{ at: new Date(), actorId: actor.id, action: 'ROTATION', reason: `${input.workDays} jour(s) / ${input.restDays} repos` }],
    }));
  }
  for (const nurseId of names.keys()) {
    const first = plan.find((item) => item.nurseId === nurseId);
    if (!first) continue;
    await tell(organizationId, nurseId, 'Rotation de gardes', `Votre rotation commence le ${formatShiftDate(first.date)}, de ${input.startTime} à ${input.endTime}, au service ${input.ward.trim()}.`, created.find((row) => row.nurseId.toString() === nurseId)?.id ?? '');
  }
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'SHIFT_ROTATION_CREATED',
    resourceType: 'nurse-shift', success: true, ip, metadata: { count: created.length },
  });
  const nameMap = await namesFor(organizationId, [...names.keys()]);
  return Promise.all(created.map((row) => toDto(row, nameMap)));
}

async function loadShift(organizationId: string, id: string) {
  const row = await NurseShift.findOne({ _id: id, organizationId });
  if (!row) throw new ApiError(404, 'Garde introuvable', 'NOT_FOUND');
  return row;
}

export async function updateShift(actor: AuthContext, organizationId: string, id: string, input: {
  date: string; startTime: string; endTime: string; type: ShiftInput['type']; ward: string; status?: 'scheduled' | 'confirmed' | 'cancelled';
}, ip?: string) {
  const row = await loadShift(organizationId, id);
  if (row.status === 'completed' || row.status === 'in_progress') {
    throw new ApiError(409, 'Une garde commencée ne se modifie pas ainsi', 'SHIFT_LOCKED');
  }
  await assertNoConflict(organizationId, row.nurseId.toString(), input.date, input.startTime, input.endTime, row.id);
  const changed = row.date !== input.date || row.startTime !== input.startTime || row.endTime !== input.endTime || row.ward !== input.ward.trim() || (input.status && input.status !== row.status);
  row.date = input.date;
  row.startTime = input.startTime;
  row.endTime = input.endTime;
  row.type = input.type;
  row.ward = input.ward.trim();
  if (input.status) row.status = input.status;
  row.sentReminders = row.sentReminders.filter((key) => key !== 'before' && key !== 'start' && key !== 'eve');
  row.history.push({ at: new Date(), actorId: actor.id, action: input.status === 'cancelled' ? 'CANCELLED' : 'UPDATED', reason: '' });
  await row.save();
  if (changed) {
    const title = input.status === 'cancelled' ? 'Garde annulée' : 'Garde modifiée';
    const message = input.status === 'cancelled'
      ? `Votre garde du ${formatShiftDate(input.date)} est annulée.`
      : `Votre garde a été mise à jour : ${formatShiftDate(input.date)}, de ${input.startTime} à ${input.endTime}, service ${input.ward.trim()}.`;
    await tell(organizationId, row.nurseId.toString(), title, message, row.id);
  }
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'SHIFT_UPDATED',
    resourceType: 'nurse-shift', resourceId: row.id, success: true, ip,
  });
  const names = await namesFor(organizationId, [row.nurseId.toString()]);
  return toDto(row, names);
}

export async function declareAbsence(actor: AuthContext, organizationId: string, id: string, reason: string, ip?: string) {
  const row = await loadShift(organizationId, id);
  if (row.status === 'completed' || row.status === 'cancelled') throw new ApiError(409, 'Cette garde ne peut plus être marquée absente', 'SHIFT_LOCKED');
  row.absent = true;
  row.absenceReason = reason;
  row.history.push({ at: new Date(), actorId: actor.id, action: 'ABSENCE', reason });
  await row.save();
  await tell(organizationId, row.nurseId.toString(), 'Absence enregistrée', `Votre garde du ${formatShiftDate(row.date)} est marquée en absence. Le remplacement sera validé par l’administration.`, row.id);
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'SHIFT_ABSENCE',
    resourceType: 'nurse-shift', resourceId: row.id, success: true, ip,
  });
  const names = await namesFor(organizationId, [row.nurseId.toString()]);
  return toDto(row, names);
}

export async function replaceNurse(actor: AuthContext, organizationId: string, id: string, nurseId: string, reason: string, ip?: string) {
  const row = await loadShift(organizationId, id);
  if (row.status === 'completed' || row.status === 'cancelled' || row.status === 'in_progress') {
    throw new ApiError(409, 'Cette garde ne peut plus changer d’infirmier', 'SHIFT_LOCKED');
  }
  if (nurseId === row.nurseId.toString()) throw new ApiError(400, 'Choisissez un autre infirmier', 'SAME_NURSE');
  await nursesInOrganization(organizationId, [nurseId]);
  await assertNoConflict(organizationId, nurseId, row.date, row.startTime, row.endTime, row.id);
  const previous = row.nurseId.toString();
  row.history.push({
    at: new Date(), actorId: actor.id, action: 'REPLACED', reason,
    fromNurseId: row.nurseId, toNurseId: new mongoose.Types.ObjectId(nurseId),
  });
  row.nurseId = new mongoose.Types.ObjectId(nurseId);
  row.absent = false;
  row.sentReminders = [];
  await row.save();
  await tell(organizationId, previous, 'Garde transférée', `Vous n’êtes plus affecté(e) à la garde du ${formatShiftDate(row.date)}. Motif : ${reason}`, row.id);
  await tell(organizationId, nurseId, 'Remplacement de garde', `Vous remplacez une garde le ${formatShiftDate(row.date)}, de ${row.startTime} à ${row.endTime}, au service ${row.ward}.`, row.id);
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'SHIFT_REPLACED',
    resourceType: 'nurse-shift', resourceId: row.id, success: true, ip, metadata: { from: previous, to: nurseId },
  });
  const names = await namesFor(organizationId, [previous, nurseId]);
  return toDto(row, names);
}

export async function myBoard(actor: AuthContext, organizationId: string) {
  const today = facilityDate();
  const horizon = addDays(today, 30);
  const rows = await NurseShift.find({
    organizationId, nurseId: actor.id, date: { $gte: addDays(today, -30), $lte: horizon },
  }).sort({ date: 1, startTime: 1 });
  const names = await namesFor(organizationId, [actor.id]);
  const items = await Promise.all(rows.map((row) => toDto(row, names)));
  const open = items.filter((item) => item.status !== 'cancelled');
  const todayShifts = open.filter((item) => item.date === today);
  const upcoming = open.filter((item) => item.date > today && item.status !== 'completed');
  const history = items.filter((item) => item.date < today || item.status === 'completed' || item.status === 'cancelled').slice(-20).reverse();
  const worked = open.filter((item) => item.date >= today && item.date <= horizon && item.status !== 'cancelled').map((item) => item.date);
  const ward = todayShifts[0]?.ward;
  const previous = await NurseShift.findOne({
    organizationId,
    status: 'completed',
    date: { $gte: addDays(today, -2), $lte: today },
    ...(ward ? { ward } : {}),
    $or: [{ handoverSummary: { $ne: '' } }, { handoverNote: { $ne: '' } }],
  }).sort({ actualEndedAt: -1 });
  return {
    today: todayShifts,
    next: upcoming[0] ?? todayShifts.find((item) => item.status !== 'completed') ?? null,
    upcoming,
    history,
    restDays: restDates(today, addDays(today, 13), worked),
    handover: previous ? { note: previous.handoverNote, summary: previous.handoverSummary, date: previous.date, ward: previous.ward } : null,
  };
}

export async function startShift(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await loadShift(organizationId, id);
  if (row.nurseId.toString() !== actor.id) throw new ApiError(403, 'Cette garde ne vous est pas affectée', 'SHIFT_FORBIDDEN');
  if (row.status !== 'scheduled' && row.status !== 'confirmed') throw new ApiError(409, 'Cette garde ne peut pas être commencée', 'SHIFT_LOCKED');
  const bounds = shiftBounds(row.date, row.startTime, row.endTime);
  if (Date.now() + 2 * 60 * 60 * 1000 < bounds.start.getTime()) {
    throw new ApiError(409, 'La prise de service ouvre deux heures avant le début', 'SHIFT_TOO_EARLY');
  }
  row.status = 'in_progress';
  row.actualStartedAt = new Date();
  row.history.push({ at: row.actualStartedAt, actorId: actor.id, action: 'STARTED', reason: '' });
  await row.save();
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'SHIFT_STARTED',
    resourceType: 'nurse-shift', resourceId: row.id, success: true, ip,
  });
  const names = await namesFor(organizationId, [actor.id]);
  return toDto(row, names);
}

export async function endShift(actor: AuthContext, organizationId: string, id: string, note: string, ip?: string) {
  const row = await loadShift(organizationId, id);
  if (row.nurseId.toString() !== actor.id) throw new ApiError(403, 'Cette garde ne vous est pas affectée', 'SHIFT_FORBIDDEN');
  if (row.status !== 'in_progress') throw new ApiError(409, 'La garde n’est pas en cours', 'SHIFT_LOCKED');
  const bounds = shiftBounds(row.date, row.startTime, row.endTime);
  const pending = await MedicationAdministration.find({
    organizationId,
    scheduledAt: { $gte: bounds.start, $lt: bounds.end },
    status: { $in: ['pending', 'not_administered', 'patient_refused'] },
  }).sort({ scheduledAt: 1 }).limit(40);
  const summary = pending.map((dose) => `${dose.medication} · ${dose.status === 'pending' ? 'non confirmée' : 'non effectuée'}`).join('\n');
  row.status = 'completed';
  row.actualEndedAt = new Date();
  row.handoverNote = note;
  row.handoverSummary = summary;
  row.history.push({ at: row.actualEndedAt, actorId: actor.id, action: 'ENDED', reason: note });
  await row.save();
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'SHIFT_ENDED',
    resourceType: 'nurse-shift', resourceId: row.id, success: true, ip,
  });
  const names = await namesFor(organizationId, [actor.id]);
  return toDto(row, names);
}

export async function dispatchShiftReminders() {
  const today = facilityDate();
  const tomorrow = addDays(today, 1);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kinshasa', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const rows = await NurseShift.find({
    status: { $in: ['scheduled', 'confirmed'] },
    date: { $in: [today, tomorrow] },
  });
  for (const row of rows) {
    const bounds = shiftBounds(row.date, row.startTime, row.endTime);
    const now = Date.now();
    const tasks: Array<{ key: string; when: boolean; title: string; message: string }> = [
      {
        key: 'eve',
        when: row.date === tomorrow && hour >= 18,
        title: 'Rappel de garde',
        message: `Rappel : vous avez une garde demain à ${row.startTime}, au service ${row.ward}. Merci de prendre vos dispositions.`,
      },
      {
        key: 'before',
        when: row.date === today && now >= bounds.start.getTime() - 60 * 60 * 1000 && now < bounds.start.getTime(),
        title: 'Prise de service bientôt',
        message: `Votre garde commence à ${row.startTime}, au service ${row.ward}.`,
      },
      {
        key: 'start',
        when: row.date === today && now >= bounds.start.getTime() && now < bounds.start.getTime() + 20 * 60 * 1000,
        title: 'Début de garde',
        message: `Votre garde commence maintenant, jusqu’à ${row.endTime}, au service ${row.ward}.`,
      },
    ];
    for (const task of tasks) {
      if (!task.when) continue;
      const claimed = await NurseShift.findOneAndUpdate(
        { _id: row._id, sentReminders: { $ne: task.key } },
        { $addToSet: { sentReminders: task.key } },
      );
      if (!claimed) continue;
      await tell(String(row.organizationId), row.nurseId.toString(), task.title, task.message, row.id);
    }
  }
}
