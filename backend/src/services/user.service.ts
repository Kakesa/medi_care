import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getEnv } from '../config/env.js';
import { ROLES, isAssignableRole, type AssignableRole, type UserRole } from '../config/permissions.js';
import { Organization } from '../models/Organization.js';
import { Patient } from '../models/Patient.js';
import { Personnel } from '../models/Personnel.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/regex.js';
import { paginated, readPagination } from '../utils/pagination.js';
import { recordAudit } from './audit.service.js';
import { toPublicUser, type PublicUser } from './auth.service.js';
import { sendMail } from './mailer.js';

interface CreateStaffInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password?: string;
  role: AssignableRole;
}

function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let value = '';
  for (let index = 0; index < 12; index += 1) {
    value += alphabet[randomInt(alphabet.length)];
  }
  return value;
}

export async function issuePatientLogin(input: {
  organizationId: string;
  organizationName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}) {
  const email = input.email.toLowerCase().trim();
  await assertEmailAvailable(email);
  const password = temporaryPassword();
  const user = await User.create({
    email,
    passwordHash: await bcrypt.hash(password, getEnv().BCRYPT_ROUNDS),
    role: ROLES.PATIENT,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone?.trim(),
    isActive: true,
    mustChangePassword: true,
    organizationId: input.organizationId,
  });

  try {
    await sendMail({
      to: user.email,
      subject: `Votre accès ${input.organizationName}`,
      text: [
        `Bonjour ${user.firstName} ${user.lastName},`,
        '',
        `Un compte patient a été créé pour vous à ${input.organizationName}.`,
        '',
        `E-mail : ${user.email}`,
        `Mot de passe temporaire : ${password}`,
        '',
        'À votre première connexion, vous devrez choisir un nouveau mot de passe.',
      ].join('\n'),
    });
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "Le compte n'a pas été créé : l'e-mail n'a pas pu être envoyé.", 'EMAIL_FAILED');
  }

  return user;
}

function requiredPassword(password?: string) {
  if (!password || password.length < 8) {
    throw new ApiError(400, 'Le mot de passe doit contenir au moins 8 caractères', 'VALIDATION_ERROR');
  }
  return password;
}

async function assertEmailAvailable(email: string) {
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new ApiError(409, 'Cet email est déjà utilisé', 'EMAIL_TAKEN');
  }
}

export async function createStaffUser(
  organizationId: string,
  input: CreateStaffInput,
  actor: { id: string; role: UserRole },
  ip?: string
) {
  if (!isAssignableRole(input.role)) {
    throw new ApiError(403, 'Ce rôle ne peut pas être attribué', 'FORBIDDEN_ROLE');
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new ApiError(404, 'Établissement introuvable');
  }

  const email = input.email.toLowerCase().trim();
  const user = input.role === ROLES.PATIENT
    ? await issuePatientLogin({
      organizationId: organization.id,
      organizationName: organization.name,
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      phone: input.phone,
    })
    : await (async () => {
      await assertEmailAvailable(email);
      return User.create({
        email,
        passwordHash: await bcrypt.hash(requiredPassword(input.password), getEnv().BCRYPT_ROUNDS),
        role: input.role,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone?.trim(),
        isActive: true,
        mustChangePassword: false,
        organizationId: organization._id,
      });
    })();

  if (input.role === ROLES.PATIENT) {
    const existingPatient = await Patient.findOne({ organizationId: organization._id, email, archivedAt: null });
    if (existingPatient && !existingPatient.linkedUserId) {
      existingPatient.linkedUserId = user._id;
      await existingPatient.save();
    } else if (!existingPatient) {
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
    }
  }

  const personnelRole = {
    DOCTOR: 'doctor',
    NURSE: 'nurse',
    RECEPTIONIST: 'receptionist',
    HOSPITAL_ADMIN: 'admin',
  } as const;
  if (input.role in personnelRole) {
    await Personnel.create({
      organizationId: organization._id,
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      role: personnelRole[input.role as keyof typeof personnelRole],
      department: 'Médecine générale',
      status: 'active',
    });
  }

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'USER_CREATED',
    resourceType: 'user',
    resourceId: user.id,
    success: true,
    ip,
    metadata: { role: input.role },
  });

  return toPublicUser(user.id);
}

export async function listUsers(
  organizationId: string,
  query: { page?: number; limit?: number; search?: string; role?: AssignableRole }
) {
  const { page, limit, skip } = readPagination(query);
  const filter: Record<string, unknown> = { organizationId };
  if (query.role) {
    filter.role = query.role;
  }
  if (query.search) {
    const safe = escapeRegex(query.search.trim());
    filter.$or = [
      { firstName: new RegExp(safe, 'i') },
      { lastName: new RegExp(safe, 'i') },
      { email: new RegExp(safe, 'i') },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  const data: PublicUser[] = [];
  for (const user of users) {
    data.push(await toPublicUser(user.id));
  }
  return paginated(data, total, page, limit);
}

export async function updateUserRole(
  organizationId: string,
  userId: string,
  role: AssignableRole,
  actor: { id: string; role: UserRole },
  ip?: string
) {
  if (actor.id === userId) {
    throw new ApiError(403, 'Vous ne pouvez pas modifier votre propre rôle', 'SELF_ROLE_CHANGE');
  }
  if (!isAssignableRole(role)) {
    throw new ApiError(403, 'Ce rôle ne peut pas être attribué', 'FORBIDDEN_ROLE');
  }

  const user = await User.findOne({ _id: userId, organizationId });
  if (!user) {
    const elsewhere = await User.exists({ _id: userId });
    if (elsewhere) {
      await recordAudit({
        actorId: actor.id,
        actorRole: actor.role,
        organizationId,
        action: 'CROSS_TENANT_DENIED',
        resourceType: 'user',
        resourceId: userId,
        success: false,
        ip,
      });
    }
    throw new ApiError(404, 'Utilisateur introuvable');
  }

  if (user.role === ROLES.SUPERADMIN) {
    throw new ApiError(403, 'Accès refusé', 'FORBIDDEN');
  }

  const previous = user.role;
  user.role = role;
  user.tokenVersion += 1;
  await user.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'USER_ROLE_CHANGED',
    resourceType: 'user',
    resourceId: user.id,
    success: true,
    ip,
    metadata: { from: previous, to: role },
  });

  return toPublicUser(user.id);
}

export async function updateUserStatus(
  organizationId: string,
  userId: string,
  isActive: boolean,
  actor: { id: string; role: UserRole },
  ip?: string
) {
  if (actor.id === userId && !isActive) {
    throw new ApiError(403, 'Vous ne pouvez pas désactiver votre propre compte', 'SELF_DISABLE');
  }

  const user = await User.findOne({ _id: userId, organizationId });
  if (!user) {
    throw new ApiError(404, 'Utilisateur introuvable');
  }

  user.isActive = isActive;
  if (!isActive) {
    user.tokenVersion += 1;
  }
  await user.save();

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    resourceType: 'user',
    resourceId: user.id,
    success: true,
    ip,
  });

  return toPublicUser(user.id);
}
