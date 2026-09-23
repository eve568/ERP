import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export function requireAuth(request, response, next) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return next(new AppError('Autenticación requerida', 401));
  }
  if (!env.jwtSecret) {
    return next(new AppError('El servicio de autenticación no está configurado', 503));
  }

  try {
    request.user = jwt.verify(authorization.slice(7), env.jwtSecret);
    return next();
  } catch {
    return next(new AppError('Token inválido o expirado', 401));
  }
}