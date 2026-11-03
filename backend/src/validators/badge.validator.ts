import { z } from 'zod';
import { objectIdSchema } from './common.js';

const empty = z.object({}).optional().default({});

export const seenBadgesSchema = z.object({
  body: z.object({
    ids: z.array(objectIdSchema).min(1).max(100),
  }),
  query: empty,
  params: empty,
});
