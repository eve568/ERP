import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  description: { type: String, trim: true, maxlength: 300 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true }
}, { timestamps: true, versionKey: false });

categorySchema.index({ companyId: 1, name: 1 }, { unique: true });

export const Category = mongoose.models.Category ?? mongoose.model('Category', categorySchema);