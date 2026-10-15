import mongoose from 'mongoose';
import { ROLES } from '../config/permissions.js';
import { Appointment } from '../models/Appointment.js';
import { Consultation } from '../models/Consultation.js';
import { Patient } from '../models/Patient.js';
import { Personnel } from '../models/Personnel.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthContext } from '../types/express.js';
import { recordAudit } from './audit.service.js';

export async function requireOwned(
  model: { findById(id: string): Promise<any> },
  id: string,
  organizationId: string,
  actor: AuthContext,
  resourceType: string,
  ip?: string
) {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(404, 'Ressource introuvable', 'NOT_FOUND');
  }
  const doc = await model.findById(id);
  if (!doc || String(doc.organizationId) !== organizationId) {
    if (doc) {
      await recordAudit({
        actorId: actor.id,
        actorRole: actor.role,
        organizationId,
        action: 'CROSS_TENANT_DENIED',
        resourceType,
        resourceId: id,
        success: false,
        ip,
      });
    }
    throw new ApiError(404, 'Ressource introuvable', 'NOT_FOUND');
  }
  return doc;
}

export async function actorPersonnel(actor: AuthContext) {
  if (!actor.organizationId) {
    return null;
  }
  return Personnel.findOne({ organizationId: actor.organizationId, userId: actor.id, archivedAt: null });
}

export async function requireActorPersonnel(actor: AuthContext) {
  const personnel = await actorPersonnel(actor);
  if (!personnel) {
    throw new ApiError(403, 'Aucune fiche personnel liée à ce compte', 'NO_PERSONNEL');
  }
  return personnel;
}

export function assertDoctorOwns(actor: AuthContext, doctorPersonnelId: string, ownPersonnelId?: string) {
  if (actor.role !== ROLES.DOCTOR) {
    return;
  }
  if (!ownPersonnelId || ownPersonnelId !== doctorPersonnelId) {
    throw new ApiError(403, 'Dossier non autorisé', 'RECORD_FORBIDDEN');
  }
}

export async function linkedPatientIds(actor: AuthContext, organizationId: string) {
  const personnel = await actorPersonnel(actor);
  if (!personnel) {
    return [] as mongoose.Types.ObjectId[];
  }
  const [fromAppointments, fromConsultations] = await Promise.all([
    Appointment.find({
      organizationId,
      doctorId: personnel._id,
      status: { $ne: 'cancelled' },
    }).distinct('patientId'),
    Consultation.find({ organizationId, doctorId: personnel._id }).distinct('patientId'),
  ]);
  return [...fromAppointments, ...fromConsultations] as mongoose.Types.ObjectId[];
}

export async function doctorCanSeePatient(
  actor: AuthContext,
  patient: { _id: unknown; primaryDoctorId?: { toString(): string } | null; careTeamIds?: { toString(): string }[] }
) {
  if (patient.primaryDoctorId?.toString() === actor.id) {
    return true;
  }
  if ((patient.careTeamIds ?? []).some((id) => id.toString() === actor.id)) {
    return true;
  }
  const personnel = await actorPersonnel(actor);
  if (!personnel || !actor.organizationId) {
    return false;
  }
  const [appointment, consultation] = await Promise.all([
    Appointment.exists({
      organizationId: actor.organizationId,
      patientId: patient._id,
      doctorId: personnel._id,
      status: { $ne: 'cancelled' },
    }),
    Consultation.exists({
      organizationId: actor.organizationId,
      patientId: patient._id,
      doctorId: personnel._id,
    }),
  ]);
  return Boolean(appointment || consultation);
}

export async function requireVisiblePatient(actor: AuthContext, organizationId: string, patientId: string, ip?: string) {
  const patient = await requireOwned(Patient, patientId, organizationId, actor, 'patient', ip);
  if (patient.archivedAt) {
    throw new ApiError(404, 'Ressource introuvable', 'NOT_FOUND');
  }
  if (actor.role === ROLES.PATIENT && String(patient.linkedUserId ?? '') !== actor.id) {
    throw new ApiError(403, 'Dossier non autorisé', 'RECORD_FORBIDDEN');
  }
  if (actor.role === ROLES.DOCTOR && !(await doctorCanSeePatient(actor, patient))) {
    throw new ApiError(403, 'Dossier non autorisé', 'RECORD_FORBIDDEN');
  }
  return patient;
}

export async function ownPatientId(actor: AuthContext, organizationId: string) {
  const patient = await Patient.findOne({ organizationId, linkedUserId: actor.id, archivedAt: null });
  return patient?._id ?? null;
}
