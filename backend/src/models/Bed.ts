import mongoose, { Schema } from 'mongoose';

const bedSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    wardId: { type: Schema.Types.ObjectId, ref: 'Ward', required: true, index: true },
    number: { type: String, required: true, trim: true, maxlength: 20 },
    type: {
      type: String,
      enum: ['standard', 'intensive_care', 'pediatric', 'maternity', 'isolation'],
      required: true,
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'maintenance', 'reserved'],
      default: 'available',
      required: true,
    },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    patientName: { type: String, trim: true, maxlength: 180 },
    admissionDate: { type: Date },
    expectedDischarge: { type: Date },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

bedSchema.index({ organizationId: 1, number: 1 }, { unique: true });

export const Bed = mongoose.model('Bed', bedSchema);
