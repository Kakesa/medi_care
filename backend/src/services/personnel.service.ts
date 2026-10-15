import { ROLES } from '../config/permissions.js';
import { Personnel } from '../models/Personnel.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { dateOnly } from '../utils/dates.js';
import { escapeRegex } from '../utils/regex.js';
import { paginated, readPagination } from '../utils/pagination.js';
import type { AuthContext } from '../types/express.js';
import { requireActorPersonnel, requireOwned } from './access.service.js';
import { recordAudit } from './audit.service.js';

function toPersonnelDto(person: {
  id?: string;
  _id: { toString(): string };
  userId?: { toString(): string } | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: string;
  department: string;
  speciality?: string | null;
  status: string;
  hireDate?: Date | null;
  createdAt?: Date;
}) {
  return {
    id: person.id ?? person._id.toString(),
    userId: person.userId ? person.userId.toString() : undefined,
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    phone: person.phone || '',
    role: person.role,
    department: person.department,
    speciality: person.speciality || undefined,
    status: person.status,
    hireDate: dateOnly(person.hireDate) || dateOnly(person.createdAt) || '',
  };
}

async function linkUserId(organizationId: string, email: string) {
  const user = await User.findOne({ organizationId, email: email.toLowerCase().trim() });
  if (!user) {
    return undefined;
  }
  const taken = await Personnel.exists({ userId: user._id });
  return taken ? undefined : user._id;
}

export async function resolveClinicalDoctor(
  actor: AuthContext,
  organizationId: string,
  requestedDoctorId: string | undefined,
  ip?: string
) {
  if (actor.role === ROLES.DOCTOR) {
    const mine = await requireActorPersonnel(actor);
    if (mine.role !== 'doctor') {
      throw new ApiError(403, 'Aucune fiche médecin liée à ce compte', 'NO_PERSONNEL');
    }
    return mine;
  }
  if (!requestedDoctorId) {
    throw new ApiError(400, 'Médecin requis', 'INVALID_DOCTOR');
  }
  const doctor = await requireOwned(Personnel, requestedDoctorId, organizationId, actor, 'personnel', ip);
  if (doctor.archivedAt || doctor.role !== 'doctor' || doctor.status === 'inactive') {
    throw new ApiError(400, 'Médecin invalide pour cet établissement', 'INVALID_DOCTOR');
  }
  return doctor;
}

export async function listPersonnel(
  organizationId: string,
  query: { page?: number; limit?: number; role?: string; department?: string; status?: string; search?: string }
) {
  const { page, limit, skip } = readPagination(query);
  const filter: Record<string, unknown> = { organizationId, archivedAt: null };
  if (query.role) filter.role = query.role;
  if (query.department) filter.department = query.department;
  if (query.status) filter.status = query.status;
  if (query.search) {
    const safe = escapeRegex(query.search.trim());
    filter.$or = [
      { firstName: new RegExp(safe, 'i') },
      { lastName: new RegExp(safe, 'i') },
      { email: new RegExp(safe, 'i') },
    ];
  }
  const [rows, total] = await Promise.all([
    Personnel.find(filter).sort({ lastName: 1, firstName: 1 }).skip(skip).limit(limit),
    Personnel.countDocuments(filter),
  ]);
  return paginated(rows.map((row) => toPersonnelDto(row)), total, page, limit);
}

export async function listDoctors(organizationId: string) {
  const rows = await Personnel.find({
    organizationId,
    role: 'doctor',
    status: 'active',
    archivedAt: null,
  }).sort({ lastName: 1 });
  return rows.map((row) => toPersonnelDto(row));
}

export async function getPersonnel(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const person = await requireOwned(Personnel, id, organizationId, actor, 'personnel', ip);
  if (person.archivedAt) {
    throw new ApiError(404, 'Ressource introuvable', 'NOT_FOUND');
  }
  return toPersonnelDto(person);
}

export async function createPersonnel(
  actor: AuthContext,
  organizationId: string,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role: 'doctor' | 'nurse' | 'receptionist' | 'admin' | 'secretary';
    department: string;
    speciality?: string;
    status?: 'active' | 'pending' | 'inactive';
  },
  ip?: string
) {
  const person = await Personnel.create({
    organizationId,
    userId: await linkUserId(organizationId, input.email),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.toLowerCase().trim(),
    phone: input.phone?.trim() || '',
    role: input.role,
    department: input.department.trim(),
    speciality: input.speciality?.trim(),
    status: input.status ?? 'active',
  });
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'PERSONNEL_CREATED',
    resourceType: 'personnel',
    resourceId: person.id,
    success: true,
    ip,
  });
  return toPersonnelDto(person);
}

export async function updatePersonnel(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: 'doctor' | 'nurse' | 'receptionist' | 'admin' | 'secretary';
    department: string;
    speciality: string;
    status: 'active' | 'pending' | 'inactive';
  }>,
  ip?: string
) {
  const person = await requireOwned(Personnel, id, organizationId, actor, 'personnel', ip);
  if (person.archivedAt) {
    throw new ApiError(404, 'Ressource introuvable', 'NOT_FOUND');
  }
  if (input.firstName !== undefined) person.firstName = input.firstName.trim();
  if (input.lastName !== undefined) person.lastName = input.lastName.trim();
  if (input.phone !== undefined) person.phone = input.phone.trim();
  if (input.role !== undefined) person.role = input.role;
  if (input.department !== undefined) person.department = input.department.trim();
  if (input.speciality !== undefined) person.speciality = input.speciality.trim();
  if (input.status !== undefined) person.status = input.status;
  if (input.email !== undefined) {
    person.email = input.email.toLowerCase().trim();
    const linked = await linkUserId(organizationId, person.email);
    if (linked && String(linked) !== String(person.userId ?? '')) {
      person.userId = linked;
    }
  }
  await person.save();
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'PERSONNEL_UPDATED',
    resourceType: 'personnel',
    resourceId: person.id,
    success: true,
    ip,
  });
  return toPersonnelDto(person);
}

export async function updatePersonnelStatus(
  actor: AuthContext,
  organizationId: string,
  id: string,
  status: 'active' | 'pending' | 'inactive',
  ip?: string
) {
  return updatePersonnel(actor, organizationId, id, { status }, ip);
}

export async function archivePersonnel(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const person = await requireOwned(Personnel, id, organizationId, actor, 'personnel', ip);
  person.archivedAt = new Date();
  person.status = 'inactive';
  person.userId = undefined;
  await person.save();
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'PERSONNEL_ARCHIVED',
    resourceType: 'personnel',
    resourceId: id,
    success: true,
    ip,
  });
}
