import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireFields } from '../utils/validation.js';
import { sendSuccess } from '../utils/response.js';
import { confirmSale, createSale, listSales } from '../modules/sales/sale.service.js';

const router = Router();
router.use(requireAuth);

router.post('/', asyncHandler(async (request, response) => {
  requireFields(request.body, ['customerId', 'items', 'paymentMethod']);
  return sendSuccess(response, await createSale(request.body, request.user), 'Venta creada correctamente', 201);
}));
router.get('/', asyncHandler(async (request, response) => sendSuccess(response, await listSales(request.query, request.user))));
router.post('/:id/confirm', asyncHandler(async (request, response) => {
  requireFields(request.body, ['warehouseId']);
  return sendSuccess(response, await confirmSale(request.params.id, request.body.warehouseId, request.user), 'Venta confirmada correctamente');
}));

export default router;