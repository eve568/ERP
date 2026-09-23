import { AppError } from '../utils/errors.js';
import { roleHasPermission } from '../config/permissions.js';

export function authorizeRoles(...allowedRoles) {
  return (request, response, next) => {
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      return next(new AppError('No tienes permisos para realizar esta acción', 403));
    }
    return next();
  };
}

export function authorizePermission(permission) {
  return (request, response, next) => {
    if (!request.user || !roleHasPermission(request.user.role, permission)) {
      return next(new AppError('No tienes permisos para realizar esta acción', 403));
    }
    return next();
  };
}