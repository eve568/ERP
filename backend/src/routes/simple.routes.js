import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireFields } from '../utils/validation.js';
import { sendSuccess } from '../utils/response.js';
import { createSimple, listSimple, updateSimple } from '../modules/simple/simple.service.js';

const router = Router();
router.use(requireAuth);
const definitions = {
  departments: ['name'], employees: ['firstName', 'lastName', 'position', 'hireDate'], leads: ['name'], opportunities: ['name'], projects: ['name'], tasks: ['title', 'projectId']
};
for (const [resource, fields] of Object.entries(definitions)) {
  router.post(`/${resource}`, authorizePermission('CREATE'), asyncHandler(async (request, response) => {
    requireFields(request.body, fields);
    return sendSuccess(response, await createSimple(resource, request.body, request.user), 'Registro creado correctamente', 201);
  }));
  router.get(`/${resource}`, authorizePermission('VIEW'), asyncHandler(async (request, response) => sendSuccess(response, await listSimple(resource, request.query, request.user))));
  router.put(`/${resource}/:id`, authorizePermission('UPDATE'), asyncHandler(async (request, response) => sendSuccess(response, await updateSimple(resource, request.params.id, request.body, request.user), 'Registro actualizado correctamente')));
}

export default router;
