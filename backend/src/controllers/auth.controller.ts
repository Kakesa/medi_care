import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as authService from '../services/auth.service.js';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body, req.ip);
  res.json(result);
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.registerPatient(req.body, req.ip);
  res.status(201).json(result);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.toPublicUser(req.auth!.id);
  res.json(user);
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.updateProfile(req.auth!.id, req.body);
  res.json(user);
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.changePassword(
    req.auth!.id,
    req.body.currentPassword,
    req.body.newPassword,
    req.ip
  );
  res.json({ success: true, message: 'Mot de passe modifié', token: result.token, user: result.user });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.auth!.id, req.ip);
  res.json({ success: true, message: 'Déconnexion effectuée' });
});
