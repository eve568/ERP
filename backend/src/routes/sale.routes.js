import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireFields } from '../utils/validation.js';
import { sendSuccess } from '../utils/response.js';
import { confirmSale, createSale, getSale, listSales } from '../modules/sales/sale.service.js';

const router = Router();
router.use(requireAuth);

router.post('/', authorizePermission('CREATE'), asyncHandler(async (request, response) => {
  requireFields(request.body, ['customerId', 'items', 'paymentMethod']);
  return sendSuccess(response, await createSale(request.body, request.user), 'Venta creada correctamente', 201);
}));
router.get('/', authorizePermission('VIEW'), asyncHandler(async (request, response) => sendSuccess(response, await listSales(request.query, request.user))));
router.get('/:id', authorizePermission('VIEW'), asyncHandler(async (request, response) => sendSuccess(response, await getSale(request.params.id, request.query, request.user))));
router.post('/:id/confirm', authorizePermission('CREATE'), asyncHandler(async (request, response) => {
  requireFields(request.body, ['warehouseId']);
  return sendSuccess(response, await confirmSale(request.params.id, request.body.warehouseId, request.body.companyId, request.user), 'Venta confirmada correctamente');
}));

export default router;