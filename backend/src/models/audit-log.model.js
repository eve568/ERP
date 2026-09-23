import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
  action: { type: String, required: true, trim: true },
  module: { type: String, required: true, trim: true },
  recordId: mongoose.Schema.Types.ObjectId,
  timestamp: { type: Date, default: Date.now, index: true },
  changes: mongoose.Schema.Types.Mixed
}, { versionKey: false });

export const AuditLog = mongoose.models.AuditLog ?? mongoose.model('AuditLog', auditLogSchema, 'audit_logs');