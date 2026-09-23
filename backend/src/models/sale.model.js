import mongoose from 'mongoose';

const saleLineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 0.0001 },
  price: { type: Number, required: true, min: 0 },
  subtotal: { type: Number, required: true, min: 0 }
}, { _id: false });

const saleSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: { type: [saleLineSchema], required: true, validate: (items) => items.length > 0 },
  subtotal: { type: Number, required: true, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ['CASH', 'CARD', 'TRANSFER', 'CREDIT'], required: true },
  status: { type: String, enum: ['DRAFT', 'PENDING', 'CONFIRMED', 'PAID', 'CANCELLED'], default: 'DRAFT', required: true }
}, { timestamps: true, versionKey: false });

saleSchema.index({ companyId: 1, createdAt: -1 });

export const Sale = mongoose.models.Sale ?? mongoose.model('Sale', saleSchema);