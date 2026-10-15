import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '../config/permissions.js';
import { ApiError } from '../utils/ApiError.js';

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new ApiError(401, 'Authentification requise', 'UNAUTHENTICATED'));
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(new ApiError(403, 'Accès refusé', 'FORBIDDEN'));
      return;
    }
    next();
  };
}
