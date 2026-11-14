import { z } from 'zod';
import { objectIdSchema } from './common.js';

const empty = z.object({}).optional().default({});
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const shiftType = z.enum(['morning', 'afternoon', 'night', 'full_day']);

function envelope(body: z.ZodTypeAny, query: z.ZodTypeAny = empty, params: z.ZodTypeAny = empty) {
  return z.object({ body, query, params });
}

const shiftBody = {
  nurseIds: z.array(objectIdSchema).min(1).max(20),
  startTime: clock,
  endTime: clock,
  type: shiftType,
  ward: z.string().trim().min(2).max(80),
};

export const shiftListSchema = envelope(empty, z.object({
  from: calendarDate.optional(),
  to: calendarDate.optional(),
}).optional().default({}));

export const shiftCreateSchema = envelope(z.object({
  ...shiftBody,
  date: calendarDate,
}));

export const shiftRotationSchema = envelope(z.object({
  ...shiftBody,
  from: calendarDate,
  to: calendarDate,
  workDays: z.coerce.number().int().min(1).max(14),
  restDays: z.coerce.number().int().min(1).max(14),
}).refine((value) => value.to >= value.from, { message: 'La fin de la rotation doit suivre son début', path: ['to'] }));

export const shiftParamsSchema = envelope(empty, empty, z.object({ id: objectIdSchema }));

export const shiftUpdateSchema = envelope(z.object({
  date: calendarDate,
  startTime: clock,
  endTime: clock,
  type: shiftType,
  ward: z.string().trim().min(2).max(80),
  status: z.enum(['scheduled', 'confirmed', 'cancelled']).optional(),
}), empty, z.object({ id: objectIdSchema }));

export const shiftReasonSchema = envelope(z.object({
  reason: z.string().trim().min(3).max(500),
}), empty, z.object({ id: objectIdSchema }));

export const shiftReplaceSchema = envelope(z.object({
  nurseId: objectIdSchema,
  reason: z.string().trim().min(3).max(500),
}), empty, z.object({ id: objectIdSchema }));

export const shiftEndSchema = envelope(z.object({
  note: z.string().trim().max(2000).optional().default(''),
}), empty, z.object({ id: objectIdSchema }));

export const pushSubscribeSchema = envelope(z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(300),
    auth: z.string().min(1).max(300),
  }),
}));
