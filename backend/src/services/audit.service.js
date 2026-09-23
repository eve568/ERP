import mongoose from 'mongoose';
import { getDatabaseState } from '../config/database.js';
import { AuditLog } from '../models/audit-log.model.js';

const ignoredFields = new Set(['password', 'passwordHash', 'token', 'authorization']);

function sanitizeChanges(value) {
  if (!value || typeof value !== 'object') return undefined;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !ignoredFields.has(key)));
}

export function recordAudit({ userId, companyId, action, module, recordId, changes }) {
  if (getDatabaseState() !== 'connected' || !mongoose.isValidObjectId(userId)) return;
  const entry = {
    userId,
    companyId: mongoose.isValidObjectId(companyId) ? companyId : undefined,
    action,
    module,
    recordId: mongoose.isValidObjectId(recordId) ? recordId : undefined,
    changes: sanitizeChanges(changes)
  };
  AuditLog.create(entry).catch((error) => console.error('No se pudo registrar auditoría:', error.message));
}