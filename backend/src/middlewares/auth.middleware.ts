import type { NextFunction, Request, Response } from 'express';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { ROLES, isUserRole } from '../config/permissions.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentification requise', 'UNAUTHENTICATED');
  }

  const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
    throw new ApiError(401, 'Session invalide ou expirée', 'INVALID_TOKEN');
  }

  if (!isUserRole(user.role)) {
    throw new ApiError(401, 'Session invalide', 'INVALID_TOKEN');
  }

  if (user.role !== ROLES.SUPERADMIN) {
    const organization = await Organization.findById(user.organizationId);
    if (!organization || organization.status !== 'active') {
      throw new ApiError(401, 'Établissement indisponible', 'ORG_SUSPENDED');
    }
  }

  req.auth = {
    id: user.id,
    role: user.role,
    organizationId: user.organizationId ? user.organizationId.toString() : null,
    email: user.email,
    tokenVersion: user.tokenVersion,
  };
  next();
});
