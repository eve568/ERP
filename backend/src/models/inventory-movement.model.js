import mongoose from 'mongoose';

const inventoryMovementSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
  type: { type: String, enum: ['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER', 'RETURN'], required: true },
  quantity: {
    type: Number,
    required: true,
    validate: {
      validator(value) {
        return this.type === 'ADJUSTMENT'
          ? Number.isFinite(value) && value !== 0
          : Number.isFinite(value) && value > 0;
      },
      message: 'La cantidad debe ser positiva; los ajustes aceptan diferencias negativas distintas de 0'
    }
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, trim: true, maxlength: 300 },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

inventoryMovementSchema.index({ companyId: 1, createdAt: -1 });

export const InventoryMovement = mongoose.models.InventoryMovement ?? mongoose.model('InventoryMovement', inventoryMovementSchema, 'inventory_movements');