import mongoose from 'mongoose';
import { getDatabaseState } from '../../config/database.js';
import { Company } from '../../models/company.model.js';
import { AppError } from '../../utils/errors.js';

function ensureDatabase() {
  if (getDatabaseState() !== 'connected') {
    throw new AppError('El servicio de empresas no está disponible', 503);
  }
}

function ensureObjectId(value, fieldName) {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(`${fieldName} no es válido`, 400);
  }
}

export async function createCompany(payload) {
  ensureDatabase();
  try {
    return await Company.create(payload);
  } catch (error) {
    if (error.code === 11000) throw new AppError('El RFC ya está registrado', 409);
    throw error;
  }
}

export async function listCompanies(user) {
  ensureDatabase();
  const filter = user.role === 'ADMIN' ? {} : { _id: user.companyId };
  if (user.role !== 'ADMIN') ensureObjectId(user.companyId, 'companyId');
  return Company.find(filter).sort({ name: 1 }).lean();
}

export async function getCompany(id, user) {
  ensureDatabase();
  ensureObjectId(id, 'id');
  if (user.role !== 'ADMIN' && user.companyId !== id) {
    throw new AppError('No tienes acceso a esta empresa', 403);
  }
  const company = await Company.findById(id).lean();
  if (!company) throw new AppError('Empresa no encontrada', 404);
  return company;
}

export async function updateCompany(id, changes, user) {
  ensureDatabase();
  ensureObjectId(id, 'id');
  if (user.role !== 'ADMIN') throw new AppError('No tienes permisos para modificar empresas', 403);
  try {
    const company = await Company.findByIdAndUpdate(id, changes, { new: true, runValidators: true }).lean();
    if (!company) throw new AppError('Empresa no encontrada', 404);
    return company;
  } catch (error) {
    if (error.code === 11000) throw new AppError('El RFC ya está registrado', 409);
    throw error;
  }
}