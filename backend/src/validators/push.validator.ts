import { z } from 'zod';

const empty = z.object({}).optional().default({});

function envelope(body: z.ZodTypeAny) {
  return z.object({ body, query: empty, params: empty });
}

const subscription = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(300),
    auth: z.string().min(1).max(300),
  }),
});

export const pushSubscribeSchema = envelope(subscription);
export const pushUnsubscribeSchema = envelope(z.object({ endpoint: z.string().url().max(2000) }));
