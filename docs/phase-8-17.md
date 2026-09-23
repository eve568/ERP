# Fases 8-17 - Operación, personas e información transversal

## Estado

**COMPLETADO CON OBSERVACIONES**

## Operación

- Ventas con cliente, líneas, precios, impuestos, descuentos, total y estados.
- Confirmación de venta con descuento transaccional de inventario.
- Compras con proveedor, líneas, totales y estados.
- Recepción de compra con incremento transaccional de inventario.
- Movimientos vinculados a ventas y compras mediante `referenceId`.

## Finanzas

- Ingresos.
- Gastos.
- Pagos vinculables mediante `referenceType` y `referenceId`.
- Aislamiento por empresa y usuario responsable.

## RRHH, CRM y proyectos

- Departamentos y empleados.
- Leads y oportunidades.
- Proyectos y tareas.
- Estados, prioridades, responsables y porcentaje de avance.
- Relaciones y filtros por empresa.

## Dashboard, reportes y notificaciones

- Dashboard con agregados de ventas, compras, ingresos, gastos, clientes, proveedores, productos, proyectos y stock bajo.
- Reporte inicial de ventas con filtros de fecha.
- Consulta de notificaciones por usuario y empresa.
- Modelos preparados para notificaciones futuras por correo o push.

## Auditoría

- Modelo `audit_logs` con `userId`, `companyId`, `action`, `module`, `recordId`, `timestamp` y `changes`.
- Consulta protegida de auditoría.

## Pruebas

- Suite backend: **36 pruebas aprobadas**.
- No hay conexión real a MongoDB Atlas en este entorno, por lo que las transacciones y agregaciones todavía deben verificarse contra una instancia real.

## Observaciones

- La escritura automática de auditoría aún debe integrarse como middleware de dominio en cada operación crítica.
- Faltan refresh tokens, revocación server-side, recuperación de contraseña y notificaciones push.
- La interfaz React Native/Web actual sigue siendo una pantalla de salud; la siguiente integración conectará autenticación, dashboard y navegación modular.
