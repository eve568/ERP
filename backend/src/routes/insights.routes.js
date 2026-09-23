import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { dashboard, listAudit, listNotifications, salesReport } from '../modules/insights/insights.service.js';

const router = Router();
router.use(requireAuth);
router.get('/dashboard', asyncHandler(async (request, response) => sendSuccess(response, await dashboard(request.query, request.user))));
router.get('/reports/sales', asyncHandler(async (request, response) => sendSuccess(response, await salesReport(request.query, request.user))));
router.get('/notifications', asyncHandler(async (request, response) => sendSuccess(response, await listNotifications(request.query, request.user))));
router.get('/audit', asyncHandler(async (request, response) => sendSuccess(response, await listAudit(request.query, request.user))));

export default router;