import { ROLES } from '../config/permissions.js';
import { Appointment } from '../models/Appointment.js';
import { BadgeSeen } from '../models/BadgeSeen.js';
import { Consultation } from '../models/Consultation.js';
import { Exam } from '../models/Exam.js';
import { Invoice } from '../models/Invoice.js';
import { PharmacyProduct } from '../models/PharmacyProduct.js';
import { Prescription } from '../models/Prescription.js';
import { ReceptionEntry } from '../models/ReceptionEntry.js';
import type { AuthContext } from '../types/express.js';
import { actorPersonnel, ownPatientId } from './access.service.js';

const LAB_WORK = ['EN_ATTENTE', 'EN_COURS', 'BROUILLON', 'CORRECTION_DEMANDEE', 'REJETE'];
const LAB_PIPELINE = ['EN_ATTENTE', 'EN_COURS', 'BROUILLON', 'EN_ATTENTE_VALIDATION', 'CORRECTION_DEMANDEE'];

function examMarker(row: { labStatus?: string | null; status?: string | null; updatedAt?: Date | null }) {
  const at = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
  return `${row.labStatus || ''}|${row.status || ''}|${at}`;
}

async function examScope(actor: AuthContext, organizationId: string) {
  if (actor.role === ROLES.PATIENT) {
    const patientId = await ownPatientId(actor, organizationId);
    return patientId ? { organizationId, patientId } : null;
  }
  if (actor.role === ROLES.DOCTOR) {
    const personnel = await actorPersonnel(actor);
    return personnel ? { organizationId, doctorId: personnel._id } : null;
  }
  if (
    actor.role === ROLES.HOSPITAL_ADMIN
    || actor.role === ROLES.RECEPTIONIST
    || actor.role === ROLES.NURSE
    || actor.role === ROLES.ACCOUNTANT
    || actor.role === ROLES.LABORANTIN
  ) {
    return { organizationId };
  }
  return null;
}

async function countUnseenExams(actor: AuthContext, organizationId: string, filter: Record<string, unknown>) {
  const rows = await Exam.find(filter).select('labStatus status updatedAt').limit(500);
  if (!rows.length) return 0;
  const seen = await BadgeSeen.find({
    organizationId,
    userId: actor.id,
    resourceType: 'exam',
    resourceId: { $in: rows.map((row) => row._id) },
  }).select('resourceId marker');
  const known = new Map(seen.map((row) => [String(row.resourceId), row.marker]));
  return rows.filter((row) => known.get(String(row._id)) !== examMarker(row)).length;
}

export async function markExamsSeen(actor: AuthContext, organizationId: string, ids: string[]) {
  const scope = await examScope(actor, organizationId);
  if (!scope) return { success: true };
  const rows = await Exam.find({ ...scope, _id: { $in: ids } }).select('labStatus status updatedAt');
  if (!rows.length) return { success: true };
  await BadgeSeen.bulkWrite(rows.map((row) => ({
    updateOne: {
      filter: { organizationId, userId: actor.id, resourceType: 'exam', resourceId: row._id },
      update: { $set: { marker: examMarker(row) } },
      upsert: true,
    },
  })));
  return { success: true };
}

export async function workBadges(actor: AuthContext, organizationId: string) {
  const counts: Record<string, number> = {};
  const base = { organizationId };
  const role = actor.role;
  const personnel = role === ROLES.DOCTOR ? await actorPersonnel(actor) : null;
  const tasks: Promise<void>[] = [];

  const put = (href: string, value: Promise<number>) => {
    tasks.push(value.then((total) => {
      if (total > 0) counts[href] = total;
    }));
  };

  if (role === ROLES.LABORANTIN) {
    put('/dashboard/laboratoire', Exam.countDocuments({
      ...base,
      type: 'laboratory',
      $or: [
        { labStatus: { $in: LAB_WORK } },
        { labStatus: null, status: { $in: ['pending', 'in_progress'] } },
      ],
    }));
  }

  if (role === ROLES.HOSPITAL_ADMIN) {
    tasks.push((async () => {
      const total = await countUnseenExams(actor, organizationId, {
        ...base,
        type: 'laboratory',
        labStatus: 'EN_ATTENTE_VALIDATION',
      });
      if (total > 0) counts['/dashboard/supervision-lab'] = total;
    })());
  }

  if (role === ROLES.RECEPTIONIST) {
    tasks.push((async () => {
      const [pipeline, ready] = await Promise.all([
        Exam.countDocuments({
          ...base,
          type: 'laboratory',
          $or: [
            { labStatus: { $in: LAB_PIPELINE } },
            { labStatus: null, status: { $in: ['pending', 'in_progress'] } },
          ],
        }),
        countUnseenExams(actor, organizationId, { ...base, type: 'laboratory', labStatus: 'VALIDE' }),
      ]);
      const total = pipeline + ready;
      if (total > 0) counts['/dashboard/demandes-lab'] = total;
    })());
  }

  const seesExams = role === ROLES.HOSPITAL_ADMIN || role === ROLES.RECEPTIONIST || role === ROLES.NURSE || role === ROLES.ACCOUNTANT || role === ROLES.DOCTOR;
  if (seesExams && (role !== ROLES.DOCTOR || personnel)) {
    tasks.push((async () => {
      const open: Record<string, unknown> = { ...base, status: { $in: ['pending', 'in_progress'] } };
      const ready: Record<string, unknown> = { ...base, status: 'completed', results: { $nin: [null, ''] } };
      if (personnel) {
        open.doctorId = personnel._id;
        ready.doctorId = personnel._id;
      }
      const [openCount, unseen] = await Promise.all([
        Exam.countDocuments(open),
        countUnseenExams(actor, organizationId, ready),
      ]);
      const total = openCount + unseen;
      if (total > 0) counts['/dashboard/examinations'] = total;
    })());
  }

  const seesAppointments = role === ROLES.HOSPITAL_ADMIN || role === ROLES.RECEPTIONIST || role === ROLES.DOCTOR;
  if (seesAppointments && (role !== ROLES.DOCTOR || personnel)) {
    const filter: Record<string, unknown> = { ...base, status: 'pending' };
    if (personnel) filter.doctorId = personnel._id;
    put('/dashboard/appointments', Appointment.countDocuments(filter));
  }

  if (role === ROLES.HOSPITAL_ADMIN || role === ROLES.RECEPTIONIST) {
    put('/dashboard/reception', ReceptionEntry.countDocuments({
      ...base,
      status: { $in: ['waiting', 'in_consultation'] },
    }));
  }

  const seesConsultations = role === ROLES.HOSPITAL_ADMIN || role === ROLES.NURSE || role === ROLES.DOCTOR;
  if (seesConsultations && (role !== ROLES.DOCTOR || personnel)) {
    const filter: Record<string, unknown> = { ...base, status: 'in_progress' };
    if (personnel) filter.doctorId = personnel._id;
    put('/dashboard/consultations', Consultation.countDocuments(filter));
  }

  if (role === ROLES.HOSPITAL_ADMIN || role === ROLES.RECEPTIONIST || role === ROLES.ACCOUNTANT) {
    put('/dashboard/billing', Invoice.countDocuments({ ...base, status: { $in: ['pending', 'overdue'] } }));
    put('/dashboard/accounting', Invoice.countDocuments({ ...base, status: { $in: ['pending', 'overdue'] } }));
  }

  if (role === ROLES.HOSPITAL_ADMIN || role === ROLES.PHARMACIST) {
    put('/dashboard/pharmacy', PharmacyProduct.countDocuments({
      ...base,
      archivedAt: null,
      status: { $in: ['low_stock', 'out_of_stock'] },
    }));
  }

  if (role === ROLES.HOSPITAL_ADMIN || role === ROLES.DOCTOR) {
    const filter: Record<string, unknown> = { ...base, status: 'draft' };
    if (role === ROLES.DOCTOR) filter.prescriberId = actor.id;
    put('/dashboard/ordonnances', Prescription.countDocuments(filter));
  }

  if (role === ROLES.PHARMACIST) {
    put('/dashboard/pharmacie-ordonnances', Prescription.countDocuments({
      ...base,
      status: 'validated',
      pharmacyStatus: { $in: ['new', 'preparing', 'partial', 'delivered'] },
    }));
  }

  if (role === ROLES.PATIENT) {
    const patientId = await ownPatientId(actor, organizationId);
    if (patientId) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      put('/dashboard/rendez-vous', Appointment.countDocuments({
        ...base,
        patientId,
        $or: [
          { status: 'pending' },
          { status: 'confirmed', date: { $gte: start } },
        ],
      }));
      tasks.push((async () => {
        const [openCount, unseen] = await Promise.all([
          Exam.countDocuments({ ...base, patientId, status: { $in: ['pending', 'in_progress'] } }),
          countUnseenExams(actor, organizationId, {
            ...base,
            patientId,
            status: 'completed',
            results: { $nin: [null, ''] },
          }),
        ]);
        const total = openCount + unseen;
        if (total > 0) counts['/dashboard/examen'] = total;
      })());
      put('/dashboard/facture', Invoice.countDocuments({
        ...base,
        patientId,
        status: { $in: ['pending', 'overdue'] },
      }));
    }
  }

  await Promise.all(tasks);
  return { counts };
}
