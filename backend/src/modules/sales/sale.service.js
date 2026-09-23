import mongoose from 'mongoose';
import { getDatabaseState } from '../../config/database.js';
import { Customer } from '../../models/customer.model.js';
import { Inventory } from '../../models/inventory.model.js';
import { InventoryMovement } from '../../models/inventory-movement.model.js';
import { Product } from '../../models/product.model.js';
import { Sale } from '../../models/sale.model.js';
import { AppError } from '../../utils/errors.js';

function ensureDatabase() {
  if (getDatabaseState() !== 'connected') throw new AppError('El servicio de ventas no está disponible', 503);
}

function companyFor(user, requestedCompanyId) {
  const companyId = user.role === 'ADMIN' ? requestedCompanyId : user.companyId;
  if (!companyId) throw new AppError('companyId es obligatorio', 400);
  if (!mongoose.isValidObjectId(companyId)) throw new AppError('companyId no es válido', 400);
  if (user.role !== 'ADMIN' && requestedCompanyId && requestedCompanyId !== user.companyId) throw new AppError('No tienes acceso a esta empresa', 403);
  return companyId;
}

export async function createSale(payload, user) {
  ensureDatabase();
  const companyId = companyFor(user, payload.companyId);
  if (!(await Customer.exists({ _id: payload.customerId, companyId }))) throw new AppError('Cliente no encontrado en esta empresa', 404);
  const items = [];
  for (const item of payload.items) {
    const product = await Product.findOne({ _id: item.productId, companyId }).lean();
    if (!product) throw new AppError('Producto no encontrado en esta empresa', 404);
    const price = item.price ?? product.salePrice;
    items.push({ productId: product._id, quantity: item.quantity, price, subtotal: item.quantity * price });
  }
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const tax = payload.tax ?? 0;
  const discount = payload.discount ?? 0;
  const total = subtotal + tax - discount;
  if (total < 0) throw new AppError('El total no puede ser negativo', 400);
  return Sale.create({ ...payload, companyId, userId: user.sub, items, subtotal, tax, discount, total });
}

export async function listSales(query, user) {
  ensureDatabase();
  const companyId = companyFor(user, query.companyId);
  const filter = { companyId };
  if (query.status) filter.status = query.status;
  return Sale.find(filter).populate('customerId', 'name').sort({ createdAt: -1 }).limit(100).lean();
}

export async function confirmSale(id, warehouseId, user) {
  ensureDatabase();
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(warehouseId)) throw new AppError('Identificador no válido', 400);
  const session = await mongoose.startSession();
  try {
    let sale;
    await session.withTransaction(async () => {
      const current = await Sale.findById(id).session(session);
      if (!current) throw new AppError('Venta no encontrada', 404);
      companyFor(user, current.companyId.toString());
      if (!['DRAFT', 'PENDING'].includes(current.status)) throw new AppError('La venta no puede confirmarse en su estado actual', 409);
      for (const item of current.items) {
        const inventory = await Inventory.findOne({ warehouseId, productId: item.productId, companyId: current.companyId }).session(session);
        if (!inventory || inventory.quantity < item.quantity) throw new AppError('Existencia insuficiente', 409);
        inventory.quantity -= item.quantity;
        await inventory.save({ session });
        await InventoryMovement.create([{
          companyId: current.companyId, productId: item.productId, warehouseId, type: 'SALE', quantity: item.quantity, userId: user.sub, referenceId: current._id
        }], { session });
      }
      current.status = 'CONFIRMED';
      sale = await current.save({ session });
    });
    return sale;
  } finally {
    await session.endSession();
  }
}