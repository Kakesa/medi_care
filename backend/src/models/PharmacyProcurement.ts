import mongoose, { Schema } from 'mongoose';

const supplierSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    contactName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    taxId: { type: String, trim: true, default: '' },
    paymentTerms: { type: String, trim: true, default: '' },
    leadDays: { type: Number, min: 0, default: 0 },
    active: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

supplierSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const PharmacySupplier = mongoose.model('PharmacySupplier', supplierSchema);

const requestLineSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'PharmacyProduct', required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    reason: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const requestSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    number: { type: String, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    priority: { type: String, enum: ['low', 'normal', 'urgent'], default: 'normal' },
    status: { type: String, enum: ['submitted', 'approved', 'rejected', 'returned'], default: 'submitted' },
    lines: { type: [requestLineSchema], required: true },
    note: { type: String, trim: true, default: '' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

requestSchema.index({ organizationId: 1, number: 1 }, { unique: true });

export const PurchaseRequest = mongoose.model('PurchaseRequest', requestSchema);

const invoiceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'PharmacySupplier' },
    supplierName: { type: String, trim: true, default: '' },
    orderId: { type: Schema.Types.ObjectId, ref: 'PharmacyOrder', required: true },
    amount: { type: Number, required: true, min: 0, default: 0 },
    paidAmount: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, enum: ['EUR', 'CDF', 'USD'], default: 'EUR' },
    status: { type: String, enum: ['open', 'partial', 'paid'], default: 'open' },
  },
  { timestamps: true }
);

invoiceSchema.index({ organizationId: 1, orderId: 1 }, { unique: true });

export const SupplierInvoice = mongoose.model('SupplierInvoice', invoiceSchema);
