import mongoose, { Schema } from 'mongoose';

const appointmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientName: { type: String, required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Personnel', required: true },
    doctorName: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    duration: { type: Number, required: true, min: 5 },
    type: { type: String, enum: ['consultation', 'followup', 'exam', 'emergency'], required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },
    requestedBy: { type: String, enum: ['staff', 'patient'], default: 'staff' },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

appointmentSchema.index({ organizationId: 1, doctorId: 1, date: 1 });
appointmentSchema.index({ organizationId: 1, patientId: 1, date: 1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
