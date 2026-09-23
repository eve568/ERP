# Fase 4 - Empresas y sucursales

## Estado

**COMPLETADO CON OBSERVACIONES**

## Implementado

- Modelo `Company` con nombre, razón social, RFC, contacto, dirección y estado.
- Modelo `Branch` con empresa, contacto, responsable y estado.
- Índice único para RFC de empresa.
- Índice único compuesto `companyId + name` para sucursales.
- CRUD inicial de empresas: crear, consultar, listar y actualizar.
- Operaciones de sucursales: crear, listar por empresa y actualizar.
- Rutas protegidas con Bearer JWT.
- `companyId` y `branchId` incorporados al JWT de sesión.
- Aislamiento backend: usuarios no administradores solo acceden a su empresa.
- `ADMIN` administra empresas; `ADMIN` y `GERENTE` administran sucursales.
- Desactivación preparada mediante actualización de `status`.

## API

| Método | Ruta | Protección |
| --- | --- | --- |
| `POST` | `/api/companies` | `ADMIN` |
| `GET` | `/api/companies` | autenticado |
| `GET` | `/api/companies/:id` | autenticado y aislado |
| `PUT` | `/api/companies/:id` | `ADMIN` |
| `POST` | `/api/branches` | `ADMIN` o `GERENTE` |
| `GET` | `/api/branches?companyId=:id` | autenticado y aislado |
| `PUT` | `/api/branches/:id` | `ADMIN` o `GERENTE`, aislado |

## Pruebas

- Suite completa: **17 pruebas aprobadas**.
- Rutas de empresas sin token: `401`.
- Creación sin MongoDB: `503`, sin simular persistencia.
- Consulta de sucursales sin `companyId`: `400`.
- Índices de unicidad verificados.
- Pruebas anteriores de autenticación y autorización sin regresiones.

## Observaciones

- La persistencia real requiere una URI válida de MongoDB Atlas.
- La creación pública de empresas no existe: solo `ADMIN` puede crear.
- El registro público no puede asignar empresa, sucursal ni roles privilegiados.
- La empresa inicial y la asociación del primer administrador deberán crearse mediante seed seguro o procedimiento de despliegue.
- La auditoría de cambios se integrará cuando se implemente el módulo transversal de auditoría.

## Siguiente fase

Fase 5: clientes y proveedores, relacionados con empresa y sucursal, con búsqueda, filtros, desactivación e historial.
