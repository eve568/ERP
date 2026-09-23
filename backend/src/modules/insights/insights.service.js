import mongoose from 'mongoose';
import { getDatabaseState } from '../../config/database.js';
import { AuditLog } from '../../models/audit-log.model.js';
import { Customer } from '../../models/customer.model.js';
import { Expense } from '../../models/expense.model.js';
import { Income } from '../../models/income.model.js';
import { Inventory } from '../../models/inventory.model.js';
import { Notification } from '../../models/notification.model.js';
import { Product } from '../../models/product.model.js';
import { Project } from '../../models/people.models.js';
import { Purchase } from '../../models/purchase.model.js';
import { Sale } from '../../models/sale.model.js';
import { Supplier } from '../../models/supplier.model.js';
import { AppError } from '../../utils/errors.js';

function ensureDatabase() {
  if (getDatabaseState() !== 'connected') throw new AppError('El servicio de reportes no está disponible', 503);
}
function companyFor(user, requested) {
  const companyId = user.role === 'ADMIN' ? requested : user.companyId;
  if (!companyId || !mongoose.isValidObjectId(companyId)) throw new AppError('companyId no es válido', 400);
  return companyId;
}
export async function dashboard(query, user) {
  ensureDatabase();
  const companyId = companyFor(user, query.companyId);
  const [sales, purchases, income, expenses, customers, suppliers, products, projects, lowStock] = await Promise.all([
    Sale.aggregate([{ $match: { companyId: new mongoose.Types.ObjectId(companyId), status: { $in: ['CONFIRMED', 'PAID'] } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
    Purchase.aggregate([{ $match: { companyId: new mongoose.Types.ObjectId(companyId), status: 'RECEIVED' } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
    Income.aggregate([{ $match: { companyId: new mongoose.Types.ObjectId(companyId) } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { companyId: new mongoose.Types.ObjectId(companyId) } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Customer.countDocuments({ companyId, status: 'ACTIVE' }), Supplier.countDocuments({ companyId, status: 'ACTIVE' }), Product.countDocuments({ companyId, status: 'ACTIVE' }), Project.countDocuments({ companyId, status: { $in: ['PENDING', 'IN_PROGRESS'] } }), Inventory.countDocuments({ companyId, $expr: { $lte: ['$quantity', '$minimumStock'] } })
  ]);
  return { sales: sales[0] ?? { total: 0, count: 0 }, purchases: purchases[0] ?? { total: 0, count: 0 }, income: income[0]?.total ?? 0, expenses: expenses[0]?.total ?? 0, customers, suppliers, products, activeProjects: projects, lowStock };
}
export async function listNotifications(query, user) {
  ensureDatabase();
  const filter = { userId: user.sub, companyId: companyFor(user, query.companyId) };
  if (query.unread === 'true') filter.readAt = { $exists: false };
  return Notification.find(filter).sort({ createdAt: -1 }).limit(100).lean();
}
export async function listAudit(query, user) {
  ensureDatabase();
  return AuditLog.find({ companyId: companyFor(user, query.companyId) }).sort({ timestamp: -1 }).limit(100).lean();
}
export async function salesReport(query, user) {
  ensureDatabase();
  const companyId = companyFor(user, query.companyId);
  const match = { companyId: new mongoose.Types.ObjectId(companyId) };
  if (query.from || query.to) match.createdAt = {};
  if (query.from) match.createdAt.$gte = new Date(query.from);
  if (query.to) match.createdAt.$lte = new Date(query.to);
  return Sale.find(match).sort({ createdAt: -1 }).limit(1000).lean();
}