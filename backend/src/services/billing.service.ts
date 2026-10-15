import { Invoice } from '../models/Invoice.js';
import { Patient } from '../models/Patient.js';
import { ApiError } from '../utils/ApiError.js';
import { dateOnly, utcDayBounds } from '../utils/dates.js';
import { paginated, readPagination } from '../utils/pagination.js';
import type { AuthContext } from '../types/express.js';
import { requireOwned, requireVisiblePatient } from './access.service.js';
import { recordAudit } from './audit.service.js';

interface ItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  type?: 'consultation' | 'exam' | 'medication' | 'service';
  referenceId?: string;
}

function toInvoiceDto(row: {
  id?: string;
  _id: { toString(): string };
  invoiceNumber: string;
  patientId: { toString(): string };
  patientName: string;
  date: Date;
  dueDate: Date;
  items: Array<{
    id?: string;
    _id?: { toString(): string };
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    type?: string;
    referenceId?: string | null;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: string;
  paymentMethod?: string | null;
  paidAt?: Date | null;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}, patient?: { address?: string | null; phone?: string | null }) {
  const status = row.status === 'pending' && row.dueDate < new Date() ? 'overdue' : row.status;
  return {
    id: row.id ?? row._id.toString(),
    invoiceNumber: row.invoiceNumber,
    patientId: row.patientId.toString(),
    patientName: row.patientName,
    patientAddress: patient?.address || undefined,
    patientPhone: patient?.phone || undefined,
    items: row.items.map((item, index) => ({
      id: item.id || item._id?.toString() || `item-${index}`,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
      type: item.type || 'service',
      referenceId: item.referenceId,
    })),
    subtotal: row.subtotal,
    tax: row.tax,
    discount: row.discount,
    total: row.total,
    status,
    paymentMethod: row.paymentMethod || undefined,
    paidAt: row.paidAt,
    dueDate: dateOnly(row.dueDate),
    notes: row.notes || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function priceItems(items: ItemInput[]) {
  const priced = items.map((item) => ({
    description: item.description.trim(),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.quantity * item.unitPrice,
    type: item.type || 'service',
    referenceId: item.referenceId,
  }));
  const subtotal = priced.reduce((sum, item) => sum + item.total, 0);
  return { items: priced, subtotal, tax: 0, discount: 0, total: subtotal };
}

async function nextNumber(organizationId: string) {
  const year = new Date().getUTCFullYear();
  const count = await Invoice.countDocuments({
    organizationId,
    invoiceNumber: new RegExp(`^FAC-${year}-`),
  });
  return `FAC-${year}-${String(count + 1).padStart(3, '0')}`;
}

async function markOverdue(organizationId: string) {
  await Invoice.updateMany(
    { organizationId, status: 'pending', dueDate: { $lt: new Date() } },
    { status: 'overdue' }
  );
}

export async function billingPatients(organizationId: string) {
  const rows = await Patient.find({ organizationId, archivedAt: null })
    .select('firstName lastName')
    .sort({ lastName: 1, firstName: 1 })
    .limit(100);
  return rows.map((row) => ({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
  }));
}

export async function listInvoices(
  organizationId: string,
  query: { page?: number; limit?: number; status?: string; patientId?: string; startDate?: string; endDate?: string }
) {
  await markOverdue(organizationId);
  const { page, limit, skip } = readPagination(query);
  const filter: Record<string, unknown> = { organizationId };
  if (query.status) filter.status = query.status;
  if (query.patientId) filter.patientId = query.patientId;
  if (query.startDate || query.endDate) {
    const date: Record<string, Date> = {};
    if (query.startDate) date.$gte = utcDayBounds(query.startDate).start;
    if (query.endDate) date.$lt = utcDayBounds(query.endDate).end;
    filter.date = date;
  }
  const [rows, total] = await Promise.all([
    Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Invoice.countDocuments(filter),
  ]);
  return paginated(rows.map((row) => toInvoiceDto(row)), total, page, limit);
}

export async function getInvoice(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  await markOverdue(organizationId);
  const row = await requireOwned(Invoice, id, organizationId, actor, 'invoice', ip);
  return toInvoiceDto(row);
}

export async function createInvoice(
  actor: AuthContext,
  organizationId: string,
  input: { patientId: string; items: ItemInput[]; dueDate?: Date; notes?: string },
  ip?: string
) {
  const patient = await requireVisiblePatient(actor, organizationId, input.patientId, ip);
  const priced = priceItems(input.items);
  const due = input.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const row = await Invoice.create({
    organizationId,
    invoiceNumber: await nextNumber(organizationId),
    patientId: patient._id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    date: new Date(),
    dueDate: due,
    ...priced,
    status: 'pending',
    notes: input.notes?.trim(),
  });
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'INVOICE_CREATED',
    resourceType: 'invoice',
    resourceId: row.id,
    success: true,
    ip,
  });
  return toInvoiceDto(row, patient);
}

export async function updateInvoice(
  actor: AuthContext,
  organizationId: string,
  id: string,
  input: Partial<{ items: ItemInput[]; dueDate: Date; notes: string }>,
  ip?: string
) {
  const row = await requireOwned(Invoice, id, organizationId, actor, 'invoice', ip);
  if (row.status === 'paid') {
    throw new ApiError(409, 'Une facture payée ne peut plus être modifiée', 'INVOICE_LOCKED');
  }
  if (input.items) {
    const priced = priceItems(input.items);
    row.items = priced.items;
    row.subtotal = priced.subtotal;
    row.tax = 0;
    row.discount = 0;
    row.total = priced.total;
  }
  if (input.dueDate) row.dueDate = input.dueDate;
  if (input.notes !== undefined) row.notes = input.notes.trim();
  await row.save();
  return toInvoiceDto(row);
}

export async function payInvoice(
  actor: AuthContext,
  organizationId: string,
  id: string,
  paymentMethod: 'cash' | 'card' | 'transfer' | 'insurance',
  ip?: string
) {
  await markOverdue(organizationId);
  const row = await requireOwned(Invoice, id, organizationId, actor, 'invoice', ip);
  if (row.status === 'paid') {
    return toInvoiceDto(row);
  }
  if (row.status === 'cancelled') {
    throw new ApiError(409, 'Une facture annulée ne peut pas être encaissée', 'INVOICE_LOCKED');
  }
  row.status = 'paid';
  row.paymentMethod = paymentMethod;
  row.paidAt = new Date();
  await row.save();
  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    organizationId,
    action: 'INVOICE_PAID',
    resourceType: 'invoice',
    resourceId: id,
    success: true,
    ip,
    metadata: { paymentMethod },
  });
  return toInvoiceDto(row);
}

export async function cancelInvoice(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  const row = await requireOwned(Invoice, id, organizationId, actor, 'invoice', ip);
  if (row.status === 'paid') {
    throw new ApiError(409, 'Une facture payée ne peut pas être annulée', 'INVOICE_LOCKED');
  }
  row.status = 'cancelled';
  await row.save();
  return toInvoiceDto(row);
}

export async function deleteInvoice(actor: AuthContext, organizationId: string, id: string, ip?: string) {
  await cancelInvoice(actor, organizationId, id, ip);
}

export async function invoicesByPatient(actor: AuthContext, organizationId: string, patientId: string, ip?: string) {
  await requireVisiblePatient(actor, organizationId, patientId, ip);
  await markOverdue(organizationId);
  const rows = await Invoice.find({ organizationId, patientId }).sort({ createdAt: -1 });
  return rows.map((row) => toInvoiceDto(row));
}

export async function overdueInvoices(organizationId: string) {
  await markOverdue(organizationId);
  const rows = await Invoice.find({ organizationId, status: 'overdue' }).sort({ dueDate: 1 });
  return rows.map((row) => toInvoiceDto(row));
}

export async function invoiceStats(organizationId: string) {
  await markOverdue(organizationId);
  const rows = await Invoice.find({ organizationId, status: { $ne: 'cancelled' } });
  return {
    totalRevenue: rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.total, 0),
    pendingAmount: rows.filter((row) => row.status === 'pending').reduce((sum, row) => sum + row.total, 0),
    overdueAmount: rows.filter((row) => row.status === 'overdue').reduce((sum, row) => sum + row.total, 0),
    invoiceCount: rows.length,
  };
}

export async function generateInvoiceNumber(organizationId: string) {
  return { invoiceNumber: await nextNumber(organizationId) };
}
