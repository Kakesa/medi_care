import { z } from 'zod';
import { objectIdSchema } from './common.js';

const empty = z.object({}).optional().default({});
const paramsId = z.object({ id: objectIdSchema });

function envelope(body: z.ZodTypeAny, query: z.ZodTypeAny = empty, params: z.ZodTypeAny = empty) {
  return z.object({ body, query, params });
}

const line = z.object({
  productId: objectIdSchema,
  quantity: z.coerce.number().int().min(1),
  reason: z.string().max(300).optional(),
  lotId: objectIdSchema.optional(),
});

export const purchaseRequestSchema = envelope(z.object({
  priority: z.enum(['low', 'normal', 'urgent']).optional(),
  note: z.string().max(500).optional(),
  lines: z.array(line.pick({ productId: true, quantity: true, reason: true })).min(1).max(30),
}));

export const requestDecisionSchema = envelope(
  z.object({
    decision: z.enum(['approve', 'reject', 'return']),
    note: z.string().max(500).optional(),
  }),
  empty,
  paramsId
);

export const receiveOrderSchema = envelope(
  z.object({
    quantity: z.coerce.number().int().min(1),
    lotNumber: z.string().min(1).max(80),
    expiresAt: z.coerce.date().optional(),
    purchasePrice: z.coerce.number().min(0).optional(),
    idempotencyKey: z.string().min(4).max(80),
  }),
  empty,
  paramsId
);

export const supplierSchema = envelope(z.object({
  name: z.string().min(1).max(160),
  contactName: z.string().max(160).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().max(160).optional(),
  address: z.string().max(300).optional(),
  taxId: z.string().max(80).optional(),
  paymentTerms: z.string().max(160).optional(),
  leadDays: z.coerce.number().int().min(0).optional(),
}));

export const saleSchema = envelope(z.object({
  kind: z.enum(['counter', 'dispense', 'ward']),
  settlement: z.enum(['paid', 'invoiced', 'internal']),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'insurance']).optional(),
  patientId: objectIdSchema.optional(),
  wardName: z.string().max(80).optional(),
  idempotencyKey: z.string().min(4).max(80),
  lines: z.array(line.pick({ productId: true, quantity: true, lotId: true })).min(1).max(30),
}));

export const expenseSchema = envelope(z.object({
  category: z.enum(['medicines', 'consumables', 'delivery', 'handling', 'equipment', 'maintenance', 'other']),
  description: z.string().min(1).max(300),
  amount: z.coerce.number().positive(),
  beneficiary: z.string().max(160).optional(),
}));

export const expenseDecisionSchema = envelope(
  z.object({ decision: z.enum(['approve', 'reject']) }),
  empty,
  paramsId
);

export const expensePaySchema = envelope(
  z.object({ paymentMethod: z.enum(['cash', 'card', 'transfer', 'other']) }),
  empty,
  paramsId
);

export const budgetSchema = envelope(z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  department: z.string().max(80).optional(),
  category: z.string().min(1).max(80),
  amount: z.coerce.number().min(0),
}));

export const movementSchema = envelope(z.object({
  productId: objectIdSchema,
  quantity: z.coerce.number().int().min(1),
  type: z.enum(['loss', 'ward_issue']),
  reason: z.string().min(3).max(300),
  idempotencyKey: z.string().min(4).max(80),
  lotId: objectIdSchema.optional(),
}));

export const pharmacyParamsSchema = envelope(empty, empty, paramsId);

const importRow = z.object({
  name: z.string().min(1).max(160),
  genericName: z.string().max(160).optional(),
  sku: z.string().max(40).optional(),
  barcode: z.string().max(40).optional(),
  category: z.string().min(1).max(80),
  dosage: z.string().max(80).optional(),
  form: z.string().max(40).optional(),
  packaging: z.string().max(80).optional(),
  unit: z.string().min(1).max(40),
  storageUnit: z.string().max(40).optional(),
  saleUnit: z.string().max(40).optional(),
  unitFactor: z.coerce.number().positive().max(100000).optional(),
  price: z.coerce.number().min(0),
  purchasePrice: z.coerce.number().min(0).optional(),
  quantity: z.coerce.number().int().min(0).optional(),
  minStock: z.coerce.number().int().min(0).optional(),
  maxStock: z.coerce.number().int().min(0).optional(),
  alertStock: z.coerce.number().int().min(0).optional(),
  location: z.string().max(80).optional(),
  description: z.string().max(500).optional(),
  supplier: z.string().max(160).optional(),
});

export const importProductsSchema = envelope(z.object({
  rows: z.array(importRow).min(1).max(100),
}));
