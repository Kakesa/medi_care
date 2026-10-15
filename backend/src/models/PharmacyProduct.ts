import mongoose, { Schema } from 'mongoose';

const productSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    minStock: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    expiryDate: { type: Date },
    supplier: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['in_stock', 'low_stock', 'out_of_stock'], required: true },
    lastRestocked: { type: Date },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

productSchema.index({ organizationId: 1, name: 1 });

export const PharmacyProduct = mongoose.model('PharmacyProduct', productSchema);
