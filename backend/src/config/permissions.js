export const rolePermissions = {
  ADMIN: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE'],
  GERENTE: ['VIEW', 'CREATE', 'UPDATE', 'EXPORT', 'APPROVE'],
  VENTAS: ['VIEW', 'CREATE', 'UPDATE'],
  COMPRAS: ['VIEW', 'CREATE', 'UPDATE'],
  ALMACEN: ['VIEW', 'CREATE', 'UPDATE'],
  FINANZAS: ['VIEW', 'CREATE', 'UPDATE', 'EXPORT', 'APPROVE'],
  RRHH: ['VIEW', 'CREATE', 'UPDATE'],
  EMPLEADO: ['VIEW']
};

export function roleHasPermission(role, permission) {
  return rolePermissions[role]?.includes(permission) ?? false;
}