import mongoose, { Schema } from 'mongoose';

const badgeSeenSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resourceType: { type: String, enum: ['exam'], required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    marker: { type: String, required: true },
  },
  { timestamps: true }
);

badgeSeenSchema.index({ organizationId: 1, userId: 1, resourceType: 1, resourceId: 1 }, { unique: true });

export const BadgeSeen = mongoose.model('BadgeSeen', badgeSeenSchema);
