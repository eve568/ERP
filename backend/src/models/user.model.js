import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 80 },
  lastName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone: { type: String, trim: true, maxlength: 30 },
  passwordHash: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ['ADMIN', 'GERENTE', 'VENTAS', 'COMPRAS', 'ALMACEN', 'FINANZAS', 'RRHH', 'EMPLEADO'],
    default: 'EMPLEADO',
    required: true
  },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true }
}, { timestamps: true, versionKey: false });

export const User = mongoose.models.User ?? mongoose.model('User', userSchema);