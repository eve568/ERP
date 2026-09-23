import mongoose from 'mongoose';
import { getDatabaseState } from '../../config/database.js';
import { Inventory } from '../../models/inventory.model.js';
import { InventoryMovement } from '../../models/inventory-movement.model.js';
import { Product } from '../../models/product.model.js';
import { Purchase } from '../../models/purchase.model.js';
import { Supplier } from '../../models/supplier.model.js';
import { AppError } from '../../utils/errors.js';

function ensureDatabase() {
  if (getDatabaseState() !== 'connected') throw new AppError('El servicio de compras no está disponible', 503);
}

function companyFor(user, requestedCompanyId) {
  const companyId = user.role === 'ADMIN' ? requestedCompanyId : user.companyId;
  if (!companyId || !mongoose.isValidObjectId(companyId)) throw new AppError('companyId no es válido', 400);
  if (user.role !== 'ADMIN' && requestedCompanyId && requestedCompanyId !== user.companyId) throw new AppError('No tienes acceso a esta empresa', 403);
  return companyId;
}

export async function createPurchase(payload, user) {
  ensureDatabase();
  const companyId = companyFor(user, payload.companyId);
  if (!(await Supplier.exists({ _id: payload.supplierId, companyId }))) throw new AppError('Proveedor no encontrado en esta empresa', 404);
  const items = [];
  for (const item of payload.items) {
    const product = await Product.findOne({ _id: item.productId, companyId }).lean();
    if (!product) throw new AppError('Producto no encontrado en esta empresa', 404);
    items.push({ productId: product._id, quantity: item.quantity, price: item.price ?? product.purchasePrice, subtotal: item.quantity * (item.price ?? product.purchasePrice) });
  }
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const tax = payload.tax ?? 0;
  const discount = payload.discount ?? 0;
  const total = subtotal + tax - discount;
  if (total < 0) throw new AppError('El total no puede ser negativo', 400);
  return Purchase.create({ ...payload, companyId, userId: user.sub, items, subtotal, tax, discount, total });
}

export async function listPurchases(query, user) {
  ensureDatabase();
  const companyId = companyFor(user, query.companyId);
  const filter = { companyId };
  if (query.status) filter.status = query.status;
  return Purchase.find(filter).populate('supplierId', 'name').sort({ createdAt: -1 }).limit(100).lean();
}

export async function receivePurchase(id, warehouseId, user) {
  ensureDatabase();
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(warehouseId)) throw new AppError('Identificador no válido', 400);
  const session = await mongoose.startSession();
  try {
    let purchase;
    await session.withTransaction(async () => {
      const current = await Purchase.findById(id).session(session);
      if (!current) throw new AppError('Compra no encontrada', 404);
      companyFor(user, current.companyId.toString());
      if (!['DRAFT', 'PENDING'].includes(current.status)) throw new AppError('La compra no puede recibirse en su estado actual', 409);
      for (const item of current.items) {
        await Inventory.findOneAndUpdate(
          { companyId: current.companyId, warehouseId, productId: item.productId },
          { $inc: { quantity: item.quantity } },
          { upsert: true, new: true, session }
        );
        await InventoryMovement.create([{
          companyId: current.companyId, productId: item.productId, warehouseId, type: 'PURCHASE', quantity: item.quantity, userId: user.sub, referenceId: current._id
        }], { session });
      }
      current.status = 'RECEIVED';
      purchase = await current.save({ session });
    });
    return purchase;
  } finally {
    await session.endSession();
  }
}