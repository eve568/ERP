import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  minimumStock: { type: Number, min: 0, default: 0 },
  maximumStock: { type: Number, min: 0 }
}, { timestamps: true, versionKey: false });

inventorySchema.index({ warehouseId: 1, productId: 1 }, { unique: true });

export const Inventory = mongoose.models.Inventory ?? mongoose.model('Inventory', inventorySchema);