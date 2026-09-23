import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireFields } from '../utils/validation.js';
import { sendSuccess } from '../utils/response.js';
import { createCompany, getCompany, listCompanies, updateCompany } from '../modules/companies/company.service.js';

const router = Router();
router.use(requireAuth);

router.post('/', authorizeRoles('ADMIN'), asyncHandler(async (request, response) => {
  requireFields(request.body, ['name', 'legalName', 'taxId']);
  const company = await createCompany(request.body);
  return sendSuccess(response, company, 'Empresa creada correctamente', 201);
}));

router.get('/', asyncHandler(async (request, response) => sendSuccess(response, await listCompanies(request.user))));
router.get('/:id', asyncHandler(async (request, response) => sendSuccess(response, await getCompany(request.params.id, request.user))));
router.put('/:id', authorizeRoles('ADMIN'), asyncHandler(async (request, response) => (
  sendSuccess(response, await updateCompany(request.params.id, request.body, request.user), 'Empresa actualizada correctamente')
)));

export default router;