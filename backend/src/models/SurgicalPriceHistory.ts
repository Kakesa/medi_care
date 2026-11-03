import mongoose, { Schema } from 'mongoose';
import { BILLING_CURRENCIES } from '../domain/billingCategories.js';

const surgicalPriceHistorySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    actId: { type: Schema.Types.ObjectId, ref: 'SurgicalAct', required: true, index: true },
    previousMinor: { type: Number, default: null },
    previousCurrency: { type: String, enum: BILLING_CURRENCIES, default: null },
    nextMinor: { type: Number, required: true, min: 0 },
    nextCurrency: { type: String, enum: BILLING_CURRENCIES, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

surgicalPriceHistorySchema.index({ organizationId: 1, actId: 1, createdAt: -1 });

export const SurgicalPriceHistory = mongoose.model('SurgicalPriceHistory', surgicalPriceHistorySchema);
