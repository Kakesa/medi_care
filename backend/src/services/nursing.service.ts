import mongoose, { type FilterQuery } from 'mongoose';
import { ROLES } from '../config/permissions.js';
import { Bed } from '../models/Bed.js';
import { BedStay } from '../models/BedStay.js';
import { Consultation } from '../models/Consultation.js';
import { Exam } from '../models/Exam.js';
import { MedicationAdministration } from '../models/MedicationAdministration.js';
import { NursingCare } from '../models/NursingCare.js';
import { NursingObservation } from '../models/NursingObservation.js';
import { NursingSettings } from '../models/NursingSettings.js';
import { Patient } from '../models/Patient.js';
import { Prescription } from '../models/Prescription.js';
import { User } from '../models/User.js';
import { VitalSigns } from '../models/VitalSigns.js';
import { ApiError } from '../utils/ApiError.js';
import { paginated, readPagination } from '../utils/pagination.js';
import { escapeRegex } from '../utils/regex.js';
import type { AuthContext } from '../types/express.js';
import { linkedPatientIds, requireVisiblePatient } from './access.service.js';
import { recordAudit } from './audit.service.js';

type VitalThresholds = {
  systolicMin: number; systolicMax: number;
  diastolicMin: number; diastolicMax: number;
  temperatureMin: number; temperatureMax: number;
  heartRateMin: number; heartRateMax: number;
  respiratoryRateMin: number; respiratoryRateMax: number;
  oxygenSaturationMin: number;
  glucoseMin: number; glucoseMax: number;
};

const defaultThresholds: VitalThresholds = {
  systolicMin: 90, systolicMax: 180, diastolicMin: 60, diastolicMax: 120,
  temperatureMin: 35, temperatureMax: 38, heartRateMin: 50, heartRateMax: 120,
  respiratoryRateMin: 10, respiratoryRateMax: 24, oxygenSaturationMin: 92,
  glucoseMin: 70, glucoseMax: 180,
};

const medicationLateWindowMs = 60 * 60 * 1000;
const dosesByFrequency: Record<number, string[]> = {
  1: ['08:00'],
  2: ['08:00', '20:00'],
  3: ['08:00', '14:00', '20:00'],
  4: ['06:00', '12:00', '18:00', '22:00'],
};
const medicationTimeZone = 'Africa/Kinshasa';

type VitalValues = {
  systolic?: number; diastolic?: number; temperature?: number; heartRate?: number;
  respiratoryRate?: number; oxygenSaturation?: number; weight?: number; height?: number; glucose?: number;
};

function alertsFor(values: {
  systolic?: number | null; diastolic?: number | null; temperature?: number | null; heartRate?: number | null;
  respiratoryRate?: number | null; oxygenSaturation?: number | null; glucose?: number | null;
}, thresholds: VitalThresholds) {
  const alerts: string[] = [];
  if (values.systolic != null && (values.systolic < thresholds.systolicMin || values.systolic > thresholds.systolicMax)) alerts.push('Tension systolique hors seuil');
  if (values.diastolic != null && (values.diastolic < thresholds.diastolicMin || values.diastolic > thresholds.diastolicMax)) alerts.push('Tension diastolique hors seuil');
  if (values.temperature != null && (values.temperature < thresholds.temperatureMin || values.temperature > thresholds.temperatureMax)) alerts.push('Température hors seuil');
  if (values.heartRate != null && (values.heartRate < thresholds.heartRateMin || values.heartRate > thresholds.heartRateMax)) alerts.push('Fréquence cardiaque hors seuil');
  if (values.respiratoryRate != null && (values.respiratoryRate < thresholds.respiratoryRateMin || values.respiratoryRate > thresholds.respiratoryRateMax)) alerts.push('Fréquence respiratoire hors seuil');
  if (values.oxygenSaturation != null && values.oxygenSaturation < thresholds.oxygenSaturationMin) alerts.push('Saturation en oxygène sous le seuil');
  if (values.glucose != null && (values.glucose < thresholds.glucoseMin || values.glucose > thresholds.glucoseMax)) alerts.push('Glycémie hors seuil');
  return alerts;
}

function idOf(value: { toString(): string } | null | undefined) {
  return value?.toString();
}

function stayDurationDays(admissionDate: Date, endDate: Date) {
  const admissionDay = Date.UTC(admissionDate.getUTCFullYear(), admissionDate.getUTCMonth(), admissionDate.getUTCDate());
  const endDay = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
  return Math.max(0, Math.round((endDay - admissionDay) / 86_400_000));
}

function scheduledInstant(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: medicationTimeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(localAsUtc));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute)
  );
  return new Date(localAsUtc - (representedAsUtc - localAsUtc));
}

function localDayBounds(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return { start: scheduledInstant(date, '00:00'), end: scheduledInstant(nextDate, '00:00') };
}

function treatmentStatusAt(item: {
  treatmentStatusHistory?: Array<{ status: 'active' | 'suspended' | 'completed' | 'interrupted'; changedAt: Date }>;
}, scheduledAt: Date) {
  const changes = item.treatmentStatusHistory ?? [];
  const latest = changes.filter((change) => change.changedAt <= scheduledAt).at(-1);
  return latest?.status ?? 'active';
}

function mapAdministration(row: InstanceType<typeof MedicationAdministration>, now = new Date()) {
  const overdue = row.status === 'pending' && now.getTime() > row.scheduledAt.getTime() + medicationLateWindowMs;
  return {
    id: row.id,
    patientId: row.patientId.toString(),
    prescriptionId: row.prescriptionId.toString(),
    prescriptionItemId: row.prescriptionItemId.toString(),
    medication: row.medication,
    prescribedDose: row.prescribedDose,
    administrationRoute: row.administrationRoute,
    posology: row.posology,
    instructions: row.instructions,
    scheduledAt: row.scheduledAt,
    administeredAt: row.administeredAt,
    administeredBy: idOf(row.administeredBy),
    status: overdue ? 'not_administered' : row.status,
    observations: row.observations,
    notDoneReason: row.notDoneReason,
    history: row.history ?? [],
  };
}

function mapCare(row: InstanceType<typeof NursingCare>) {
  return {
    id: row.id,
    patientId: idOf(row.patientId),
    nurseId: idOf(row.nurseId),
    type: row.type,
    description: row.description,
    prescriptionId: idOf(row.prescriptionId),
    prescriptionItemId: idOf(row.prescriptionItemId),
    medication: row.medication,
    prescribedDose: row.prescribedDose,
    administrationRoute: row.administrationRoute,
    scheduledAt: row.scheduledAt,
    performedAt: row.performedAt,
    status: row.status,
    observations: row.observations,
    notDoneReason: row.notDoneReason,
    history: row.history ?? [],
    createdAt: row.createdAt,
  };
}

async function namesById(organizationId: string, ids: Array<string | undefined>) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map<string, string>();
  const users = await User.find({ _id: { $in: unique }, organizationId }).select('firstName lastName');
  return new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]));
}

function mapVitals(row: InstanceType<typeof VitalSigns>, thresholds: VitalThresholds) {
  return {
    id: row.id,
    patientId: idOf(row.patientId),
    recordedBy: idOf(row.recordedBy),
    measuredAt: row.measuredAt,
    systolic: row.systolic,
    diastolic: row.diastolic,
    temperature: row.temperature,
    heartRate: row.heartRate,
    respiratoryRate: row.respiratoryRate,
    oxygenSaturation: row.oxygenSaturation,
    weight: row.weight,
    height: row.height,
    glucose: row.glucose,
    observation: row.observation,
    alerts: alertsFor(row, thresholds),
    createdAt: row.createdAt,
  };
}

async function thresholdsFor(organizationId: string): Promise<VitalThresholds> {
  const settings = await NursingSettings.findOne({ organizationId })
    .select(Object.keys(defaultThresholds).join(' '))
    .lean();
  return { ...defaultThresholds, ...(settings ?? {}) };
}

async function doctorPatientIds(actor: AuthContext, organizationId: string) {
  const [linked, assigned] = await Promise.all([
    linkedPatientIds(actor, organizationId),
    Patient.find({
      organizationId,
      archivedAt: null,
      $or: [{ primaryDoctorId: actor.id }, { careTeamIds: actor.id }],
    }).distinct('_id'),
  ]);
  return [...new Set([...linked, ...assigned].map((id) => id.toString()))];
}

async function patientFilter(actor: AuthContext, organizationId: string, search?: string): Promise<FilterQuery<unknown>> {
  const clauses: FilterQuery<unknown>[] = [
    { organizationId },
    { archivedAt: null },
    { status: { $in: ['hospitalized', 'outpatient'] } },
  ];
  if (actor.role === ROLES.DOCTOR) {
    clauses.push({ _id: { $in: await doctorPatientIds(actor, organizationId) } });
  }
  if (search?.trim()) {
    const safe = escapeRegex(search.trim());
    clauses.push({
      $or: [
        { firstName: new RegExp(safe, 'i') },
        { lastName: new RegExp(safe, 'i') },
        { room: new RegExp(safe, 'i') },
      ],
    });
  }
  return { $and: clauses };
}

async function patientDtos(patients: InstanceType<typeof Patient>[], organizationId: string, latest: Map<string, ReturnType<typeof mapVitals>>) {
  if (!patients.length) return [];
  const patientIds = patients.map((patient) => patient._id);
  const doctorIds = [...new Set(patients.map((patient) => patient.primaryDoctorId?.toString()).filter((id): id is string => Boolean(id)))];
  const [doctors, stays, nextCareRows] = await Promise.all([
    doctorIds.length ? User.find({ _id: { $in: doctorIds }, organizationId }).select('firstName lastName') : [],
    BedStay.find({ organizationId, patientId: { $in: patientIds }, status: 'active' }).sort({ admissionDate: -1 }).select('patientId wardName bedNumber'),
    NursingCare.find({ organizationId, patientId: { $in: patientIds }, status: { $in: ['pending', 'in_progress'] } })
      .sort({ scheduledAt: 1 }).select('patientId type description scheduledAt status'),
  ]);
  const doctorById = new Map(doctors.map((doctor) => [doctor.id, `${doctor.firstName} ${doctor.lastName}`]));
  const stayByPatient = new Map<string, (typeof stays)[number]>();
  for (const stay of stays) {
    const patientId = stay.patientId?.toString();
    if (patientId && !stayByPatient.has(patientId)) stayByPatient.set(patientId, stay);
  }
  const nextCareByPatient = new Map<string, (typeof nextCareRows)[number]>();
  for (const care of nextCareRows) if (!nextCareByPatient.has(care.patientId.toString())) nextCareByPatient.set(care.patientId.toString(), care);
  return patients.map((patient) => {
    const patientId = patient.id;
    const stay = stayByPatient.get(patientId);
    const nextCare = nextCareByPatient.get(patientId);
    const dateOfBirth = patient.dateOfBirth;
    const now = new Date();
    const age = dateOfBirth
      ? Math.max(0, now.getFullYear() - dateOfBirth.getFullYear() - (now < new Date(now.getFullYear(), dateOfBirth.getMonth(), dateOfBirth.getDate()) ? 1 : 0))
      : undefined;
    return {
      id: patientId,
      recordNumber: patientId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      age,
      status: patient.status,
      room: stay?.bedNumber ?? patient.room,
      ward: stay?.wardName,
      doctor: patient.primaryDoctorId ? doctorById.get(patient.primaryDoctorId.toString()) : undefined,
      primaryDoctorId: idOf(patient.primaryDoctorId),
      lastVitals: latest.get(patientId) ?? (patient.temperature !== undefined || patient.tension || patient.saturation !== undefined
        ? { temperature: patient.temperature, tension: patient.tension, oxygenSaturation: patient.saturation }
        : undefined),
      nextCare: nextCare ? {
        id: nextCare.id, type: nextCare.type, description: nextCare.description,
        scheduledAt: nextCare.scheduledAt, status: nextCare.status,
      } : undefined,
    };
  });
}

async function latestVitalsForPatients(organizationId: string, patientIds: mongoose.Types.ObjectId[], thresholds: VitalThresholds) {
  const rows = await VitalSigns.find({ organizationId, patientId: { $in: patientIds } }).sort({ measuredAt: -1 });
  const latest = new Map<string, ReturnType<typeof mapVitals>>();
  for (const row of rows) {
    const key = row.patientId.toString();
    if (!latest.has(key)) latest.set(key, mapVitals(row, thresholds));
  }
  return latest;
}

export async function listNursingPatients(actor: AuthContext, organizationId: string, query: { page?: number; limit?: number; search?: string }) {
  const { page, limit, skip } = readPagination(query);
  const filter = await patientFilter(actor, organizationId, query.search);
  const [patients, total, thresholds] = await Promise.all([
    Patient.find(filter).sort({ status: 1, lastName: 1, firstName: 1 }).skip(skip).limit(limit),
    Patient.countDocuments(filter),
    thresholdsFor(organizationId),
  ]);
  const latest = await latestVitalsForPatients(organizationId, patients.map((patient) => patient._id), thresholds);
  const rows = await patientDtos(patients, organizationId, latest);
  return paginated(rows, total, page, limit);
}

export async function getNursingDashboard(actor: AuthContext, organizationId: string) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const filter = await patientFilter(actor, organizationId);
  const patientIds = actor.role === ROLES.DOCTOR ? await doctorPatientIds(actor, organizationId) : undefined;
  const careScope = patientIds ? { organizationId, patientId: { $in: patientIds } } : { organizationId };
  const [patients, patientCount, scheduled, overdueCare, completedToday, thresholds, deliveredPrescriptions] = await Promise.all([
    Patient.find(filter).sort({ status: 1, lastName: 1 }).limit(100),
    Patient.countDocuments(filter),
    NursingCare.countDocuments({ ...careScope, status: { $in: ['pending', 'in_progress'] }, scheduledAt: { $gte: start, $lt: end } }),
    NursingCare.countDocuments({ ...careScope, status: { $in: ['pending', 'in_progress'] }, scheduledAt: { $lt: now } }),
    NursingCare.countDocuments({ ...careScope, status: 'completed', performedAt: { $gte: start, $lt: end } }),
    thresholdsFor(organizationId),
    Prescription.find({
      organizationId, status: 'validated', pharmacyStatus: 'delivered',
      ...(patientIds ? { patientId: { $in: patientIds } } : {}),
    }).select('_id'),
  ]);
  const completedPrescriptionIds = await NursingCare.distinct('prescriptionId', {
    ...careScope, status: 'completed', prescriptionId: { $in: deliveredPrescriptions.map((row) => row._id) },
  });
  const latest = await latestVitalsForPatients(organizationId, patients.map((patient) => patient._id), thresholds);
  const patientRows = await patientDtos(patients, organizationId, latest);
  const monitoringPatients = await NursingCare.distinct('patientId', {
    ...careScope, type: 'monitoring', status: { $in: ['pending', 'in_progress'] },
  });
  const attentionPatientIds = new Set([
    ...[...latest.entries()].filter(([, row]) => row.alerts.length > 0).map(([id]) => id),
    ...monitoringPatients.map((id) => id.toString()),
  ]);
  const attentionPatientCount = attentionPatientIds.size;
  const dueItems = await NursingCare.find({
    ...careScope, status: { $in: ['pending', 'in_progress'] }, scheduledAt: { $lt: end },
  }).sort({ scheduledAt: 1 }).limit(10);
  return {
    stats: {
      patientsUnderSurveillance: patientCount,
      careToPerform: scheduled,
      careCompletedToday: completedToday,
      overdueCare,
      prescriptionsWaiting: Math.max(0, deliveredPrescriptions.length - completedPrescriptionIds.length),
      patientsRequiringAttention: attentionPatientCount,
    },
    patients: patientRows,
    dueItems: dueItems.map(mapCare),
    alertDisclaimer: 'Les alertes signalent un dépassement des seuils configurés et ne constituent pas un diagnostic.',
  };
}

export async function listNursingCare(actor: AuthContext, organizationId: string, query: { page?: number; limit?: number; patientId?: string; status?: string; date?: Date }) {
  const { page, limit, skip } = readPagination(query);
  const filter: Record<string, unknown> = { organizationId };
  if (query.patientId) {
    await requireVisiblePatient(actor, organizationId, query.patientId);
    filter.patientId = query.patientId;
  } else if (actor.role === ROLES.DOCTOR) {
    filter.patientId = { $in: await doctorPatientIds(actor, organizationId) };
  }
  if (query.status) filter.status = query.status;
  if (query.date) {
    const start = new Date(query.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    filter.scheduledAt = { $gte: start, $lt: end };
  }
  const [rows, total] = await Promise.all([
    NursingCare.find(filter).sort({ scheduledAt: -1 }).skip(skip).limit(limit),
    NursingCare.countDocuments(filter),
  ]);
  return paginated(rows.map(mapCare), total, page, limit);
}

export async function createNursingCare(
  actor: AuthContext,
  organizationId: string,
  input: {
    patientId: string; type: string; description: string; prescriptionId?: string; prescriptionItemId?: string;
    scheduledAt: Date;
  },
  ip?: string
) {
  const patient = await requireVisiblePatient(actor, organizationId, input.patientId, ip);
  let prescriptionFields: Record<string, unknown> = {};
  if (input.type === 'medication') {
    const prescription = await Prescription.findOne({
      _id: input.prescriptionId, organizationId, patientId: patient._id, status: 'validated',
    });
    if (!prescription) throw new ApiError(404, 'Prescription validée introuvable', 'PRESCRIPTION_NOT_FOUND');
    const item = prescription.items.find((candidate) => candidate.id === input.prescriptionItemId);
    if (!item) throw new ApiError(400, 'Ligne de prescription introuvable', 'PRESCRIPTION_ITEM_NOT_FOUND');
    if (!item.administrationRoute) {
      throw new ApiError(409, 'La voie d’administration doit être définie par le prescripteur', 'PRESCRIPTION_ROUTE_MISSING');
    }
    prescriptionFields = {
      prescriptionId: prescription._id,
      prescriptionItemId: item._id,
      medication: item.medication,
      prescribedDose: item.dosage,
      administrationRoute: item.administrationRoute,
    };
  }
  const row = await NursingCare.create({
    organizationId, patientId: patient._id, nurseId: actor.id,
    type: input.type, description: input.description,
    ...prescriptionFields,
    scheduledAt: input.scheduledAt,
    status: 'pending',
    history: [{ actorId: actor.id, action: 'CREATED', at: new Date() }],
  });
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'NURSING_CARE_CREATED',
    resourceType: 'nursing-care', resourceId: row.id, success: true, ip,
    metadata: { patientId: patient.id, careType: input.type },
  });
  return mapCare(row);
}

export async function getMedicationAdministrationSheet(
  actor: AuthContext,
  organizationId: string,
  query: { patientId: string; date: string }
) {
  await requireVisiblePatient(actor, organizationId, query.patientId);
  const { start, end } = localDayBounds(query.date);
  const prescriptions = await Prescription.find({
    organizationId,
    patientId: query.patientId,
    status: 'validated',
  }).select('items');
  const scheduled = [] as Array<{
    prescriptionId: mongoose.Types.ObjectId;
    prescriptionItemId: mongoose.Types.ObjectId;
    medication: string;
    prescribedDose: string;
    administrationRoute: string;
    posology: string;
    instructions: string;
    scheduledAt: Date;
    status: 'pending' | 'suspended' | 'treatment_completed' | 'treatment_interrupted';
  }>;
  const unconfiguredItems: Array<{ prescriptionId: string; medication: string; reason: string }> = [];

  for (const prescription of prescriptions) {
    for (const item of prescription.items) {
      if (!item.treatmentStartDate || !item.treatmentEndDate || !item.administrationTimes?.length) {
        unconfiguredItems.push({ prescriptionId: prescription.id, medication: item.medication, reason: 'Dates ou heures quotidiennes non définies par le prescripteur' });
        continue;
      }
      if (query.date < item.treatmentStartDate || query.date > item.treatmentEndDate) continue;
      if (!item.administrationRoute) {
        unconfiguredItems.push({ prescriptionId: prescription.id, medication: item.medication, reason: 'Voie d’administration non définie par le prescripteur' });
        continue;
      }
      for (const time of item.administrationTimes) {
        const scheduledAt = scheduledInstant(query.date, time);
        const treatmentStatus = treatmentStatusAt(item, scheduledAt);
        scheduled.push({
          prescriptionId: prescription._id,
          prescriptionItemId: item._id,
          medication: item.medication,
          prescribedDose: item.dosage,
          administrationRoute: item.administrationRoute,
          posology: item.posology,
          instructions: item.instructions ?? '',
          scheduledAt,
          status: treatmentStatus === 'suspended' ? 'suspended'
            : treatmentStatus === 'completed' ? 'treatment_completed'
              : treatmentStatus === 'interrupted' ? 'treatment_interrupted'
                : 'pending',
        });
      }
    }
  }

  if (scheduled.length) {
    await MedicationAdministration.bulkWrite(scheduled.map((dose) => ({
      updateOne: {
        filter: {
          organizationId,
          prescriptionId: dose.prescriptionId,
          prescriptionItemId: dose.prescriptionItemId,
          scheduledAt: dose.scheduledAt,
        },
        update: {
          $setOnInsert: {
            organizationId,
            patientId: query.patientId,
            ...dose,
            status: dose.status,
          },
        },
        upsert: true,
      },
    })));
  }

  const rows = await MedicationAdministration.find({
    organizationId,
    patientId: query.patientId,
    scheduledAt: { $gte: start, $lt: end },
  }).sort({ scheduledAt: 1 });
  const nurseIds = [...new Set(rows.map((row) => row.administeredBy?.toString()).filter((id): id is string => Boolean(id)))];
  const nurses = nurseIds.length
    ? await User.find({ _id: { $in: nurseIds }, organizationId }).select('firstName lastName')
    : [];
  const nurseNameById = new Map(nurses.map((nurse) => [nurse.id, `${nurse.firstName} ${nurse.lastName}`]));
  return {
    patientId: query.patientId,
    date: query.date,
    timeZone: medicationTimeZone,
    lateWindowMinutes: medicationLateWindowMs / 60_000,
    doses: rows.map((row) => ({
      ...mapAdministration(row),
      administeredByName: row.administeredBy ? nurseNameById.get(row.administeredBy.toString()) : undefined,
    })),
    unconfiguredItems,
  };
}

export async function addTreatmentLine(
  actor: AuthContext,
  organizationId: string,
  input: {
    patientId: string;
    medication: string;
    timesPerDay: number;
    administrationRoute: string;
    treatmentStartDate: string;
    treatmentEndDate: string;
  },
  ip?: string
) {
  await requireVisiblePatient(actor, organizationId, input.patientId, ip);
  const prescription = await Prescription.findOne({
    organizationId,
    patientId: input.patientId,
    status: 'validated',
  }).sort({ createdAt: -1 });
  if (!prescription) throw new ApiError(404, 'Aucune prescription validée pour ce patient', 'PRESCRIPTION_NOT_FOUND');
  const medication = input.medication.trim();
  prescription.items.push({
    medication,
    dosage: 'Selon prescription',
    posology: `${input.timesPerDay} fois / jour`,
    administrationRoute: input.administrationRoute,
    duration: '7 jours',
    treatmentStartDate: input.treatmentStartDate,
    treatmentEndDate: input.treatmentEndDate,
    administrationTimes: dosesByFrequency[input.timesPerDay],
    instructions: '',
    quantityPrescribed: 1,
    quantityDispensed: 0,
  });
  await prescription.save();
  const item = prescription.items[prescription.items.length - 1];
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'NURSING_TREATMENT_LINE_ADDED',
    resourceType: 'prescription', resourceId: prescription.id, success: true, ip,
    metadata: { patientId: input.patientId, prescriptionItemId: item.id, medication },
  });
  return {
    prescriptionId: prescription.id,
    prescriptionItemId: item.id,
    medication: item.medication,
    administrationTimes: item.administrationTimes,
    administrationRoute: item.administrationRoute,
  };
}

export async function scheduleMedicationAdministrations(
  actor: AuthContext,
  organizationId: string,
  input: {
    patientId: string;
    prescriptionId: string;
    prescriptionItemId: string;
    timesPerDay: number;
    administrationRoute: string;
    treatmentStartDate: string;
    treatmentEndDate: string;
  },
  ip?: string
) {
  await requireVisiblePatient(actor, organizationId, input.patientId, ip);
  const prescription = await Prescription.findOne({
    _id: input.prescriptionId,
    organizationId,
    patientId: input.patientId,
    status: 'validated',
  });
  if (!prescription) throw new ApiError(404, 'Prescription validée introuvable', 'PRESCRIPTION_NOT_FOUND');
  const item = prescription.items.id(input.prescriptionItemId);
  if (!item) throw new ApiError(404, 'Ligne de prescription introuvable', 'PRESCRIPTION_ITEM_NOT_FOUND');
  const closed = await MedicationAdministration.countDocuments({
    organizationId,
    prescriptionItemId: item._id,
    status: { $ne: 'pending' },
  });
  if (closed > 0) {
    throw new ApiError(409, 'Des prises sont déjà enregistrées. La fréquence ne peut plus être modifiée.', 'SCHEDULE_LOCKED');
  }
  await MedicationAdministration.deleteMany({ organizationId, prescriptionItemId: item._id, status: 'pending' });
  item.administrationTimes = dosesByFrequency[input.timesPerDay];
  item.administrationRoute = input.administrationRoute;
  item.treatmentStartDate = input.treatmentStartDate;
  item.treatmentEndDate = input.treatmentEndDate;
  await prescription.save();
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'MEDICATION_SCHEDULE_SET',
    resourceType: 'prescription', resourceId: prescription.id, success: true, ip,
    metadata: { patientId: input.patientId, prescriptionItemId: item.id, timesPerDay: input.timesPerDay },
  });
  return {
    prescriptionItemId: item.id,
    administrationTimes: item.administrationTimes,
    administrationRoute: item.administrationRoute,
    treatmentStartDate: item.treatmentStartDate,
    treatmentEndDate: item.treatmentEndDate,
  };
}

export async function confirmMedicationAdministration(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: { observations?: string },
  ip?: string
) {
  const row = await MedicationAdministration.findOne({ _id: id, organizationId });
  if (!row) throw new ApiError(404, 'Prise planifiée introuvable', 'NOT_FOUND');
  await requireVisiblePatient(actor, organizationId, row.patientId.toString(), ip);
  if (row.status !== 'pending') throw new ApiError(409, 'Cette prise a déjà été clôturée', 'ADMINISTRATION_CLOSED');
  const administeredAt = new Date();
  if (administeredAt < row.scheduledAt) throw new ApiError(409, 'Cette prise est prévue ultérieurement', 'ADMINISTRATION_NOT_DUE');
  const status = administeredAt.getTime() <= row.scheduledAt.getTime()
    ? 'administered_on_time'
    : 'administered_late';
  const updated = await MedicationAdministration.findOneAndUpdate(
    { _id: id, organizationId, status: 'pending' },
    {
      $set: { status, administeredAt, administeredBy: actor.id, observations: input.observations },
      $push: { history: { actorId: actor.id, action: 'ADMINISTERED', at: administeredAt, changes: { status: { from: 'pending', to: status } } } },
    },
    { new: true, runValidators: true }
  );
  if (!updated) throw new ApiError(409, 'Cette prise a déjà été clôturée', 'ADMINISTRATION_CLOSED');
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'MEDICATION_ADMINISTERED',
    resourceType: 'medication-administration', resourceId: updated.id, success: true, ip,
    metadata: { patientId: updated.patientId.toString(), status },
  });
  return mapAdministration(updated);
}

export async function markMedicationAdministrationMissed(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: { reasonType: 'patient_absent' | 'patient_refused' | 'unavailable' | 'other'; reason: string; observations?: string },
  ip?: string
) {
  const row = await MedicationAdministration.findOne({ _id: id, organizationId });
  if (!row) throw new ApiError(404, 'Prise planifiée introuvable', 'NOT_FOUND');
  await requireVisiblePatient(actor, organizationId, row.patientId.toString(), ip);
  if (row.status !== 'pending') throw new ApiError(409, 'Cette prise a déjà été clôturée', 'ADMINISTRATION_CLOSED');
  if (Date.now() < row.scheduledAt.getTime()) {
    throw new ApiError(409, 'Cette prise est prévue ultérieurement', 'ADMINISTRATION_NOT_DUE');
  }
  if (input.reasonType !== 'patient_refused' && Date.now() <= row.scheduledAt.getTime() + medicationLateWindowMs) {
    throw new ApiError(409, 'Le délai autorisé n’est pas encore écoulé', 'ADMINISTRATION_GRACE_PERIOD');
  }
  const status = input.reasonType === 'patient_refused' ? 'patient_refused' : 'not_administered';
  const at = new Date();
  const updated = await MedicationAdministration.findOneAndUpdate(
    { _id: id, organizationId, status: 'pending' },
    {
      $set: { status, notDoneReason: input.reason, observations: input.observations },
      $push: { history: { actorId: actor.id, action: 'NOT_ADMINISTERED', at, reason: input.reason, changes: { status: { from: 'pending', to: status }, reasonType: input.reasonType } } },
    },
    { new: true, runValidators: true }
  );
  if (!updated) throw new ApiError(409, 'Cette prise a déjà été clôturée', 'ADMINISTRATION_CLOSED');
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'MEDICATION_NOT_ADMINISTERED',
    resourceType: 'medication-administration', resourceId: updated.id, success: true, ip,
    metadata: { patientId: updated.patientId.toString(), status, reasonType: input.reasonType },
  });
  return mapAdministration(updated);
}

export async function correctMedicationAdministration(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: { reason: string; administeredAt?: Date; observations?: string; notDoneReason?: string },
  ip?: string
) {
  const row = await MedicationAdministration.findOne({ _id: id, organizationId });
  if (!row) throw new ApiError(404, 'Prise planifiée introuvable', 'NOT_FOUND');
  await requireVisiblePatient(actor, organizationId, row.patientId.toString(), ip);
  if (row.status === 'pending') throw new ApiError(409, 'Une prise en attente ne peut pas être corrigée', 'ADMINISTRATION_PENDING');
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (input.administeredAt && input.administeredAt.getTime() !== row.administeredAt?.getTime()) {
    if (input.administeredAt > new Date()) throw new ApiError(400, 'L’heure réelle ne peut pas être dans le futur', 'INVALID_ADMINISTRATION_TIME');
    const previousStatus = row.status;
    changes.administeredAt = { from: row.administeredAt, to: input.administeredAt };
    row.administeredAt = input.administeredAt;
    if (!row.administeredBy) {
      changes.administeredBy = { from: undefined, to: actor.id };
      row.administeredBy = new mongoose.Types.ObjectId(actor.id);
    }
    row.status = input.administeredAt.getTime() <= row.scheduledAt.getTime()
      ? 'administered_on_time'
      : 'administered_late';
    changes.status = { from: previousStatus, to: row.status };
  }
  if (input.observations !== undefined && input.observations !== row.observations) {
    changes.observations = { from: row.observations, to: input.observations };
    row.observations = input.observations;
  }
  if (input.notDoneReason !== undefined && input.notDoneReason !== row.notDoneReason) {
    changes.notDoneReason = { from: row.notDoneReason, to: input.notDoneReason };
    row.notDoneReason = input.notDoneReason;
  }
  if (!Object.keys(changes).length) throw new ApiError(400, 'La correction ne modifie aucune donnée', 'NO_CORRECTION');
  row.history.push({ actorId: new mongoose.Types.ObjectId(actor.id), action: 'CORRECTED', at: new Date(), reason: input.reason, changes });
  await row.save();
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'MEDICATION_ADMINISTRATION_CORRECTED',
    resourceType: 'medication-administration', resourceId: row.id, success: true, ip,
    metadata: { patientId: row.patientId.toString(), fields: Object.keys(changes) },
  });
  return mapAdministration(row);
}

export async function updateNursingCare(
  actor: AuthContext, organizationId: string, id: string,
  input: { status: string; observations?: string; notDoneReason?: string }, ip?: string
) {
  const row = await NursingCare.findOne({ _id: id, organizationId });
  if (!row) throw new ApiError(404, 'Soin introuvable', 'NOT_FOUND');
  if (row.status === 'completed' || row.status === 'not_done' || row.status === 'cancelled') {
    throw new ApiError(409, 'Un soin clôturé ne peut pas être modifié ; utilisez une correction justifiée', 'CARE_CLOSED');
  }
  const allowed: Record<string, string[]> = {
    pending: ['in_progress', 'completed', 'not_done', 'cancelled'],
    in_progress: ['completed', 'not_done', 'cancelled'],
  };
  if (!allowed[row.status]?.includes(input.status)) {
    throw new ApiError(409, 'Transition de statut invalide', 'INVALID_CARE_TRANSITION');
  }
  const previousStatus = row.status;
  row.status = input.status as typeof row.status;
  if (input.observations !== undefined) row.observations = input.observations;
  if (input.status === 'not_done') row.notDoneReason = input.notDoneReason;
  if (input.status === 'completed') row.performedAt = new Date();
  row.history.push({
    actorId: new mongoose.Types.ObjectId(actor.id),
    action: `STATUS_${input.status.toUpperCase()}`,
    at: new Date(),
    reason: input.notDoneReason,
    changes: { status: { from: previousStatus, to: input.status } },
  });
  await row.save();
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'NURSING_CARE_STATUS_CHANGED',
    resourceType: 'nursing-care', resourceId: row.id, success: true, ip,
    metadata: { patientId: row.patientId.toString(), from: previousStatus, to: input.status },
  });
  return mapCare(row);
}

export async function correctNursingCare(
  actor: AuthContext, organizationId: string, id: string,
  input: { reason: string; description?: string; scheduledAt?: Date; observations?: string }, ip?: string
) {
  const row = await NursingCare.findOne({ _id: id, organizationId });
  if (!row) throw new ApiError(404, 'Soin introuvable', 'NOT_FOUND');
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (input.description !== undefined && input.description !== row.description) {
    changes.description = { from: row.description, to: input.description };
    row.description = input.description;
  }
  if (input.scheduledAt !== undefined && input.scheduledAt.getTime() !== row.scheduledAt.getTime()) {
    changes.scheduledAt = { from: row.scheduledAt, to: input.scheduledAt };
    row.scheduledAt = input.scheduledAt;
  }
  if (input.observations !== undefined && input.observations !== row.observations) {
    changes.observations = { from: row.observations, to: input.observations };
    row.observations = input.observations;
  }
  if (!Object.keys(changes).length) throw new ApiError(400, 'La correction ne modifie aucune donnée', 'NO_CORRECTION');
  row.history.push({
    actorId: new mongoose.Types.ObjectId(actor.id), action: 'CORRECTED', at: new Date(),
    reason: input.reason, changes,
  });
  await row.save();
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'NURSING_CARE_CORRECTED',
    resourceType: 'nursing-care', resourceId: row.id, success: true, ip,
    metadata: { patientId: row.patientId.toString(), fields: Object.keys(changes) },
  });
  return mapCare(row);
}

export async function createVitalSigns(
  actor: AuthContext, organizationId: string,
  input: { patientId: string; measuredAt?: Date } & VitalValues & { observation?: string }, ip?: string
) {
  const patient = await requireVisiblePatient(actor, organizationId, input.patientId, ip);
  const { patientId: _patientId, ...values } = input;
  const row = await VitalSigns.create({
    organizationId, patientId: patient._id, recordedBy: actor.id,
    measuredAt: input.measuredAt ?? new Date(), ...values,
  });
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'NURSING_VITALS_RECORDED',
    resourceType: 'vital-signs', resourceId: row.id, success: true, ip,
    metadata: { patientId: patient.id },
  });
  const names = await namesById(organizationId, [actor.id]);
  return { ...mapVitals(row, await thresholdsFor(organizationId)), recordedByName: names.get(actor.id) };
}

export async function listVitalSigns(actor: AuthContext, organizationId: string, query: { patientId: string; page?: number; limit?: number }) {
  await requireVisiblePatient(actor, organizationId, query.patientId);
  const { page, limit, skip } = readPagination(query);
  const filter = { organizationId, patientId: query.patientId };
  const [rows, total, thresholds] = await Promise.all([
    VitalSigns.find(filter).sort({ measuredAt: -1 }).skip(skip).limit(limit),
    VitalSigns.countDocuments(filter),
    thresholdsFor(organizationId),
  ]);
  const mapped = rows.map((row) => mapVitals(row, thresholds));
  const names = await namesById(organizationId, mapped.map((row) => row.recordedBy));
  return paginated(mapped.map((row) => ({
    ...row,
    recordedByName: row.recordedBy ? names.get(row.recordedBy) : undefined,
  })), total, page, limit);
}

export async function createNursingObservation(
  actor: AuthContext, organizationId: string,
  input: { patientId: string; observedAt?: Date; content: string }, ip?: string
) {
  const patient = await requireVisiblePatient(actor, organizationId, input.patientId, ip);
  const row = await NursingObservation.create({
    organizationId, patientId: patient._id, nurseId: actor.id,
    observedAt: input.observedAt ?? new Date(), content: input.content,
  });
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'NURSING_OBSERVATION_CREATED',
    resourceType: 'nursing-observation', resourceId: row.id, success: true, ip,
    metadata: { patientId: patient.id },
  });
  return { id: row.id, patientId: row.patientId.toString(), nurseId: row.nurseId.toString(), observedAt: row.observedAt, content: row.content };
}

export async function getNursingPatient(actor: AuthContext, organizationId: string, patientId: string, ip?: string) {
  const patient = await requireVisiblePatient(actor, organizationId, patientId, ip);
  const [consultations, prescriptions, exams, care, observations, vitals, thresholds, stay, doctor] = await Promise.all([
    Consultation.find({ organizationId, patientId }).sort({ date: -1 }).limit(20).select('date doctorName diagnosis status'),
    Prescription.find({ organizationId, patientId, status: 'validated' }).sort({ createdAt: -1 }).limit(50)
      .select('prescriberName items status pharmacyStatus validatedAt createdAt'),
    Exam.find({ organizationId, patientId }).sort({ date: -1 }).limit(50).select('name type date status'),
    NursingCare.find({ organizationId, patientId }).sort({ scheduledAt: -1 }).limit(100),
    NursingObservation.find({ organizationId, patientId }).sort({ observedAt: -1 }).limit(100),
    VitalSigns.find({ organizationId, patientId }).sort({ measuredAt: -1 }).limit(100),
    thresholdsFor(organizationId),
    BedStay.findOne({ organizationId, patientId }).sort({ admissionDate: -1 })
      .select('bedId wardName bedNumber admissionDate dischargeDate status'),
    patient.primaryDoctorId ? User.findById(patient.primaryDoctorId).select('firstName lastName') : null,
  ]);
  const activeBed = stay?.status === 'active'
    ? await Bed.findOne({ _id: stay.bedId, organizationId }).select('expectedDischarge')
    : null;
  const stayEnd = stay?.dischargeDate ?? new Date();
  const mappedVitals = vitals.map((row) => mapVitals(row, thresholds));
  const mappedPrescriptions = prescriptions.map((row) => ({
    id: row.id,
    prescriberName: row.prescriberName,
    status: row.status,
    pharmacyStatus: row.pharmacyStatus,
    validatedAt: row.validatedAt,
    items: row.items.map((item) => {
      const closing = [...(item.treatmentStatusHistory ?? [])].reverse()
        .find((change) => change.status === 'completed' || change.status === 'interrupted');
      return {
        id: item.id,
        medication: item.medication,
        dosage: item.dosage,
        posology: item.posology,
        administrationRoute: item.administrationRoute,
        duration: item.duration,
        treatmentStartDate: item.treatmentStartDate,
        treatmentEndDate: item.treatmentEndDate,
        administrationTimes: item.administrationTimes ?? [],
        instructions: item.instructions ?? '',
        treatmentStatus: item.treatmentStatus,
        actualTreatmentEndAt: closing?.changedAt,
      };
    }),
  }));
    const names = await namesById(organizationId, [
      ...mappedVitals.map((row) => row.recordedBy),
      ...observations.map((row) => row.nurseId.toString()),
    ]);
    return {
    patient: {
      id: patient.id, recordNumber: patient.id,
      firstName: patient.firstName, lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth, gender: patient.gender, allergies: patient.allergies,
      bloodType: patient.bloodType, status: patient.status, room: stay?.bedNumber ?? patient.room,
      ward: stay?.wardName, doctor: doctor ? `${doctor.firstName} ${doctor.lastName}` : undefined,
    },
    hospitalization: stay ? {
      status: stay.status,
      admittedAt: stay.admissionDate,
      dischargedAt: stay.dischargeDate,
      expectedDischargeAt: activeBed?.expectedDischarge,
      durationDays: stayDurationDays(stay.admissionDate, stayEnd),
      ward: stay.wardName,
      room: stay.bedNumber,
    } : patient.admissionDate ? {
      status: patient.status === 'discharged' ? 'completed' : 'active',
      admittedAt: patient.admissionDate,
      dischargedAt: patient.dischargeDate,
      durationDays: stayDurationDays(patient.admissionDate, patient.dischargeDate ?? new Date()),
      ward: undefined,
      room: patient.room,
    } : undefined,
    consultations,
    prescriptions: mappedPrescriptions,
    exams,
    care: care.map(mapCare),
    observations: observations.map((row) => ({
      id: row.id,
      nurseId: row.nurseId.toString(),
      nurseName: names.get(row.nurseId.toString()),
      observedAt: row.observedAt,
      content: row.content,
    })),
    vitals: mappedVitals.map((row) => ({
      ...row,
      recordedByName: row.recordedBy ? names.get(row.recordedBy) : undefined,
    })),
  };
}

export async function getNursingSettings(organizationId: string) {
  return thresholdsFor(organizationId);
}

export async function updateNursingSettings(
  actor: AuthContext, organizationId: string, thresholds: VitalThresholds, ip?: string
) {
  await NursingSettings.findOneAndUpdate(
    { organizationId },
    { $set: thresholds, $setOnInsert: { organizationId } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'NURSING_THRESHOLDS_UPDATED',
    resourceType: 'nursing-settings', resourceId: organizationId, success: true, ip,
  });
  return thresholdsFor(organizationId);
}

export async function getNursingReport(actor: AuthContext, organizationId: string, query: { from?: Date; to?: Date }) {
  const patientScope: Record<string, unknown> = { organizationId };
  if (actor.role === ROLES.DOCTOR) {
    patientScope.patientId = { $in: await doctorPatientIds(actor, organizationId) };
  }
  const scheduledAt: Record<string, Date> = {};
  if (query.from) scheduledAt.$gte = query.from;
  if (query.to) scheduledAt.$lte = query.to;
  const careFilter = { ...patientScope, ...(Object.keys(scheduledAt).length ? { scheduledAt } : {}) };
  const observedAt: Record<string, Date> = {};
  if (query.from) observedAt.$gte = query.from;
  if (query.to) observedAt.$lte = query.to;
  const eventFilter = { ...patientScope, ...(Object.keys(observedAt).length ? { observedAt } : {}) };
  const measuredAt: Record<string, Date> = {};
  if (query.from) measuredAt.$gte = query.from;
  if (query.to) measuredAt.$lte = query.to;
  const vitalsFilter = { ...patientScope, ...(Object.keys(measuredAt).length ? { measuredAt } : {}) };
  const [total, byStatus, byType, observations, vitals] = await Promise.all([
    NursingCare.countDocuments(careFilter),
    NursingCare.aggregate([{ $match: careFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    NursingCare.aggregate([{ $match: careFilter }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
    NursingObservation.countDocuments(eventFilter),
    VitalSigns.countDocuments(vitalsFilter),
  ]);
  return {
    totalCare: total,
    byStatus: Object.fromEntries(byStatus.map((row: { _id: string; count: number }) => [row._id, row.count])),
    byType: Object.fromEntries(byType.map((row: { _id: string; count: number }) => [row._id, row.count])),
    observations,
    vitalMeasurements: vitals,
    period: { from: query.from, to: query.to },
  };
}
