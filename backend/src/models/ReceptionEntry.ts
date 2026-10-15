import mongoose, { Schema } from 'mongoose';

const receptionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientName: { type: String, required: true },
    arrivalTime: { type: String, required: true },
    reason: { type: String, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    status: {
      type: String,
      enum: ['waiting', 'in_consultation', 'completed', 'cancelled'],
      default: 'waiting',
    },
    assignedDoctor: { type: String, trim: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Personnel' },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

receptionSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

export const ReceptionEntry = mongoose.model('ReceptionEntry', receptionSchema);
