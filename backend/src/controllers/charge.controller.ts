import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as chargeService from '../services/charge.service.js';

const org = (req: Request) => req.organizationId!;
const auth = (req: Request) => req.auth!;

export const catalog = asyncHandler(async (req: Request, res: Response) => {
  res.json(await chargeService.listCatalog(auth(req), org(req)));
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(await chargeService.listCharges(auth(req), org(req), req.query as never, req.ip));
});

export const recommend = asyncHandler(async (req: Request, res: Response) => {
  const result = await chargeService.recordCharge(auth(req), org(req), {
    patientId: req.body.patientId,
    originModule: 'acts',
    originId: req.body.idempotencyKey,
    catalogKind: req.body.catalogKind,
    catalogItemId: req.body.catalogItemId,
    quantity: req.body.quantity,
  }, req.ip);
  res.status(result.created ? 201 : 200).json(result.charge);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  res.json(await chargeService.updateCharge(auth(req), org(req), req.params.id, req.body, req.ip));
});
