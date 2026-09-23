import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireFields } from '../utils/validation.js';
import { sendSuccess } from '../utils/response.js';
import { createBranch, listBranches, updateBranch } from '../modules/companies/branch.service.js';

const router = Router();
router.use(requireAuth);

router.post('/', authorizeRoles('ADMIN', 'GERENTE'), asyncHandler(async (request, response) => {
  requireFields(request.body, ['name', 'companyId']);
  const branch = await createBranch(request.body, request.user);
  return sendSuccess(response, branch, 'Sucursal creada correctamente', 201);
}));

router.get('/', asyncHandler(async (request, response) => {
  requireFields(request.query, ['companyId']);
  return sendSuccess(response, await listBranches(request.query.companyId, request.user));
}));

router.put('/:id', authorizeRoles('ADMIN', 'GERENTE'), asyncHandler(async (request, response) => (
  sendSuccess(response, await updateBranch(request.params.id, request.body, request.user), 'Sucursal actualizada correctamente')
)));

export default router;