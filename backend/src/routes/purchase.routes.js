import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireFields } from '../utils/validation.js';
import { sendSuccess } from '../utils/response.js';
import { createPurchase, listPurchases, receivePurchase } from '../modules/purchases/purchase.service.js';

const router = Router();
router.use(requireAuth);

router.post('/', asyncHandler(async (request, response) => {
  requireFields(request.body, ['supplierId', 'items']);
  return sendSuccess(response, await createPurchase(request.body, request.user), 'Compra creada correctamente', 201);
}));
router.get('/', asyncHandler(async (request, response) => sendSuccess(response, await listPurchases(request.query, request.user))));
router.post('/:id/receive', asyncHandler(async (request, response) => {
  requireFields(request.body, ['warehouseId']);
  return sendSuccess(response, await receivePurchase(request.params.id, request.body.warehouseId, request.user), 'Compra recibida correctamente');
}));

export default router;