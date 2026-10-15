import mongoose, { Schema } from 'mongoose';

const personnelSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    role: {
      type: String,
      enum: ['doctor', 'nurse', 'receptionist', 'admin', 'secretary'],
      required: true,
    },
    department: { type: String, required: true, trim: true },
    speciality: { type: String, trim: true },
    status: { type: String, enum: ['active', 'pending', 'inactive'], default: 'active' },
    hireDate: { type: Date, default: () => new Date() },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

personnelSchema.index({ organizationId: 1, lastName: 1, firstName: 1 });
personnelSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } }
);

export const Personnel = mongoose.model('Personnel', personnelSchema);
