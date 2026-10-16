import type { NextFunction, Request, Response } from 'express';
import { hasPharmacyPermission, type PharmacyPermission } from '../domain/pharmacyPermissions.js';
import { ApiError } from '../utils/ApiError.js';

export function requirePharmacy(...required: PharmacyPermission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new ApiError(401, 'Authentification requise', 'UNAUTHENTICATED'));
      return;
    }
    if (!hasPharmacyPermission(req.auth.role, required)) {
      next(new ApiError(403, 'Accès refusé', 'FORBIDDEN'));
      return;
    }
    next();
  };
}
