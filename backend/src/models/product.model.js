import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  sku: { type: String, required: true, uppercase: true, trim: true, maxlength: 60 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 500 },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  purchasePrice: { type: Number, required: true, min: 0 },
  salePrice: { type: Number, required: true, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  minimumStock: { type: Number, default: 0, min: 0 },
  maximumStock: { type: Number, min: 0 },
  unit: { type: String, required: true, trim: true, maxlength: 30 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true }
}, { timestamps: true, versionKey: false });

productSchema.index({ companyId: 1, sku: 1 }, { unique: true });
productSchema.index({ companyId: 1, name: 1 });

export const Product = mongoose.models.Product ?? mongoose.model('Product', productSchema);