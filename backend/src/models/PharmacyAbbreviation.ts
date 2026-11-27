import mongoose, { Schema } from 'mongoose';

const pharmacyAbbreviationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    code: { type: String, required: true, trim: true, lowercase: true, maxlength: 40 },
    meaning: { type: String, required: true, trim: true, maxlength: 120 },
    kind: {
      type: String,
      enum: ['form', 'unit', 'frequency', 'duration', 'marker', 'other'],
      required: true,
      default: 'other',
    },
    unit: { type: String, trim: true, default: '', maxlength: 80 },
    variants: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

pharmacyAbbreviationSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export const PharmacyAbbreviation = mongoose.model('PharmacyAbbreviation', pharmacyAbbreviationSchema);
