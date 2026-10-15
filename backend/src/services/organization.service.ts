import { Organization } from '../models/Organization.js';
import { Patient } from '../models/Patient.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/regex.js';
import { paginated, readPagination } from '../utils/pagination.js';
import { recordAudit } from './audit.service.js';

function toOrganizationDto(
  org: {
    id?: string;
    _id: { toString(): string };
    name: string;
    slug: string;
    address: string;
    phone: string;
    email: string;
    status: string;
    plan: string;
    createdAt?: Date;
    updatedAt?: Date;
  },
  counts?: { userCount: number; patientCount: number }
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
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
    ...counts,
  };
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

export async function listOrganizations(query: {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'suspended';
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
    ];
  }

  const [organizations, total] = await Promise.all([
    Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Organization.countDocuments(filter),
  ]);

  const data = await Promise.all(
    organizations.map(async (org) => {
      const [userCount, patientCount] = await Promise.all([
        User.countDocuments({ organizationId: org._id }),
        Patient.countDocuments({ organizationId: org._id, archivedAt: null }),
      ]);
      return toOrganizationDto(org, { userCount, patientCount });
    })
  );

  return paginated(data, total, page, limit);
}

export async function getOrganization(id: string) {
  const organization = await Organization.findById(id);
  if (!organization) {
    throw new ApiError(404, 'Établissement introuvable');
  }
  const [userCount, patientCount] = await Promise.all([
    User.countDocuments({ organizationId: organization._id }),
    Patient.countDocuments({ organizationId: organization._id, archivedAt: null }),
  ]);
  return toOrganizationDto(organization, { userCount, patientCount });
}

export async function updateOrganization(
  id: string,
  input: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    status?: 'active' | 'suspended';
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
  if (input.status) organization.status = input.status;
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
