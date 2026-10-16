import mongoose, { Schema } from 'mongoose';

const saleLineSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'PharmacyProduct', required: true },
    productName: { type: String, required: true },
    lotId: { type: Schema.Types.ObjectId, ref: 'StockLot', required: true },
    lotNumber: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    number: { type: String, required: true },
    kind: { type: String, enum: ['counter', 'dispense', 'ward'], required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    patientName: { type: String, trim: true, default: '' },
    wardName: { type: String, trim: true, default: '' },
    lines: { type: [saleLineSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['EUR', 'CDF', 'USD'], default: 'EUR' },
    settlement: { type: String, enum: ['paid', 'invoiced', 'internal'], required: true },
    paymentMethod: { type: String, enum: ['cash', 'card', 'transfer', 'insurance'] },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    idempotencyKey: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

saleSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true });
saleSchema.index({ organizationId: 1, number: 1 }, { unique: true });

export const PharmacySale = mongoose.model('PharmacySale', saleSchema);

const expenseSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    number: { type: String, required: true },
    category: {
      type: String,
      enum: ['medicines', 'consumables', 'delivery', 'handling', 'equipment', 'maintenance', 'other'],
      required: true,
    },
    date: { type: Date, required: true },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['EUR', 'CDF', 'USD'], required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'PharmacySupplier' },
    beneficiary: { type: String, trim: true, default: '' },
    reference: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['requested', 'approved', 'committed', 'paid', 'rejected'], default: 'requested' },
    paymentMethod: { type: String, enum: ['cash', 'card', 'transfer', 'other'] },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
    sourceType: { type: String, trim: true, default: 'manual' },
    sourceId: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

expenseSchema.index({ organizationId: 1, number: 1 }, { unique: true });
expenseSchema.index({ organizationId: 1, sourceType: 1, sourceId: 1 });

export const PharmacyExpense = mongoose.model('PharmacyExpense', expenseSchema);

const budgetSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    department: { type: String, trim: true, default: '' },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['EUR', 'CDF', 'USD'], required: true },
  },
  { timestamps: true }
);

budgetSchema.index({ organizationId: 1, periodStart: 1, periodEnd: 1, department: 1, category: 1 }, { unique: true });

export const PharmacyBudget = mongoose.model('PharmacyBudget', budgetSchema);
