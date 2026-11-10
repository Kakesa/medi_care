import { z } from 'zod';
import { objectIdSchema } from './common.js';

const empty = z.object({}).optional().default({});
const paramsId = z.object({ id: objectIdSchema });

function envelope(body: z.ZodTypeAny, query: z.ZodTypeAny = empty, params: z.ZodTypeAny = empty) {
  return z.object({ body, query, params });
}

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});

const item = z.object({
  medication: z.string().trim().min(1).max(160),
  dosage: z.string().trim().min(1).max(80),
  posology: z.string().trim().min(1).max(160),
  administrationRoute: z.string().trim().min(2).max(80).optional(),
  duration: z.string().trim().min(1).max(80),
  treatmentStartDate: calendarDate.optional(),
  treatmentEndDate: calendarDate.optional(),
  administrationTimes: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).max(24).optional(),
  instructions: z.string().trim().max(500).optional(),
  quantityPrescribed: z.coerce.number().int().min(1).max(999),
}).superRefine((value, context) => {
  const scheduleFields = [value.treatmentStartDate, value.treatmentEndDate, value.administrationTimes];
  if (scheduleFields.some(Boolean) && scheduleFields.some((field) => !field)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['administrationTimes'], message: 'Dates et heures prévues doivent être renseignées ensemble' });
  }
  if (value.treatmentStartDate && value.treatmentEndDate && value.treatmentEndDate < value.treatmentStartDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['treatmentEndDate'], message: 'La fin du traitement doit être postérieure ou égale à son début' });
  }
  if (value.administrationTimes && new Set(value.administrationTimes).size !== value.administrationTimes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['administrationTimes'], message: 'Les heures prévues doivent être uniques' });
  }
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

export const prescriptionItemStatusSchema = envelope(z.object({
  status: z.enum(['active', 'suspended', 'completed', 'interrupted']),
  reason: z.string().trim().min(3).max(500),
}), empty, z.object({ id: objectIdSchema, itemId: objectIdSchema }));

export const dispenseSchema = envelope(z.object({
  itemIndex: z.coerce.number().int().min(0),
  productId: objectIdSchema,
  quantity: z.coerce.number().int().min(1).max(999),
}), empty, paramsId);

export const unavailableSchema = envelope(z.object({
  itemIndex: z.coerce.number().int().min(0),
  note: z.string().trim().min(3).max(500),
}), empty, paramsId);
