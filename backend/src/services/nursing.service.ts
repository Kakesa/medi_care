import mongoose, { type FilterQuery } from 'mongoose';
import { ROLES } from '../config/permissions.js';
import { BedStay } from '../models/BedStay.js';
import { Consultation } from '../models/Consultation.js';
import { Exam } from '../models/Exam.js';
import { NursingCare } from '../models/NursingCare.js';
import { NursingObservation } from '../models/NursingObservation.js';
import { Organization } from '../models/Organization.js';
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
  const organization = await Organization.findById(organizationId).select('nursingVitalThresholds');
  if (!organization) throw new ApiError(404, 'Établissement introuvable', 'NOT_FOUND');
  return { ...defaultThresholds, ...(organization.nursingVitalThresholds ?? {}) };
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

async function patientDto(patient: InstanceType<typeof Patient>, organizationId: string, latest?: ReturnType<typeof mapVitals>) {
  const [doctor, stay, nextCare] = await Promise.all([
    patient.primaryDoctorId ? User.findById(patient.primaryDoctorId).select('firstName lastName') : null,
    BedStay.findOne({ organizationId, patientId: patient._id, status: 'active' }).select('wardName bedNumber'),
    NursingCare.findOne({ organizationId, patientId: patient._id, status: { $in: ['pending', 'in_progress'] }, scheduledAt: { $gte: new Date() } })
      .sort({ scheduledAt: 1 }).select('type description scheduledAt status'),
  ]);
  const age = patient.dateOfBirth ? Math.max(0, new Date().getFullYear() - patient.dateOfBirth.getFullYear() - (new Date() < new Date(new Date().getFullYear(), patient.dateOfBirth.getMonth(), patient.dateOfBirth.getDate()) ? 1 : 0)) : undefined;
  return {
    id: patient.id ?? patient._id.toString(),
    recordNumber: patient._id.toString(),
    firstName: patient.firstName,
    lastName: patient.lastName,
    age,
    status: patient.status,
    room: stay?.bedNumber ?? patient.room,
    ward: stay?.wardName,
    doctor: doctor ? `${doctor.firstName} ${doctor.lastName}` : undefined,
    primaryDoctorId: idOf(patient.primaryDoctorId),
    lastVitals: latest ?? (patient.temperature !== undefined || patient.tension || patient.saturation !== undefined
      ? { temperature: patient.temperature, tension: patient.tension, oxygenSaturation: patient.saturation }
      : undefined),
    nextCare: nextCare ? {
      id: nextCare.id, type: nextCare.type, description: nextCare.description,
      scheduledAt: nextCare.scheduledAt, status: nextCare.status,
    } : undefined,
  };
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
  const rows = await Promise.all(patients.map((patient) => patientDto(patient, organizationId, latest.get(patient.id))));
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
  const patientRows = await Promise.all(patients.map((patient) => patientDto(patient, organizationId, latest.get(patient.id))));
  const attentionPatientCount = [...latest.values()].filter((row) => row.alerts.length > 0).length;
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
  return mapVitals(row, await thresholdsFor(organizationId));
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
  return paginated(rows.map((row) => mapVitals(row, thresholds)), total, page, limit);
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
    Consultation.find({ organizationId, patientId }).sort({ date: -1 }).limit(20).select('date doctorName status'),
    Prescription.find({ organizationId, patientId, status: 'validated' }).sort({ createdAt: -1 }).limit(50)
      .select('prescriberName items status pharmacyStatus validatedAt createdAt'),
    Exam.find({ organizationId, patientId }).sort({ date: -1 }).limit(50).select('name type date status'),
    NursingCare.find({ organizationId, patientId }).sort({ scheduledAt: -1 }).limit(100),
    NursingObservation.find({ organizationId, patientId }).sort({ observedAt: -1 }).limit(100),
    VitalSigns.find({ organizationId, patientId }).sort({ measuredAt: -1 }).limit(100),
    thresholdsFor(organizationId),
    BedStay.findOne({ organizationId, patientId, status: 'active' }).select('wardName bedNumber'),
    patient.primaryDoctorId ? User.findById(patient.primaryDoctorId).select('firstName lastName') : null,
  ]);
  return {
    patient: {
      id: patient.id, recordNumber: patient.id,
      firstName: patient.firstName, lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth, gender: patient.gender, allergies: patient.allergies,
      bloodType: patient.bloodType, status: patient.status, room: stay?.bedNumber ?? patient.room,
      ward: stay?.wardName, doctor: doctor ? `${doctor.firstName} ${doctor.lastName}` : undefined,
    },
    consultations,
    prescriptions,
    exams,
    care: care.map(mapCare),
    observations: observations.map((row) => ({
      id: row.id, nurseId: row.nurseId.toString(), observedAt: row.observedAt, content: row.content,
    })),
    vitals: vitals.map((row) => mapVitals(row, thresholds)),
  };
}

export async function getNursingSettings(organizationId: string) {
  return thresholdsFor(organizationId);
}

export async function updateNursingSettings(
  actor: AuthContext, organizationId: string, thresholds: VitalThresholds, ip?: string
) {
  const organization = await Organization.findByIdAndUpdate(
    organizationId, { $set: { nursingVitalThresholds: thresholds } }, { new: true, runValidators: true }
  ).select('nursingVitalThresholds');
  if (!organization) throw new ApiError(404, 'Établissement introuvable', 'NOT_FOUND');
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'NURSING_THRESHOLDS_UPDATED',
    resourceType: 'organization', resourceId: organizationId, success: true, ip,
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
