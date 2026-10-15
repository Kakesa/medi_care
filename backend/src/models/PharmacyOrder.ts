import mongoose, { Schema } from 'mongoose';

const orderSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'PharmacyProduct', required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    supplier: { type: String, trim: true, default: '' },
    orderDate: { type: Date, required: true },
    expectedDelivery: { type: Date },
    status: { type: String, enum: ['pending', 'confirmed', 'delivered', 'cancelled'], default: 'pending' },
    totalCost: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
    stockApplied: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const PharmacyOrder = mongoose.model('PharmacyOrder', orderSchema);
