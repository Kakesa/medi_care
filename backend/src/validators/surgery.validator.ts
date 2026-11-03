import { z } from 'zod';
import { objectIdSchema } from './common.js';

const empty = z.object({}).optional().default({});
const paramsId = z.object({ id: objectIdSchema });
const paramsPatient = z.object({ patientId: objectIdSchema });
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function envelope(body: z.ZodTypeAny, query: z.ZodTypeAny = empty, params: z.ZodTypeAny = empty) {
  return z.object({ body, query, params });
}

const actBody = {
  name: z.string().min(1).max(160),
  categoryId: objectIdSchema,
  description: z.string().max(2000).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  active: z.boolean().optional(),
};

export const listActsSchema = envelope(
  empty,
  z.object({
    search: z.string().max(80).optional(),
    categoryId: objectIdSchema.optional(),
    active: z.enum(['true', 'false']).optional(),
    billable: z.enum(['true', 'false']).optional(),
    sort: z.enum(['name', 'createdAt', 'updatedAt']).optional(),
    direction: z.enum(['asc', 'desc']).optional(),
  }).optional().default({})
);

export const createActSchema = envelope(z.object(actBody));
export const updateActSchema = envelope(
  z.object({
    name: actBody.name.optional(),
    categoryId: objectIdSchema.optional(),
    description: actBody.description,
    unitPrice: actBody.unitPrice,
    active: z.boolean().optional(),
  }),
  empty,
  paramsId
);
export const actParamsSchema = envelope(empty, empty, paramsId);
export const createCategorySchema = envelope(z.object({ name: z.string().min(1).max(80) }));
export const priceHistorySchema = envelope(empty, z.object({ actId: objectIdSchema.optional() }).optional().default({}));
export const statsSchema = envelope(
  empty,
  z.object({ startDate: day.optional(), endDate: day.optional() }).optional().default({})
);
export const patientHistorySchema = envelope(empty, empty, paramsPatient);
