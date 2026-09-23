# ERP Modular

Base inicial de un ERP multiempresa y multisucursal. Esta entrega corresponde exclusivamente a la **Fase 1: arquitectura y configuración**.

## Arquitectura

```text
React Native / React Native Web
          |
       REST/JSON
          |
Node.js + Express + middleware de seguridad
          |
MongoDB Atlas + Mongoose
```

El frontend nunca se conecta directamente a MongoDB. Todas las operaciones pasan por el backend.

## Estructura

- `backend/src/config`: entorno y conexión de base de datos.
- `backend/src/middleware`: errores y middleware transversal.
- `backend/src/routes`: rutas HTTP por módulo.
- `backend/src/app.js`: composición de Express, sin abrir el puerto.
- `backend/src/server.js`: arranque de base de datos y servidor.
- `frontend`: aplicación Expo para Android y Web.
- `docs`: decisiones, configuración y contrato inicial de API.

## Requisitos

- Node.js 20 o superior.
- Una URI de MongoDB Atlas para conectar la base de datos.

## Instalación

```powershell
& 'C:\Program Files\nodejs\npm.cmd' install
Copy-Item .env.example .env
```

Completa `MONGODB_URI` en `.env`. La URI de ejemplo no intenta conectarse y permite iniciar la API para validar la arquitectura.
Para autenticación, define también `JWT_SECRET` con un valor largo y aleatorio. `JWT_EXPIRES_IN` controla la duración del token y usa `15m` por defecto.

## Ejecución

Backend:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev:backend
```

Frontend Web:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev:frontend
```

La API queda disponible en `http://localhost:4000` y el frontend Expo Web normalmente en `http://localhost:8081`.

## Validación

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run test:backend
```

Endpoint inicial: `GET /api/health`.

## Endpoints principales

- Autenticación: `/api/auth/*`.
- Empresas y sucursales: `/api/companies`, `/api/branches`.
- Clientes y proveedores: `/api/customers`, `/api/suppliers`.
- Catálogo: `/api/categories`, `/api/products`.
- Inventario: `/api/warehouses`, `/api/inventory`, `/api/inventory/movement`.
- Operación: `/api/sales`, `/api/purchases`.
- Finanzas: `/api/finance/incomes`, `/api/finance/expenses`, `/api/finance/payments`.
- Dashboard y reportes: `/api/dashboard`, `/api/reports/sales`.
- Auditoría y notificaciones: `/api/audit`, `/api/notifications`.

El detalle de alcance y pendientes está en [docs/final-status.md](docs/final-status.md).
