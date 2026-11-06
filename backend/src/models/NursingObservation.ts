import mongoose, { Schema } from 'mongoose';

const nursingObservationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    nurseId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    observedAt: { type: Date, required: true, default: Date.now },
    content: { type: String, required: true, trim: true, maxlength: 3000 },
  },
  { timestamps: true }
);

nursingObservationSchema.index({ organizationId: 1, patientId: 1, observedAt: -1 });

export const NursingObservation = mongoose.model('NursingObservation', nursingObservationSchema);
