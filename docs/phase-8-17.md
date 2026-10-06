# Fases 8-17 - Operación, personas e información transversal

## Estado

**COMPLETADO CON OBSERVACIONES**

## Operación

- Ventas con cliente, líneas, precios, impuestos, descuentos, total y estados.
- Nueva venta desde la interfaz con cliente, almacén, productos, disponibilidad real por almacén, cantidades editables, búsqueda por nombre/SKU e historial con detalle.
- Al enviar una venta con almacén, el backend obtiene los precios vigentes desde `Product.salePrice` y confirma la venta con descuento de inventario y movimientos `SALE` dentro de una transacción.
- El descuento usa una actualización condicional de `Inventory.quantity` (`quantity >= cantidad a vender`) para impedir sobreventa concurrente; un fallo al descontar stock o registrar el movimiento revierte la venta completa.
- La venta persiste su almacén. El detalle muestra cliente, fecha, almacén/sucursal, líneas, precios, subtotales, total y estado.
- Se conservan los borradores antiguos; su confirmación también revalida empresa, almacén, productos, precios y stock.
- El modelo permite impuestos y descuentos, pero no hay una política de cálculo configurada; la interfaz no los inventa y el backend fija ambos en cero para nuevas ventas.
- `paymentMethod` se conserva en Sale. Aunque existe un modelo genérico `Payment`, no hay una política definida para cuándo marcar un pago como pendiente/completado ni manejo de pagos parciales; la creación automática de pagos queda pendiente de Finanzas.
- La cancelación no se expone: no existe una operación de dominio para revertir stock/pagos y conservar la trazabilidad.
- Nueva compra desde la interfaz con proveedor, almacén, búsqueda de productos, costos unitarios editables, líneas y resumen.
- Una compra con almacén queda recibida en una transacción que crea Purchase, incrementa Inventory y registra movimientos PURCHASE.
- El servidor calcula subtotales y total a partir de cantidad y costo unitario; ignora totales e impuestos recibidos del cliente. No hay política de impuestos/descuentos definida y se conservan en cero.
- `Product.purchasePrice` se trata como costo de referencia: se usa si un borrador antiguo omite el costo por línea, pero la compra guarda el costo real capturado y no actualiza el catálogo.
- La recepción valida proveedor, producto, empresa, almacén, sucursal activa y permisos. La actualización de inventario usa incremento atómico con upsert y respeta el índice único por almacén/producto.
- El historial de compras incluye búsqueda por folio/proveedor, filtro de estado y detalle de proveedor, almacén/sucursal, líneas, costos y total.
- Los borradores heredados sin almacén siguen pudiendo guardarse, pero no incrementan inventario hasta ser recibidos en un almacén mediante la operación protegida.
- No existe cancelación/devolución de compra con reversa transaccional; no se expone esa acción.
- `Payment` y `Expense` permiten relacionar pagos/gastos con compras, pero no hay política de cuentas por pagar ni aplicación de pagos definida; su integración queda para Finanzas.
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

- Suite backend: **67 pruebas aprobadas, 0 fallos** en la última verificación de Compras.
- No hay conexión real a MongoDB Atlas en este entorno, por lo que las transacciones y agregaciones todavía deben verificarse contra una instancia real.

## Observaciones

- La escritura automática de auditoría aún debe integrarse como middleware de dominio en cada operación crítica.
- Faltan refresh tokens, revocación server-side, recuperación de contraseña y notificaciones push.
- El `activeCompanyId` del ADMIN permanece en el contexto frontend/sesión local; los endpoints validan el `companyId` solicitado y las relaciones de sus registros, pero no hay todavía un contexto de empresa activa firmado server-side.
- Falta ejecutar pruebas de integración y concurrencia contra MongoDB real configurado como replica set o clúster sharded; las pruebas locales usan contratos/mocks.
