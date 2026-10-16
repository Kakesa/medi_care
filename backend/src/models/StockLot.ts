import mongoose, { Schema } from 'mongoose';

const lotSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'PharmacyProduct', required: true, index: true },
    lotNumber: { type: String, required: true, trim: true, maxlength: 80 },
    warehouse: { type: String, required: true, trim: true, default: 'principal', maxlength: 80 },
    supplierName: { type: String, trim: true, default: '' },
    supplierId: { type: Schema.Types.ObjectId, ref: 'PharmacySupplier' },
    receivedAt: { type: Date, required: true },
    manufacturedAt: { type: Date },
    expiresAt: { type: Date },
    quantityReceived: { type: Number, required: true, min: 0 },
    quantityRemaining: { type: Number, required: true, min: 0 },
    purchasePrice: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, enum: ['EUR', 'CDF', 'USD'], default: 'EUR' },
    receiptDocument: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['available', 'blocked', 'expired', 'depleted'], default: 'available', required: true },
  },
  { timestamps: true }
);

lotSchema.index({ organizationId: 1, productId: 1, lotNumber: 1, warehouse: 1 }, { unique: true });

export const StockLot = mongoose.model('StockLot', lotSchema);
