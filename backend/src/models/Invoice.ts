import mongoose, { Schema } from 'mongoose';

const invoiceItemSchema = new Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    type: { type: String, default: 'service' },
    category: { type: String, trim: true, uppercase: true, maxlength: 40 },
    catalogItemId: { type: Schema.Types.ObjectId, ref: 'BillableService' },
    serviceCode: { type: String, trim: true, maxlength: 40 },
    unit: { type: String, trim: true, maxlength: 20 },
    source: { type: String, enum: ['manual', 'catalog', 'surgery', 'pharmacy'], default: 'manual' },
    surgicalActId: { type: Schema.Types.ObjectId, ref: 'SurgicalAct' },
    detail: { type: String, trim: true, maxlength: 2000 },
    referenceId: { type: String },
    chargeId: { type: Schema.Types.ObjectId, ref: 'PatientCharge' },
    prescriberName: { type: String, trim: true, maxlength: 160 },
    prescribedAt: { type: Date },
    realizationStatus: { type: String, enum: ['recommended', 'pending', 'performed', 'cancelled'] },
    originModule: { type: String, trim: true, maxlength: 40 },
  },
  { _id: true }
);

const invoiceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    invoiceNumber: { type: String, required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientName: { type: String, required: true },
    date: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    items: { type: [invoiceItemSchema], required: true },
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true, default: 0 },
    discount: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, enum: ['EUR', 'CDF', 'USD'], default: 'EUR' },
    status: { type: String, enum: ['draft', 'pending', 'paid', 'overdue', 'cancelled'], default: 'draft' },
    paymentMethod: { type: String, enum: ['cash', 'card', 'transfer', 'insurance'] },
    paymentReference: { type: String, trim: true, maxlength: 80 },
    finalizedAt: { type: Date },
    paidAt: { type: Date },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

invoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ organizationId: 1, patientId: 1 });
invoiceSchema.index({ organizationId: 1, 'items.surgicalActId': 1 });

export const Invoice = mongoose.model('Invoice', invoiceSchema);
