import mongoose, { Schema } from 'mongoose';

const historySchema = new Schema(
  {
    at: { type: Date, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String, required: true },
    action: { type: String, required: true },
    from: { type: String, default: '' },
    to: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const patientChargeSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    patientName: { type: String, required: true },
    originModule: {
      type: String,
      enum: ['acts', 'consultation', 'exam', 'pharmacy', 'hospitalization'],
      required: true,
    },
    originId: { type: String, required: true },
    catalogKind: { type: String, enum: ['surgery', 'service', 'pharmacy'], required: true },
    catalogItemId: { type: Schema.Types.ObjectId },
    label: { type: String, required: true },
    detail: { type: String, default: '' },
    category: { type: String, required: true },
    unit: { type: String, default: 'acte' },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['EUR', 'CDF', 'USD'], required: true },
    prescriberId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    prescriberName: { type: String, required: true },
    prescribedAt: { type: Date, required: true },
    realizationStatus: {
      type: String,
      enum: ['recommended', 'pending', 'performed', 'cancelled'],
      default: 'recommended',
      required: true,
    },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    invoiceItemId: { type: Schema.Types.ObjectId },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true }
);

patientChargeSchema.index({ organizationId: 1, originModule: 1, originId: 1 }, { unique: true });
patientChargeSchema.index({ organizationId: 1, patientId: 1, prescribedAt: -1 });

export const PatientCharge = mongoose.model('PatientCharge', patientChargeSchema);
