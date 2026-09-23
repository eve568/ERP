import mongoose from 'mongoose';
import { getDatabaseState } from '../../config/database.js';
import { Branch } from '../../models/branch.model.js';
import { Company } from '../../models/company.model.js';
import { AppError } from '../../utils/errors.js';

function ensureDatabase() {
  if (getDatabaseState() !== 'connected') {
    throw new AppError('El servicio de sucursales no está disponible', 503);
  }
}

function ensureObjectId(value, fieldName) {
  if (!mongoose.isValidObjectId(value)) throw new AppError(`${fieldName} no es válido`, 400);
}

function ensureCompanyAccess(companyId, user) {
  ensureObjectId(companyId, 'companyId');
  if (user.role !== 'ADMIN' && user.companyId !== companyId) {
    throw new AppError('No tienes acceso a esta empresa', 403);
  }
}

export async function createBranch(payload, user) {
  ensureDatabase();
  ensureCompanyAccess(payload.companyId, user);
  if (!(await Company.exists({ _id: payload.companyId }))) throw new AppError('Empresa no encontrada', 404);
  try {
    return await Branch.create(payload);
  } catch (error) {
    if (error.code === 11000) throw new AppError('La sucursal ya existe en esta empresa', 409);
    throw error;
  }
}

export async function listBranches(companyId, user) {
  ensureDatabase();
  ensureCompanyAccess(companyId, user);
  return Branch.find({ companyId }).sort({ name: 1 }).lean();
}

export async function updateBranch(id, changes, user) {
  ensureDatabase();
  ensureObjectId(id, 'id');
  const branch = await Branch.findById(id).lean();
  if (!branch) throw new AppError('Sucursal no encontrada', 404);
  ensureCompanyAccess(branch.companyId.toString(), user);
  const updated = await Branch.findByIdAndUpdate(id, changes, { new: true, runValidators: true }).lean();
  return updated;
}