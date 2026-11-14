import mongoose, { Schema } from 'mongoose';

const historySchema = new Schema({
  at: { type: Date, required: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true, maxlength: 40 },
  reason: { type: String, default: '', maxlength: 500 },
  fromNurseId: { type: Schema.Types.ObjectId, ref: 'User' },
  toNurseId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const nurseShiftSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  nurseId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  type: { type: String, enum: ['morning', 'afternoon', 'night', 'full_day'], required: true },
  ward: { type: String, required: true, trim: true, maxlength: 80 },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'],
    default: 'scheduled',
    required: true,
  },
  absent: { type: Boolean, default: false },
  absenceReason: { type: String, default: '', maxlength: 500 },
  actualStartedAt: { type: Date },
  actualEndedAt: { type: Date },
  handoverNote: { type: String, default: '', maxlength: 2000 },
  handoverSummary: { type: String, default: '', maxlength: 4000 },
  sentReminders: { type: [String], default: [] },
  history: { type: [historySchema], default: [] },
}, { timestamps: true });

nurseShiftSchema.index({ organizationId: 1, date: 1, nurseId: 1 });

export const NurseShift = mongoose.model('NurseShift', nurseShiftSchema);
