import mongoose from 'mongoose';

const purchaseLineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 0.0001 },
  price: { type: Number, required: true, min: 0 },
  subtotal: { type: Number, required: true, min: 0 }
}, { _id: false });

const purchaseSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: { type: [purchaseLineSchema], required: true, validate: (items) => items.length > 0 },
  subtotal: { type: Number, required: true, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['DRAFT', 'PENDING', 'RECEIVED', 'CANCELLED'], default: 'DRAFT', required: true }
}, { timestamps: true, versionKey: false });

purchaseSchema.index({ companyId: 1, createdAt: -1 });

export const Purchase = mongoose.models.Purchase ?? mongoose.model('Purchase', purchaseSchema);