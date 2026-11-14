import mongoose, { Schema } from 'mongoose';

const shiftCycleSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  workDays: { type: Number, required: true, min: 1, max: 31 },
  restDays: { type: Number, required: true, min: 1, max: 31 },
  active: { type: Boolean, default: true, required: true },
}, { timestamps: true });

shiftCycleSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const ShiftCycle = mongoose.model('ShiftCycle', shiftCycleSchema);
