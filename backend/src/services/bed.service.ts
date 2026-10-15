import mongoose from 'mongoose';
import { Bed } from '../models/Bed.js';
import { BedStay } from '../models/BedStay.js';
import { Patient } from '../models/Patient.js';
import { Ward } from '../models/Ward.js';
import { ApiError } from '../utils/ApiError.js';
import { dateOnly } from '../utils/dates.js';
import { paginated, readPagination } from '../utils/pagination.js';
import type { AuthContext } from '../types/express.js';
import { requireOwned } from './access.service.js';
import { recordAudit } from './audit.service.js';

type WardDoc = {
  id?: string;
  _id: { toString(): string };
  name: string;
  floor: number;
  department: string;
};

type BedDoc = {
  id?: string;
  _id: { toString(): string };
  wardId: { toString(): string } | WardDoc;
  number: string;
  type: string;
  status: string;
  patientId?: { toString(): string } | null;
  patientName?: string | null;
  admissionDate?: Date | null;
  expectedDischarge?: Date | null;
  notes?: string | null;
  save(): Promise<unknown>;
  set(path: string, value: unknown): void;
};

function todayStamp() {
  return dateOnly(new Date()) ?? new Date().toISOString().slice(0, 10);
}

function asDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dayCount(start?: Date | null, end?: Date | null) {
  const from = dateOnly(start);
  const to = dateOnly(end) ?? todayStamp();
  if (!from) return 0;
  const ms = asDate(to).getTime() - asDate(from).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function wardOf(value: BedDoc['wardId']): WardDoc | null {
  if (value && typeof value === 'object' && 'name' in value) {
    return value;
  }
  return null;
}

function toWardDto(row: WardDoc, totalBeds: number) {
  return {
    id: row.id ?? row._id.toString(),
    name: row.name,
    floor: row.floor,
    department: row.department,
    totalBeds,
  };
}

function toBedDto(row: BedDoc) {
  const ward = wardOf(row.wardId);
  return {
    id: row.id ?? row._id.toString(),
    number: row.number,
    wardId: ward ? (ward.id ?? ward._id.toString()) : row.wardId.toString(),
    wardName: ward?.name ?? '',
    floor: ward?.floor ?? 0,
    type: row.type,
    status: row.status,
    patientId: row.patientId ? row.patientId.toString() : undefined,
    patientName: row.patientName || undefined,
    admissionDate: dateOnly(row.admissionDate),
    expectedDischarge: dateOnly(row.expectedDischarge),
    notes: row.notes || undefined,
  };
}

async function countsByWard(organizationId: string) {
  const rows = await Bed.aggregate<{ _id: { toString(): string }; total: number }>([
    { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
    { $group: { _id: '$wardId', total: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.total]));
}

async function assertUniqueName(organizationId: string, name: string, exceptId?: string) {
  const existing = await Ward.findOne({
    organizationId,
    name,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  if (existing) {
    throw new ApiError(409, 'Un service porte déjà ce nom', 'DUPLICATE');
  }
}

async function assertUniqueNumber(organizationId: string, number: string, exceptId?: string) {
  const existing = await Bed.findOne({
    organizationId,
    number,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  if (existing) {
    throw new ApiError(409, 'Ce numéro de lit existe déjà', 'DUPLICATE');
  }
}

export async function listWards(organizationId: string) {
  const [wards, counts] = await Promise.all([
    Ward.find({ organizationId }).sort({ floor: 1, name: 1 }),
    countsByWard(organizationId),
  ]);
  return wards.map((ward) => toWardDto(ward, counts.get(String(ward._id)) ?? 0));
}

export async function getWard(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const ward = await requireOwned(Ward, id, organizationId, actor, 'ward', ip);
  const total = await Bed.countDocuments({ organizationId, wardId: ward._id });
  return toWardDto(ward, total);
}

export async function createWard(
  actor: AuthContext,
  organizationId: string,
  input: { name: string; floor: number; department: string },
  ip?: string
) {
  await assertUniqueName(organizationId, input.name);
  const ward = await Ward.create({ organizationId, ...input });
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'WARD_CREATED',
    resourceType: 'ward',
    resourceId: ward.id,
    success: true,
    ip,
  });
  return toWardDto(ward, 0);
}

export async function updateWard(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: { name?: string; floor?: number; department?: string },
  ip?: string
) {
  const ward = await requireOwned(Ward, id, organizationId, actor, 'ward', ip);
  if (input.name && input.name !== ward.name) {
    await assertUniqueName(organizationId, input.name, ward.id);
    ward.name = input.name;
  }
  if (input.floor !== undefined) ward.floor = input.floor;
  if (input.department) ward.department = input.department;
  await ward.save();
  if (input.name) {
    await BedStay.updateMany(
      { organizationId, bedId: { $in: await Bed.find({ organizationId, wardId: ward._id }).distinct('_id') }, status: 'active' },
      { wardName: ward.name }
    );
  }
  const total = await Bed.countDocuments({ organizationId, wardId: ward._id });
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'WARD_UPDATED',
    resourceType: 'ward',
    resourceId: ward.id,
    success: true,
    ip,
  });
  return toWardDto(ward, total);
}

export async function deleteWard(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const ward = await requireOwned(Ward, id, organizationId, actor, 'ward', ip);
  const beds = await Bed.countDocuments({ organizationId, wardId: ward._id });
  if (beds > 0) {
    throw new ApiError(409, 'Retirez les lits de ce service avant de le supprimer', 'WARD_NOT_EMPTY');
  }
  await ward.deleteOne();
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'WARD_DELETED',
    resourceType: 'ward',
    resourceId: id,
    success: true,
    ip,
  });
}

export async function listBeds(
  organizationId: string,
  query: { page?: number; limit?: number; wardId?: string; status?: string; type?: string }
) {
  const { page, limit, skip } = readPagination(query);
  const filter = {
    organizationId,
    ...(query.wardId ? { wardId: query.wardId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
  };
  const [rows, total] = await Promise.all([
    Bed.find(filter).populate('wardId').sort({ number: 1 }).skip(skip).limit(limit),
    Bed.countDocuments(filter),
  ]);
  return paginated(rows.map((row) => toBedDto(row as unknown as BedDoc)), total, page, limit);
}

async function loadBed(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const bed = await requireOwned(Bed, id, organizationId, actor, 'bed', ip);
  await bed.populate('wardId');
  return bed as BedDoc;
}

export async function getBed(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  return toBedDto(await loadBed(actor, organizationId, id, ip));
}

export async function createBed(
  actor: AuthContext,
  organizationId: string,
  input: { number: string; wardId: string; type: string; notes?: string },
  ip?: string
) {
  await requireOwned(Ward, input.wardId, organizationId, actor, 'ward', ip);
  await assertUniqueNumber(organizationId, input.number);
  const bed = await Bed.create({
    organizationId,
    wardId: input.wardId,
    number: input.number,
    type: input.type,
    status: 'available',
    notes: input.notes ?? '',
  });
  await bed.populate('wardId');
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'BED_CREATED',
    resourceType: 'bed',
    resourceId: bed.id,
    success: true,
    ip,
  });
  return toBedDto(bed as unknown as BedDoc);
}

export async function updateBed(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: {
    number?: string;
    wardId?: string;
    type?: string;
    status?: 'available' | 'maintenance' | 'reserved';
    notes?: string;
    expectedDischarge?: string;
  },
  ip?: string
) {
  const bed = await loadBed(actor, organizationId, id, ip);
  if (bed.status === 'occupied' && (input.status || input.number || input.wardId)) {
    throw new ApiError(409, 'Libérez le lit avant de modifier son numéro, son service ou son statut', 'BED_OCCUPIED');
  }
  if (input.wardId) {
    await requireOwned(Ward, input.wardId, organizationId, actor, 'ward', ip);
    bed.set('wardId', input.wardId);
  }
  if (input.number && input.number !== bed.number) {
    await assertUniqueNumber(organizationId, input.number, bed.id ?? bed._id.toString());
    bed.set('number', input.number);
  }
  if (input.type) bed.set('type', input.type);
  if (input.status) bed.set('status', input.status);
  if (input.notes !== undefined) bed.set('notes', input.notes);
  if (input.expectedDischarge !== undefined) {
    bed.set('expectedDischarge', input.expectedDischarge ? asDate(input.expectedDischarge) : undefined);
  }
  await bed.save();
  const fresh = await Bed.findById(bed._id).populate('wardId');
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'BED_UPDATED',
    resourceType: 'bed',
    resourceId: id,
    success: true,
    ip,
  });
  return toBedDto(fresh as unknown as BedDoc);
}

export async function deleteBed(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const bed = await loadBed(actor, organizationId, id, ip);
  if (bed.status === 'occupied') {
    throw new ApiError(409, 'Libérez le lit avant de le supprimer', 'BED_OCCUPIED');
  }
  await BedStay.deleteMany({ organizationId, bedId: bed._id });
  await Bed.deleteOne({ _id: bed._id });
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'BED_DELETED',
    resourceType: 'bed',
    resourceId: id,
    success: true,
    ip,
  });
}

export async function assignBed(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: { patientId: string; expectedDischarge?: string },
  ip?: string
) {
  const bed = await loadBed(actor, organizationId, id, ip);
  if (bed.status !== 'available' && bed.status !== 'reserved') {
    throw new ApiError(409, 'Ce lit ne peut pas être attribué', 'BED_UNAVAILABLE');
  }
  const patient = await requireOwned(Patient, input.patientId, organizationId, actor, 'patient', ip);
  if (patient.archivedAt || patient.status === 'discharged') {
    throw new ApiError(409, 'Ce patient ne peut pas occuper un lit', 'PATIENT_UNAVAILABLE');
  }
  const other = await Bed.findOne({
    organizationId,
    patientId: patient._id,
    status: 'occupied',
    _id: { $ne: bed._id },
  });
  if (other) {
    throw new ApiError(409, 'Ce patient occupe déjà un lit', 'PATIENT_ALREADY_ASSIGNED');
  }

  const admission = todayStamp();
  const ward = wardOf(bed.wardId);
  bed.set('status', 'occupied');
  bed.set('patientId', patient._id);
  bed.set('patientName', `${patient.firstName} ${patient.lastName}`);
  bed.set('admissionDate', asDate(admission));
  bed.set('expectedDischarge', input.expectedDischarge ? asDate(input.expectedDischarge) : undefined);
  await bed.save();

  await BedStay.create({
    organizationId,
    bedId: bed._id,
    bedNumber: bed.number,
    wardName: ward?.name ?? '',
    patientId: patient._id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    admissionDate: asDate(admission),
    status: 'active',
  });

  patient.status = 'hospitalized';
  patient.room = bed.number;
  if (!patient.admissionDate) patient.admissionDate = asDate(admission);
  await patient.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'BED_ASSIGNED',
    resourceType: 'bed',
    resourceId: id,
    success: true,
    ip,
    metadata: { patientId: patient.id },
  });
  const fresh = await Bed.findById(bed._id).populate('wardId');
  return toBedDto(fresh as unknown as BedDoc);
}

export async function releaseBed(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const bed = await loadBed(actor, organizationId, id, ip);
  if (bed.status !== 'occupied') {
    throw new ApiError(409, 'Ce lit n’est pas occupé', 'BED_NOT_OCCUPIED');
  }
  const patientId = bed.patientId?.toString();
  const number = bed.number;
  const discharge = todayStamp();

  await Bed.updateOne(
    { _id: bed._id, organizationId },
    {
      $set: { status: 'available' },
      $unset: { patientId: 1, patientName: 1, admissionDate: 1, expectedDischarge: 1 },
    }
  );

  await BedStay.updateMany(
    { organizationId, bedId: bed._id, status: 'active' },
    { status: 'completed', dischargeDate: asDate(discharge) }
  );

  if (patientId) {
    const patient = await Patient.findOne({ _id: patientId, organizationId });
    if (patient && patient.room === number) {
      patient.room = '';
      patient.status = 'outpatient';
      await patient.save();
    }
  }

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'BED_RELEASED',
    resourceType: 'bed',
    resourceId: id,
    success: true,
    ip,
  });
  const fresh = await Bed.findById(bed._id).populate('wardId');
  return toBedDto(fresh as unknown as BedDoc);
}

export async function listOccupations(organizationId: string, query: { page?: number; limit?: number }) {
  const { page, limit, skip } = readPagination(query);
  const filter = { organizationId };
  const [rows, total] = await Promise.all([
    BedStay.find(filter).sort({ admissionDate: -1 }).skip(skip).limit(limit),
    BedStay.countDocuments(filter),
  ]);
  return paginated(
    rows.map((row) => ({
      id: row.id,
      bedId: row.bedId.toString(),
      bedNumber: row.bedNumber,
      wardName: row.wardName,
      patientId: row.patientId ? row.patientId.toString() : undefined,
      patientName: row.patientName,
      admissionDate: dateOnly(row.admissionDate) ?? '',
      dischargeDate: dateOnly(row.dischargeDate),
      durationDays: dayCount(row.admissionDate, row.dischargeDate),
      status: row.status,
    })),
    total,
    page,
    limit
  );
}
