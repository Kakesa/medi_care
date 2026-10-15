import type { NextFunction, Request, Response } from 'express';
import { ROLES } from '../config/permissions.js';
import { ApiError } from '../utils/ApiError.js';
import { recordAudit } from '../services/audit.service.js';

/**
 * Le tenant vient exclusivement de l'utilisateur authentifié.
 * Un organizationId présent dans le corps ou la query est ignoré plus loin,
 * et un superadmin n'emprunte pas ces routes pour lire les données médicales.
 */
export async function requireTenant(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.auth) {
      throw new ApiError(401, 'Authentification requise', 'UNAUTHENTICATED');
    }

    if (req.auth.role === ROLES.SUPERADMIN || !req.auth.organizationId) {
      await recordAudit({
        actorId: req.auth.id,
        actorRole: req.auth.role,
        action: 'TENANT_ROUTE_DENIED',
        success: false,
        ip: req.ip,
      });
      throw new ApiError(403, 'Cette ressource est limitée à un établissement', 'TENANT_REQUIRED');
    }

    req.organizationId = req.auth.organizationId;
    next();
  } catch (error) {
    next(error);
  }
}
