import mongoose from 'mongoose';

const incomeSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
  concept: { type: String, required: true, trim: true, maxlength: 240 },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  paymentMethod: { type: String, enum: ['CASH', 'CARD', 'TRANSFER', 'CREDIT'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: false });

export const Income = mongoose.models.Income ?? mongoose.model('Income', incomeSchema);