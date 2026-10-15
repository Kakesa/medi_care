import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 80 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 160 },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', required: true },
    /**
     * Réservé à une évolution abonnements. Aucune limite n'est appliquée pour l'instant.
     */
    plan: {
      type: String,
      enum: ['unconfigured', 'free', 'starter', 'professional', 'enterprise'],
      default: 'unconfigured',
      required: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

organizationSchema.index({ status: 1, name: 1 });

export type OrganizationDocument = InferSchemaType<typeof organizationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Organization = mongoose.model('Organization', organizationSchema);
