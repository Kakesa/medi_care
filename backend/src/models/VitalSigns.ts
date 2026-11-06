import mongoose, { Schema } from 'mongoose';

const vitalSignsSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    measuredAt: { type: Date, required: true, index: true },
    systolic: { type: Number, min: 40, max: 300 },
    diastolic: { type: Number, min: 20, max: 200 },
    temperature: { type: Number, min: 25, max: 45 },
    heartRate: { type: Number, min: 20, max: 300 },
    respiratoryRate: { type: Number, min: 1, max: 100 },
    oxygenSaturation: { type: Number, min: 0, max: 100 },
    weight: { type: Number, min: 0.1, max: 500 },
    height: { type: Number, min: 20, max: 300 },
    glucose: { type: Number, min: 0, max: 1000 },
    observation: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

vitalSignsSchema.index({ organizationId: 1, patientId: 1, measuredAt: -1 });

export const VitalSigns = mongoose.model('VitalSigns', vitalSignsSchema);
