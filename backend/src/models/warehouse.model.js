import mongoose from 'mongoose';

const warehouseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  address: { type: String, trim: true, maxlength: 300 },
  responsible: { type: String, trim: true, maxlength: 160 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true }
}, { timestamps: true, versionKey: false });

warehouseSchema.index({ companyId: 1, name: 1 }, { unique: true });

export const Warehouse = mongoose.models.Warehouse ?? mongoose.model('Warehouse', warehouseSchema);