import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireFields } from '../utils/validation.js';
import { sendSuccess } from '../utils/response.js';
import { createPartner, deactivatePartner, listPartners, updatePartner } from '../modules/partners/partner.service.js';

const router = Router();
router.use(requireAuth);

function createResourceRoutes(resource) {
  const resourceRouter = Router();
  resourceRouter.post('/', authorizePermission('CREATE'), asyncHandler(async (request, response) => {
    requireFields(request.body, ['name']);
    const item = await createPartner(resource, request.body, request.user);
    return sendSuccess(response, item, 'Registro creado correctamente', 201);
  }));
  resourceRouter.get('/', authorizePermission('VIEW'), asyncHandler(async (request, response) => (
    sendSuccess(response, await listPartners(resource, request.query, request.user))
  )));
  resourceRouter.put('/:id', authorizePermission('UPDATE'), asyncHandler(async (request, response) => (
    sendSuccess(response, await updatePartner(resource, request.params.id, request.body, request.user), 'Registro actualizado correctamente')
  )));
  resourceRouter.delete('/:id', authorizePermission('DELETE'), asyncHandler(async (request, response) => (
    sendSuccess(response, await deactivatePartner(resource, request.params.id, request.user), 'Registro desactivado correctamente')
  )));
  return resourceRouter;
}

router.use('/customers', createResourceRoutes('customers'));
router.use('/suppliers', createResourceRoutes('suppliers'));

export default router;
