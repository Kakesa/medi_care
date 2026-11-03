import { SURGICAL_SEED, surgicalNameKey } from '../domain/surgicalSeed.js';
import { AuditLog } from '../models/AuditLog.js';
import { Invoice } from '../models/Invoice.js';
import { SurgicalAct } from '../models/SurgicalAct.js';
import { SurgicalCategory } from '../models/SurgicalCategory.js';
import { SurgicalPriceHistory } from '../models/SurgicalPriceHistory.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { dateOnly, utcDayBounds } from '../utils/dates.js';
import { fromMinorUnits, toMinorUnits } from '../utils/money.js';
import type { AuthContext } from '../types/express.js';
import { requireOwned, requireVisiblePatient } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { organizationCurrency } from './catalog.service.js';
import type { BillingCurrency } from '../domain/billingCategories.js';

interface ActRow {
  id?: string;
  _id: { toString(): string };
  categoryId: { toString(): string } | string;
  name: string;
  description?: string | null;
  priceMinor?: number | null;
  currency?: string | null;
  active: boolean;
  billingCategory?: string | null;
  createdBy?: { toString(): string } | null;
  updatedBy?: { toString(): string } | null;
  createdAt?: Date;
  updatedAt?: Date;
}

function amountOf(minor?: number | null) {
  return minor == null ? null : fromMinorUnits(minor);
}

async function nameMap(ids: Array<unknown>) {
  const unique = [...new Set(ids.filter(Boolean).map((id) => String(id)))];
  if (unique.length === 0) return new Map<string, string>();
  const users = await User.find({ _id: { $in: unique } }).select('firstName lastName');
  return new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`]));
}

function toActDto(
  row: ActRow,
  categoryName: string,
  currency: BillingCurrency,
  names: Map<string, string>
) {
  const createdBy = row.createdBy ? String(row.createdBy) : undefined;
  const updatedBy = row.updatedBy ? String(row.updatedBy) : undefined;
  const priced = row.priceMinor != null && Boolean(row.currency);
  return {
    id: row.id ?? row._id.toString(),
    categoryId: String(row.categoryId),
    categoryName,
    name: row.name,
    description: row.description || '',
    unitPrice: amountOf(row.priceMinor),
    currency: row.currency || null,
    active: row.active,
    billingCategory: row.billingCategory || 'CHIRURGIE',
    billable: row.active && priced && row.currency === currency,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy,
    createdByName: createdBy ? names.get(createdBy) : undefined,
    updatedBy,
    updatedByName: updatedBy ? names.get(updatedBy) : undefined,
  };
}

async function categoryOrThrow(actor: AuthContext, organizationId: string, categoryId: string, ip?: string) {
  const category = await requireOwned(SurgicalCategory, categoryId, organizationId, actor, 'surgical_category', ip);
  if (!category.active) {
    throw new ApiError(409, 'Cette catégorie est inactive', 'CATEGORY_INACTIVE');
  }
  return category;
}

function duplicateName(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 11000);
}

export async function ensureSurgicalSeed(actor: AuthContext, organizationId: string) {
  const keys = SURGICAL_SEED.flatMap((category) => category.acts.map((act) => surgicalNameKey(act.name)));
  const present = await SurgicalAct.countDocuments({ organizationId, nameKey: { $in: keys } });
  if (present >= keys.length) return;

  for (const category of SURGICAL_SEED) {
    const nameKey = surgicalNameKey(category.name);
    let stored = await SurgicalCategory.findOne({ organizationId, nameKey });
    if (!stored) {
      try {
        stored = await SurgicalCategory.create({
          organizationId,
          name: category.name,
          nameKey,
          billingCategory: category.billingCategory || 'CHIRURGIE',
          active: true,
          createdBy: actor.id,
        });
      } catch (error) {
        if (!duplicateName(error)) throw error;
        stored = await SurgicalCategory.findOne({ organizationId, nameKey });
      }
    }
    if (!stored) continue;
    for (const act of category.acts) {
      const actKey = surgicalNameKey(act.name);
      const exists = await SurgicalAct.exists({ organizationId, nameKey: actKey });
      if (exists) continue;
      try {
        await SurgicalAct.create({
          organizationId,
          categoryId: stored._id,
          name: act.name,
          nameKey: actKey,
          description: act.description,
          active: true,
          createdBy: actor.id,
          updatedBy: actor.id,
        });
      } catch (error) {
        if (!duplicateName(error)) throw error;
      }
    }
  }
}

export async function listCategories(actor: AuthContext, organizationId: string) {
  await ensureSurgicalSeed(actor, organizationId);
  const rows = await SurgicalCategory.find({ organizationId, active: true }).sort({ name: 1 });
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function createCategory(
  actor: AuthContext,
  organizationId: string,
  name: string,
  ip?: string
) {
  const trimmed = name.trim();
  const nameKey = surgicalNameKey(trimmed);
  if (await SurgicalCategory.exists({ organizationId, nameKey })) {
    throw new ApiError(409, 'Cette catégorie existe déjà', 'CATEGORY_EXISTS');
  }
  try {
    const row = await SurgicalCategory.create({
      organizationId,
      name: trimmed,
      nameKey,
      active: true,
      createdBy: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      actorRole: actor.role,
      organizationId,
      action: 'SURGICAL_CATEGORY_CREATED',
      resourceType: 'surgical_category',
      resourceId: row.id,
      success: true,
      ip,
      metadata: { name: row.name },
    });
    return { id: row.id, name: row.name };
  } catch (error) {
    if (duplicateName(error)) throw new ApiError(409, 'Cette catégorie existe déjà', 'CATEGORY_EXISTS');
    throw error;
  }
}

export async function listActs(
  actor: AuthContext,
  organizationId: string,
  query: {
    search?: string;
    categoryId?: string;
    active?: 'true' | 'false';
    billable?: 'true' | 'false';
    sort?: 'name' | 'createdAt' | 'updatedAt';
    direction?: 'asc' | 'desc';
  }
) {
  await ensureSurgicalSeed(actor, organizationId);
  const currency = await organizationCurrency(organizationId);
  const filter: Record<string, unknown> = { organizationId };
  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.active) filter.active = query.active === 'true';
  const rows = await SurgicalAct.find(filter).sort({ name: 1 });
  const categories = await SurgicalCategory.find({ organizationId }).select('name');
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const names = await nameMap(rows.flatMap((row) => [row.createdBy, row.updatedBy]));
  let data = rows.map((row) => toActDto(row, categoryNames.get(String(row.categoryId)) || '', currency, names));
  if (query.search) {
    const needle = surgicalNameKey(query.search);
    data = data.filter((act) => surgicalNameKey(act.name).includes(needle) || surgicalNameKey(act.description).includes(needle));
  }
  if (query.billable === 'true') data = data.filter((act) => act.billable);
  const sort = query.sort || 'name';
  const factor = query.direction === 'desc' ? -1 : 1;
  data.sort((left, right) => {
    const a = sort === 'name' ? left.name : String(left[sort] || '');
    const b = sort === 'name' ? right.name : String(right[sort] || '');
    return a.localeCompare(b, 'fr') * factor;
  });
  return { data, total: data.length, currency };
}

export async function getAct(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(SurgicalAct, id, organizationId, actor, 'surgical_act', ip);
  const category = await SurgicalCategory.findById(row.categoryId).select('name');
  const currency = await organizationCurrency(organizationId);
  const names = await nameMap([row.createdBy, row.updatedBy]);
  return toActDto(row, category?.name || '', currency, names);
}

async function writePrice(
  organizationId: string,
  act: { _id: unknown; priceMinor?: number | null; currency?: string | null },
  nextMinor: number,
  currency: BillingCurrency,
  actorId: string
) {
  if (act.priceMinor === nextMinor && act.currency === currency) return false;
  await SurgicalPriceHistory.create({
    organizationId,
    actId: act._id,
    previousMinor: act.priceMinor ?? null,
    previousCurrency: act.currency ?? null,
    nextMinor,
    nextCurrency: currency,
    changedBy: actorId,
  });
  return true;
}

export async function createAct(
  actor: AuthContext,
  organizationId: string,
  input: { name: string; categoryId: string; description?: string; unitPrice?: number; active?: boolean },
  ip?: string
) {
  await categoryOrThrow(actor, organizationId, input.categoryId, ip);
  const category = await categoryOrThrow(actor, organizationId, input.categoryId, ip);
  const name = input.name.trim();
  const nameKey = surgicalNameKey(name);
  if (await SurgicalAct.exists({ organizationId, nameKey })) {
    throw new ApiError(409, 'Cet acte existe déjà', 'ACT_EXISTS');
  }
  const priceMinor = input.unitPrice == null ? undefined : toMinorUnits(input.unitPrice);
  let row;
  try {
    row = await SurgicalAct.create({
      organizationId,
      categoryId: input.categoryId,
      name,
      nameKey,
      description: input.description?.trim() || '',
      priceMinor,
      currency: priceMinor == null ? undefined : currency,
      active: input.active ?? true,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
  } catch (error) {
    if (duplicateName(error)) throw new ApiError(409, 'Cet acte existe déjà', 'ACT_EXISTS');
    throw error;
  }
  if (priceMinor != null) {
    await writePrice(organizationId, { _id: row._id, priceMinor: null, currency: null }, priceMinor, currency, actor.id);
  }
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'SURGICAL_ACT_CREATED',
    resourceType: 'surgical_act',
    resourceId: row.id,
    success: true,
    ip,
    metadata: { name: row.name },
  });
  return getAct(actor, organizationId, row.id, ip);
}

export async function updateAct(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: { name?: string; categoryId?: string; description?: string; unitPrice?: number; active?: boolean },
  ip?: string
) {
  const row = await requireOwned(SurgicalAct, id, organizationId, actor, 'surgical_act', ip);
  const changes: string[] = [];
  if (input.categoryId && String(input.categoryId) !== String(row.categoryId)) {
    await categoryOrThrow(actor, organizationId, input.categoryId, ip);
    row.categoryId = input.categoryId as never;
    changes.push('catégorie');
  }
  if (input.name !== undefined) {
    const name = input.name.trim();
    const nameKey = surgicalNameKey(name);
    if (nameKey !== row.nameKey) {
      const taken = await SurgicalAct.exists({ organizationId, nameKey, _id: { $ne: row._id } });
      if (taken) throw new ApiError(409, 'Cet acte existe déjà', 'ACT_EXISTS');
      row.name = name;
      row.nameKey = nameKey;
      changes.push('nom');
    }
  }
  if (input.description !== undefined && input.description.trim() !== (row.description || '')) {
    row.description = input.description.trim();
    changes.push('description');
  }
  if (input.active !== undefined && input.active !== row.active) {
    row.active = input.active;
    changes.push(input.active ? 'activation' : 'désactivation');
  }
  if (input.unitPrice !== undefined) {
    const currency = await organizationCurrency(organizationId);
    const nextMinor = toMinorUnits(input.unitPrice);
    const changed = await writePrice(organizationId, row, nextMinor, currency, actor.id);
    if (changed) {
      row.priceMinor = nextMinor;
      row.currency = currency;
      changes.push('tarif');
    }
  }
  if (changes.length === 0) {
    return getAct(actor, organizationId, id, ip);
  }
  row.updatedBy = actor.id as never;
  try {
    await row.save();
  } catch (error) {
    if (duplicateName(error)) throw new ApiError(409, 'Cet acte existe déjà', 'ACT_EXISTS');
    throw error;
  }
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'SURGICAL_ACT_UPDATED',
    resourceType: 'surgical_act',
    resourceId: id,
    success: true,
    ip,
    metadata: { name: row.name, changes },
  });
  return getAct(actor, organizationId, id, ip);
}

export async function priceHistory(actor: AuthContext, organizationId: string, actId?: string, ip?: string) {
  if (actId) await requireOwned(SurgicalAct, actId, organizationId, actor, 'surgical_act', ip);
  const filter: Record<string, unknown> = { organizationId };
  if (actId) filter.actId = actId;
  const rows = await SurgicalPriceHistory.find(filter).sort({ createdAt: -1 }).limit(200);
  const acts = await SurgicalAct.find({ organizationId, _id: { $in: rows.map((row) => row.actId) } }).select('name');
  const actNames = new Map(acts.map((act) => [act.id, act.name]));
  const names = await nameMap(rows.map((row) => row.changedBy));
  return rows.map((row) => ({
    id: row.id,
    actId: String(row.actId),
    actName: actNames.get(String(row.actId)) || '',
    previousPrice: amountOf(row.previousMinor),
    previousCurrency: row.previousCurrency || null,
    nextPrice: fromMinorUnits(row.nextMinor),
    nextCurrency: row.nextCurrency,
    changedAt: row.createdAt,
    changedBy: String(row.changedBy),
    changedByName: names.get(String(row.changedBy)),
  }));
}

export async function changeHistory(organizationId: string) {
  const rows = await AuditLog.find({
    organizationId,
    resourceType: { $in: ['surgical_act', 'surgical_category'] },
    success: true,
  }).sort({ createdAt: -1 }).limit(200);
  const names = await nameMap(rows.map((row) => row.actorId));
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    metadata: row.metadata || {},
    createdAt: row.createdAt,
    actorId: row.actorId ? String(row.actorId) : undefined,
    actorName: row.actorId ? names.get(String(row.actorId)) : undefined,
  }));
}

export async function surgeryStats(
  actor: AuthContext,
  organizationId: string,
  query: { startDate?: string; endDate?: string }
) {
  await ensureSurgicalSeed(actor, organizationId);
  const currency = await organizationCurrency(organizationId);
  const [total, active, inactive, unpriced] = await Promise.all([
    SurgicalAct.countDocuments({ organizationId }),
    SurgicalAct.countDocuments({ organizationId, active: true }),
    SurgicalAct.countDocuments({ organizationId, active: false }),
    SurgicalAct.countDocuments({ organizationId, priceMinor: null }),
  ]);
  const date: Record<string, Date> = {};
  if (query.startDate) date.$gte = utcDayBounds(query.startDate).start;
  if (query.endDate) date.$lt = utcDayBounds(query.endDate).end;
  const invoiceFilter: Record<string, unknown> = {
    organizationId,
    status: { $in: ['pending', 'paid', 'overdue'] },
    'items.surgicalActId': { $exists: true },
  };
  if (query.startDate || query.endDate) invoiceFilter.date = date;
  const invoices = await Invoice.find(invoiceFilter).select('date currency items status');
  const categories = await SurgicalCategory.find({ organizationId }).select('name');
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const acts = await SurgicalAct.find({ organizationId }).select('name categoryId');
  const actInfo = new Map(acts.map((act) => [act.id, { name: act.name, categoryId: String(act.categoryId) }]));

  let quantity = 0;
  let amountMinor = 0;
  const other = new Map<string, { lineCount: number; amountMinor: number }>();
  const byAct = new Map<string, { name: string; categoryName: string; quantity: number; amountMinor: number }>();
  const byDay = new Map<string, { quantity: number; amountMinor: number }>();

  for (const invoice of invoices) {
    const invoiceCurrency = invoice.currency || 'EUR';
    const day = dateOnly(invoice.date) || '';
    for (const item of invoice.items) {
      if (!item.surgicalActId) continue;
      const lineMinor = toMinorUnits(item.total);
      if (invoiceCurrency === currency) {
        quantity += item.quantity;
        amountMinor += lineMinor;
        const info = actInfo.get(String(item.surgicalActId));
        const current = byAct.get(String(item.surgicalActId)) || {
          name: info?.name || item.description,
          categoryName: info ? categoryNames.get(info.categoryId) || '' : '',
          quantity: 0,
          amountMinor: 0,
        };
        current.quantity += item.quantity;
        current.amountMinor += lineMinor;
        byAct.set(String(item.surgicalActId), current);
        const bucket = byDay.get(day) || { quantity: 0, amountMinor: 0 };
        bucket.quantity += item.quantity;
        bucket.amountMinor += lineMinor;
        byDay.set(day, bucket);
      } else {
        const bucket = other.get(invoiceCurrency) || { lineCount: 0, amountMinor: 0 };
        bucket.lineCount += 1;
        bucket.amountMinor += lineMinor;
        other.set(invoiceCurrency, bucket);
      }
    }
  }

  const topActs = [...byAct.entries()]
    .map(([actId, value]) => ({
      actId,
      name: value.name,
      categoryName: value.categoryName,
      quantity: value.quantity,
      amount: fromMinorUnits(value.amountMinor),
    }))
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 8);

  const byCategoryMap = new Map<string, { quantity: number; amountMinor: number }>();
  for (const value of byAct.values()) {
    const current = byCategoryMap.get(value.categoryName) || { quantity: 0, amountMinor: 0 };
    current.quantity += value.quantity;
    current.amountMinor += value.amountMinor;
    byCategoryMap.set(value.categoryName, current);
  }

  return {
    currency,
    period: { startDate: query.startDate || null, endDate: query.endDate || null },
    acts: { total, active, inactive, unpriced },
    billed: { quantity, amount: fromMinorUnits(amountMinor) },
    otherCurrencies: [...other.entries()].map(([code, value]) => ({
      currency: code,
      lineCount: value.lineCount,
      amount: fromMinorUnits(value.amountMinor),
    })),
    byCategory: [...byCategoryMap.entries()].map(([name, value]) => ({
      name,
      quantity: value.quantity,
      amount: fromMinorUnits(value.amountMinor),
    })),
    topActs,
    evolution: [...byDay.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, value]) => ({ date, quantity: value.quantity, amount: fromMinorUnits(value.amountMinor) })),
  };
}

export async function patientSurgeryHistory(
  actor: AuthContext,
  organizationId: string,
  patientId: string,
  ip?: string
) {
  await requireVisiblePatient(actor, organizationId, patientId, ip);
  const invoices = await Invoice.find({
    organizationId,
    patientId,
    'items.surgicalActId': { $exists: true },
  }).sort({ date: -1 });
  const names = await nameMap(invoices.map((invoice) => invoice.get('createdBy')));
  return invoices.flatMap((invoice) => {
    const createdBy = invoice.get('createdBy');
    return invoice.items
      .filter((item) => item.surgicalActId)
      .map((item) => ({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        date: invoice.date,
        currency: invoice.currency || 'EUR',
        billedBy: createdBy ? String(createdBy) : undefined,
        billedByName: createdBy ? names.get(String(createdBy)) : undefined,
        actId: String(item.surgicalActId),
        name: item.description,
        description: item.get('detail') || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      }));
  });
}

export async function priceSurgicalAct(
  actor: AuthContext,
  organizationId: string,
  actId: string,
  quantity: number,
  ip?: string
) {
  const act = await requireOwned(SurgicalAct, actId, organizationId, actor, 'surgical_act', ip);
  if (!act.active) {
    throw new ApiError(409, `L'acte ${act.name} n'est plus actif`, 'ACT_INACTIVE');
  }
  if (act.priceMinor == null || !act.currency) {
    throw new ApiError(409, `L'acte ${act.name} n'a pas encore de tarif`, 'ACT_UNPRICED');
  }
  const currency = await organizationCurrency(organizationId);
  if (act.currency !== currency) {
    throw new ApiError(
      409,
      `L'acte ${act.name} est tarifé en ${act.currency}. Enregistrez son prix dans la devise actuelle de l'établissement.`,
      'CURRENCY_MISMATCH'
    );
  }
  const totalMinor = act.priceMinor * quantity;
  return {
    description: act.name,
    detail: act.description || '',
    quantity,
    unitPrice: fromMinorUnits(act.priceMinor),
    total: fromMinorUnits(totalMinor),
    type: 'service',
    category: 'CHIRURGIE',
    surgicalActId: act._id,
    unit: 'acte',
    source: 'surgery' as const,
  };
}
