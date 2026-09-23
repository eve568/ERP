# Decisiones de arquitectura

## Límites

- `frontend` contiene presentación, navegación y consumo HTTP.
- `backend` contiene reglas de negocio, validación, autorización y persistencia.
- `database.js` es el único punto inicial de conexión a MongoDB.

## Evolución modular

Cada módulo funcional seguirá una estructura `model`, `controller`, `service`, `routes` y `validation` dentro de `backend/src/modules`. Las rutas transversales permanecen en `backend/src/routes`.

## Seguridad inicial

- Secretos solo mediante variables de entorno.
- Helmet para cabeceras HTTP.
- CORS restringido a un origen configurado.
- Rate limiting global inicial.
- Errores 500 sin detalle técnico para el cliente.
- MongoDB no es accesible desde el frontend.

## Decisiones pendientes

- Estrategia JWT o sesión segura para autenticación.
- Política de refresh tokens.
- Roles y permisos en Fase 3.
- Índices y transacciones de los módulos de inventario, ventas y compras.
