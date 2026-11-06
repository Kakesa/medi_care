import mongoose, { Schema } from 'mongoose';

const nursingSettingsSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
    systolicMin: { type: Number, required: true },
    systolicMax: { type: Number, required: true },
    diastolicMin: { type: Number, required: true },
    diastolicMax: { type: Number, required: true },
    temperatureMin: { type: Number, required: true },
    temperatureMax: { type: Number, required: true },
    heartRateMin: { type: Number, required: true },
    heartRateMax: { type: Number, required: true },
    respiratoryRateMin: { type: Number, required: true },
    respiratoryRateMax: { type: Number, required: true },
    oxygenSaturationMin: { type: Number, required: true },
    glucoseMin: { type: Number, required: true },
    glucoseMax: { type: Number, required: true },
  },
  { timestamps: true }
);

export const NursingSettings = mongoose.model('NursingSettings', nursingSettingsSchema);
