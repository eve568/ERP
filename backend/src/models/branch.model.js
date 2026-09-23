import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  address: { type: String, trim: true, maxlength: 300 },
  phone: { type: String, trim: true, maxlength: 30 },
  manager: { type: String, trim: true, maxlength: 160 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true }
}, { timestamps: true, versionKey: false });

branchSchema.index({ companyId: 1, name: 1 }, { unique: true });

export const Branch = mongoose.models.Branch ?? mongoose.model('Branch', branchSchema);