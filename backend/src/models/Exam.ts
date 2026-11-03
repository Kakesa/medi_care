import mongoose, { Schema } from 'mongoose';

const examSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientName: { type: String, required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Personnel', required: true },
    doctorName: { type: String, required: true },
    type: { type: String, enum: ['laboratory', 'imaging', 'biopsy', 'other'], required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
    results: { type: String, trim: true },
    files: { type: [String], default: [] },
    notes: { type: String, trim: true },
    labStatus: {
      type: String,
      enum: ['EN_ATTENTE', 'EN_COURS', 'BROUILLON', 'EN_ATTENTE_VALIDATION', 'CORRECTION_DEMANDEE', 'VALIDE', 'REJETE', 'ANNULE'],
    },
    draftResults: { type: String, trim: true, default: '' },
    technicalNotes: { type: String, trim: true, default: '' },
    attachments: {
      type: [{
        name: { type: String, required: true },
        mimeType: { type: String, required: true },
        data: { type: String, required: true },
      }],
      default: [],
    },
    versions: {
      type: [{
        version: Number,
        results: String,
        technicalNotes: String,
        submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        submittedByName: String,
        submittedAt: Date,
        decision: String,
        decisionByName: String,
        decisionAt: Date,
        comment: String,
      }],
      default: [],
    },
    history: {
      type: [{
        at: Date,
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        userName: String,
        action: String,
        from: String,
        to: String,
        comment: String,
      }],
      default: [],
    },
  },
  { timestamps: true }
);

examSchema.index({ organizationId: 1, status: 1, date: -1 });
examSchema.index({ organizationId: 1, patientId: 1 });

export const Exam = mongoose.model('Exam', examSchema);
