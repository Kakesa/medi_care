import mongoose, { Schema } from 'mongoose';

const analysisAlertSchema = new Schema(
  {
    code: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const itemAnalysisSchema = new Schema(
  {
    rawText: { type: String, trim: true, default: '' },
    medicationName: { type: String, trim: true, default: '' },
    dosageAmount: { type: Number, default: null },
    dosageUnit: { type: String, trim: true, default: '' },
    form: { type: String, trim: true, default: '' },
    formUnit: { type: String, trim: true, default: '' },
    quantityMarked: { type: Number, default: null },
    dosePerDay: { type: Number, default: null },
    durationDays: { type: Number, default: null },
    quantityFromPosology: { type: Number, default: null },
    quantityProposed: { type: Number, default: null },
    quantityValidated: { type: Number, default: null },
    posologyText: { type: String, trim: true, default: '' },
    instructions: { type: String, trim: true, default: '' },
    confidence: { type: String, enum: ['high', 'medium', 'low'], default: 'low' },
    needsPharmacistValidation: { type: Boolean, default: true },
    alerts: { type: [analysisAlertSchema], default: [] },
    matchedProductId: { type: Schema.Types.ObjectId, ref: 'PharmacyProduct', default: null },
    matchedProductName: { type: String, trim: true, default: '' },
    matchConfidence: { type: String, enum: ['high', 'medium', 'low', 'none'], default: 'none' },
    matchCandidates: {
      type: [{ id: { type: String, required: true }, name: { type: String, required: true } }],
      default: [],
    },
    unitPrice: { type: Number, default: null },
    lineTotal: { type: Number, default: null },
    billable: { type: Boolean, default: false },
    validationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'needs_review'],
      default: 'pending',
    },
    analyzedAt: { type: Date },
  },
  { _id: false },
);

const itemSchema = new Schema(
  {
    medication: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    posology: { type: String, required: true, trim: true },
    administrationRoute: { type: String, trim: true, maxlength: 80 },
    form: { type: String, trim: true, maxlength: 40 },
    frequency: { type: String, trim: true, maxlength: 80 },
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
    analysis: { type: itemAnalysisSchema, default: undefined },
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
    consultationId: { type: Schema.Types.ObjectId, ref: 'Consultation' },
    recommendations: { type: String, trim: true, maxlength: 2000, default: '' },
    items: { type: [itemSchema], required: true },
    status: { type: String, enum: ['draft', 'validated'], default: 'draft' },
    pharmacyStatus: { type: String, enum: ['new', 'preparing', 'partial', 'delivered', 'closed'], default: 'new' },
    quoteStatus: { type: String, enum: ['none', 'pending_review', 'ready', 'partial'], default: 'none' },
    quoteTotal: { type: Number, default: 0 },
    quoteCurrency: { type: String, enum: ['EUR', 'CDF', 'USD'], default: 'EUR' },
    quotePendingLines: { type: Number, default: 0 },
    quotedAt: { type: Date },
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
prescriptionSchema.index({ organizationId: 1, consultationId: 1 }, { unique: true, sparse: true });

export const Prescription = mongoose.model('Prescription', prescriptionSchema);
