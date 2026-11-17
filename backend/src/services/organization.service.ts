import bcrypt from 'bcryptjs';
import { getEnv } from '../config/env.js';
import { ROLES } from '../config/permissions.js';
import { Appointment } from '../models/Appointment.js';
import { AuditLog } from '../models/AuditLog.js';
import { Consultation } from '../models/Consultation.js';
import { Exam } from '../models/Exam.js';
import { Organization } from '../models/Organization.js';
import { Patient } from '../models/Patient.js';
import { Personnel } from '../models/Personnel.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/regex.js';
import { paginated, readPagination } from '../utils/pagination.js';
import { recordAudit } from './audit.service.js';
import { uploadImage } from './cloudinary.service.js';
import { sendMail } from './mailer.js';

type OrganizationShape = {
  id?: string;
  _id: { toString(): string };
  name: string;
  slug: string;
  address: string;
  phone: string;
  email: string;
  status: string;
  plan: string;
  currency?: string;
  facilityType?: string | null;
  registrationNumber?: string | null;
  commune?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  logo?: string | null;
  coverImage?: string | null;
  primaryColor?: string | null;
  timezone?: string | null;
  stamp?: string | null;
  rejectionReason?: string | null;
  submittedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

function locationOf(org: OrganizationShape) {
  return [org.commune, org.city, org.province, org.country].filter(Boolean).join(', ');
}

function toOrganizationDto(
  org: OrganizationShape,
  extras?: { userCount?: number; patientCount?: number; admin?: ReturnType<typeof adminDto> | null }
) {
  return {
    id: org.id ?? org._id.toString(),
    name: org.name,
    slug: org.slug,
    address: org.address,
    phone: org.phone,
    email: org.email,
    status: org.status,
    plan: org.plan,
    currency: org.currency,
    facilityType: org.facilityType || undefined,
    registrationNumber: org.registrationNumber || undefined,
    commune: org.commune || undefined,
    city: org.city || undefined,
    province: org.province || undefined,
    country: org.country || undefined,
    location: locationOf(org) || undefined,
    logo: org.logo || undefined,
    coverImage: org.coverImage || undefined,
    primaryColor: org.primaryColor || undefined,
    timezone: org.timezone || undefined,
    stamp: org.stamp || undefined,
    rejectionReason: org.rejectionReason || undefined,
    submittedAt: org.submittedAt || undefined,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
    userCount: extras?.userCount,
    patientCount: extras?.patientCount,
    admin: extras?.admin ?? undefined,
  };
}

function adminDto(user: {
  id?: string;
  _id: { toString(): string };
  firstName: string;
  lastName: string;
  postName?: string | null;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  isActive: boolean;
}) {
  return {
    id: user.id ?? user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    postName: user.postName || undefined,
    fullName: [user.lastName, user.postName, user.firstName].filter(Boolean).join(' '),
    email: user.email,
    phone: user.phone || undefined,
    jobTitle: user.jobTitle || undefined,
    isActive: user.isActive,
  };
}

export async function listPublicOrganizations() {
  const rows = await Organization.find({ status: 'active' }).sort({ name: 1 });
  return rows.map((row) => ({ name: row.name, slug: row.slug }));
}

export async function createOrganization(
  input: { name: string; slug: string; address: string; phone: string; email: string },
  actorId: string,
  ip?: string
) {
  const slug = input.slug.toLowerCase();
  const existing = await Organization.findOne({ slug });
  if (existing) {
    throw new ApiError(409, 'Cet identifiant d’établissement est déjà utilisé', 'SLUG_TAKEN');
  }

  const organization = await Organization.create({
    name: input.name.trim(),
    slug,
    address: input.address.trim(),
    phone: input.phone.trim(),
    email: input.email.toLowerCase().trim(),
    status: 'active',
    plan: 'unconfigured',
    createdBy: actorId,
  });

  await recordAudit({
    actorId,
    actorRole: 'SUPERADMIN',
    organizationId: organization.id,
    action: 'ORGANIZATION_CREATED',
    resourceType: 'organization',
    resourceId: organization.id,
    success: true,
    ip,
  });

  return toOrganizationDto(organization, { userCount: 0, patientCount: 0 });
}

async function adminsByOrganization(ids: unknown[]) {
  const rows = await User.find({ organizationId: { $in: ids }, role: ROLES.HOSPITAL_ADMIN })
    .sort({ createdAt: 1 })
    .select('firstName lastName postName email phone jobTitle isActive organizationId');
  const map = new Map<string, ReturnType<typeof adminDto>>();
  for (const row of rows) {
    const key = row.organizationId?.toString() ?? '';
    if (key && !map.has(key)) map.set(key, adminDto(row));
  }
  return map;
}

async function mailQuietly(to: string | undefined, subject: string, text: string) {
  if (!to) return false;
  try {
    await sendMail({ to, subject, text });
    return true;
  } catch {
    return false;
  }
}

function slugify(name: string) {
  const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return base || 'centre';
}

export async function listOrganizations(query: {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'pending' | 'active' | 'suspended' | 'rejected';
}) {
  const { page, limit, skip } = readPagination(query);
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.search) {
    const safe = escapeRegex(query.search.trim());
    filter.$or = [
      { name: new RegExp(safe, 'i') },
      { slug: new RegExp(safe, 'i') },
      { email: new RegExp(safe, 'i') },
      { city: new RegExp(safe, 'i') },
      { commune: new RegExp(safe, 'i') },
      { address: new RegExp(safe, 'i') },
    ];
  }

  const [organizations, total] = await Promise.all([
    Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Organization.countDocuments(filter),
  ]);

  const admins = await adminsByOrganization(organizations.map((org) => org._id));
  const data = await Promise.all(
    organizations.map(async (org) => {
      const [userCount, patientCount] = await Promise.all([
        User.countDocuments({ organizationId: org._id }),
        Patient.countDocuments({ organizationId: org._id, archivedAt: null }),
      ]);
      return toOrganizationDto(org, { userCount, patientCount, admin: admins.get(org.id) ?? null });
    })
  );

  return paginated(data, total, page, limit);
}

export async function getOrganization(id: string) {
  const organization = await Organization.findById(id);
  if (!organization) {
    throw new ApiError(404, 'Établissement introuvable');
  }
  const [userCount, patientCount, admins] = await Promise.all([
    User.countDocuments({ organizationId: organization._id }),
    Patient.countDocuments({ organizationId: organization._id, archivedAt: null }),
    adminsByOrganization([organization._id]),
  ]);
  return toOrganizationDto(organization, { userCount, patientCount, admin: admins.get(organization.id) ?? null });
}

export async function updateOrganization(
  id: string,
  input: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    status?: 'active' | 'suspended';
    facilityType?: string;
    registrationNumber?: string;
    commune?: string;
    city?: string;
    province?: string;
    country?: string;
    currency?: 'EUR' | 'CDF' | 'USD';
    timezone?: string;
    primaryColor?: string;
  },
  actorId: string,
  ip?: string
) {
  const organization = await Organization.findById(id);
  if (!organization) {
    throw new ApiError(404, 'Établissement introuvable');
  }

  if (input.name) organization.name = input.name.trim();
  if (input.address) organization.address = input.address.trim();
  if (input.phone) organization.phone = input.phone.trim();
  if (input.email) organization.email = input.email.toLowerCase().trim();
  if (input.status) {
    if (organization.status === 'pending' || organization.status === 'rejected') {
      throw new ApiError(409, 'Validez ou rejetez d’abord cette demande', 'DECISION_REQUIRED');
    }
    organization.status = input.status;
  }
  if (input.facilityType !== undefined) organization.facilityType = input.facilityType.trim();
  if (input.registrationNumber !== undefined) organization.registrationNumber = input.registrationNumber.trim();
  if (input.commune !== undefined) organization.commune = input.commune.trim();
  if (input.city !== undefined) organization.city = input.city.trim();
  if (input.province !== undefined) organization.province = input.province.trim();
  if (input.country !== undefined) organization.country = input.country.trim();
  if (input.currency) organization.currency = input.currency;
  if (input.timezone !== undefined) organization.timezone = input.timezone.trim();
  if (input.primaryColor !== undefined) organization.primaryColor = input.primaryColor;
  await organization.save();

  if (input.status === 'suspended') {
    await User.updateMany({ organizationId: organization._id }, { $inc: { tokenVersion: 1 } });
  }

  await recordAudit({
    actorId,
    actorRole: 'SUPERADMIN',
    organizationId: organization.id,
    action: 'ORGANIZATION_UPDATED',
    resourceType: 'organization',
    resourceId: organization.id,
    success: true,
    ip,
    metadata: { status: organization.status },
  });

  return getOrganization(organization.id);
}

type CenterInput = {
  name: string;
  facilityType: string;
  registrationNumber: string;
  address: string;
  commune: string;
  city: string;
  province: string;
  country: string;
  phone: string;
  email: string;
  logo: string;
  coverImage?: string;
  primaryColor: string;
  currency: 'EUR' | 'CDF' | 'USD';
  timezone: string;
  stamp?: string;
};

type AdminInput = {
  firstName: string;
  lastName: string;
  postName: string;
  email: string;
  phone: string;
  jobTitle: string;
  password: string;
  confirmPassword: string;
};

function assertSamePassword(password: string, confirmPassword: string) {
  if (password !== confirmPassword) {
    throw new ApiError(400, 'La confirmation du mot de passe ne correspond pas', 'PASSWORD_MISMATCH');
  }
}

async function uniqueSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  let index = 2;
  while (await Organization.exists({ slug })) {
    slug = `${base}-${index}`;
    index += 1;
  }
  return slug;
}

async function tellSuperAdmins(name: string) {
  const supers = await User.find({ role: ROLES.SUPERADMIN, isActive: true }).select('email');
  await Promise.all(supers.map((user) => mailQuietly(
    user.email,
    'Nouvelle inscription d’établissement',
    `${name} a soumis une demande d’inscription. Connectez-vous à l’espace SuperAdmin pour la valider.`,
  )));
}

async function withCloudImages(center: CenterInput): Promise<CenterInput> {
  const folder = 'medicare/centres';
  return {
    ...center,
    logo: await uploadImage(center.logo, `${folder}/logos`),
    coverImage: center.coverImage ? await uploadImage(center.coverImage, `${folder}/couvertures`) : undefined,
    stamp: center.stamp ? await uploadImage(center.stamp, `${folder}/cachets`) : undefined,
  };
}

function applyCenter(organization: { set(path: string, value: unknown): unknown }, center: CenterInput) {
  organization.set('name', center.name.trim());
  organization.set('facilityType', center.facilityType);
  organization.set('registrationNumber', center.registrationNumber.trim());
  organization.set('address', center.address.trim());
  organization.set('commune', center.commune.trim());
  organization.set('city', center.city.trim());
  organization.set('province', center.province.trim());
  organization.set('country', center.country.trim());
  organization.set('phone', center.phone.trim());
  organization.set('email', center.email.toLowerCase().trim());
  organization.set('logo', center.logo);
  organization.set('coverImage', center.coverImage);
  organization.set('primaryColor', center.primaryColor);
  organization.set('currency', center.currency);
  organization.set('timezone', center.timezone.trim());
  organization.set('stamp', center.stamp);
}

export async function applyOrganization(input: { admin: AdminInput; center: CenterInput }, ip?: string) {
  assertSamePassword(input.admin.password, input.admin.confirmPassword);
  const email = input.admin.email.toLowerCase().trim();
  if (await User.exists({ email })) {
    throw new ApiError(409, 'Cet email est déjà utilisé', 'EMAIL_TAKEN');
  }
  const center = await withCloudImages(input.center);
  const organization = await Organization.create({
    name: center.name.trim(),
    slug: await uniqueSlug(center.name),
    address: center.address.trim(),
    phone: center.phone.trim(),
    email: center.email.toLowerCase().trim(),
    status: 'pending',
    plan: 'unconfigured',
    currency: center.currency,
    facilityType: center.facilityType,
    registrationNumber: center.registrationNumber.trim(),
    commune: center.commune.trim(),
    city: center.city.trim(),
    province: center.province.trim(),
    country: center.country.trim(),
    logo: center.logo,
    coverImage: center.coverImage,
    primaryColor: center.primaryColor,
    timezone: center.timezone.trim(),
    stamp: center.stamp,
    submittedAt: new Date(),
  });
  try {
    const user = await User.create({
      email,
      passwordHash: await bcrypt.hash(input.admin.password, getEnv().BCRYPT_ROUNDS),
      role: ROLES.HOSPITAL_ADMIN,
      firstName: input.admin.firstName.trim(),
      lastName: input.admin.lastName.trim(),
      postName: input.admin.postName.trim(),
      phone: input.admin.phone.trim(),
      jobTitle: input.admin.jobTitle.trim(),
      isActive: false,
      mustChangePassword: false,
      organizationId: organization._id,
    });
    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      organizationId: organization.id,
      action: 'ORGANIZATION_SUBMITTED',
      resourceType: 'organization',
      resourceId: organization.id,
      success: true,
      ip,
    });
  } catch (error) {
    await organization.deleteOne();
    throw error;
  }
  await tellSuperAdmins(organization.name);
  return { id: organization.id, status: 'pending' as const, message: 'Demande enregistrée. L’accès sera ouvert après validation.' };
}

export async function resubmitOrganization(input: { email: string; password: string; admin: AdminInput; center: CenterInput }, ip?: string) {
  assertSamePassword(input.admin.password, input.admin.confirmPassword);
  const email = input.email.toLowerCase().trim();
  const user = await User.findOne({ email }).select('+passwordHash');
  const matches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !matches || user.role !== ROLES.HOSPITAL_ADMIN) {
    throw new ApiError(401, 'Identifiants de la demande invalides', 'INVALID_CREDENTIALS');
  }
  const organization = await Organization.findById(user.organizationId);
  if (!organization || organization.status !== 'rejected') {
    throw new ApiError(409, 'Seule une demande refusée peut être renvoyée', 'NOT_REJECTED');
  }
  const nextEmail = input.admin.email.toLowerCase().trim();
  if (nextEmail !== user.email && await User.exists({ email: nextEmail })) {
    throw new ApiError(409, 'Cet email est déjà utilisé', 'EMAIL_TAKEN');
  }
  applyCenter(organization, await withCloudImages(input.center));
  organization.status = 'pending';
  organization.set('rejectionReason', undefined);
  organization.submittedAt = new Date();
  await organization.save();
  user.email = nextEmail;
  user.firstName = input.admin.firstName.trim();
  user.lastName = input.admin.lastName.trim();
  user.postName = input.admin.postName.trim();
  user.phone = input.admin.phone.trim();
  user.jobTitle = input.admin.jobTitle.trim();
  user.passwordHash = await bcrypt.hash(input.admin.password, getEnv().BCRYPT_ROUNDS);
  user.isActive = false;
  await user.save();
  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    organizationId: organization.id,
    action: 'ORGANIZATION_RESUBMITTED',
    resourceType: 'organization',
    resourceId: organization.id,
    success: true,
    ip,
  });
  await tellSuperAdmins(organization.name);
  return { id: organization.id, status: 'pending' as const, message: 'Demande renvoyée. Elle sera examinée à nouveau.' };
}

export async function decideOrganization(
  id: string,
  input: { decision: 'approve' | 'reject'; reason?: string },
  actorId: string,
  ip?: string
) {
  const organization = await Organization.findById(id);
  if (!organization) throw new ApiError(404, 'Établissement introuvable');
  if (organization.status !== 'pending') {
    throw new ApiError(409, 'Cet établissement n’est pas en attente de validation', 'NOT_PENDING');
  }
  const reason = input.reason?.trim();
  if (input.decision === 'reject' && !reason) {
    throw new ApiError(400, 'Le motif de rejet est obligatoire', 'REASON_REQUIRED');
  }
  const admin = await User.findOne({ organizationId: organization._id, role: ROLES.HOSPITAL_ADMIN });
  if (input.decision === 'approve') {
    organization.status = 'active';
    organization.set('rejectionReason', undefined);
    await organization.save();
    if (admin) {
      admin.isActive = true;
      await admin.save();
      await mailQuietly(admin.email, 'Votre établissement est activé', `${organization.name} est maintenant actif. Vous pouvez vous connecter avec votre email.`);
    }
  } else {
    organization.status = 'rejected';
    organization.rejectionReason = reason;
    await organization.save();
    if (admin) {
      admin.isActive = false;
      await admin.save();
      await mailQuietly(admin.email, 'Inscription refusée', `La demande de ${organization.name} a été refusée.\nMotif : ${reason}\nVous pouvez corriger les informations et renvoyer la demande.`);
    }
  }
  await recordAudit({
    actorId,
    actorRole: 'SUPERADMIN',
    organizationId: organization.id,
    action: input.decision === 'approve' ? 'ORGANIZATION_APPROVED' : 'ORGANIZATION_REJECTED',
    resourceType: 'organization',
    resourceId: organization.id,
    success: true,
    ip,
    metadata: { status: organization.status, reason },
  });
  return getOrganization(organization.id);
}

export async function getOrganizationProfile(id: string) {
  const organization = await getOrganization(id);
  const orgId = id;
  const [admins, personnel, personnelCount, patients, consultations, exams, appointments, history] = await Promise.all([
    User.find({ organizationId: orgId, role: ROLES.HOSPITAL_ADMIN }).sort({ createdAt: 1 })
      .select('firstName lastName postName email phone jobTitle isActive createdAt'),
    Personnel.find({ organizationId: orgId, archivedAt: null }).sort({ lastName: 1 }).limit(100)
      .select('firstName lastName role department status'),
    Personnel.countDocuments({ organizationId: orgId, archivedAt: null }),
    Patient.countDocuments({ organizationId: orgId, archivedAt: null }),
    Consultation.countDocuments({ organizationId: orgId }),
    Exam.countDocuments({ organizationId: orgId }),
    Appointment.countDocuments({ organizationId: orgId }),
    AuditLog.find({ organizationId: orgId }).sort({ createdAt: -1 }).limit(50)
      .select('action actorRole success createdAt metadata'),
  ]);
  return {
    organization,
    admins: admins.map((row) => ({ ...adminDto(row), createdAt: row.createdAt })),
    personnel: personnel.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      department: row.department,
      status: row.status,
    })),
    activity: { patients, consultations, exams, appointments, personnel: personnelCount },
    history: history.map((row) => {
      const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};
      return {
        id: row.id,
        action: row.action,
        actorRole: row.actorRole,
        success: row.success,
        createdAt: row.createdAt,
        status: typeof metadata.status === 'string' ? metadata.status : undefined,
        reason: typeof metadata.reason === 'string' ? metadata.reason : undefined,
      };
    }),
  };
}
