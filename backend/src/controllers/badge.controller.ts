import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as badgeService from '../services/badge.service.js';

export const workBadges = asyncHandler(async (req: Request, res: Response) => {
  res.json(await badgeService.workBadges(req.auth!, req.organizationId!));
});

export const markSeen = asyncHandler(async (req: Request, res: Response) => {
  res.json(await badgeService.markSeen(req.auth!, req.organizationId!, req.body.ids, req.body.resource));
});
