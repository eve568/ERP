import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireFields } from '../utils/validation.js';
import { sendSuccess } from '../utils/response.js';
import { createFinancialRecord, listFinancialRecords } from '../modules/finance/finance.service.js';

const router = Router();
router.use(requireAuth);

function resourceRoutes(resource, fields) {
  const resourceRouter = Router();
  resourceRouter.post('/', asyncHandler(async (request, response) => {
    requireFields(request.body, fields);
    return sendSuccess(response, await createFinancialRecord(resource, request.body, request.user), 'Registro financiero creado correctamente', 201);
  }));
  resourceRouter.get('/', asyncHandler(async (request, response) => sendSuccess(response, await listFinancialRecords(resource, request.query, request.user))));
  return resourceRouter;
}

router.use('/incomes', resourceRoutes('incomes', ['concept', 'amount', 'paymentMethod']));
router.use('/expenses', resourceRoutes('expenses', ['concept', 'category', 'amount']));
router.use('/payments', resourceRoutes('payments', ['referenceType', 'referenceId', 'amount', 'method']));

export default router;