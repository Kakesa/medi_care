import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import * as shifts from '../services/shift.service.js';
import { pushPublicKey, savePushSubscription } from '../services/push.service.js';

function context(req: Request) {
  if (!req.auth || !req.organizationId) throw new ApiError(401, 'Authentification requise', 'UNAUTHENTICATED');
  return { actor: req.auth, organizationId: req.organizationId };
}

export const staff = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = context(req);
  res.json(await shifts.listStaff(organizationId));
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = context(req);
  res.json(await shifts.listShifts(organizationId, req.query as { from?: string; to?: string }));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.status(201).json(await shifts.createShifts(actor, organizationId, req.body, req.ip));
});

export const publish = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await shifts.publishShifts(actor, organizationId, req.body.from, req.body.to, req.ip));
});

export const copy = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.status(201).json(await shifts.copyShifts(actor, organizationId, req.body.from, req.body.to, req.body.targetFrom, req.ip));
});

export const templates = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = context(req);
  res.json(await shifts.listTemplates(organizationId));
});

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.status(201).json(await shifts.saveTemplate(actor, organizationId, req.body, undefined, req.ip));
});

export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await shifts.saveTemplate(actor, organizationId, req.body, req.params.id, req.ip));
});

export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  await shifts.removeTemplate(actor, organizationId, req.params.id, req.ip);
  res.status(204).send();
});

export const cycles = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = context(req);
  res.json(await shifts.listCycles(organizationId));
});

export const createCycle = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.status(201).json(await shifts.saveCycle(actor, organizationId, req.body, undefined, req.ip));
});

export const updateCycle = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await shifts.saveCycle(actor, organizationId, req.body, req.params.id, req.ip));
});

export const deleteCycle = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  await shifts.removeCycle(actor, organizationId, req.params.id, req.ip);
  res.status(204).send();
});

export const rotation = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.status(201).json(await shifts.createRotation(actor, organizationId, req.body, req.ip));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await shifts.updateShift(actor, organizationId, req.params.id, req.body, req.ip));
});

export const absence = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await shifts.declareAbsence(actor, organizationId, req.params.id, req.body.reason, req.ip));
});

export const replace = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await shifts.replaceNurse(actor, organizationId, req.params.id, req.body.nurseId, req.body.reason, req.ip));
});

export const mine = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await shifts.myBoard(actor, organizationId));
});

export const start = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await shifts.startShift(actor, organizationId, req.params.id, req.ip));
});

export const end = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  res.json(await shifts.endShift(actor, organizationId, req.params.id, req.body.note ?? '', req.ip));
});

export const pushKey = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ publicKey: pushPublicKey() });
});

export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const { actor, organizationId } = context(req);
  await savePushSubscription({
    organizationId,
    userId: actor.id,
    endpoint: req.body.endpoint,
    p256dh: req.body.keys.p256dh,
    auth: req.body.keys.auth,
  });
  res.status(201).json({ ok: true });
});
