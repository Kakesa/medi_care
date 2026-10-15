import mongoose, { type FilterQuery } from 'mongoose';
import { ROLES, type UserRole } from '../config/permissions.js';
import { Organization } from '../models/Organization.js';
import { Patient } from '../models/Patient.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/regex.js';
import { paginated, readPagination } from '../utils/pagination.js';
import { dateOnly } from '../utils/dates.js';
import { doctorCanSeePatient, linkedPatientIds } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { issuePatientLogin } from './user.service.js';
import type { AuthContext } from '../types/express.js';

interface PatientWriteInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: 'M' | 'F';
  address?: string;
  bloodType?: string;
  allergies?: string[];
  status?: 'outpatient' | 'hospitalized' | 'discharged';
  room?: string;
  primaryDoctorId?: string | null;
  linkedUserId?: string;
  careTeamIds?: string[];
}

function toPatientDto(patient: {
  id?: string;
  _id: { toString(): string };
  organizationId: mongoose.Types.ObjectId;
  linkedUserId?: mongoose.Types.ObjectId | null;
  primaryDoctorId?: mongoose.Types.ObjectId | null;
  careTeamIds?: mongoose.Types.ObjectId[];
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  address?: string | null;
  bloodType?: string | null;
  allergies?: string[];
  status: string;
  room?: string | null;
  admissionDate?: Date | null;
  dischargeDate?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: patient.id ?? patient._id.toString(),
    organizationId: patient.organizationId.toString(),
    linkedUserId: patient.linkedUserId ? patient.linkedUserId.toString() : undefined,
    primaryDoctorId: patient.primaryDoctorId ? patient.primaryDoctorId.toString() : undefined,
    careTeamIds: (patient.careTeamIds ?? []).map((id) => id.toString()),
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email || undefined,
    phone: patient.phone || undefined,
    dateOfBirth: dateOnly(patient.dateOfBirth),
    gender: patient.gender || undefined,
    address: patient.address || undefined,
    bloodType: patient.bloodType || undefined,
    allergies: patient.allergies ?? [],
    status: patient.status,
    room: patient.status === 'hospitalized' ? patient.room || undefined : undefined,
    admissionDate: dateOnly(patient.admissionDate),
    dischargeDate: dateOnly(patient.dischargeDate),
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  };
}

async function findVisiblePatient(id: string, organizationId: string, actor: AuthContext, ip?: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(404, 'Ressource introuvable', 'NOT_FOUND');
  }

  const patient = await Patient.findOne({ _id: id, organizationId, archivedAt: null });
  if (!patient) {
    const elsewhere = await Patient.exists({ _id: id });
    if (elsewhere) {
      await recordAudit({
        actorId: actor.id,
        actorRole: actor.role,
        organizationId,
        action: 'CROSS_TENANT_DENIED',
        resourceType: 'patient',
        resourceId: id,
        success: false,
        ip,
      });
    }
    throw new ApiError(404, 'Ressource introuvable', 'NOT_FOUND');
  }

  if (actor.role === ROLES.DOCTOR) {
    if (!(await doctorCanSeePatient(actor, patient))) {
      throw new ApiError(403, 'Dossier non autorisé', 'RECORD_FORBIDDEN');
    }
    return patient;
  }

  assertCanRead(actor, patient.primaryDoctorId?.toString(), patient.linkedUserId?.toString(), (patient.careTeamIds ?? []).map((value) => value.toString()));
  return patient;
}

function assertCanRead(
  actor: AuthContext,
  primaryDoctorId?: string,
  linkedUserId?: string,
  careTeamIds: string[] = []
) {
  if (actor.role === ROLES.HOSPITAL_ADMIN || actor.role === ROLES.RECEPTIONIST || actor.role === ROLES.NURSE) {
    return;
  }
  if (actor.role === ROLES.DOCTOR) {
    if (primaryDoctorId === actor.id || careTeamIds.includes(actor.id)) {
      return;
    }
    throw new ApiError(403, 'Dossier non autorisé', 'RECORD_FORBIDDEN');
  }
  if (actor.role === ROLES.PATIENT) {
    if (linkedUserId === actor.id) {
      return;
    }
    throw new ApiError(403, 'Dossier non autorisé', 'RECORD_FORBIDDEN');
  }
  throw new ApiError(403, 'Accès refusé', 'FORBIDDEN');
}

async function assertDoctorInOrg(organizationId: string, doctorId: string) {
  const doctor = await User.findOne({
    _id: doctorId,
    organizationId,
    role: ROLES.DOCTOR,
    isActive: true,
  });
  if (!doctor) {
    throw new ApiError(400, 'Médecin invalide pour cet établissement', 'INVALID_DOCTOR');
  }
}

function listFilter(
  actor: AuthContext,
  organizationId: string,
  query: { search?: string; status?: string },
  extraIds: mongoose.Types.ObjectId[] = []
) {
  const and: FilterQuery<unknown>[] = [{ organizationId }, { archivedAt: null }];

  if (actor.role === ROLES.DOCTOR) {
    const or: FilterQuery<unknown>[] = [{ primaryDoctorId: actor.id }, { careTeamIds: actor.id }];
    if (extraIds.length > 0) {
      or.push({ _id: { $in: extraIds } });
    }
    and.push({ $or: or });
  }
  if (actor.role === ROLES.PATIENT) {
    and.push({ linkedUserId: actor.id });
  }
  if (query.status) {
    and.push({ status: query.status });
  }
  if (query.search) {
    const safe = escapeRegex(query.search.trim());
    and.push({
      $or: [
        { firstName: new RegExp(safe, 'i') },
        { lastName: new RegExp(safe, 'i') },
        { email: new RegExp(safe, 'i') },
      ],
    });
  }
  return { $and: and };
}

export async function listPatients(
  actor: AuthContext,
  organizationId: string,
  query: { page?: number; limit?: number; search?: string; status?: 'outpatient' | 'hospitalized' | 'discharged' }
) {
  const { page, limit, skip } = readPagination(query);
  const extraIds = actor.role === ROLES.DOCTOR ? await linkedPatientIds(actor, organizationId) : [];
  const filter = listFilter(actor, organizationId, query, extraIds);
  const [patients, total] = await Promise.all([
    Patient.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Patient.countDocuments(filter),
  ]);
  return paginated(patients.map((patient) => toPatientDto(patient)), total, page, limit);
}

export async function getPatient(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const patient = await findVisiblePatient(id, organizationId, actor, ip);
  return toPatientDto(patient);
}

export async function createPatient(
  actor: AuthContext,
  organizationId: string,
  input: PatientWriteInput,
  ip?: string
) {
  if (input.primaryDoctorId) {
    await assertDoctorInOrg(organizationId, input.primaryDoctorId);
  }
  if (input.linkedUserId) {
    const linked = await User.findOne({ _id: input.linkedUserId, organizationId, role: ROLES.PATIENT });
    if (!linked) {
      throw new ApiError(400, 'Compte patient invalide pour cet établissement', 'INVALID_PATIENT_USER');
    }
  }

  const status = input.status ?? 'outpatient';
  const patient = await Patient.create({
    organizationId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email?.toLowerCase(),
    phone: input.phone,
    dateOfBirth: input.dateOfBirth,
    gender: input.gender,
    address: input.address,
    bloodType: input.bloodType,
    allergies: input.allergies ?? [],
    status,
    room: status === 'hospitalized' ? input.room : undefined,
    admissionDate: status === 'hospitalized' ? new Date() : undefined,
    primaryDoctorId: input.primaryDoctorId,
    linkedUserId: input.linkedUserId,
  });

  if (!patient.linkedUserId && patient.email) {
    const existingAccount = await User.findOne({ email: patient.email });
    if (!existingAccount) {
      const organization = await Organization.findById(organizationId);
      try {
        const account = await issuePatientLogin({
          organizationId,
          organizationName: organization?.name || 'MediCare',
          firstName: patient.firstName,
          lastName: patient.lastName,
          email: patient.email,
          phone: patient.phone,
        });
        patient.linkedUserId = account._id;
        await patient.save();
      } catch (error) {
        if (error instanceof ApiError && (error.code === 'EMAIL_NOT_CONFIGURED' || error.code === 'EMAIL_FAILED')) {
          throw new ApiError(error.status, "Le dossier est enregistré, mais l'e-mail avec le mot de passe n'a pas pu être envoyé.", error.code);
        }
        throw error;
      }
    }
  }

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'PATIENT_CREATED',
    resourceType: 'patient',
    resourceId: patient.id,
    success: true,
    ip,
  });

  return toPatientDto(patient);
}

export async function updatePatient(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: PatientWriteInput,
  ip?: string
) {
  const patient = await findVisiblePatient(id, organizationId, actor, ip);
  if (actor.role === ROLES.DOCTOR && !(await doctorCanSeePatient(actor, patient))) {
    throw new ApiError(403, 'Dossier non autorisé', 'RECORD_FORBIDDEN');
  }

  if (input.primaryDoctorId) {
    await assertDoctorInOrg(organizationId, input.primaryDoctorId);
    patient.primaryDoctorId = new mongoose.Types.ObjectId(input.primaryDoctorId);
  }
  if (input.primaryDoctorId === null) {
    patient.primaryDoctorId = undefined;
  }
  if (input.careTeamIds) {
    for (const doctorId of input.careTeamIds) {
      await assertDoctorInOrg(organizationId, doctorId);
    }
    patient.careTeamIds = input.careTeamIds.map((doctorId) => new mongoose.Types.ObjectId(doctorId));
  }

  if (input.firstName) patient.firstName = input.firstName;
  if (input.lastName) patient.lastName = input.lastName;
  if (input.email) patient.email = input.email.toLowerCase();
  if (input.phone !== undefined) patient.phone = input.phone;
  if (input.dateOfBirth) patient.dateOfBirth = input.dateOfBirth;
  if (input.gender) patient.gender = input.gender;
  if (input.address !== undefined) patient.address = input.address;
  if (input.bloodType !== undefined) patient.bloodType = input.bloodType;
  if (input.allergies) patient.allergies = input.allergies;
  if (input.status) {
    patient.status = input.status;
    if (input.status === 'hospitalized' && !patient.admissionDate) {
      patient.admissionDate = new Date();
    }
    if (input.status === 'discharged') {
      patient.dischargeDate = new Date();
      patient.room = undefined;
    }
  }
  if (input.room !== undefined && patient.status === 'hospitalized') {
    patient.room = input.room;
  }

  await patient.save();
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'PATIENT_UPDATED',
    resourceType: 'patient',
    resourceId: patient.id,
    success: true,
    ip,
  });
  return toPatientDto(patient);
}

export async function archivePatient(
  actor: AuthContext,
  organizationId: string,
  id: string,
  ip?: string
) {
  if (actor.role !== ROLES.HOSPITAL_ADMIN) {
    throw new ApiError(403, 'Accès refusé', 'FORBIDDEN');
  }
  const patient = await findVisiblePatient(id, organizationId, actor, ip);
  patient.archivedAt = new Date();
  await patient.save();
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'PATIENT_ARCHIVED',
    resourceType: 'patient',
    resourceId: patient.id,
    success: true,
    ip,
  });
}

export function rolesAllowedToReadPatients(): UserRole[] {
  return [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.NURSE, ROLES.PATIENT];
}
