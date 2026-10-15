import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.js';

const patientFields = {
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email('Email invalide').max(160).optional(),
  phone: z.string().max(30).optional(),
  dateOfBirth: z.coerce.date(),
  gender: z.enum(['M', 'F']),
  address: z.string().max(300).optional(),
  bloodType: z.string().max(8).optional(),
  allergies: z.array(z.string().max(80)).max(30).optional(),
  status: z.enum(['outpatient', 'hospitalized', 'discharged']).optional(),
  room: z.string().max(40).optional(),
  primaryDoctorId: objectIdSchema.optional(),
  linkedUserId: objectIdSchema.optional(),
};

export const createPatientSchema = z.object({
  body: z.object(patientFields).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({}).strict().optional().default({}),
});

export const updatePatientSchema = z.object({
  body: z.object({
    firstName: patientFields.firstName.optional(),
    lastName: patientFields.lastName.optional(),
    email: patientFields.email,
    phone: patientFields.phone,
    dateOfBirth: patientFields.dateOfBirth.optional(),
    gender: patientFields.gender.optional(),
    address: patientFields.address,
    bloodType: patientFields.bloodType,
    allergies: patientFields.allergies,
    status: patientFields.status,
    room: patientFields.room,
    primaryDoctorId: objectIdSchema.nullable().optional(),
    careTeamIds: z.array(objectIdSchema).max(20).optional(),
  }).strict(),
  query: z.object({}).strict().optional().default({}),
  params: z.object({ id: objectIdSchema }),
});

export const listPatientsSchema = z.object({
  body: z.object({}).strict().optional().default({}),
  query: paginationSchema.extend({
    search: z.string().max(80).optional(),
    status: z.enum(['outpatient', 'hospitalized', 'discharged']).optional(),
  }),
  params: z.object({}).strict().optional().default({}),
});

export const patientParamsSchema = z.object({
  body: z.object({}).strict().optional().default({}),
  query: z.object({}).strict().optional().default({}),
  params: z.object({ id: objectIdSchema }),
});
