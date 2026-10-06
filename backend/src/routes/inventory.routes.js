import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireFields } from '../utils/validation.js';
import { sendSuccess } from '../utils/response.js';
import { createMovement, createWarehouse, listInventory, listMovements, listWarehouses } from '../modules/inventory/inventory.service.js';

const router = Router();
router.use(requireAuth);

router.post('/warehouses', authorizePermission('CREATE'), asyncHandler(async (request, response) => {
  requireFields(request.body, ['name', 'branchId']);
  return sendSuccess(response, await createWarehouse(request.body, request.user), 'Almacén creado correctamente', 201);
}));
router.get('/warehouses', authorizePermission('VIEW'), asyncHandler(async (request, response) => sendSuccess(response, await listWarehouses(request.query, request.user))));
router.post('/inventory/movement', authorizePermission('CREATE'), asyncHandler(async (request, response) => {
  requireFields(request.body, ['productId', 'warehouseId', 'type', 'quantity']);
  return sendSuccess(response, await createMovement(request.body, request.user), 'Movimiento registrado correctamente', 201);
}));
router.get('/inventory', authorizePermission('VIEW'), asyncHandler(async (request, response) => sendSuccess(response, await listInventory(request.query, request.user))));
router.get('/inventory/movements', authorizePermission('VIEW'), asyncHandler(async (request, response) => sendSuccess(response, await listMovements(request.query, request.user))));

export default router;