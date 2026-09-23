import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  legalName: { type: String, required: true, trim: true, maxlength: 200 },
  taxId: { type: String, required: true, uppercase: true, trim: true, maxlength: 30 },
  address: { type: String, trim: true, maxlength: 300 },
  phone: { type: String, trim: true, maxlength: 30 },
  email: { type: String, lowercase: true, trim: true, maxlength: 160 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true }
}, { timestamps: true, versionKey: false });

companySchema.index({ taxId: 1 }, { unique: true });

export const Company = mongoose.models.Company ?? mongoose.model('Company', companySchema);