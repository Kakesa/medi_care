import mongoose, { Schema } from 'mongoose';
import { BILLING_CURRENCIES, BILLING_UNITS } from '../domain/billingCategories.js';

const billableServiceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    category: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    unitPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: BILLING_CURRENCIES, required: true },
    unit: { type: String, enum: BILLING_UNITS, default: 'acte', required: true },
    department: { type: String, trim: true, maxlength: 80, default: '' },
    active: { type: Boolean, default: true, required: true },
    effectiveFrom: { type: Date, required: true },
    billingRule: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

billableServiceSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export const BillableService = mongoose.model('BillableService', billableServiceSchema);
