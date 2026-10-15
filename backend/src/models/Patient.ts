import mongoose, { Schema } from 'mongoose';

const patientSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    linkedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    primaryDoctorId: { type: Schema.Types.ObjectId, ref: 'User' },
    careTeamIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, lowercase: true, trim: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 30 },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['M', 'F'] },
    address: { type: String, trim: true, maxlength: 300 },
    bloodType: { type: String, trim: true, maxlength: 8 },
    allergies: [{ type: String, trim: true, maxlength: 80 }],
    status: {
      type: String,
      enum: ['outpatient', 'hospitalized', 'discharged'],
      default: 'outpatient',
      required: true,
    },
    room: { type: String, trim: true, maxlength: 40 },
    admissionDate: { type: Date },
    dischargeDate: { type: Date },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

patientSchema.index({ organizationId: 1, lastName: 1, firstName: 1 });
patientSchema.index({ organizationId: 1, archivedAt: 1 });
patientSchema.index({ linkedUserId: 1 }, { unique: true, sparse: true });

export const Patient = mongoose.model('Patient', patientSchema);
