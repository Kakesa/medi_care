import type { Request } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';
import { sanitize } from '../utils/sanitize.js';

interface AuditInput {
  actorId?: string;
  actorRole?: string;
  organizationId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ip?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(input: AuditInput) {
  const metadata = sanitize(input.metadata ?? {}) as Record<string, unknown>;
  await AuditLog.create({
    actorId: input.actorId,
    actorRole: input.actorRole,
    organizationId: input.organizationId || null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    ip: input.ip,
    success: input.success,
    metadata,
  });

  logger.info({
    audit: true,
    action: input.action,
    actorId: input.actorId,
    actorRole: input.actorRole,
    organizationId: input.organizationId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    success: input.success,
  });
}

export function requestIp(req: Request) {
  return req.ip;
}
