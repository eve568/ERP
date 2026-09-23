import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { authorizePermission, authorizeRoles } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireFields } from '../utils/validation.js';
import { changePassword, loginUser, registerUser } from '../modules/auth/auth.service.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

router.post('/register', asyncHandler(async (request, response) => {
  requireFields(request.body, ['firstName', 'lastName', 'email', 'password']);
  if (request.body.password.length < 8) {
    return response.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
  }
  const user = await registerUser(request.body);
  return sendSuccess(response, user, 'Usuario registrado correctamente', 201);
}));

router.post('/login', asyncHandler(async (request, response) => {
  requireFields(request.body, ['email', 'password']);
  const result = await loginUser(request.body);
  return sendSuccess(response, result, 'Inicio de sesión correcto');
}));

router.post('/change-password', requireAuth, asyncHandler(async (request, response) => {
  requireFields(request.body, ['currentPassword', 'newPassword']);
  await changePassword(request.user.sub, request.body.currentPassword, request.body.newPassword);
  return sendSuccess(response, null, 'Contraseña actualizada correctamente');
}));

router.get('/me', requireAuth, (request, response) => sendSuccess(response, { user: request.user }, 'Sesión válida'));
router.get('/admin-check', requireAuth, authorizeRoles('ADMIN'), (request, response) => (
  sendSuccess(response, { authorized: true }, 'Acceso administrativo autorizado')
));
router.get('/export-check', requireAuth, authorizePermission('EXPORT'), (request, response) => (
  sendSuccess(response, { authorized: true }, 'Permiso de exportación autorizado')
));
router.post('/logout', requireAuth, (request, response) => (
  sendSuccess(response, null, 'Sesión cerrada; elimina el token del cliente')
));

export default router;