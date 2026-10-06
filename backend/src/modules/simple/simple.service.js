import mongoose from 'mongoose';
import { getDatabaseState } from '../../config/database.js';
import { Department, Employee, Lead, Opportunity, Project, Task } from '../../models/people.models.js';
import { AppError } from '../../utils/errors.js';

const resources = { departments: Department, employees: Employee, leads: Lead, opportunities: Opportunity, projects: Project, tasks: Task };

function ensureDatabase() {
  if (getDatabaseState() !== 'connected') throw new AppError('El servicio no está disponible', 503);
}
function companyFor(user, requested) {
  const companyId = user.role === 'ADMIN' ? requested : user.companyId;
  if (!companyId) throw new AppError(user.role === 'ADMIN' ? 'Selecciona una empresa activa antes de continuar' : 'Tu usuario no tiene una empresa asignada', 400);
  if (!mongoose.isValidObjectId(companyId)) throw new AppError('La empresa seleccionada no es válida', 400);
  if (user.role !== 'ADMIN' && requested && requested !== user.companyId) throw new AppError('No tienes acceso a esta empresa', 403);
  return companyId;
}
function getModel(resource) {
  if (!resources[resource]) throw new AppError('Recurso no soportado', 400);
  return resources[resource];
}
export async function createSimple(resource, payload, user) {
  ensureDatabase();
  const companyId = companyFor(user, payload.companyId);
  if (resource === 'tasks' && payload.projectId && !(await Project.exists({ _id: payload.projectId, companyId }))) throw new AppError('Proyecto no encontrado en esta empresa', 404);
  return getModel(resource).create({ ...payload, companyId });
}
export async function listSimple(resource, query, user) {
  ensureDatabase();
  const companyId = companyFor(user, query.companyId);
  const filter = { companyId };
  if (query.status) filter.status = query.status;
  if (query.projectId) filter.projectId = query.projectId;
  return getModel(resource).find(filter).sort({ createdAt: -1 }).limit(100).lean();
}
export async function updateSimple(resource, id, changes, user) {
  ensureDatabase();
  if (!mongoose.isValidObjectId(id)) throw new AppError('id no es válido', 400);
  const Model = getModel(resource);
  const current = await Model.findById(id).lean();
  if (!current) throw new AppError('Registro no encontrado', 404);
  const companyId = companyFor(user, current.companyId.toString());
  return Model.findOneAndUpdate({ _id: id, companyId }, { ...changes, companyId }, { new: true, runValidators: true }).lean();
}