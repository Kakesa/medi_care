import type { UserRole } from '../config/permissions.js';

export interface AuthContext {
  id: string;
  role: UserRole;
  organizationId: string | null;
  email: string;
  tokenVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      organizationId?: string;
    }
  }
}

export {};
