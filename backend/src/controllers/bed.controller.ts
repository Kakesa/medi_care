import type { Request, Response } from 'express';
import * as bedService from '../services/bed.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const org = (req: Request) => req.organizationId!;
const auth = (req: Request) => req.auth!;

export const listWards = asyncHandler(async (req: Request, res: Response) => {
  res.json(await bedService.listWards(org(req)));
});

export const getWard = asyncHandler(async (req: Request, res: Response) => {
  res.json(await bedService.getWard(auth(req), org(req), req.params.id, req.ip));
});

export const createWard = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await bedService.createWard(auth(req), org(req), req.body, req.ip));
});

export const updateWard = asyncHandler(async (req: Request, res: Response) => {
  res.json(await bedService.updateWard(auth(req), org(req), req.params.id, req.body, req.ip));
});

export const deleteWard = asyncHandler(async (req: Request, res: Response) => {
  await bedService.deleteWard(auth(req), org(req), req.params.id, req.ip);
  res.json({ success: true, message: 'Service supprimé' });
});

export const listBeds = asyncHandler(async (req: Request, res: Response) => {
  res.json(await bedService.listBeds(org(req), req.query as never));
});

export const listOccupations = asyncHandler(async (req: Request, res: Response) => {
  res.json(await bedService.listOccupations(org(req), req.query as never));
});

export const getBed = asyncHandler(async (req: Request, res: Response) => {
  res.json(await bedService.getBed(auth(req), org(req), req.params.id, req.ip));
});

export const createBed = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await bedService.createBed(auth(req), org(req), req.body, req.ip));
});

export const updateBed = asyncHandler(async (req: Request, res: Response) => {
  res.json(await bedService.updateBed(auth(req), org(req), req.params.id, req.body, req.ip));
});

export const deleteBed = asyncHandler(async (req: Request, res: Response) => {
  await bedService.deleteBed(auth(req), org(req), req.params.id, req.ip);
  res.json({ success: true, message: 'Lit supprimé' });
});

export const assignBed = asyncHandler(async (req: Request, res: Response) => {
  res.json(await bedService.assignBed(auth(req), org(req), req.params.id, req.body, req.ip));
});

export const releaseBed = asyncHandler(async (req: Request, res: Response) => {
  res.json(await bedService.releaseBed(auth(req), org(req), req.params.id, req.ip));
});
