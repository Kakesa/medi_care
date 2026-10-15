import bcrypt from 'bcryptjs';
import type { UserRole } from '../src/config/permissions.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { signAccessToken } from '../src/utils/tokens.js';

let sequence = 0;

export async function createOrganization(name = 'Hôpital Test') {
  sequence += 1;
  return Organization.create({
    name,
    slug: `hopital-${sequence}`,
    address: '1 rue de la Santé',
    phone: '0102030405',
    email: `contact-${sequence}@hopital.test`,
    status: 'active',
    plan: 'unconfigured',
  });
}

export async function createUser(options: {
  role: UserRole;
  organizationId?: string | null;
  email?: string;
  password?: string;
  isActive?: boolean;
}) {
  sequence += 1;
  const password = options.password ?? 'Password123!';
  const user = await User.create({
    email: options.email ?? `${options.role.toLowerCase()}-${sequence}@example.com`,
    passwordHash: await bcrypt.hash(password, 4),
    role: options.role,
    firstName: 'Ada',
    lastName: 'Martin',
    isActive: options.isActive ?? true,
    organizationId: options.role === 'SUPERADMIN' ? null : options.organizationId,
  });
  const token = signAccessToken(user.id, user.tokenVersion);
  return { user, token, password };
}

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}
