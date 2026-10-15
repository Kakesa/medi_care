import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.js';

const empty = z.object({}).strict().optional().default({});

export const listNotificationsSchema = z.object({
  body: empty,
  query: paginationSchema,
  params: empty,
});

export const notificationParamsSchema = z.object({
  body: empty,
  query: empty,
  params: z.object({ id: objectIdSchema }),
});

export const markAllNotificationsSchema = z.object({
  body: empty,
  query: empty,
  params: empty,
});
