# Fase 1 - Arquitectura y configuración

## Estado

**COMPLETADO CON OBSERVACIONES**

## Alcance realizado

- Monorepo npm con workspaces `backend` y `frontend`.
- Backend Express con módulos preparados por responsabilidad.
- Seguridad transversal inicial con Helmet, CORS, rate limiting y respuestas de error sin detalles sensibles.
- Configuración mediante variables de entorno.
- Conexión Mongoose a MongoDB Atlas cuando existe una URI real.
- Endpoint `GET /api/health` para comprobar API y estado de base de datos.
- Cliente Expo compatible con Android y Web que consulta el endpoint de salud.
- Pruebas HTTP básicas para salud y rutas inexistentes.

## Variables de entorno

En la raíz, copiar `.env.example` a `.env` y definir:

- `NODE_ENV`: entorno de ejecución.
- `PORT`: puerto de la API, por defecto `4000`.
- `MONGODB_URI`: URI privada de MongoDB Atlas.
- `CORS_ORIGIN`: origen permitido del frontend.

En `frontend/.env.example` está `EXPO_PUBLIC_API_URL`.

## API inicial

| Método | Ruta | Resultado |
| --- | --- | --- |
| `GET` | `/` | Información básica de la API |
| `GET` | `/api/health` | Estado del servicio y MongoDB |

Las respuestas siguen `{ success, data, message }`. Los errores públicos no exponen trazas ni credenciales.

## Base de datos

Mongoose está configurado para MongoDB Atlas, pero todavía no existen colecciones de negocio. Esto es intencional: los modelos se agregarán a partir de la Fase 2 y autenticación en la Fase 3.

## Pruebas ejecutadas

- `npm install`: correcto.
- `node --test backend/test/health.test.js`: correcto, 2 pruebas aprobadas.
- API iniciada con URI de ejemplo: `GET /api/health` respondió `200` y reportó `database: not_configured`.
- Expo Web compiló `frontend/index.js` y sirvió `http://localhost:8081` con `200`.
- Prueba manual pendiente de conexión real a Atlas hasta disponer de `MONGODB_URI` válida.

## Observaciones

La auditoría de npm reportó vulnerabilidades en dependencias instaladas. Deben revisarse en una tarea de mantenimiento antes de producción; no se aplicó `npm audit fix --force` porque podría introducir cambios incompatibles en esta fase.

Expo también indicó que las versiones instaladas de React, React DOM y React Native tienen parches superiores a los rangos esperados por Expo. El frontend arranca y compila, pero conviene fijar las versiones compatibles antes de producción.
