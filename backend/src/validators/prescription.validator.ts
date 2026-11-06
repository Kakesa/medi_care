import { z } from 'zod';
import { objectIdSchema } from './common.js';

const empty = z.object({}).optional().default({});
const paramsId = z.object({ id: objectIdSchema });

function envelope(body: z.ZodTypeAny, query: z.ZodTypeAny = empty, params: z.ZodTypeAny = empty) {
  return z.object({ body, query, params });
}

const item = z.object({
  medication: z.string().trim().min(1).max(160),
  dosage: z.string().trim().min(1).max(80),
  posology: z.string().trim().min(1).max(160),
  administrationRoute: z.string().trim().min(2).max(80).optional(),
  duration: z.string().trim().min(1).max(80),
  instructions: z.string().trim().max(500).optional(),
  quantityPrescribed: z.coerce.number().int().min(1).max(999),
});

export const listPrescriptionsSchema = envelope(empty, z.object({
  patientId: objectIdSchema.optional(),
}).optional().default({}));

export const createPrescriptionSchema = envelope(z.object({
  patientId: objectIdSchema,
  examId: objectIdSchema.optional(),
  items: z.array(item).min(1).max(20),
}));

export const prescriptionParamsSchema = envelope(empty, empty, paramsId);

export const dispenseSchema = envelope(z.object({
  itemIndex: z.coerce.number().int().min(0),
  productId: objectIdSchema,
  quantity: z.coerce.number().int().min(1).max(999),
}), empty, paramsId);

export const unavailableSchema = envelope(z.object({
  itemIndex: z.coerce.number().int().min(0),
  note: z.string().trim().min(3).max(500),
}), empty, paramsId);
