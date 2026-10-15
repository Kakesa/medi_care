import mongoose, { Schema } from 'mongoose';

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    action: { type: String, required: true },
    resourceType: { type: String },
    resourceId: { type: String },
    ip: { type: String },
    success: { type: Boolean, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
