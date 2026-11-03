import { ROLES } from '../config/permissions.js';
import { BILLING_CATEGORIES, resolveCategory } from '../domain/billingCategories.js';
import { AuditLog } from '../models/AuditLog.js';
import { Invoice } from '../models/Invoice.js';
import { Organization } from '../models/Organization.js';
import { PharmacyExpense, PharmacySale } from '../models/PharmacyOperations.js';
import { User } from '../models/User.js';
import type { AuthContext } from '../types/express.js';
import { ApiError } from '../utils/ApiError.js';

export type CashService = 'reception' | 'pharmacy' | 'all';

const EXPENSE_LABELS: Record<string, string> = {
  medicines: 'Médicaments',
  consumables: 'Consommables',
  delivery: 'Livraison',
  handling: 'Manutention',
  equipment: 'Équipement',
  maintenance: 'Maintenance',
  other: 'Autre',
};

const CATEGORY_LABELS = new Map(BILLING_CATEGORIES.map((category) => [category.code, category.label]));

export interface CashMovement {
  id: string;
  at: string;
  reference: string;
  label: string;
  category: string;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  actorName: string;
  status: 'paid' | 'pending' | 'cancelled';
  statusLabel: string;
  direction: 'in' | 'out';
  source: 'invoice' | 'sale' | 'expense';
  service: 'reception' | 'pharmacy';
  serviceLabel: string;
}

function categoryLabel(code: string) {
  return CATEGORY_LABELS.get(code) || EXPENSE_LABELS[code] || code;
}

function dayBound(value: string, endOfDay: boolean) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new ApiError(400, 'Date invalide', 'VALIDATION_ERROR');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new ApiError(400, 'Date invalide', 'VALIDATION_ERROR');
  }
  return date;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function within(date: Date, start: Date, end: Date) {
  return date >= start && date <= end;
}

async function actorNames(ids: Array<unknown>) {
  const unique = [...new Set(ids.filter(Boolean).map((id) => String(id)))];
  if (!unique.length) return new Map<string, string>();
  const users = await User.find({ _id: { $in: unique } }).select('firstName lastName');
  return new Map(users.map((user) => [String(user._id), `${user.firstName} ${user.lastName}`]));
}

function addCategory(target: Map<string, number>, label: string, amount: number) {
  target.set(label, money((target.get(label) || 0) + amount));
}

function isPharmacyItem(item: { originModule?: string | null; source?: string | null; category?: string | null; type?: string | null }) {
  return item.originModule === 'pharmacy' || item.source === 'pharmacy' || resolveCategory(item) === 'MEDICAMENT';
}

function portion(items: Array<{ originModule?: string | null; source?: string | null; category?: string | null; type?: string | null; total?: number | null }>, pharmacy: boolean) {
  const parts = new Map<string, number>();
  for (const item of items) {
    if (isPharmacyItem(item) !== pharmacy) continue;
    const code = resolveCategory(item);
    parts.set(code, (parts.get(code) || 0) + (item.total || 0));
  }
  return parts;
}

function allowedServices(role: string): CashService[] {
  if (role === ROLES.HOSPITAL_ADMIN) return ['reception', 'pharmacy', 'all'];
  if (role === ROLES.PHARMACIST) return ['pharmacy'];
  if (role === ROLES.RECEPTIONIST || role === ROLES.ACCOUNTANT) return ['reception'];
  return [];
}

export async function cashflowReport(actor: AuthContext, organizationId: string, from: string, to: string, requested?: string) {
  const allowed = allowedServices(actor.role);
  if (!allowed.length) throw new ApiError(403, 'Accès refusé à ce journal', 'FORBIDDEN');
  const service = (requested || (allowed.includes('all') ? 'all' : allowed[0])) as CashService;
  if (!['reception', 'pharmacy', 'all'].includes(service) || !allowed.includes(service)) {
    throw new ApiError(403, 'Ce service ne fait pas partie de votre journal', 'FORBIDDEN');
  }
  const includeReception = service === 'reception' || service === 'all';
  const includePharmacy = service === 'pharmacy' || service === 'all';
  const start = dayBound(from, false);
  const end = dayBound(to, true);
  if (end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new ApiError(400, 'La période ne peut pas dépasser un an', 'VALIDATION_ERROR');
  }

  const organization = await Organization.findById(organizationId).select('name address phone email currency');
  if (!organization) throw new ApiError(404, 'Établissement introuvable', 'NOT_FOUND');
  const currency = organization.currency || 'EUR';

  const [paidInvoices, openInvoices, cancelledInvoices, sales, expenses] = await Promise.all([
    Invoice.find({ organizationId, status: 'paid', paidAt: { $gte: start, $lte: end } }),
    Invoice.find({
      organizationId,
      status: { $in: ['pending', 'overdue'] },
      $or: [
        { finalizedAt: { $gte: start, $lte: end } },
        { finalizedAt: null, createdAt: { $gte: start, $lte: end } },
      ],
    }),
    Invoice.find({ organizationId, status: 'cancelled', updatedAt: { $gte: start, $lte: end } }),
    includePharmacy
      ? PharmacySale.find({
        organizationId,
        settlement: 'paid',
        total: { $gt: 0 },
        createdAt: { $gte: start, $lte: end },
        $or: [{ invoiceId: null }, { invoiceId: { $exists: false } }],
      })
      : Promise.resolve([]),
    includePharmacy
      ? PharmacyExpense.find({
        organizationId,
        date: { $gte: start, $lte: end },
        amount: { $gt: 0 },
      })
      : Promise.resolve([]),
  ]);

  const audits = await AuditLog.find({
    organizationId,
    action: 'INVOICE_PAID',
    success: true,
    resourceId: { $in: paidInvoices.map((row) => String(row._id)) },
  }).select('actorId resourceId createdAt').sort({ createdAt: 1 });
  const paidByAudit = new Map<string, string>();
  for (const audit of audits) {
    if (audit.actorId && audit.resourceId) paidByAudit.set(audit.resourceId, String(audit.actorId));
  }

  const names = await actorNames([
    ...paidInvoices.flatMap((row) => [row.paidBy, row.createdBy, paidByAudit.get(String(row._id))]),
    ...openInvoices.map((row) => row.createdBy),
    ...cancelledInvoices.map((row) => row.createdBy),
    ...sales.map((row) => row.actorId),
    ...expenses.flatMap((row) => [row.paidBy, row.requestedBy]),
  ]);
  const actorName = (id: unknown) => (id && names.get(String(id))) || 'Non renseigné';

  const entries: CashMovement[] = [];
  const exits: CashMovement[] = [];
  const pending: CashMovement[] = [];
  const cancelled: CashMovement[] = [];
  const incomeCategories = new Map<string, number>();
  const expenseCategories = new Map<string, number>();
  const other = new Map<string, { income: number; expense: number }>();

  const countMoney = (direction: 'in' | 'out', movementCurrency: string, parts: Array<{ label: string; amount: number }>, prefix: string) => {
    const named = parts.map((part) => ({ label: prefix ? `${prefix} — ${part.label}` : part.label, amount: part.amount }));
    if (movementCurrency === currency) {
      const target = direction === 'in' ? incomeCategories : expenseCategories;
      for (const part of named) addCategory(target, part.label, part.amount);
      return;
    }
    const bucket = other.get(movementCurrency) || { income: 0, expense: 0 };
    const amount = named.reduce((sum, part) => sum + part.amount, 0);
    if (direction === 'in') bucket.income = money(bucket.income + amount);
    else bucket.expense = money(bucket.expense + amount);
    other.set(movementCurrency, bucket);
  };

  const labelled = (parts: Map<string, number>) => [...parts.entries()].map(([code, amount]) => ({ label: categoryLabel(code), amount: money(amount) }));

  const pushInvoicePortion = (
    row: (typeof paidInvoices)[number],
    bucket: 'paid' | 'pending' | 'cancelled',
    at: Date,
    status: CashMovement['status'],
    statusLabel: string,
    owner: 'reception' | 'pharmacy',
    parts: Map<string, number>,
    amount: number,
  ) => {
    if (amount <= 0) return;
    if (owner === 'reception' && !includeReception) return;
    if (owner === 'pharmacy' && !includePharmacy) return;
    const lines = labelled(parts);
    const movement: CashMovement = {
      id: String(row._id),
      at: at.toISOString(),
      reference: row.invoiceNumber,
      label: row.patientName,
      category: lines.map((part) => part.label).join(', ') || 'Autre',
      amount,
      currency: row.currency || 'EUR',
      paymentMethod: row.paymentMethod || null,
      actorName: actorName(row.paidBy || paidByAudit.get(String(row._id)) || row.createdBy),
      status,
      statusLabel,
      direction: 'in',
      source: 'invoice',
      service: owner,
      serviceLabel: owner === 'pharmacy' ? 'Pharmacie' : 'Réception',
    };
    if (bucket === 'paid') {
      entries.push(movement);
      countMoney('in', movement.currency, lines, service === 'all' ? movement.serviceLabel : '');
    } else if (bucket === 'cancelled') {
      cancelled.push(movement);
    } else {
      pending.push(movement);
    }
  };

  const pushInvoice = (
    row: (typeof paidInvoices)[number],
    bucket: 'paid' | 'pending' | 'cancelled',
    at: Date,
    status: CashMovement['status'],
    statusLabel: string,
  ) => {
    const items = row.items || [];
    const receptionParts = portion(items, false);
    const pharmacyParts = portion(items, true);
    let receptionTotal = money([...receptionParts.values()].reduce((sum, amount) => sum + amount, 0));
    let pharmacyTotal = money([...pharmacyParts.values()].reduce((sum, amount) => sum + amount, 0));
    const gap = money(row.total - receptionTotal - pharmacyTotal);
    if (Math.abs(gap) >= 0.01) {
      if (pharmacyParts.size && pharmacyTotal >= receptionTotal) {
        pharmacyParts.set('AUTRE', (pharmacyParts.get('AUTRE') || 0) + gap);
        pharmacyTotal = money(pharmacyTotal + gap);
      } else {
        receptionParts.set('AUTRE', (receptionParts.get('AUTRE') || 0) + gap);
        receptionTotal = money(receptionTotal + gap);
      }
    }
    if (!receptionParts.size && !pharmacyParts.size) {
      receptionParts.set('AUTRE', row.total);
      receptionTotal = money(row.total);
    }
    pushInvoicePortion(row, bucket, at, status, statusLabel, 'reception', receptionParts, receptionTotal);
    pushInvoicePortion(row, bucket, at, status, statusLabel, 'pharmacy', pharmacyParts, pharmacyTotal);
  };

  for (const row of paidInvoices) {
    if (!row.paidAt || !within(row.paidAt, start, end)) continue;
    pushInvoice(row, 'paid', row.paidAt, 'paid', 'Encaissée');
  }

  if (includePharmacy) for (const row of sales) {
    const at = row.createdAt || row.updatedAt;
    if (!at) continue;
    const products = row.lines.map((line) => line.productName).filter(Boolean).join(', ') || 'Vente pharmacie';
    const who = row.patientName || row.wardName || 'Vente comptoir';
    entries.push({
      id: String(row._id),
      at: new Date(at).toISOString(),
      reference: row.number,
      label: `${who} — ${products}`,
      category: 'Médicament',
      amount: money(row.total),
      currency: row.currency || currency,
      paymentMethod: row.paymentMethod || null,
      actorName: actorName(row.actorId),
      status: 'paid',
      statusLabel: 'Encaissée',
      direction: 'in',
      source: 'sale',
      service: 'pharmacy',
      serviceLabel: 'Pharmacie',
    });
    countMoney('in', row.currency || currency, [{ label: 'Médicament', amount: row.total }], service === 'all' ? 'Pharmacie' : '');
  }

  for (const row of openInvoices) {
    const at = row.finalizedAt || row.createdAt;
    if (!at || !within(new Date(at), start, end)) continue;
    pushInvoice(row, 'pending', new Date(at), 'pending', row.status === 'overdue' ? 'En retard' : 'À encaisser');
  }

  for (const row of cancelledInvoices) {
    const at = row.updatedAt || row.createdAt;
    if (!at) continue;
    pushInvoice(row, 'cancelled', new Date(at), 'cancelled', 'Annulée');
  }

  if (includePharmacy) for (const row of expenses) {
    const label = EXPENSE_LABELS[row.category] || 'Autre';
    const movement: CashMovement = {
      id: String(row._id),
      at: new Date(row.date).toISOString(),
      reference: row.number,
      label: row.description,
      category: label,
      amount: money(row.amount),
      currency: row.currency,
      paymentMethod: row.paymentMethod || null,
      actorName: actorName(row.paidBy || row.requestedBy),
      status: row.status === 'paid' ? 'paid' : row.status === 'rejected' ? 'cancelled' : 'pending',
      statusLabel: row.status === 'paid' ? 'Payée' : row.status === 'rejected' ? 'Rejetée' : 'En attente',
      direction: 'out',
      source: 'expense',
      service: 'pharmacy',
      serviceLabel: 'Pharmacie',
    };
    if (row.status === 'paid') {
      exits.push(movement);
      countMoney('out', row.currency, [{ label, amount: row.amount }], service === 'all' ? 'Pharmacie' : '');
    } else if (row.status === 'rejected') {
      cancelled.push(movement);
    } else {
      pending.push(movement);
    }
  }

  const byDate = (left: CashMovement, right: CashMovement) => new Date(right.at).getTime() - new Date(left.at).getTime();
  entries.sort(byDate);
  exits.sort(byDate);
  pending.sort(byDate);
  cancelled.sort(byDate);

  const income = money([...incomeCategories.values()].reduce((sum, amount) => sum + amount, 0));
  const expense = money([...expenseCategories.values()].reduce((sum, amount) => sum + amount, 0));
  const toList = (source: Map<string, number>) => [...source.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .filter((row) => row.amount !== 0)
    .sort((left, right) => right.amount - left.amount);

  return {
    organization: {
      name: organization.name,
      address: organization.address,
      phone: organization.phone,
      email: organization.email,
    },
    period: { from, to },
    generatedAt: new Date().toISOString(),
    service,
    allowed,
    currency,
    entries,
    exits,
    pending,
    cancelled,
    totals: { income, expense, balance: money(income - expense) },
    balances: [
      { currency, income, expense, balance: money(income - expense) },
      ...[...other.entries()].map(([code, amounts]) => ({
        currency: code,
        income: money(amounts.income),
        expense: money(amounts.expense),
        balance: money(amounts.income - amounts.expense),
      })),
    ].filter((row, index) => index === 0 || row.income !== 0 || row.expense !== 0),
    incomeByCategory: toList(incomeCategories),
    expenseByCategory: toList(expenseCategories),
    otherCurrency: [...other.entries()].map(([code, amounts]) => ({ currency: code, ...amounts })),
  };
}
