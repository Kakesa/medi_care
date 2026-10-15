import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as userService from '../services/user.service.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.listUsers(req.organizationId!, req.query as never);
  res.json(result);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.createStaffUser(req.organizationId!, req.body, req.auth!, req.ip);
  res.status(201).json(user);
});

export const updateRole = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateUserRole(
    req.organizationId!,
    req.params.id,
    req.body.role,
    req.auth!,
    req.ip
  );
  res.json(user);
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateUserStatus(
    req.organizationId!,
    req.params.id,
    req.body.isActive,
    req.auth!,
    req.ip
  );
  res.json(user);
});
