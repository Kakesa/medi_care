import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as surgeryService from '../services/surgery.service.js';

const org = (req: Request) => req.organizationId!;
const auth = (req: Request) => req.auth!;

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  res.json(await surgeryService.listCategories(auth(req), org(req)));
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await surgeryService.createCategory(auth(req), org(req), req.body.name, req.ip));
});

export const listActs = asyncHandler(async (req: Request, res: Response) => {
  res.json(await surgeryService.listActs(auth(req), org(req), req.query as never));
});

export const getAct = asyncHandler(async (req: Request, res: Response) => {
  res.json(await surgeryService.getAct(auth(req), org(req), req.params.id, req.ip));
});

export const createAct = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await surgeryService.createAct(auth(req), org(req), req.body, req.ip));
});

export const updateAct = asyncHandler(async (req: Request, res: Response) => {
  res.json(await surgeryService.updateAct(auth(req), org(req), req.params.id, req.body, req.ip));
});

export const priceHistory = asyncHandler(async (req: Request, res: Response) => {
  const actId = typeof req.query.actId === 'string' ? req.query.actId : undefined;
  res.json(await surgeryService.priceHistory(auth(req), org(req), actId, req.ip));
});

export const changeHistory = asyncHandler(async (req: Request, res: Response) => {
  res.json(await surgeryService.changeHistory(org(req)));
});

export const stats = asyncHandler(async (req: Request, res: Response) => {
  res.json(await surgeryService.surgeryStats(auth(req), org(req), req.query as never));
});

export const patientHistory = asyncHandler(async (req: Request, res: Response) => {
  res.json(await surgeryService.patientSurgeryHistory(auth(req), org(req), req.params.patientId, req.ip));
});
