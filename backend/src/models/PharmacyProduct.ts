import mongoose, { Schema } from 'mongoose';

const productSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    genericName: { type: String, trim: true, default: '' },
    sku: { type: String, trim: true, uppercase: true, default: '' },
    barcode: { type: String, trim: true, default: '' },
    category: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['medication', 'consumable', 'device'], default: 'medication' },
    form: { type: String, trim: true, default: '' },
    dosage: { type: String, trim: true, default: '' },
    packaging: { type: String, trim: true, default: '' },
    quantity: { type: Number, required: true, min: 0 },
    reservedQuantity: { type: Number, required: true, min: 0, default: 0 },
    minStock: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true },
    storageUnit: { type: String, trim: true, default: '' },
    saleUnit: { type: String, trim: true, default: '' },
    price: { type: Number, required: true, min: 0 },
    purchasePrice: { type: Number, min: 0, default: 0 },
    averageCost: { type: Number, min: 0, default: 0 },
    currency: { type: String, enum: ['EUR', 'CDF', 'USD'], default: 'EUR' },
    prescriptionRequired: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    expiryDate: { type: Date },
    supplier: { type: String, trim: true, default: '' },
    primarySupplierId: { type: Schema.Types.ObjectId, ref: 'PharmacySupplier' },
    status: { type: String, enum: ['in_stock', 'low_stock', 'out_of_stock'], required: true },
    lastRestocked: { type: Date },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

productSchema.index({ organizationId: 1, name: 1 });
productSchema.index({ organizationId: 1, sku: 1 }, { unique: true, partialFilterExpression: { sku: { $gt: '' } } });

export const PharmacyProduct = mongoose.model('PharmacyProduct', productSchema);
