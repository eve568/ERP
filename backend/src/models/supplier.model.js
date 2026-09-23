import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  taxId: { type: String, uppercase: true, trim: true, maxlength: 30 },
  phone: { type: String, trim: true, maxlength: 30 },
  email: { type: String, lowercase: true, trim: true, maxlength: 160 },
  address: { type: String, trim: true, maxlength: 300 },
  contact: { type: String, trim: true, maxlength: 160 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true }
}, { timestamps: true, versionKey: false });

supplierSchema.index({ companyId: 1, taxId: 1 }, { unique: true, sparse: true });
supplierSchema.index({ companyId: 1, name: 1 });

export const Supplier = mongoose.models.Supplier ?? mongoose.model('Supplier', supplierSchema);