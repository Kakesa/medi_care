import mongoose, { Schema } from 'mongoose';

const bedStaySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    bedId: { type: Schema.Types.ObjectId, ref: 'Bed', required: true, index: true },
    bedNumber: { type: String, required: true, trim: true },
    wardName: { type: String, required: true, trim: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    patientName: { type: String, required: true, trim: true },
    admissionDate: { type: Date, required: true },
    dischargeDate: { type: Date },
    status: { type: String, enum: ['active', 'completed'], required: true },
  },
  { timestamps: true }
);

bedStaySchema.index({ organizationId: 1, admissionDate: -1 });

export const BedStay = mongoose.model('BedStay', bedStaySchema);
