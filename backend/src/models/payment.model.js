import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  referenceType: { type: String, enum: ['SALE', 'PURCHASE', 'EXPENSE'], required: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, enum: ['CASH', 'CARD', 'TRANSFER', 'CREDIT'], required: true },
  date: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['PENDING', 'COMPLETED', 'CANCELLED'], default: 'COMPLETED', required: true }
}, { timestamps: true, versionKey: false });

paymentSchema.index({ companyId: 1, referenceType: 1, referenceId: 1 });

export const Payment = mongoose.models.Payment ?? mongoose.model('Payment', paymentSchema);