import { PharmacyBudget, PharmacyExpense } from '../models/PharmacyOperations.js';
import { PharmacyOrder } from '../models/PharmacyOrder.js';
import { SupplierInvoice } from '../models/PharmacyProcurement.js';
import { PharmacySale } from '../models/PharmacyOperations.js';
import { StockLot } from '../models/StockLot.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthContext } from '../types/express.js';
import { requireOwned } from './access.service.js';
import { recordAudit } from './audit.service.js';
import { organizationCurrency } from './catalog.service.js';

const EXPENSE_CATEGORIES = ['medicines', 'consumables', 'delivery', 'handling', 'equipment', 'maintenance', 'other'] as const;

async function nextNumber(organizationId: string) {
  const year = new Date().getUTCFullYear();
  const count = await PharmacyExpense.countDocuments({ organizationId, number: new RegExp(`^DEP-${year}-`) });
  return `DEP-${year}-${String(count + 1).padStart(3, '0')}`;
}

function expenseDto(row: {
  id: string;
  number: string;
  category: string;
  date: Date;
  description: string;
  amount: number;
  currency: string;
  status: string;
  beneficiary?: string;
  requestedBy: { toString(): string };
  sourceType?: string;
  sourceId?: string;
}) {
  return {
    id: row.id,
    number: row.number,
    category: row.category,
    date: row.date,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    beneficiary: row.beneficiary || '',
    requestedBy: row.requestedBy.toString(),
    sourceType: row.sourceType || 'manual',
    sourceId: row.sourceId || '',
  };
}

export async function submitExpense(actor: AuthContext, organizationId: string, input: {
  category: (typeof EXPENSE_CATEGORIES)[number];
  description: string;
  amount: number;
  beneficiary?: string;
  date?: Date;
}, ip?: string) {
  const currency = await organizationCurrency(organizationId);
  if (input.amount <= 0) throw new ApiError(400, 'Montant invalide', 'VALIDATION_ERROR');
  const row = await PharmacyExpense.create({
    organizationId,
    number: await nextNumber(organizationId),
    category: input.category,
    date: input.date || new Date(),
    description: input.description.trim(),
    amount: input.amount,
    currency,
    beneficiary: input.beneficiary?.trim() || '',
    status: 'requested',
    requestedBy: actor.id,
    sourceType: 'manual',
  });
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'EXPENSE_REQUESTED',
    resourceType: 'pharmacy_expense', resourceId: row.id, success: true, ip,
  });
  return expenseDto(row);
}

export async function listExpenses(organizationId: string, mine?: string) {
  const filter: Record<string, unknown> = { organizationId };
  if (mine) filter.requestedBy = mine;
  const rows = await PharmacyExpense.find(filter).sort({ createdAt: -1 }).limit(100);
  return rows.map((row) => expenseDto(row));
}

export async function reviewExpense(
  actor: AuthContext,
  organizationId: string,
  id: string,
  decision: 'approve' | 'reject',
  ip?: string
) {
  const row = await requireOwned(PharmacyExpense, id, organizationId, actor, 'pharmacy_expense', ip);
  if (String(row.requestedBy) === actor.id) {
    throw new ApiError(403, 'Vous ne pouvez pas valider votre propre dépense', 'SELF_APPROVAL');
  }
  if (row.status !== 'requested') throw new ApiError(409, 'Cette dépense est déjà traitée', 'EXPENSE_LOCKED');
  row.status = decision === 'approve' ? 'approved' : 'rejected';
  row.approvedBy = actor.id;
  await row.save();
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'EXPENSE_REVIEWED',
    resourceType: 'pharmacy_expense', resourceId: id, success: true, ip, metadata: { decision },
  });
  return expenseDto(row);
}

export async function payExpense(actor: AuthContext, organizationId: string, id: string, paymentMethod: 'cash' | 'card' | 'transfer' | 'other', ip?: string) {
  const row = await requireOwned(PharmacyExpense, id, organizationId, actor, 'pharmacy_expense', ip);
  if (row.status === 'paid') return expenseDto(row);
  if (row.status !== 'approved' && row.status !== 'committed') {
    throw new ApiError(409, 'La dépense doit être approuvée avant le paiement', 'EXPENSE_LOCKED');
  }
  row.status = 'paid';
  row.paymentMethod = paymentMethod;
  row.paidBy = actor.id;
  await row.save();
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'EXPENSE_PAID',
    resourceType: 'pharmacy_expense', resourceId: id, success: true, ip,
  });
  return expenseDto(row);
}

export async function paySupplierInvoice(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const invoice = await requireOwned(SupplierInvoice, id, organizationId, actor, 'supplier_invoice', ip);
  const existing = await PharmacyExpense.findOne({ organizationId, sourceType: 'supplier_invoice', sourceId: invoice.id, status: 'paid' });
  if (existing) return { expense: expenseDto(existing), invoice: invoiceDto(invoice) };
  const due = invoice.amount - invoice.paidAmount;
  if (due <= 0) throw new ApiError(409, 'Facture déjà soldée', 'INVOICE_SETTLED');
  const expense = await PharmacyExpense.create({
    organizationId,
    number: await nextNumber(organizationId),
    category: 'medicines',
    date: new Date(),
    description: `Règlement facture fournisseur ${invoice.supplierName || ''}`.trim(),
    amount: due,
    currency: invoice.currency,
    beneficiary: invoice.supplierName || '',
    status: 'paid',
    paymentMethod: 'transfer',
    requestedBy: actor.id,
    approvedBy: actor.id,
    paidBy: actor.id,
    sourceType: 'supplier_invoice',
    sourceId: invoice.id,
  });
  invoice.paidAmount = invoice.amount;
  invoice.status = 'paid';
  await invoice.save();
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'SUPPLIER_INVOICE_PAID',
    resourceType: 'supplier_invoice', resourceId: id, success: true, ip,
  });
  return { expense: expenseDto(expense), invoice: invoiceDto(invoice) };
}

function invoiceDto(row: { id: string; supplierName?: string; amount: number; paidAmount: number; currency: string; status: string; orderId: { toString(): string } }) {
  return {
    id: row.id,
    orderId: row.orderId.toString(),
    supplierName: row.supplierName || '',
    amount: row.amount,
    paidAmount: row.paidAmount,
    currency: row.currency,
    status: row.status,
  };
}

export async function listSupplierInvoices(organizationId: string) {
  const rows = await SupplierInvoice.find({ organizationId }).sort({ createdAt: -1 });
  return rows.map((row) => invoiceDto(row));
}

export async function saveBudget(actor: AuthContext, organizationId: string, input: {
  periodStart: Date;
  periodEnd: Date;
  department?: string;
  category: string;
  amount: number;
}, ip?: string) {
  const currency = await organizationCurrency(organizationId);
  const row = await PharmacyBudget.findOneAndUpdate(
    {
      organizationId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      department: input.department?.trim() || '',
      category: input.category,
    },
    { $set: { amount: input.amount, currency } },
    { upsert: true, new: true }
  );
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, organizationId, action: 'BUDGET_UPDATED',
    resourceType: 'pharmacy_budget', resourceId: row.id, success: true, ip,
    metadata: { amount: input.amount, category: input.category },
  });
  return {
    id: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    department: row.department,
    category: row.category,
    amount: row.amount,
    currency: row.currency,
  };
}

export async function listBudgets(organizationId: string) {
  const rows = await PharmacyBudget.find({ organizationId }).sort({ periodStart: -1 });
  return rows.map((row) => ({
    id: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    department: row.department,
    category: row.category,
    amount: row.amount,
    currency: row.currency,
  }));
}

export async function financeSummary(organizationId: string) {
  const [expenses, orders, invoices, sales, lots, budgets] = await Promise.all([
    PharmacyExpense.find({ organizationId, status: { $in: ['approved', 'committed', 'paid'] } }),
    PharmacyOrder.find({ organizationId, status: { $in: ['confirmed', 'partial'] } }),
    SupplierInvoice.find({ organizationId, status: { $in: ['open', 'partial'] } }),
    PharmacySale.find({ organizationId, settlement: 'paid' }),
    StockLot.find({ organizationId, status: 'available', quantityRemaining: { $gt: 0 } }),
    PharmacyBudget.find({ organizationId }),
  ]);
  const paid = expenses.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.amount, 0);
  const approved = expenses.filter((row) => row.status === 'approved' || row.status === 'committed').reduce((sum, row) => sum + row.amount, 0);
  const orderCommitment = orders.reduce((sum, row) => {
    const remaining = row.quantity - (row.receivedQuantity || 0);
    const unit = row.quantity > 0 ? row.totalCost / row.quantity : 0;
    return sum + remaining * unit;
  }, 0);
  const engaged = approved + orderCommitment;
  const unpaidInvoices = invoices.reduce((sum, row) => sum + (row.amount - row.paidAmount), 0);
  const salesTotal = sales.reduce((sum, row) => sum + row.total, 0);
  const stockValue = lots.reduce((sum, row) => sum + row.quantityRemaining * (row.purchasePrice || 0), 0);
  const budgetAmount = budgets.reduce((sum, row) => sum + row.amount, 0);
  const consumed = engaged + paid;
  return {
    stockValue,
    engaged,
    paid,
    unpaidInvoices,
    salesTotal,
    budgetAmount,
    remaining: budgetAmount - consumed,
    alert: budgetAmount > 0 && consumed > budgetAmount ? 'exceeded' : budgetAmount > 0 && consumed >= budgetAmount * 0.8 ? 'warning' : 'ok',
  };
}
