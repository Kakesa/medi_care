import mongoose, { Schema } from 'mongoose';

const surgicalCategorySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nameKey: { type: String, required: true, trim: true, maxlength: 80 },
    billingCategory: { type: String, trim: true, uppercase: true, maxlength: 40, default: 'CHIRURGIE' },
    active: { type: Boolean, default: true, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

surgicalCategorySchema.index({ organizationId: 1, nameKey: 1 }, { unique: true });

export const SurgicalCategory = mongoose.model('SurgicalCategory', surgicalCategorySchema);
