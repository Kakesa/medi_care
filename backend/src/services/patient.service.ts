import mongoose, { type FilterQuery } from 'mongoose';
import { ROLES, type UserRole } from '../config/permissions.js';
import { BedStay } from '../models/BedStay.js';
import { Consultation } from '../models/Consultation.js';
import { Exam } from '../models/Exam.js';
import { Organization } from '../models/Organization.js';
import { Patient } from '../models/Patient.js';
import { Prescription } from '../models/Prescription.js';
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
  temperature?: number | null;
  tension?: string | null;
  saturation?: number | null;
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
  temperature?: number | null;
  tension?: string | null;
  saturation?: number | null;
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
    temperature: patient.temperature ?? undefined,
    tension: patient.tension || undefined,
    saturation: patient.saturation ?? undefined,
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
    const pattern = new RegExp(safe, 'i');
    and.push({
      $or: [
        { firstName: pattern },
        { lastName: pattern },
        { phone: pattern },
        { email: pattern },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ['$firstName', ' ', '$lastName'] },
              regex: safe,
              options: 'i',
            },
          },
        },
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
    temperature: input.temperature ?? undefined,
    tension: input.tension || undefined,
    saturation: input.saturation ?? undefined,
    allergies: input.allergies ?? [],
    status,
    room: status === 'hospitalized' ? input.room : undefined,
    admissionDate: status === 'hospitalized' ? new Date() : undefined,
    primaryDoctorId: input.primaryDoctorId,
    linkedUserId: input.linkedUserId,
  });

  if (!patient.linkedUserId && patient.email) {
    const existingAccount = await User.findOne({ email: patient.email });
    const sameHospital = existingAccount
      && existingAccount.role === ROLES.PATIENT
      && String(existingAccount.organizationId ?? '') === organizationId;
    if (sameHospital) {
      const taken = await Patient.exists({ linkedUserId: existingAccount._id });
      if (!taken) {
        patient.linkedUserId = existingAccount._id;
        await patient.save();
      }
    } else if (!existingAccount) {
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
  if (input.temperature !== undefined) patient.temperature = input.temperature ?? undefined;
  if (input.tension !== undefined) patient.tension = input.tension || undefined;
  if (input.saturation !== undefined) patient.saturation = input.saturation ?? undefined;
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

function visibleExamResult(
  exam: { type?: string; labStatus?: string | null; results?: string | null },
  actor: AuthContext,
) {
  const laboratory = exam.type === 'laboratory';
  const official = !laboratory
    || (!exam.labStatus && Boolean(exam.results))
    || (Boolean(exam.results) && exam.labStatus !== 'ANNULE' && exam.labStatus !== 'REJETE');
  const canSeeDraft = actor.role === ROLES.HOSPITAL_ADMIN || actor.role === ROLES.DOCTOR || actor.role === ROLES.NURSE;
  return official || canSeeDraft ? exam.results || undefined : undefined;
}

export async function getPatientDossier(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const patient = await findVisiblePatient(id, organizationId, actor, ip);
  const [consultations, exams, prescriptions, stays, doctor] = await Promise.all([
    Consultation.find({ organizationId, patientId: patient._id }).sort({ date: -1, createdAt: -1 }).limit(200),
    Exam.find({ organizationId, patientId: patient._id })
      .sort({ date: -1, createdAt: -1 })
      .limit(200)
      .select('name type category date status results labStatus doctorName notes createdAt'),
    Prescription.find({ organizationId, patientId: patient._id, status: 'validated' })
      .sort({ createdAt: -1 })
      .limit(100)
      .select('prescriberName items createdAt validatedAt'),
    BedStay.find({ organizationId, patientId: patient._id }).sort({ admissionDate: -1 }).limit(50),
    patient.primaryDoctorId ? User.findById(patient.primaryDoctorId).select('firstName lastName') : null,
  ]);

  const examRows = exams.map((exam) => ({
    id: exam.id,
    name: exam.name,
    category: exam.category,
    type: exam.type,
    date: dateOnly(exam.date),
    status: exam.status,
    labStatus: exam.labStatus || undefined,
    doctorName: exam.doctorName,
    results: visibleExamResult(exam, actor),
    consultationId: /^Consultation ([a-f0-9]{24})$/.exec(exam.notes || '')?.[1],
  }));

  const consultationRows = consultations.map((row) => ({
    id: row.id,
    patientId: row.patientId.toString(),
    date: dateOnly(row.date),
    recordedAt: row.createdAt,
    doctorName: row.doctorName,
    status: row.status,
    motif: row.plainte || undefined,
    symptoms: row.symptoms ?? [],
    histoireMaladie: row.histoireMaladie || undefined,
    comportementAnamnese: row.comportementAnamnese || undefined,
    examenPhysique: row.examenPhysique || undefined,
    diagnosis: row.diagnosis || undefined,
    conclusion: row.conclusion || undefined,
    treatment: row.treatment || undefined,
    prescription: row.prescription || undefined,
    notes: row.notes || undefined,
    followUpDate: dateOnly(row.followUpDate),
    requestedExams: row.recommandationExamens || undefined,
    antecedent: row.antecedent || undefined,
    allergies: row.allergies ?? [],
    exams: examRows.filter((exam) => exam.consultationId === row.id).map(({ consultationId: _link, ...exam }) => exam),
  }));

  const allergyNames = new Set<string>();
  for (const name of patient.allergies ?? []) {
    const trimmed = name.trim();
    if (trimmed) allergyNames.add(trimmed);
  }
  for (const row of consultationRows) {
    for (const name of row.allergies) {
      const trimmed = name.trim();
      if (trimmed) allergyNames.add(trimmed);
    }
  }

  const hospitalizations = stays.length
    ? stays.map((stay) => ({
      id: stay.id,
      status: stay.status,
      ward: stay.wardName,
      room: stay.bedNumber,
      admittedAt: stay.admissionDate,
      dischargedAt: stay.dischargeDate,
    }))
    : patient.admissionDate
      ? [{
        id: patient.id,
        status: patient.status === 'discharged' ? 'completed' : 'active',
        ward: undefined,
        room: patient.room || undefined,
        admittedAt: patient.admissionDate,
        dischargedAt: patient.dischargeDate,
      }]
      : [];

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'PATIENT_DOSSIER_VIEWED',
    resourceType: 'patient',
    resourceId: patient.id,
    success: true,
    ip,
  });

  return {
    patient: {
      ...toPatientDto(patient),
      doctorName: doctor ? `${doctor.firstName} ${doctor.lastName}` : undefined,
    },
    consultations: consultationRows,
    history: {
      antecedents: consultationRows.flatMap((row) => (
        row.antecedent ? [{ date: row.date, doctorName: row.doctorName, text: row.antecedent }] : []
      )),
      allergies: [...allergyNames],
      hospitalizations,
      exams: examRows.map(({ consultationId: _link, ...exam }) => exam),
      prescriptions: prescriptions.map((row) => ({
        id: row.id,
        prescriberName: row.prescriberName,
        createdAt: row.createdAt,
        items: row.items.map((item) => ({
          medication: item.medication,
          dosage: item.dosage,
          posology: item.posology,
          route: item.administrationRoute || undefined,
          duration: item.duration,
          instructions: item.instructions || undefined,
        })),
      })),
    },
  };
}

export function rolesAllowedToReadPatients(): UserRole[] {
  return [ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.NURSE, ROLES.PATIENT];
}
