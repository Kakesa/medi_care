import { z } from 'zod';
import { objectIdSchema } from './common.js';

const empty = z.object({}).optional().default({});
const paramsId = z.object({ id: objectIdSchema });

function envelope(body: z.ZodTypeAny, query: z.ZodTypeAny = empty, params: z.ZodTypeAny = empty) {
  return z.object({ body, query, params });
}

export const listChargesSchema = envelope(
  empty,
  z.object({
    patientId: objectIdSchema.optional(),
    realizationStatus: z.enum(['recommended', 'pending', 'performed', 'cancelled']).optional(),
  }).optional().default({})
);

export const recommendChargeSchema = envelope(z.object({
  patientId: objectIdSchema,
  catalogKind: z.enum(['surgery', 'service']),
  catalogItemId: objectIdSchema,
  quantity: z.coerce.number().int().min(1).max(99).optional(),
  idempotencyKey: z.string().trim().min(8).max(80),
}));

export const updateChargeSchema = envelope(
  z.object({
    realizationStatus: z.enum(['recommended', 'pending', 'performed', 'cancelled']).optional(),
    quantity: z.coerce.number().int().min(1).max(99).optional(),
  }).refine((value) => value.realizationStatus !== undefined || value.quantity !== undefined, {
    message: 'Indiquez un statut ou une quantité',
  }),
  empty,
  paramsId
);
