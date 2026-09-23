import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
  concept: { type: String, required: true, trim: true, maxlength: 240 },
  category: { type: String, required: true, trim: true, maxlength: 100 },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  responsibleId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['PENDING', 'PAID', 'CANCELLED'], default: 'PENDING', required: true }
}, { timestamps: true, versionKey: false });

export const Expense = mongoose.models.Expense ?? mongoose.model('Expense', expenseSchema);