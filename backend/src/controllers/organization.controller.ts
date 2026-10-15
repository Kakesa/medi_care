import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as organizationService from '../services/organization.service.js';
import * as userService from '../services/user.service.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const organization = await organizationService.createOrganization(req.body, req.auth!.id, req.ip);
  res.status(201).json(organization);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await organizationService.listOrganizations(req.query as never);
  res.json(result);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const organization = await organizationService.getOrganization(req.params.id);
  res.json(organization);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const organization = await organizationService.updateOrganization(req.params.id, req.body, req.auth!.id, req.ip);
  res.json(organization);
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.createStaffUser(req.params.id, req.body, req.auth!, req.ip);
  res.status(201).json(user);
});
