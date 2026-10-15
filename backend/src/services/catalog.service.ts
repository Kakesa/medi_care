import { BILLING_CATEGORIES, BILLING_CURRENCIES, type BillingCurrency } from '../domain/billingCategories.js';
import { BillableService } from '../models/BillableService.js';
import { Organization } from '../models/Organization.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthContext } from '../types/express.js';
import { requireOwned } from './access.service.js';
import { recordAudit } from './audit.service.js';

export interface CatalogInput {
  code: string;
  name: string;
  description?: string;
  category: string;
  unitPrice: number;
  unit?: 'acte' | 'unite' | 'boite' | 'jour' | 'nuit' | 'heure' | 'seance' | 'autre';
  department?: string;
  active?: boolean;
  effectiveFrom?: Date;
  billingRule?: string;
}

function toDto(row: {
  id?: string;
  _id: { toString(): string };
  code: string;
  name: string;
  description?: string | null;
  category: string;
  unitPrice: number;
  currency: string;
  unit: string;
  department?: string | null;
  active: boolean;
  effectiveFrom: Date;
  billingRule?: string | null;
}) {
  return {
    id: row.id ?? row._id.toString(),
    code: row.code,
    name: row.name,
    description: row.description || undefined,
    category: row.category,
    unitPrice: row.unitPrice,
    currency: row.currency,
    unit: row.unit,
    department: row.department || undefined,
    active: row.active,
    effectiveFrom: row.effectiveFrom,
    billingRule: row.billingRule || undefined,
  };
}

export async function organizationCurrency(organizationId: string): Promise<BillingCurrency> {
  const organization = await Organization.findById(organizationId).select('currency');
  const currency = organization && 'currency' in organization ? String(organization.currency || '') : '';
  return (BILLING_CURRENCIES as readonly string[]).includes(currency) ? currency as BillingCurrency : 'EUR';
}

export async function billingSettings(organizationId: string) {
  return {
    currency: await organizationCurrency(organizationId),
    currencies: BILLING_CURRENCIES,
    categories: BILLING_CATEGORIES,
  };
}

export async function updateBillingSettings(
  actor: AuthContext,
  organizationId: string,
  currency: BillingCurrency,
  ip?: string
) {
  const organization = await Organization.findById(organizationId);
  if (!organization) throw new ApiError(404, 'Établissement introuvable', 'NOT_FOUND');
  organization.set('currency', currency);
  await organization.save();
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'BILLING_CURRENCY_UPDATED',
    resourceType: 'organization',
    resourceId: organizationId,
    success: true,
    ip,
    metadata: { currency },
  });
  return billingSettings(organizationId);
}

export async function listServices(organizationId: string, activeOnly = false) {
  const filter: Record<string, unknown> = { organizationId };
  if (activeOnly) filter.active = true;
  const rows = await BillableService.find(filter).sort({ category: 1, name: 1 });
  return rows.map((row) => toDto(row));
}

export async function createService(actor: AuthContext, organizationId: string, input: CatalogInput, ip?: string) {
  const currency = await organizationCurrency(organizationId);
  let row;
  try {
    row = await BillableService.create({
    organizationId,
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    description: input.description?.trim() || '',
    category: input.category.trim().toUpperCase(),
    unitPrice: input.unitPrice,
    currency,
    unit: input.unit || 'acte',
    department: input.department?.trim() || '',
    active: input.active ?? true,
    effectiveFrom: input.effectiveFrom ?? new Date(),
    billingRule: input.billingRule?.trim() || '',
  });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      throw new ApiError(409, 'Ce code de prestation existe déjà', 'CODE_EXISTS');
    }
    throw error;
  }
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'CATALOG_CREATED',
    resourceType: 'billable_service',
    resourceId: row.id,
    success: true,
    ip,
    metadata: { code: row.code, category: row.category },
  });
  return toDto(row);
}

export async function updateService(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: Partial<CatalogInput>,
  ip?: string
) {
  const row = await requireOwned(BillableService, id, organizationId, actor, 'billable_service', ip);
  if (input.name !== undefined) row.name = input.name.trim();
  if (input.description !== undefined) row.description = input.description.trim();
  if (input.category !== undefined) row.category = input.category.trim().toUpperCase();
  if (input.unitPrice !== undefined) {
    row.unitPrice = input.unitPrice;
    row.currency = await organizationCurrency(organizationId);
    row.effectiveFrom = input.effectiveFrom ?? new Date();
  } else if (input.effectiveFrom) {
    row.effectiveFrom = input.effectiveFrom;
  }
  if (input.unit !== undefined) row.unit = input.unit;
  if (input.department !== undefined) row.department = input.department.trim();
  if (input.active !== undefined) row.active = input.active;
  if (input.billingRule !== undefined) row.billingRule = input.billingRule.trim();
  await row.save();
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'CATALOG_UPDATED',
    resourceType: 'billable_service',
    resourceId: id,
    success: true,
    ip,
    metadata: { code: row.code, active: row.active },
  });
  return toDto(row);
}
