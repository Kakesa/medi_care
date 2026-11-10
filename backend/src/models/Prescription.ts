import mongoose, { Schema } from 'mongoose';

const itemSchema = new Schema(
  {
    medication: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    posology: { type: String, required: true, trim: true },
    administrationRoute: { type: String, trim: true, maxlength: 80 },
    duration: { type: String, required: true, trim: true },
    treatmentStartDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    treatmentEndDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    administrationTimes: [{ type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ }],
    treatmentStatus: { type: String, enum: ['active', 'suspended', 'completed', 'interrupted'], default: 'active', required: true },
    treatmentStatusHistory: {
      type: [{
        status: { type: String, enum: ['active', 'suspended', 'completed', 'interrupted'], required: true },
        changedAt: { type: Date, required: true },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        reason: { type: String, required: true, trim: true, maxlength: 500 },
      }],
      default: [],
    },
    instructions: { type: String, trim: true, default: '' },
    quantityPrescribed: { type: Number, required: true, min: 1 },
    quantityDispensed: { type: Number, required: true, min: 0, default: 0 },
    unavailable: { type: Boolean, default: false },
    unavailableNote: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const prescriptionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientName: { type: String, required: true },
    prescriberId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    prescriberName: { type: String, required: true },
    examId: { type: Schema.Types.ObjectId, ref: 'Exam' },
    items: { type: [itemSchema], required: true },
    status: { type: String, enum: ['draft', 'validated'], default: 'draft' },
    pharmacyStatus: { type: String, enum: ['new', 'preparing', 'partial', 'delivered', 'closed'], default: 'new' },
    validatedAt: { type: Date },
    history: {
      type: [{
        at: Date,
        userName: String,
        action: String,
        comment: String,
      }],
      default: [],
    },
  },
  { timestamps: true }
);

prescriptionSchema.index({ organizationId: 1, pharmacyStatus: 1, createdAt: -1 });

export const Prescription = mongoose.model('Prescription', prescriptionSchema);
