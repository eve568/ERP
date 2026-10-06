import mongoose from 'mongoose';
import { getDatabaseState } from '../../config/database.js';
import { Branch } from '../../models/branch.model.js';
import { Company } from '../../models/company.model.js';
import { Inventory } from '../../models/inventory.model.js';
import { InventoryMovement } from '../../models/inventory-movement.model.js';
import { Product } from '../../models/product.model.js';
import { Warehouse } from '../../models/warehouse.model.js';
import { AppError } from '../../utils/errors.js';

const movementTypes = ['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER', 'RETURN'];

function ensureDatabase() {
  if (getDatabaseState() !== 'connected') {
    throw new AppError('El servicio de inventario no está disponible', 503);
  }
}

function ensureObjectId(value, fieldName) {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(`${fieldName} no es válido`, 400);
  }
}

function companyFor(user, requestedCompanyId) {
  const companyId = user.role === 'ADMIN' ? requestedCompanyId : user.companyId;
  if (!companyId) throw new AppError('companyId es obligatorio', 400);
  ensureObjectId(companyId, 'companyId');
  if (
    user.role !== 'ADMIN' &&
    requestedCompanyId &&
    String(requestedCompanyId) !== String(user.companyId)
  ) {
    throw new AppError('No tienes acceso a esta empresa', 403);
  }
  return String(companyId);
}

function ensureBranchAccess(branch, user) {
  if (
    user.role !== 'ADMIN' &&
    user.branchId &&
    String(branch._id) !== String(user.branchId)
  ) {
    throw new AppError('No tienes acceso a esta sucursal', 403);
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function ensureBranch(companyId, branchId, user) {
  ensureObjectId(branchId, 'branchId');
  const branch = await Branch.findOne({ _id: branchId, companyId }).lean();
  if (!branch) throw new AppError('Sucursal no encontrada en esta empresa', 400);
  ensureBranchAccess(branch, user);
  if (branch.status !== 'ACTIVE') {
    throw new AppError('La sucursal seleccionada está inactiva', 409);
  }
  return branch;
}

async function ensureWarehouseAccess(warehouseId, user, requestedCompanyId) {
  ensureObjectId(warehouseId, 'warehouseId');
  const warehouse = await Warehouse.findById(warehouseId).lean();
  if (!warehouse) throw new AppError('Almacén no encontrado', 404);

  const companyId = companyFor(user, requestedCompanyId);
  if (String(warehouse.companyId) !== companyId) {
    throw new AppError('No tienes acceso a este almacén', 403);
  }

  const branch = await Branch.findOne({
    _id: warehouse.branchId,
    companyId,
  }).lean();
  if (!branch) throw new AppError('La sucursal del almacén no pertenece a esta empresa', 400);
  ensureBranchAccess(branch, user);
  if (branch.status !== 'ACTIVE') {
    throw new AppError('La sucursal del almacén está inactiva', 409);
  }
  if (warehouse.status !== 'ACTIVE') {
    throw new AppError('El almacén seleccionado está inactivo', 409);
  }
  return warehouse;
}

async function ensureProductAccess(productId, companyId) {
  ensureObjectId(productId, 'productId');
  const product = await Product.findOne({ _id: productId, companyId }).lean();
  if (!product) throw new AppError('Producto no encontrado en esta empresa', 404);
  return product;
}

function createSession() {
  return mongoose.startSession();
}

export async function createWarehouse(payload, user) {
  ensureDatabase();
  const companyId = companyFor(user, payload.companyId);
  if (!(await Company.exists({ _id: companyId }))) {
    throw new AppError('Empresa no encontrada', 404);
  }
  await ensureBranch(companyId, payload.branchId, user);

  try {
    return await Warehouse.create({ ...payload, companyId });
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError('El almacén ya existe en esta empresa', 409);
    }
    throw error;
  }
}

export async function listWarehouses(query, user) {
  ensureDatabase();
  const companyId = companyFor(user, query.companyId);
  const filter = { companyId };

  if (query.branchId) {
    await ensureBranch(companyId, query.branchId, user);
    filter.branchId = query.branchId;
  } else if (user.role !== 'ADMIN' && user.branchId) {
    filter.branchId = user.branchId;
  }
  if (query.status) filter.status = query.status;

  return Warehouse.find(filter)
    .populate('branchId', 'name')
    .sort({ name: 1 })
    .lean();
}

export async function createMovement(payload, user) {
  ensureDatabase();
  if (!movementTypes.includes(payload.type)) {
    throw new AppError('El tipo de movimiento no es válido', 400);
  }
  if (!Number.isFinite(payload.quantity)) {
    throw new AppError('La cantidad debe ser numérica', 400);
  }
  if (
    payload.type === 'ADJUSTMENT'
      ? payload.quantity === 0
      : payload.quantity <= 0
  ) {
    throw new AppError(
      payload.type === 'ADJUSTMENT'
        ? 'La diferencia del ajuste no puede ser 0'
        : 'La cantidad debe ser mayor a 0',
      400
    );
  }
  if (
    payload.reason !== undefined &&
    (typeof payload.reason !== 'string' || payload.reason.length > 300)
  ) {
    throw new AppError('El motivo no puede exceder 300 caracteres', 400);
  }
  if (payload.referenceId) ensureObjectId(payload.referenceId, 'referenceId');

  const companyId = companyFor(user, payload.companyId);
  const warehouse = await ensureWarehouseAccess(
    payload.warehouseId,
    user,
    companyId
  );
  const product = await ensureProductAccess(payload.productId, companyId);
  if (String(product.companyId) !== String(warehouse.companyId)) {
    throw new AppError('El producto y el almacén deben pertenecer a la misma empresa', 400);
  }

  const session = await createSession();
  try {
    let movement;
    await session.withTransaction(async () => {
      const current = await Inventory.findOne({
        companyId,
        warehouseId: warehouse._id,
        productId: product._id,
      }).session(session);

      let difference = payload.quantity;
      if (payload.type === 'SALE') difference = -payload.quantity;
      if (payload.type === 'ADJUSTMENT') difference = payload.quantity;
      const quantity = (current?.quantity ?? 0) + difference;

      if (quantity < 0) throw new AppError('Existencia insuficiente', 409);

      const minimumStock = current?.minimumStock ?? product.minimumStock ?? 0;
      const maximumStock = current?.maximumStock ?? product.maximumStock;
      await Inventory.findOneAndUpdate(
        {
          companyId,
          warehouseId: warehouse._id,
          productId: product._id,
        },
        {
          $set: {
            companyId,
            warehouseId: warehouse._id,
            productId: product._id,
            quantity,
            minimumStock,
            maximumStock,
          },
        },
        { upsert: true, new: true, runValidators: true, session }
      );

      [movement] = await InventoryMovement.create(
        [
          {
            ...payload,
            companyId,
            warehouseId: warehouse._id,
            productId: product._id,
            userId: user.sub,
          },
        ],
        { session }
      );
    });
    return movement;
  } finally {
    await session.endSession();
  }
}

async function getFilteredProductIds(companyId, query) {
  if (!query.q?.trim()) return null;
  const expression = new RegExp(escapeRegex(query.q.trim()), 'i');
  const products = await Product.find({
    companyId,
    $or: [{ name: expression }, { sku: expression }],
  })
    .select('_id')
    .lean();
  return products.map((product) => product._id);
}

async function inventoryFilter(query, user) {
  const companyId = companyFor(user, query.companyId);
  const filter = { companyId };

  if (query.warehouseId) {
    const warehouse = await ensureWarehouseAccess(
      query.warehouseId,
      user,
      companyId
    );
    filter.warehouseId = warehouse._id;
  } else if (user.role !== 'ADMIN' && user.branchId) {
    const warehouses = await Warehouse.find({
      companyId,
      branchId: user.branchId,
    })
      .select('_id')
      .lean();
    filter.warehouseId = { $in: warehouses.map((warehouse) => warehouse._id) };
  }

  if (query.branchId) {
    await ensureBranch(companyId, query.branchId, user);
    const warehouses = await Warehouse.find({
      companyId,
      branchId: query.branchId,
    })
      .select('_id')
      .lean();
    const branchWarehouseIds = warehouses.map((warehouse) => warehouse._id);
    if (filter.warehouseId && !Array.isArray(filter.warehouseId.$in)) {
      if (!branchWarehouseIds.some((id) => String(id) === String(filter.warehouseId))) {
        filter.warehouseId = { $in: [] };
      }
    } else if (filter.warehouseId?.$in) {
      filter.warehouseId.$in = filter.warehouseId.$in.filter((id) =>
        branchWarehouseIds.some((branchId) => String(branchId) === String(id))
      );
    } else {
      filter.warehouseId = { $in: branchWarehouseIds };
    }
  }

  if (query.productId) {
    await ensureProductAccess(query.productId, companyId);
    filter.productId = query.productId;
  }

  const productIds = await getFilteredProductIds(companyId, query);
  if (productIds) {
    if (filter.productId && !productIds.some((id) => String(id) === String(filter.productId))) {
      filter.productId = { $in: [] };
    } else if (filter.productId) {
      filter.productId = productIds[0];
    } else {
      filter.productId = { $in: productIds };
    }
  }

  return { companyId, filter };
}

export async function listInventory(query, user) {
  ensureDatabase();
  const { filter } = await inventoryFilter(query, user);
  return Inventory.find(filter)
    .populate('productId', 'sku name unit status minimumStock maximumStock')
    .populate({
      path: 'warehouseId',
      select: 'name branchId status',
      populate: { path: 'branchId', select: 'name' },
    })
    .sort({ quantity: 1, updatedAt: -1 })
    .lean();
}

export async function listMovements(query, user) {
  ensureDatabase();
  const { companyId, filter } = await inventoryFilter(query, user);
  const movementFilter = { companyId };
  if (filter.warehouseId) movementFilter.warehouseId = filter.warehouseId;
  if (filter.productId) movementFilter.productId = filter.productId;
  if (query.type) {
    if (!movementTypes.includes(query.type)) {
      throw new AppError('El tipo de movimiento no es válido', 400);
    }
    movementFilter.type = query.type;
  }

  const limit = Math.min(Math.max(Number.parseInt(query.limit ?? '100', 10) || 100, 1), 100);
  return InventoryMovement.find(movementFilter)
    .populate('productId', 'sku name unit')
    .populate({
      path: 'warehouseId',
      select: 'name branchId',
      populate: { path: 'branchId', select: 'name' },
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}
