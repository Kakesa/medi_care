import mongoose, { Schema } from 'mongoose';

const consultationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientName: { type: String, required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Personnel', required: true },
    doctorName: { type: String, required: true },
    date: { type: Date, required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    symptoms: { type: [String], default: [] },
    diagnosis: { type: String, required: true },
    treatment: { type: String, trim: true },
    prescription: { type: String, trim: true },
    notes: { type: String, trim: true },
    followUpDate: { type: Date },
    status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
  },
  { timestamps: true }
);

consultationSchema.index({ organizationId: 1, doctorId: 1, date: -1 });
consultationSchema.index({ organizationId: 1, patientId: 1, date: -1 });

export const Consultation = mongoose.model('Consultation', consultationSchema);
