import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.js';

const empty = z.object({}).optional().default({});
const paramsId = z.object({ id: objectIdSchema });

function envelope(body: z.ZodTypeAny, query: z.ZodTypeAny = empty, params: z.ZodTypeAny = empty) {
  return z.object({ body, query, params });
}

const careTypes = ['medication', 'injection', 'infusion', 'dressing', 'sample', 'monitoring', 'hygiene', 'assistance', 'other'] as const;
const careStatuses = ['pending', 'in_progress', 'completed', 'not_done', 'cancelled'] as const;

export const nursingListSchema = envelope(empty, paginationSchema.extend({
  patientId: objectIdSchema.optional(),
  status: z.enum(careStatuses).optional(),
  date: z.coerce.date().optional(),
}).optional().default({}));

export const nursingPatientListSchema = envelope(empty, paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
}).optional().default({}));

export const nursingPatientParamsSchema = envelope(empty, empty, z.object({ patientId: objectIdSchema }));

export const nursingCreateCareSchema = envelope(z.object({
  patientId: objectIdSchema,
  type: z.enum(careTypes),
  description: z.string().trim().min(2).max(2000),
  prescriptionId: objectIdSchema.optional(),
  prescriptionItemId: objectIdSchema.optional(),
  scheduledAt: z.coerce.date(),
}).superRefine((data, context) => {
  if (data.type === 'medication') {
    if (!data.prescriptionId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['prescriptionId'], message: 'Une prescription validée est requise' });
    if (!data.prescriptionItemId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['prescriptionItemId'], message: 'La ligne prescrite est requise' });
  }
}));

export const nursingUpdateCareSchema = envelope(z.object({
  status: z.enum(careStatuses),
  observations: z.string().trim().max(2000).optional(),
  notDoneReason: z.string().trim().min(3).max(500).optional(),
}).superRefine((data, context) => {
  if (data.status === 'not_done' && !data.notDoneReason) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['notDoneReason'], message: 'Le motif de non-réalisation est requis' });
  }
}), empty, paramsId);

export const nursingCorrectionSchema = envelope(z.object({
  reason: z.string().trim().min(3).max(500),
  description: z.string().trim().min(2).max(2000).optional(),
  scheduledAt: z.coerce.date().optional(),
  observations: z.string().trim().max(2000).optional(),
}).refine((data) => data.description !== undefined || data.scheduledAt !== undefined || data.observations !== undefined, {
  message: 'Aucune correction à enregistrer',
}), empty, paramsId);

export const nursingVitalsSchema = envelope(z.object({
  patientId: objectIdSchema,
  measuredAt: z.coerce.date().optional(),
  systolic: z.coerce.number().min(40).max(300).optional(),
  diastolic: z.coerce.number().min(20).max(200).optional(),
  temperature: z.coerce.number().min(25).max(45).optional(),
  heartRate: z.coerce.number().int().min(20).max(300).optional(),
  respiratoryRate: z.coerce.number().int().min(1).max(100).optional(),
  oxygenSaturation: z.coerce.number().min(0).max(100).optional(),
  weight: z.coerce.number().min(0.1).max(500).optional(),
  height: z.coerce.number().min(20).max(300).optional(),
  glucose: z.coerce.number().min(0).max(1000).optional(),
  observation: z.string().trim().max(1000).optional(),
}).refine((data) => Object.keys(data).some((key) => !['patientId', 'measuredAt', 'observation'].includes(key)), {
  message: 'Au moins une constante doit être renseignée',
}));

export const nursingVitalsListSchema = envelope(empty, z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  patientId: objectIdSchema,
}));

export const nursingObservationSchema = envelope(z.object({
  patientId: objectIdSchema,
  observedAt: z.coerce.date().optional(),
  content: z.string().trim().min(2).max(3000),
}));

const thresholdsSchema = z.object({
  systolicMin: z.number().min(40).max(300),
  systolicMax: z.number().min(40).max(300),
  diastolicMin: z.number().min(20).max(200),
  diastolicMax: z.number().min(20).max(200),
  temperatureMin: z.number().min(25).max(45),
  temperatureMax: z.number().min(25).max(45),
  heartRateMin: z.number().min(20).max(300),
  heartRateMax: z.number().min(20).max(300),
  respiratoryRateMin: z.number().min(1).max(100),
  respiratoryRateMax: z.number().min(1).max(100),
  oxygenSaturationMin: z.number().min(0).max(100),
  glucoseMin: z.number().min(0).max(1000),
  glucoseMax: z.number().min(0).max(1000),
}).superRefine((value, context) => {
  for (const [minimum, maximum] of [
    ['systolicMin', 'systolicMax'],
    ['diastolicMin', 'diastolicMax'],
    ['temperatureMin', 'temperatureMax'],
    ['heartRateMin', 'heartRateMax'],
    ['respiratoryRateMin', 'respiratoryRateMax'],
    ['glucoseMin', 'glucoseMax'],
  ] as const) {
    if (value[minimum] >= value[maximum]) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [maximum], message: 'La borne maximale doit dépasser la borne minimale' });
    }
  }
});

export const nursingThresholdsSchema = envelope(thresholdsSchema);
export const nursingReportSchema = envelope(empty, z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).optional().default({}));
