import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.js';

const empty = z.object({}).strict().optional().default({});
const paramsId = z.object({ id: objectIdSchema });

function envelope(body: z.ZodTypeAny, query: z.ZodTypeAny = empty, params: z.ZodTypeAny = empty) {
  return z.object({ body, query, params });
}

const bedType = z.enum(['standard', 'intensive_care', 'pediatric', 'maternity', 'isolation']);
const freeStatus = z.enum(['available', 'maintenance', 'reserved']);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide');

const wardBody = {
  name: z.string().trim().min(2).max(80),
  floor: z.coerce.number().int().min(0).max(40),
  department: z.string().trim().min(2).max(80),
};

export const listWardsSchema = envelope(empty);
export const createWardSchema = envelope(z.object(wardBody).strict());
export const updateWardSchema = envelope(
  z.object({
    name: wardBody.name.optional(),
    floor: wardBody.floor.optional(),
    department: wardBody.department.optional(),
  }).strict(),
  empty,
  paramsId
);
export const wardParamsSchema = envelope(empty, empty, paramsId);

export const listBedsSchema = envelope(
  empty,
  paginationSchema.extend({
    wardId: objectIdSchema.optional(),
    status: z.enum(['available', 'occupied', 'maintenance', 'reserved']).optional(),
    type: bedType.optional(),
  })
);

export const createBedSchema = envelope(
  z.object({
    number: z.string().trim().min(1).max(20),
    wardId: objectIdSchema,
    type: bedType,
    notes: z.string().trim().max(500).optional(),
  }).strict()
);

export const updateBedSchema = envelope(
  z.object({
    number: z.string().trim().min(1).max(20).optional(),
    wardId: objectIdSchema.optional(),
    type: bedType.optional(),
    status: freeStatus.optional(),
    notes: z.string().trim().max(500).optional(),
    expectedDischarge: z.union([day, z.literal('')]).optional(),
  }).strict(),
  empty,
  paramsId
);

export const bedParamsSchema = envelope(empty, empty, paramsId);

export const assignBedSchema = envelope(
  z.object({
    patientId: objectIdSchema,
    expectedDischarge: day.optional(),
  }).strict(),
  empty,
  paramsId
);

export const releaseBedSchema = envelope(z.object({}).strict(), empty, paramsId);

export const listOccupationsSchema = envelope(empty, paginationSchema);
