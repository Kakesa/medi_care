import mongoose, { Schema } from 'mongoose';

const wardSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    floor: { type: Number, required: true, min: 0, max: 40 },
    department: { type: String, required: true, trim: true, maxlength: 80 },
  },
  { timestamps: true }
);

wardSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const Ward = mongoose.model('Ward', wardSchema);
