import mongoose, { Schema } from 'mongoose';

const shiftTemplateSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  ward: { type: String, required: true, trim: true, maxlength: 80 },
  requiredNurses: { type: Number, required: true, min: 1, max: 30 },
  active: { type: Boolean, default: true, required: true },
}, { timestamps: true });

shiftTemplateSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const ShiftTemplate = mongoose.model('ShiftTemplate', shiftTemplateSchema);
