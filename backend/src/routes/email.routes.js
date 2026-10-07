import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sendTestEmail } from '../modules/email/email.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireFields } from '../utils/validation.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

router.post('/test', requireAuth, asyncHandler(async (request, response) => {
  requireFields(request.body, ['to']);
  const result = await sendTestEmail(request.body.to);
  return sendSuccess(response, { id: result.id }, 'Correo de prueba enviado');
}));

export default router;
