import { ReceptionEntry } from '../models/ReceptionEntry.js';
import { paginated, readPagination } from '../utils/pagination.js';
import type { AuthContext } from '../types/express.js';
import { requireOwned, requireVisiblePatient } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { resolveClinicalDoctor } from './personnel.service.js';

function toReceptionDto(row: {
  id?: string;
  _id: { toString(): string };
  patientId: { toString(): string };
  patientName: string;
  arrivalTime: string;
  reason: string;
  priority: string;
  status: string;
  assignedDoctor?: string | null;
  notes?: string | null;
  createdAt?: Date;
}) {
  return {
    id: row.id ?? row._id.toString(),
    patientId: row.patientId.toString(),
    patientName: row.patientName,
    arrivalTime: row.arrivalTime,
    reason: row.reason,
    priority: row.priority,
    status: row.status,
    assignedDoctor: row.assignedDoctor || undefined,
    notes: row.notes || undefined,
    createdAt: row.createdAt,
  };
}

function nowTime() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export async function listReception(organizationId: string, query: { page?: number; limit?: number }) {
  const { page, limit, skip } = readPagination(query);
  const filter = { organizationId };
  const [rows, total] = await Promise.all([
    ReceptionEntry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ReceptionEntry.countDocuments(filter),
  ]);
  return paginated(rows.map((row) => toReceptionDto(row)), total, page, limit);
}

export async function getReception(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(ReceptionEntry, id, organizationId, actor, 'reception', ip);
  return toReceptionDto(row);
}

export async function createReception(
  actor: AuthContext,
  organizationId: string,
  input: { patientId: string; reason: string; priority?: 'low' | 'medium' | 'high' | 'urgent'; notes?: string },
  ip?: string
) {
  const patient = await requireVisiblePatient(actor, organizationId, input.patientId, ip);
  const row = await ReceptionEntry.create({
    organizationId,
    patientId: patient._id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    arrivalTime: nowTime(),
    reason: input.reason.trim(),
    priority: input.priority ?? 'medium',
    status: 'waiting',
    notes: input.notes?.trim(),
  });
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'RECEPTION_CREATED',
    resourceType: 'reception',
    resourceId: row.id,
    success: true,
    ip,
  });
  return toReceptionDto(row);
}

export async function updateReception(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: Partial<{ reason: string; priority: 'low' | 'medium' | 'high' | 'urgent'; notes: string; status: string; assignedDoctor: string }>,
  ip?: string
) {
  const row = await requireOwned(ReceptionEntry, id, organizationId, actor, 'reception', ip);
  if (input.reason !== undefined) row.reason = input.reason.trim();
  if (input.priority) row.priority = input.priority;
  if (input.notes !== undefined) row.notes = input.notes.trim();
  if (input.status) row.status = input.status;
  if (input.assignedDoctor !== undefined) row.assignedDoctor = input.assignedDoctor.trim();
  await row.save();
  return toReceptionDto(row);
}

export async function updateReceptionStatus(
  actor: AuthContext,
  organizationId: string,
  id: string,
  status: 'waiting' | 'in_consultation' | 'completed' | 'cancelled',
  assignedDoctor: string | undefined,
  ip?: string
) {
  return updateReception(actor, organizationId, id, { status, assignedDoctor }, ip);
}

export async function assignReceptionDoctor(
  actor: AuthContext,
  organizationId: string,
  id: string,
  doctorId: string,
  ip?: string
) {
  const row = await requireOwned(ReceptionEntry, id, organizationId, actor, 'reception', ip);
  const doctor = await resolveClinicalDoctor(actor, organizationId, doctorId, ip);
  row.doctorId = doctor._id;
  row.assignedDoctor = `Dr. ${doctor.firstName} ${doctor.lastName}`;
  row.status = 'in_consultation';
  await row.save();
  return toReceptionDto(row);
}

export async function cancelReception(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(ReceptionEntry, id, organizationId, actor, 'reception', ip);
  row.status = 'cancelled';
  await row.save();
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'RECEPTION_CANCELLED',
    resourceType: 'reception',
    resourceId: id,
    success: true,
    ip,
  });
}

export async function waitingReception(organizationId: string) {
  const rows = await ReceptionEntry.find({ organizationId, status: 'waiting' }).sort({ createdAt: 1 });
  return rows.map((row) => toReceptionDto(row));
}

export async function todayReceptionStats(organizationId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rows = await ReceptionEntry.find({ organizationId, createdAt: { $gte: start } });
  return {
    waiting: rows.filter((row) => row.status === 'waiting').length,
    inConsultation: rows.filter((row) => row.status === 'in_consultation').length,
    completed: rows.filter((row) => row.status === 'completed').length,
    cancelled: rows.filter((row) => row.status === 'cancelled').length,
  };
}
