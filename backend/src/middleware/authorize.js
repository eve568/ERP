// Modo de pruebas: la autenticación sigue siendo obligatoria en las rutas protegidas,
// pero no se restringen acciones por rol o permiso.
// Centralizar este bypass aquí permite restaurar RBAC sin modificar cada módulo.
export function authorizeRoles(..._allowedRoles) {
  return (_request, _response, next) => next();
}

export function authorizePermission(_permission) {
  return (_request, _response, next) => next();
}
