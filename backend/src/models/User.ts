import mongoose, { Schema } from 'mongoose';
import { ROLES, type UserRole } from '../config/permissions.js';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 30 },
    isActive: { type: Boolean, default: true, required: true },
    tokenVersion: { type: Number, default: 0, required: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index({ organizationId: 1, role: 1 });

userSchema.pre('validate', function (next) {
  if (this.role === ROLES.SUPERADMIN) {
    this.organizationId = null;
    next();
    return;
  }
  if (!this.organizationId) {
    next(new Error('Un utilisateur d’établissement doit être rattaché à un hôpital.'));
    return;
  }
  next();
});

export interface UserDoc {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  isActive: boolean;
  tokenVersion: number;
  organizationId?: mongoose.Types.ObjectId | null;
}

export const User = mongoose.model('User', userSchema);
