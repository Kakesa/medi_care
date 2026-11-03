import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getEnv } from '../config/env.js';
import { ROLES } from '../config/permissions.js';
import { Organization } from '../models/Organization.js';
import { Patient } from '../models/Patient.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { signAccessToken } from '../utils/tokens.js';
import { recordAudit } from './audit.service.js';
import { sendMail } from './mailer.js';

const RESET_SENT = 'Si un compte existe pour cette adresse, un e-mail de réinitialisation a été envoyé.';

const INVALID_LOGIN = 'Email ou mot de passe incorrect';

export interface PublicOrganization {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
}

export interface PublicUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isActive: boolean;
  mustChangePassword: boolean;
  organizationId: string | null;
  organization: PublicOrganization | null;
}

export async function toPublicUser(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'Utilisateur introuvable');
  }

  let organization: PublicOrganization | null = null;
  if (user.organizationId) {
    const org = await Organization.findById(user.organizationId);
    if (org) {
      organization = {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status as 'active' | 'suspended',
      };
    }
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone || undefined,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword === true,
    organizationId: user.organizationId ? user.organizationId.toString() : null,
    organization,
  };
}

async function hashPassword(password: string) {
  return bcrypt.hash(password, getEnv().BCRYPT_ROUNDS);
}

export async function login(input: { email: string; password: string }, ip?: string) {
  const email = input.email.toLowerCase().trim();
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = user
    ? await bcrypt.compare(input.password, user.passwordHash)
    : false;

  if (!user || !passwordMatches) {
    await recordAudit({
      action: 'LOGIN_FAILED',
      success: false,
      ip,
      metadata: { email },
    });
    throw new ApiError(401, INVALID_LOGIN, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      organizationId: user.organizationId?.toString() ?? null,
      action: 'LOGIN_BLOCKED',
      success: false,
      ip,
    });
    throw new ApiError(403, 'Compte désactivé', 'ACCOUNT_DISABLED');
  }

  if (user.role !== ROLES.SUPERADMIN) {
    const organization = await Organization.findById(user.organizationId);
    if (!organization || organization.status !== 'active') {
      await recordAudit({
        actorId: user.id,
        actorRole: user.role,
        organizationId: user.organizationId?.toString() ?? null,
        action: 'LOGIN_BLOCKED',
        success: false,
        ip,
      });
      throw new ApiError(403, 'Établissement indisponible', 'ORG_SUSPENDED');
    }
  }

  const token = signAccessToken(user.id, user.tokenVersion);
  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    organizationId: user.organizationId?.toString() ?? null,
    action: 'LOGIN_SUCCESS',
    success: true,
    ip,
  });

  return { token, user: await toPublicUser(user.id) };
}

export async function registerPatient(
  input: {
    organizationSlug: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
  },
  ip?: string
) {
  const organization = await Organization.findOne({ slug: input.organizationSlug.toLowerCase() });
  if (!organization || organization.status !== 'active') {
    throw new ApiError(404, 'Établissement introuvable', 'ORG_NOT_FOUND');
  }

  const email = input.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, 'Cet email est déjà utilisé', 'EMAIL_TAKEN');
  }

  const user = await User.create({
    email,
    passwordHash: await hashPassword(input.password),
    role: ROLES.PATIENT,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone?.trim(),
    isActive: true,
    organizationId: organization._id,
  });

  await Patient.create({
    organizationId: organization._id,
    linkedUserId: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    status: 'outpatient',
    allergies: [],
  });

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    organizationId: organization.id,
    action: 'PATIENT_REGISTERED',
    resourceType: 'user',
    resourceId: user.id,
    success: true,
    ip,
  });

  return { token: signAccessToken(user.id, user.tokenVersion), user: await toPublicUser(user.id) };
}

export async function updateProfile(
  userId: string,
  input: { firstName?: string; lastName?: string; email?: string; phone?: string }
) {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'Utilisateur introuvable');
  }

  if (input.email) {
    const email = input.email.toLowerCase().trim();
    const taken = await User.findOne({ email, _id: { $ne: user._id } });
    if (taken) {
      throw new ApiError(409, 'Cet email est déjà utilisé', 'EMAIL_TAKEN');
    }
    user.email = email;
  }
  if (input.firstName) user.firstName = input.firstName.trim();
  if (input.lastName) user.lastName = input.lastName.trim();
  if (input.phone !== undefined) user.phone = input.phone.trim();
  await user.save();

  if (user.role === ROLES.PATIENT) {
    await Patient.updateOne(
      { linkedUserId: user._id },
      {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      }
    );
  }

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    organizationId: user.organizationId?.toString() ?? null,
    action: 'PROFILE_UPDATED',
    resourceType: 'user',
    resourceId: user.id,
    success: true,
  });

  return toPublicUser(user.id);
}

function resetTokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function requestPasswordReset(email: string) {
  const normalized = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalized });
  if (!user || !user.isActive) return { success: true, message: RESET_SENT };

  const token = crypto.randomBytes(32).toString('hex');
  user.set('passwordResetTokenHash', resetTokenHash(token));
  user.set('passwordResetExpires', new Date(Date.now() + 30 * 60 * 1000));
  await user.save();

  const origin = getEnv().CORS_ORIGIN[0] ?? 'http://localhost:8080';
  try {
    await sendMail({
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe MediCare',
      text: [
        `Bonjour ${user.firstName} ${user.lastName},`,
        '',
        'Pour choisir un nouveau mot de passe, ouvrez ce lien. Il est valable 30 minutes :',
        `${origin}/reset-password?token=${token}`,
        '',
        "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
      ].join('\n'),
    });
  } catch {
    return { success: true, message: RESET_SENT };
  }

  return { success: true, message: RESET_SENT };
}

export async function resetPassword(token: string, newPassword: string, ip?: string) {
  const user = await User.findOne({
    passwordResetTokenHash: resetTokenHash(token),
    passwordResetExpires: { $gt: new Date() },
    isActive: true,
  }).select('+passwordHash +passwordResetTokenHash');
  if (!user) {
    throw new ApiError(400, 'Ce lien n’est plus valable. Demandez un nouvel e-mail.', 'RESET_TOKEN_INVALID');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.tokenVersion += 1;
  user.set('passwordResetTokenHash', undefined);
  user.set('passwordResetExpires', undefined);
  await user.save();

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    organizationId: user.organizationId?.toString() ?? null,
    action: 'PASSWORD_RESET',
    resourceType: 'user',
    resourceId: user.id,
    success: true,
    ip,
  });

  return { success: true, message: 'Mot de passe modifié. Vous pouvez vous connecter.' };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  ip?: string
) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new ApiError(404, 'Utilisateur introuvable');
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    throw new ApiError(400, 'Mot de passe actuel incorrect', 'INVALID_PASSWORD');
  }
  if (currentPassword === newPassword) {
    throw new ApiError(400, 'Choisissez un mot de passe différent du mot de passe temporaire', 'PASSWORD_UNCHANGED');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.tokenVersion += 1;
  await user.save();

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    organizationId: user.organizationId?.toString() ?? null,
    action: 'PASSWORD_CHANGED',
    resourceType: 'user',
    resourceId: user.id,
    success: true,
    ip,
  });

  return {
    token: signAccessToken(user.id, user.tokenVersion),
    user: await toPublicUser(user.id),
  };
}

export async function logout(userId: string, ip?: string) {
  const user = await User.findById(userId);
  if (!user) {
    return;
  }
  user.tokenVersion += 1;
  await user.save();
  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    organizationId: user.organizationId?.toString() ?? null,
    action: 'LOGOUT',
    success: true,
    ip,
  });
}
