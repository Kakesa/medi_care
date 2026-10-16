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
    status: { type: String, enum: ['pending', 'confirmed', 'partial', 'delivered', 'cancelled'], default: 'pending' },
    totalCost: { type: Number, required: true, min: 0 },
    purchasePrice: { type: Number, min: 0, default: 0 },
    receivedQuantity: { type: Number, min: 0, default: 0 },
    requestId: { type: Schema.Types.ObjectId, ref: 'PurchaseRequest' },
    notes: { type: String, trim: true },
    stockApplied: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const PharmacyOrder = mongoose.model('PharmacyOrder', orderSchema);
