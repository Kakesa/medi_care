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

const medicationAdministrationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    prescriptionId: { type: Schema.Types.ObjectId, ref: 'Prescription', required: true },
    prescriptionItemId: { type: Schema.Types.ObjectId, required: true },
    medication: { type: String, required: true, trim: true, maxlength: 160 },
    prescribedDose: { type: String, required: true, trim: true, maxlength: 80 },
    administrationRoute: { type: String, required: true, trim: true, maxlength: 80 },
    posology: { type: String, required: true, trim: true, maxlength: 160 },
    instructions: { type: String, trim: true, maxlength: 500, default: '' },
    scheduledAt: { type: Date, required: true, index: true },
    administeredAt: { type: Date },
    administeredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['pending', 'administered_on_time', 'administered_late', 'not_administered', 'patient_refused', 'suspended', 'treatment_completed', 'treatment_interrupted'],
      default: 'pending',
      required: true,
    },
    observations: { type: String, trim: true, maxlength: 2000 },
    notDoneReason: { type: String, trim: true, maxlength: 500 },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true }
);

medicationAdministrationSchema.index(
  { organizationId: 1, prescriptionId: 1, prescriptionItemId: 1, scheduledAt: 1 },
  { unique: true }
);
medicationAdministrationSchema.index({ organizationId: 1, patientId: 1, scheduledAt: -1 });

export const MedicationAdministration = mongoose.model('MedicationAdministration', medicationAdministrationSchema);