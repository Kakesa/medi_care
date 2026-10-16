import mongoose, { Schema } from 'mongoose';

export const MOVEMENT_TYPES = [
  'purchase_receipt',
  'sale',
  'dispense',
  'ward_issue',
  'sale_return',
  'supplier_return',
  'transfer',
  'loss',
  'expiry',
  'inventory_adjustment',
  'correction',
] as const;

const movementSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'PharmacyProduct', required: true, index: true },
    lotId: { type: Schema.Types.ObjectId, ref: 'StockLot' },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    direction: { type: String, enum: ['in', 'out'], required: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true },
    warehouseFrom: { type: String, trim: true, default: '' },
    warehouseTo: { type: String, trim: true, default: '' },
    occurredAt: { type: Date, required: true },
    reason: { type: String, trim: true, default: '' },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sourceType: { type: String, trim: true, default: '' },
    sourceId: { type: String, trim: true, default: '' },
    quantityBefore: { type: Number, required: true },
    quantityAfter: { type: Number, required: true },
    lotQuantityBefore: { type: Number },
    lotQuantityAfter: { type: Number },
    status: { type: String, enum: ['pending', 'validated', 'rejected'], default: 'validated', required: true },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 120 },
    validatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    validatedAt: { type: Date },
  },
  { timestamps: true }
);

movementSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true });

export const StockMovement = mongoose.model('StockMovement', movementSchema);
