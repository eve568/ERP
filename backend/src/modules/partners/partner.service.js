import mongoose from 'mongoose';
import { getDatabaseState } from '../../config/database.js';
import { Company } from '../../models/company.model.js';
import { Customer } from '../../models/customer.model.js';
import { Supplier } from '../../models/supplier.model.js';
import { AppError } from '../../utils/errors.js';
import { sendCustomerWelcomeEmail } from '../email/email.service.js';

const models = { customers: Customer, suppliers: Supplier };

function ensureDatabase() {
  if (getDatabaseState() !== 'connected') throw new AppError('El servicio no está disponible', 503);
}

function ensureObjectId(value, fieldName) {
  if (!mongoose.isValidObjectId(value)) throw new AppError(`${fieldName} no es válido`, 400);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveCompanyId(requestedCompanyId, user) {
  const companyId = user.role === 'ADMIN' ? requestedCompanyId : user.companyId;
  if (!companyId) {
    throw new AppError(
      user.role === 'ADMIN'
        ? 'Selecciona una empresa activa antes de continuar'
        : 'Tu usuario no tiene una empresa asignada',
      400
    );
  }
  ensureObjectId(companyId, 'companyId');
  if (user.role !== 'ADMIN' && requestedCompanyId && requestedCompanyId !== user.companyId) {
    throw new AppError('No tienes acceso a esta empresa', 403);
  }
  return companyId;
}

function getModel(resource) {
  const model = models[resource];
  if (!model) throw new AppError('Recurso no soportado', 400);
  return model;
}

export async function createPartner(resource, payload, user) {
  ensureDatabase();
  const Model = getModel(resource);
  const companyId = resolveCompanyId(payload.companyId, user);
  if (!(await Company.exists({ _id: companyId }))) throw new AppError('Empresa no encontrada', 404);
  try {
    const item = await Model.create({ ...payload, companyId });

    if (resource === 'customers' && item.email) {
      const company = await Company.findById(companyId).select('name').lean();
      sendCustomerWelcomeEmail({
        to: item.email,
        customerName: item.name,
        companyName: company?.name
      }).catch((error) => {
        console.error('No fue posible enviar la confirmación de registro del cliente:', error.message);
      });
    }

    return item;
  } catch (error) {
    if (error.code === 11000) throw new AppError('El RFC ya está registrado en esta empresa', 409);
    throw error;
  }
}

export async function listPartners(resource, query, user) {
  ensureDatabase();
  const Model = getModel(resource);
  const companyId = resolveCompanyId(query.companyId, user);
  const page = Math.max(Number.parseInt(query.page ?? '1', 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit ?? '20', 10) || 20, 1), 100);
  const filter = { companyId };
  if (query.status) filter.status = query.status;
  if (query.q?.trim()) {
    const expression = new RegExp(escapeRegex(query.q.trim()), 'i');
    filter.$or = [{ name: expression }, { taxId: expression }, { email: expression }];
  }
  const [items, total] = await Promise.all([
    Model.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Model.countDocuments(filter)
  ]);
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function updatePartner(resource, id, changes, user) {
  ensureDatabase();
  const Model = getModel(resource);
  ensureObjectId(id, 'id');
  const current = await Model.findById(id).lean();
  if (!current) throw new AppError('Registro no encontrado', 404);
  const companyId = resolveCompanyId(current.companyId.toString(), user);
  if (changes.companyId && changes.companyId !== companyId) throw new AppError('No puedes cambiar la empresa del registro', 400);
  try {
    return await Model.findOneAndUpdate({ _id: id, companyId }, { ...changes, companyId }, { new: true, runValidators: true }).lean();
  } catch (error) {
    if (error.code === 11000) throw new AppError('El RFC ya está registrado en esta empresa', 409);
    throw error;
  }
}

export async function deactivatePartner(resource, id, user) {
  return updatePartner(resource, id, { status: 'INACTIVE' }, user);
}