import { z } from 'zod';
import { objectIdSchema } from './common.js';

const empty = z.object({}).optional().default({});
const paramsId = z.object({ id: objectIdSchema });
const attachment = z.object({
  name: z.string().trim().min(1).max(120),
  mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  data: z.string().min(20).max(1_800_000),
});

function envelope(body: z.ZodTypeAny, query: z.ZodTypeAny = empty, params: z.ZodTypeAny = empty) {
  return z.object({ body, query, params });
}

export const listLabSchema = envelope(empty, z.object({
  labStatus: z.enum(['EN_ATTENTE', 'EN_COURS', 'BROUILLON', 'EN_ATTENTE_VALIDATION', 'CORRECTION_DEMANDEE', 'VALIDE', 'REJETE', 'ANNULE']).optional(),
}).optional().default({}));

export const labParamsSchema = envelope(empty, empty, paramsId);

export const orderLabSchema = envelope(z.object({
  patientId: objectIdSchema,
  doctorId: objectIdSchema,
  instructions: z.string().trim().max(2000).optional(),
  items: z.array(z.object({
    kind: z.enum(['surgery', 'service']),
    catalogItemId: objectIdSchema,
    name: z.string().trim().min(1).max(160),
    category: z.string().trim().min(1).max(80),
  })).min(1).max(20),
}));

export const labDraftSchema = envelope(z.object({
  results: z.string().trim().min(1).max(8000),
  technicalNotes: z.string().trim().max(4000).optional(),
  attachments: z.array(attachment).max(2).optional(),
}), empty, paramsId);

export const labDecisionSchema = envelope(z.object({
  comment: z.string().trim().max(2000).optional(),
}), empty, paramsId);
