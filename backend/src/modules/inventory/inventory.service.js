import mongoose from 'mongoose';
import { getDatabaseState } from '../../config/database.js';
import { Branch } from '../../models/branch.model.js';
import { Company } from '../../models/company.model.js';
import { Inventory } from '../../models/inventory.model.js';
import { InventoryMovement } from '../../models/inventory-movement.model.js';
import { Product } from '../../models/product.model.js';
import { Warehouse } from '../../models/warehouse.model.js';
import { AppError } from '../../utils/errors.js';

function ensureDatabase() {
  if (getDatabaseState() !== 'connected') throw new AppError('El servicio de inventario no está disponible', 503);
}

function ensureObjectId(value, fieldName) {
  if (!mongoose.isValidObjectId(value)) throw new AppError(`${fieldName} no es válido`, 400);
}

function companyFor(user, requestedCompanyId) {
  const companyId = user.role === 'ADMIN' ? requestedCompanyId : user.companyId;
  if (!companyId) throw new AppError('companyId es obligatorio', 400);
  ensureObjectId(companyId, 'companyId');
  if (user.role !== 'ADMIN' && requestedCompanyId && requestedCompanyId !== user.companyId) throw new AppError('No tienes acceso a esta empresa', 403);
  return companyId;
}

async function ensureWarehouseAccess(warehouseId, user) {
  ensureObjectId(warehouseId, 'warehouseId');
  const warehouse = await Warehouse.findById(warehouseId).lean();
  if (!warehouse) throw new AppError('Almacén no encontrado', 404);
  companyFor(user, warehouse.companyId.toString());
  return warehouse;
}

export async function createWarehouse(payload, user) {
  ensureDatabase();
  const companyId = companyFor(user, payload.companyId);
  ensureObjectId(payload.branchId, 'branchId');
  if (!(await Company.exists({ _id: companyId }))) throw new AppError('Empresa no encontrada', 404);
  if (!(await Branch.exists({ _id: payload.branchId, companyId }))) throw new AppError('Sucursal no encontrada en esta empresa', 400);
  try {
    return await Warehouse.create({ ...payload, companyId });
  } catch (error) {
    if (error.code === 11000) throw new AppError('El almacén ya existe en esta empresa', 409);
    throw error;
  }
}

export async function listWarehouses(query, user) {
  ensureDatabase();
  const companyId = companyFor(user, query.companyId);
  const filter = { companyId };
  if (query.branchId) {
    ensureObjectId(query.branchId, 'branchId');
    filter.branchId = query.branchId;
  }
  return Warehouse.find(filter).sort({ name: 1 }).lean();
}

export async function createMovement(payload, user) {
  ensureDatabase();
  const warehouse = await ensureWarehouseAccess(payload.warehouseId, user);
  ensureObjectId(payload.productId, 'productId');
  const product = await Product.findOne({ _id: payload.productId, companyId: warehouse.companyId }).lean();
  if (!product) throw new AppError('Producto no encontrado en esta empresa', 404);
  if (payload.type === 'SALE' && payload.quantity > (await Inventory.findOne({ warehouseId: warehouse._id, productId: product._id }).lean())?.quantity) {
    throw new AppError('Existencia insuficiente', 409);
  }

  const session = await mongoose.startSession();
  try {
    let movement;
    await session.withTransaction(async () => {
      const sign = ['SALE'].includes(payload.type) ? -1 : 1;
      const current = await Inventory.findOne({ warehouseId: warehouse._id, productId: product._id }).session(session);
      const quantity = (current?.quantity ?? 0) + sign * payload.quantity;
      if (quantity < 0) throw new AppError('Existencia insuficiente', 409);
      await Inventory.findOneAndUpdate(
        { warehouseId: warehouse._id, productId: product._id },
        { $set: { companyId: warehouse.companyId, quantity, minimumStock: product.minimumStock, maximumStock: product.maximumStock } },
        { upsert: true, new: true, session }
      );
      [movement] = await InventoryMovement.create([{ ...payload, companyId: warehouse.companyId, userId: user.sub }], { session });
    });
    return movement;
  } finally {
    await session.endSession();
  }
}

export async function listInventory(query, user) {
  ensureDatabase();
  const companyId = companyFor(user, query.companyId);
  const filter = { companyId };
  if (query.warehouseId) filter.warehouseId = query.warehouseId;
  if (query.productId) filter.productId = query.productId;
  return Inventory.find(filter).populate('productId', 'sku name').populate('warehouseId', 'name').sort({ quantity: 1 }).lean();
}

export async function listMovements(query, user) {
  ensureDatabase();
  const companyId = companyFor(user, query.companyId);
  const filter = { companyId };
  if (query.warehouseId) filter.warehouseId = query.warehouseId;
  if (query.productId) filter.productId = query.productId;
  return InventoryMovement.find(filter).sort({ createdAt: -1 }).limit(100).lean();
}