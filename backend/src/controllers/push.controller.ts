import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { pushPublicKey, removePushSubscription, savePushSubscription } from '../services/push.service.js';

function actor(req: Request) {
  if (!req.auth) throw new ApiError(401, 'Authentification requise', 'UNAUTHENTICATED');
  return req.auth;
}

export const key = asyncHandler(async (req: Request, res: Response) => {
  actor(req);
  res.json({ publicKey: pushPublicKey() });
});

export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const auth = actor(req);
  await savePushSubscription({
    organizationId: auth.organizationId,
    userId: auth.id,
    endpoint: req.body.endpoint,
    p256dh: req.body.keys.p256dh,
    auth: req.body.keys.auth,
  });
  res.status(201).json({ ok: true });
});

export const unsubscribe = asyncHandler(async (req: Request, res: Response) => {
  const auth = actor(req);
  await removePushSubscription(auth.id, req.body.endpoint);
  res.json({ ok: true });
});
