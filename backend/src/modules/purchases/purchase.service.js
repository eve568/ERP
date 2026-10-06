import mongoose from 'mongoose';
import { getDatabaseState } from '../../config/database.js';
import { Branch } from '../../models/branch.model.js';
import { Inventory } from '../../models/inventory.model.js';
import { InventoryMovement } from '../../models/inventory-movement.model.js';
import { Product } from '../../models/product.model.js';
import { Purchase } from '../../models/purchase.model.js';
import { Supplier } from '../../models/supplier.model.js';
import { Warehouse } from '../../models/warehouse.model.js';
import { AppError } from '../../utils/errors.js';

function ensureDatabase() {
  if (getDatabaseState() !== 'connected') {
    throw new AppError('El servicio de compras no está disponible', 503);
  }
}

function ensureObjectId(value, fieldName) {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(`${fieldName} no es válido`, 400);
  }
}

function companyFor(user, requestedCompanyId) {
  const companyId =
    user.role === 'ADMIN' ? requestedCompanyId : user.companyId;
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
  if (branch.status !== 'ACTIVE') {
    throw new AppError('La sucursal seleccionada está inactiva', 409);
  }
}

async function ensureSupplier(supplierId, companyId, session) {
  ensureObjectId(supplierId, 'supplierId');
  let query = Supplier.findOne({
    _id: supplierId,
    companyId,
    status: 'ACTIVE',
  });
  if (session) query = query.session(session);
  const supplier = await query.lean();
  if (!supplier) {
    throw new AppError('Proveedor no encontrado o inactivo en esta empresa', 404);
  }
  return supplier;
}

async function ensureProducts(items, companyId, session) {
  const products = new Map();
  for (const item of items) {
    ensureObjectId(item?.productId, 'productId');
    if (
      typeof item.quantity !== 'number' ||
      !Number.isFinite(item.quantity) ||
      item.quantity < 0.0001
    ) {
      throw new AppError('Cada cantidad debe ser al menos 0.0001', 400);
    }
    if (
      item.price !== undefined &&
      (typeof item.price !== 'number' ||
        !Number.isFinite(item.price) ||
        item.price < 0)
    ) {
      throw new AppError('Cada costo unitario debe ser un número mayor o igual a 0', 400);
    }
    const key = String(item.productId);
    const quantity = (products.get(key)?.quantity ?? 0) + item.quantity;
    if (!Number.isFinite(quantity)) {
      throw new AppError('La cantidad total del producto no es válida', 400);
    }
    products.set(key, { quantity, product: null });
  }

  for (const [productId, value] of products) {
    let query = Product.findOne({
      _id: productId,
      companyId,
      status: 'ACTIVE',
    });
    if (session) query = query.session(session);
    const product = await query.lean();
    if (!product) {
      throw new AppError('Producto no encontrado o inactivo en esta empresa', 404);
    }
    value.product = product;
  }
  return products;
}

function calculateItems(items, products) {
  const consolidated = new Map();
  for (const item of items) {
    const key = String(item.productId);
    const price = item.price ?? products.get(key)?.product.purchasePrice;
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
      throw new AppError('El costo unitario del producto no es válido', 400);
    }
    const current = consolidated.get(key);
    if (current && current.price !== price) {
      throw new AppError(
        'No se puede consolidar el mismo producto con costos unitarios diferentes',
        400
      );
    }
    if (current) current.quantity += item.quantity;
    else consolidated.set(key, { ...item, price, quantity: item.quantity });
  }

  const saleItems = [...consolidated.values()].map((item) => {
    const product = products.get(String(item.productId))?.product;
    const subtotal = Math.round(item.quantity * item.price * 100) / 100;
    return {
      productId: product._id,
      quantity: item.quantity,
      price: item.price,
      subtotal,
    };
  });
  const subtotal =
    Math.round(saleItems.reduce((sum, item) => sum + item.subtotal, 0) * 100) /
    100;
  return { items: saleItems, subtotal, tax: 0, discount: 0, total: subtotal };
}

async function ensureWarehouse(warehouseId, companyId, user) {
  ensureObjectId(warehouseId, 'warehouseId');
  const warehouse = await Warehouse.findOne({
    _id: warehouseId,
    companyId,
    status: 'ACTIVE',
  }).lean();
  if (!warehouse) {
    throw new AppError('Almacén no encontrado o inactivo en esta empresa', 404);
  }
  const branch = await Branch.findOne({
    _id: warehouse.branchId,
    companyId,
  }).lean();
  if (!branch) {
    throw new AppError('La sucursal del almacén no pertenece a esta empresa', 400);
  }
  ensureBranchAccess(branch, user);
  return warehouse;
}

async function addInventoryAndRecord(purchase, warehouse, user, session) {
  for (const item of purchase.items) {
    await Inventory.findOneAndUpdate(
      {
        companyId: purchase.companyId,
        warehouseId: warehouse._id,
        productId: item.productId,
      },
      {
        $setOnInsert: {
          companyId: purchase.companyId,
          warehouseId: warehouse._id,
          productId: item.productId,
        },
        $inc: { quantity: item.quantity },
      },
      { upsert: true, new: true, session, runValidators: true }
    );
    await InventoryMovement.create(
      [
        {
          companyId: purchase.companyId,
          productId: item.productId,
          warehouseId: warehouse._id,
          type: 'PURCHASE',
          quantity: item.quantity,
          userId: user.sub,
          referenceId: purchase._id,
        },
      ],
      { session }
    );
  }
}

export async function createPurchase(payload, user) {
  ensureDatabase();
  const companyId = companyFor(user, payload.companyId);
  if (!Array.isArray(payload.items) || !payload.items.length) {
    throw new AppError('Agrega al menos un producto a la compra', 400);
  }

  if (!payload.warehouseId) {
    await ensureSupplier(payload.supplierId, companyId);
    const products = await ensureProducts(payload.items, companyId);
    const totals = calculateItems(payload.items, products);
    return Purchase.create({
      companyId,
      supplierId: payload.supplierId,
      userId: user.sub,
      ...totals,
      status: 'DRAFT',
    });
  }

  const warehouse = await ensureWarehouse(payload.warehouseId, companyId, user);
  const session = await mongoose.startSession();
  try {
    let purchase;
    await session.withTransaction(async () => {
      await ensureSupplier(payload.supplierId, companyId, session);
      const products = await ensureProducts(payload.items, companyId, session);
      const totals = calculateItems(payload.items, products);
      [purchase] = await Purchase.create(
        [
          {
            companyId,
            supplierId: payload.supplierId,
            warehouseId: warehouse._id,
            userId: user.sub,
            ...totals,
            status: 'RECEIVED',
          },
        ],
        { session }
      );
      await addInventoryAndRecord(purchase, warehouse, user, session);
    });
    return purchase;
  } finally {
    await session.endSession();
  }
}

export async function listPurchases(query, user) {
  ensureDatabase();
  const companyId = companyFor(user, query.companyId);
  const filter = { companyId };
  if (query.status) filter.status = query.status;
  if (query.q?.trim()) {
    const term = query.q.trim();
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const suppliers = await Supplier.find({
      companyId,
      name: new RegExp(escaped, 'i'),
    })
      .select('_id')
      .lean();
    const alternatives = [];
    if (mongoose.isValidObjectId(term)) alternatives.push({ _id: term });
    if (suppliers.length) {
      alternatives.push({
        supplierId: { $in: suppliers.map((supplier) => supplier._id) },
      });
    }
    if (alternatives.length) filter.$or = alternatives;
    else filter._id = { $in: [] };
  }
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit ?? '100', 10) || 100, 1),
    100
  );
  return Purchase.find(filter)
    .populate('supplierId', 'name taxId')
    .populate({
      path: 'warehouseId',
      select: 'name branchId',
      populate: { path: 'branchId', select: 'name' },
    })
    .populate('items.productId', 'sku name unit')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export async function getPurchase(id, query, user) {
  ensureDatabase();
  ensureObjectId(id, 'purchaseId');
  const companyId = companyFor(user, query.companyId);
  const purchase = await Purchase.findOne({ _id: id, companyId })
    .populate('supplierId', 'name taxId email phone address')
    .populate({
      path: 'warehouseId',
      select: 'name branchId',
      populate: { path: 'branchId', select: 'name' },
    })
    .populate('items.productId', 'sku name unit')
    .lean();
  if (!purchase) {
    throw new AppError('Compra no encontrada en esta empresa', 404);
  }
  return purchase;
}

export async function receivePurchase(id, warehouseId, requestedCompanyId, user) {
  ensureDatabase();
  ensureObjectId(id, 'purchaseId');
  const companyId = companyFor(user, requestedCompanyId);
  const warehouse = await ensureWarehouse(warehouseId, companyId, user);
  const session = await mongoose.startSession();
  try {
    let purchase;
    await session.withTransaction(async () => {
      const current = await Purchase.findOne({ _id: id, companyId }).session(session);
      if (!current) throw new AppError('Compra no encontrada en esta empresa', 404);
      if (!['DRAFT', 'PENDING'].includes(current.status)) {
        throw new AppError('La compra no puede recibirse en su estado actual', 409);
      }
      await ensureSupplier(current.supplierId, companyId, session);
      const products = await ensureProducts(current.items, companyId, session);
      const totals = calculateItems(current.items, products);
      current.items = totals.items;
      current.subtotal = totals.subtotal;
      current.tax = totals.tax;
      current.discount = totals.discount;
      current.total = totals.total;
      current.warehouseId = warehouse._id;
      current.status = 'RECEIVED';

      await addInventoryAndRecord(current, warehouse, user, session);
      purchase = await current.save({ session });
    });
    return purchase;
  } finally {
    await session.endSession();
  }
}
