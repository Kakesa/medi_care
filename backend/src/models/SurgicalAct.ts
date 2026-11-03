import mongoose, { Schema } from 'mongoose';
import { BILLING_CURRENCIES } from '../domain/billingCategories.js';

const surgicalActSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'SurgicalCategory', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    nameKey: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    billingCategory: { type: String, trim: true, uppercase: true, maxlength: 40, default: 'CHIRURGIE' },
    priceMinor: { type: Number, min: 0 },
    currency: { type: String, enum: BILLING_CURRENCIES },
    active: { type: Boolean, default: true, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

surgicalActSchema.index({ organizationId: 1, nameKey: 1 }, { unique: true });
surgicalActSchema.index({ organizationId: 1, active: 1, name: 1 });

export const SurgicalAct = mongoose.model('SurgicalAct', surgicalActSchema);
