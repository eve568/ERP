import mongoose from 'mongoose';
import { getDatabaseState } from '../../config/database.js';
import { Expense } from '../../models/expense.model.js';
import { Income } from '../../models/income.model.js';
import { Payment } from '../../models/payment.model.js';
import { AppError } from '../../utils/errors.js';

const models = { incomes: Income, expenses: Expense, payments: Payment };

function ensureDatabase() {
  if (getDatabaseState() !== 'connected') throw new AppError('El servicio financiero no está disponible', 503);
}

function companyFor(user, requestedCompanyId) {
  const companyId = user.role === 'ADMIN' ? requestedCompanyId : user.companyId;
  if (!companyId || !mongoose.isValidObjectId(companyId)) throw new AppError('companyId no es válido', 400);
  if (user.role !== 'ADMIN' && requestedCompanyId && requestedCompanyId !== user.companyId) throw new AppError('No tienes acceso a esta empresa', 403);
  return companyId;
}

function getModel(resource) {
  if (!models[resource]) throw new AppError('Recurso financiero no soportado', 400);
  return models[resource];
}

export async function createFinancialRecord(resource, payload, user) {
  ensureDatabase();
  const companyId = companyFor(user, payload.companyId);
  const Model = getModel(resource);
  return Model.create({ ...payload, companyId, userId: user.sub, responsibleId: user.sub });
}

export async function listFinancialRecords(resource, query, user) {
  ensureDatabase();
  const companyId = companyFor(user, query.companyId);
  const Model = getModel(resource);
  const filter = { companyId };
  if (query.status) filter.status = query.status;
  return Model.find(filter).sort({ date: -1, createdAt: -1 }).limit(100).lean();
}