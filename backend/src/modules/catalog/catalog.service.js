import mongoose from 'mongoose';
import { getDatabaseState } from '../../config/database.js';
import { Category } from '../../models/category.model.js';
import { Company } from '../../models/company.model.js';
import { Product } from '../../models/product.model.js';
import { Supplier } from '../../models/supplier.model.js';
import { AppError } from '../../utils/errors.js';

function ensureDatabase() {
  if (getDatabaseState() !== 'connected') throw new AppError('El servicio de catálogo no está disponible', 503);
}

function ensureObjectId(value, fieldName) {
  if (!mongoose.isValidObjectId(value)) throw new AppError(`${fieldName} no es válido`, 400);
}

function companyFor(user, requestedCompanyId) {
  const companyId = user.role === 'ADMIN' ? requestedCompanyId : user.companyId;
  if (!companyId) throw new AppError(user.role === 'ADMIN' ? 'Selecciona una empresa activa antes de continuar' : 'Tu usuario no tiene una empresa asignada', 400);
  ensureObjectId(companyId, 'companyId');
  if (user.role !== 'ADMIN' && requestedCompanyId && requestedCompanyId !== user.companyId) {
    throw new AppError('No tienes acceso a esta empresa', 403);
  }
  return companyId;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function ensureReferences(companyId, payload) {
  if (!(await Company.exists({ _id: companyId }))) throw new AppError('Empresa no encontrada', 404);
  if (!(await Category.exists({ _id: payload.categoryId, companyId }))) throw new AppError('Categoría no encontrada en esta empresa', 400);
  if (payload.supplierId && !(await Supplier.exists({ _id: payload.supplierId, companyId }))) {
    throw new AppError('Proveedor no encontrado en esta empresa', 400);
  }
}

export async function createCategory(payload, user) {
  ensureDatabase();
  const companyId = companyFor(user, payload.companyId);
  if (!(await Company.exists({ _id: companyId }))) throw new AppError('Empresa no encontrada', 404);
  try {
    return await Category.create({ ...payload, companyId });
  } catch (error) {
    if (error.code === 11000) throw new AppError('La categoría ya existe en esta empresa', 409);
    throw error;
  }
}

export async function listCategories(query, user) {
  ensureDatabase();
  const companyId = companyFor(user, query.companyId);
  const filter = { companyId };
  if (query.status) filter.status = query.status;
  if (query.q?.trim()) filter.name = new RegExp(escapeRegex(query.q.trim()), 'i');

  let categories = await Category.find(filter).sort({ name: 1 }).lean();

  // Modo de pruebas: si la empresa todavía no tiene categorías y la consulta
  // no aplica filtros, crea una categoría base para permitir registrar productos.
  if (categories.length === 0 && !query.status && !query.q?.trim()) {
    const defaultCategory = await Category.findOneAndUpdate(
      { companyId, name: 'General' },
      {
        $setOnInsert: {
          companyId,
          name: 'General',
          description: 'Categoría automática para pruebas'
        },
        $set: { status: 'ACTIVE' }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    categories = [defaultCategory];
  }

  return categories;
}

export async function updateCategory(id, changes, user) {
  ensureDatabase();
  ensureObjectId(id, 'id');
  const category = await Category.findById(id).lean();
  if (!category) throw new AppError('Categoría no encontrada', 404);
  const companyId = companyFor(user, category.companyId.toString());
  return Category.findOneAndUpdate({ _id: id, companyId }, { ...changes, companyId }, { new: true, runValidators: true }).lean();
}

export async function createProduct(payload, user) {
  ensureDatabase();
  const companyId = companyFor(user, payload.companyId);
  await ensureReferences(companyId, payload);
  try {
    return await Product.create({ ...payload, companyId });
  } catch (error) {
    if (error.code === 11000) throw new AppError('El SKU ya existe en esta empresa', 409);
    throw error;
  }
}

export async function listProducts(query, user) {
  ensureDatabase();
  const companyId = companyFor(user, query.companyId);
  const page = Math.max(Number.parseInt(query.page ?? '1', 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit ?? '20', 10) || 20, 1), 100);
  const filter = { companyId };
  if (query.categoryId) {
    ensureObjectId(query.categoryId, 'categoryId');
    filter.categoryId = query.categoryId;
  }
  if (query.status) filter.status = query.status;
  if (query.q?.trim()) {
    const expression = new RegExp(escapeRegex(query.q.trim()), 'i');
    filter.$or = [{ name: expression }, { sku: expression }];
  }
  const [items, total] = await Promise.all([
    Product.find(filter).populate('categoryId', 'name').sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter)
  ]);
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function updateProduct(id, changes, user) {
  ensureDatabase();
  ensureObjectId(id, 'id');
  const product = await Product.findById(id).lean();
  if (!product) throw new AppError('Producto no encontrado', 404);
  if (user.role === 'ADMIN' && !changes.companyId) {
    throw new AppError('companyId es obligatorio', 400);
  }
  const requestedCompanyId = changes.companyId ?? product.companyId.toString();
  const companyId = companyFor(user, requestedCompanyId);
  if (product.companyId.toString() !== String(companyId)) {
    throw new AppError('No tienes acceso a este producto', 403);
  }
  if (changes.companyId && String(changes.companyId) !== String(companyId)) {
    throw new AppError('No puedes cambiar la empresa del producto', 400);
  }
  if (changes.categoryId || changes.supplierId) await ensureReferences(companyId, { ...product, ...changes });
  try {
    return await Product.findOneAndUpdate({ _id: id, companyId }, { ...changes, companyId }, { new: true, runValidators: true }).lean();
  } catch (error) {
    if (error.code === 11000) throw new AppError('El SKU ya existe en esta empresa', 409);
    throw error;
  }
}