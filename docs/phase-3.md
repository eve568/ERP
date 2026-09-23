# Fase 3 - Autenticación, usuarios, roles y permisos

## Estado

**COMPLETADO CON OBSERVACIONES**

## Implementado

- Modelo Mongoose `User` con datos personales, rol, empresa, sucursal y estado.
- Contraseñas almacenadas como hash bcrypt con factor 12.
- `passwordHash` excluido de consultas por defecto.
- Registro de usuarios mediante `POST /api/auth/register`.
- El registro público siempre asigna `EMPLEADO`; los roles privilegiados no se aceptan desde el cliente.
- Login mediante `POST /api/auth/login` con JWT.
- Middleware `requireAuth` para tokens Bearer.
- Middleware backend `authorizeRoles` y `authorizePermission`.
- Matriz inicial de roles: `ADMIN`, `GERENTE`, `VENTAS`, `COMPRAS`, `ALMACEN`, `FINANZAS`, `RRHH`, `EMPLEADO`.
- Logout stateless mediante `POST /api/auth/logout`.
- Ruta de sesión `GET /api/auth/me`.
- Manejo de credenciales inválidas, tokens ausentes, tokens inválidos y servicio no disponible.

## API

| Método | Ruta | Protección |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Pública, requiere MongoDB y configuración JWT |
| `POST` | `/api/auth/login` | Pública, requiere MongoDB y configuración JWT |
| `GET` | `/api/auth/me` | Bearer token |
| `GET` | `/api/auth/admin-check` | Bearer token + rol `ADMIN` |
| `GET` | `/api/auth/export-check` | Bearer token + permiso `EXPORT` |
| `POST` | `/api/auth/logout` | Bearer token |

## Seguridad

- JWT firmado con `JWT_SECRET` desde variables de entorno.
- Duración configurable con `JWT_EXPIRES_IN`, por defecto `15m`.
- No se devuelve el hash de contraseña.
- Los permisos se validan en el backend, no solo en la interfaz.
- Los mensajes públicos no exponen trazas ni credenciales.
- La API no simula registros cuando MongoDB no está disponible; responde `503`.

## Pruebas

- Suite completa: **13 pruebas aprobadas**.
- Registro con campos faltantes: `400`.
- Registro sin MongoDB configurado: `503`.
- Ruta protegida sin token: `401`.
- Usuario `EMPLEADO` en ruta administrativa: `403`.
- Usuario `ADMIN` autorizado: `200`.
- Permisos por rol verificados.

## Observaciones

- La persistencia real de registro/login requiere una URI válida de MongoDB Atlas y `JWT_SECRET` configurado.
- El logout JWT stateless elimina la responsabilidad al cliente; la revocación server-side y refresh tokens quedan para una fase de seguridad avanzada.
- El registro público deberá restringirse o convertirse en flujo de invitación cuando exista el primer administrador.

## Siguiente fase

Fase 4: empresas y sucursales, con aislamiento multiempresa y multisucursal validado desde el backend.
