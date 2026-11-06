import mongoose, { Schema } from 'mongoose';

const historySchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, maxlength: 40 },
    at: { type: Date, required: true, default: Date.now },
    reason: { type: String, trim: true, maxlength: 500 },
    changes: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const nursingCareSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    nurseId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['medication', 'injection', 'infusion', 'dressing', 'sample', 'monitoring', 'hygiene', 'assistance', 'other'],
      required: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    prescriptionId: { type: Schema.Types.ObjectId, ref: 'Prescription' },
    prescriptionItemId: { type: Schema.Types.ObjectId },
    medication: { type: String, trim: true, maxlength: 160 },
    prescribedDose: { type: String, trim: true, maxlength: 80 },
    administrationRoute: { type: String, trim: true, maxlength: 80 },
    scheduledAt: { type: Date, required: true, index: true },
    performedAt: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'not_done', 'cancelled'],
      default: 'pending',
      required: true,
    },
    observations: { type: String, trim: true, maxlength: 2000 },
    notDoneReason: { type: String, trim: true, maxlength: 500 },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true }
);

nursingCareSchema.index({ organizationId: 1, patientId: 1, scheduledAt: -1 });
nursingCareSchema.index({ organizationId: 1, status: 1, scheduledAt: 1 });

export const NursingCare = mongoose.model('NursingCare', nursingCareSchema);
