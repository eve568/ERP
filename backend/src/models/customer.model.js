import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  taxId: { type: String, uppercase: true, trim: true, maxlength: 30 },
  phone: { type: String, trim: true, maxlength: 30 },
  email: { type: String, lowercase: true, trim: true, maxlength: 160 },
  address: { type: String, trim: true, maxlength: 300 },
  city: { type: String, trim: true, maxlength: 100 },
  state: { type: String, trim: true, maxlength: 100 },
  postalCode: { type: String, trim: true, maxlength: 15 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true }
}, { timestamps: true, versionKey: false });

customerSchema.index(
  { companyId: 1, taxId: 1 },
  {
    unique: true,
    partialFilterExpression: { taxId: { $type: 'string', $gt: '' } }
  }
);
customerSchema.index({ companyId: 1, name: 1 });

export const Customer = mongoose.models.Customer ?? mongoose.model('Customer', customerSchema);