import mongoose from 'mongoose';
import { getDatabaseState } from '../../config/database.js';
import { Branch } from '../../models/branch.model.js';
import { Customer } from '../../models/customer.model.js';
import { Inventory } from '../../models/inventory.model.js';
import { InventoryMovement } from '../../models/inventory-movement.model.js';
import { Product } from '../../models/product.model.js';
import { Sale } from '../../models/sale.model.js';
import { Warehouse } from '../../models/warehouse.model.js';
import { AppError } from '../../utils/errors.js';

const paymentMethods = ['CASH', 'CARD', 'TRANSFER', 'CREDIT'];

function ensureDatabase() {
  if (getDatabaseState() !== 'connected') {
    throw new AppError('El servicio de ventas no está disponible', 503);
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

async function ensureWarehouseAccess(warehouseId, companyId, user) {
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

function normalizeSaleItems(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new AppError('Agrega al menos un producto a la venta', 400);
  }

  const quantities = new Map();
  for (const item of items) {
    ensureObjectId(item?.productId, 'productId');
    if (
      typeof item.quantity !== 'number' ||
      !Number.isFinite(item.quantity) ||
      item.quantity < 0.0001
    ) {
      throw new AppError('Cada cantidad debe ser al menos 0.0001', 400);
    }
    const total = (quantities.get(String(item.productId)) ?? 0) + item.quantity;
    if (!Number.isFinite(total)) {
      throw new AppError('La cantidad total del producto no es válida', 400);
    }
    quantities.set(String(item.productId), total);
  }

  return [...quantities].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

function calculateSaleItems(items, products) {
  const saleItems = items.map((item) => {
    const product = products.get(String(item.productId));
    if (!product) {
      throw new AppError('Producto no encontrado o inactivo en esta empresa', 404);
    }
    const price = product.salePrice;
    const lineSubtotal = Math.round(item.quantity * price * 100) / 100;
    return {
      productId: product._id,
      quantity: item.quantity,
      price,
      subtotal: lineSubtotal,
    };
  });
  const subtotal =
    Math.round(
      saleItems.reduce((sum, item) => sum + item.subtotal, 0) * 100
    ) / 100;
  return { items: saleItems, subtotal, tax: 0, discount: 0, total: subtotal };
}

async function loadProducts(items, companyId, session) {
  const products = new Map();
  for (const item of items) {
    let query = Product.findOne({
      _id: item.productId,
      companyId,
      status: 'ACTIVE',
    });
    if (session) query = query.session(session);
    const product = await query.lean();
    if (!product) {
      throw new AppError('Producto no encontrado o inactivo en esta empresa', 404);
    }
    products.set(String(product._id), product);
  }
  return products;
}

async function validateCustomer(customerId, companyId, session) {
  ensureObjectId(customerId, 'customerId');
  let query = Customer.findOne({
    _id: customerId,
    companyId,
    status: 'ACTIVE',
  });
  if (session) query = query.session(session);
  if (!(await query.select('_id').lean())) {
    throw new AppError('Cliente no encontrado o inactivo en esta empresa', 404);
  }
}

async function deductInventoryAndRecord(sale, warehouse, user, session) {
  for (const item of sale.items) {
    const inventory = await Inventory.findOneAndUpdate(
      {
        companyId: sale.companyId,
        warehouseId: warehouse._id,
        productId: item.productId,
        quantity: { $gte: item.quantity },
      },
      { $inc: { quantity: -item.quantity } },
      { new: true, session, runValidators: true }
    );
    if (!inventory) {
      throw new AppError('Existencia insuficiente para uno o más productos', 409);
    }

    await InventoryMovement.create(
      [
        {
          companyId: sale.companyId,
          productId: item.productId,
          warehouseId: warehouse._id,
          type: 'SALE',
          quantity: item.quantity,
          userId: user.sub,
          referenceId: sale._id,
        },
      ],
      { session }
    );
  }
}

export async function createSale(payload, user) {
  ensureDatabase();
  const companyId = companyFor(user, payload.companyId);
  if (!paymentMethods.includes(payload.paymentMethod)) {
    throw new AppError('El método de pago no es válido', 400);
  }
  const items = normalizeSaleItems(payload.items);

  if (!payload.warehouseId) {
    await validateCustomer(payload.customerId, companyId);
    const products = await loadProducts(items, companyId);
    const totals = calculateSaleItems(items, products);
    return Sale.create({
      companyId,
      customerId: payload.customerId,
      userId: user.sub,
      ...totals,
      paymentMethod: payload.paymentMethod,
      status: 'DRAFT',
    });
  }

  const warehouse = await ensureWarehouseAccess(
    payload.warehouseId,
    companyId,
    user
  );
  const session = await mongoose.startSession();
  try {
    let sale;
    await session.withTransaction(async () => {
      await validateCustomer(payload.customerId, companyId, session);
      const products = await loadProducts(items, companyId, session);
      const totals = calculateSaleItems(items, products);
      [sale] = await Sale.create(
        [
          {
            companyId,
            customerId: payload.customerId,
            warehouseId: warehouse._id,
            userId: user.sub,
            ...totals,
            paymentMethod: payload.paymentMethod,
            status: 'CONFIRMED',
          },
        ],
        { session }
      );
      await deductInventoryAndRecord(sale, warehouse, user, session);
    });
    return sale;
  } finally {
    await session.endSession();
  }
}

export async function listSales(query, user) {
  ensureDatabase();
  const companyId = companyFor(user, query.companyId);
  const filter = { companyId };
  if (query.status) filter.status = query.status;
  if (query.q?.trim()) {
    const term = query.q.trim();
    const customers = await Customer.find({
      companyId,
      name: new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    })
      .select('_id')
      .lean();
    const alternatives = [];
    if (mongoose.isValidObjectId(term)) alternatives.push({ _id: term });
    if (customers.length) {
      alternatives.push({ customerId: { $in: customers.map((item) => item._id) } });
    }
    if (alternatives.length) filter.$or = alternatives;
    else filter._id = { $in: [] };
  }
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit ?? '100', 10) || 100, 1),
    100
  );
  return Sale.find(filter)
    .populate('customerId', 'name taxId')
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

export async function getSale(id, query, user) {
  ensureDatabase();
  ensureObjectId(id, 'saleId');
  const companyId = companyFor(user, query.companyId);
  return Sale.findOne({ _id: id, companyId })
    .populate('customerId', 'name taxId email phone address')
    .populate({
      path: 'warehouseId',
      select: 'name branchId',
      populate: { path: 'branchId', select: 'name' },
    })
    .populate('items.productId', 'sku name unit')
    .lean()
    .then((sale) => {
      if (!sale) throw new AppError('Venta no encontrada en esta empresa', 404);
      return sale;
    });
}

export async function confirmSale(id, warehouseId, requestedCompanyId, user) {
  ensureDatabase();
  ensureObjectId(id, 'saleId');
  const companyId = companyFor(user, requestedCompanyId);
  const warehouse = await ensureWarehouseAccess(warehouseId, companyId, user);
  const session = await mongoose.startSession();
  try {
    let sale;
    await session.withTransaction(async () => {
      const current = await Sale.findOne({ _id: id, companyId }).session(session);
      if (!current) throw new AppError('Venta no encontrada en esta empresa', 404);
      if (!['DRAFT', 'PENDING'].includes(current.status)) {
        throw new AppError('La venta no puede confirmarse en su estado actual', 409);
      }

      await validateCustomer(current.customerId, companyId, session);
      const normalizedItems = normalizeSaleItems(current.items);
      const products = await loadProducts(normalizedItems, companyId, session);
      const totals = calculateSaleItems(normalizedItems, products);
      current.items = totals.items;
      current.subtotal = totals.subtotal;
      current.tax = totals.tax;
      current.discount = totals.discount;
      current.total = totals.total;
      current.warehouseId = warehouse._id;
      current.status = 'CONFIRMED';

      await deductInventoryAndRecord(current, warehouse, user, session);
      sale = await current.save({ session });
    });
    return sale;
  } finally {
    await session.endSession();
  }
}
