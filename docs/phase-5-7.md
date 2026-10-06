# Fases 5-7 - Relaciones, catálogo e inventario

## Estado

**COMPLETADO CON OBSERVACIONES**

## Fase 5: clientes y proveedores

- Modelos aislados por empresa.
- Búsqueda, filtros, paginación y actualización.
- Desactivación lógica mediante `DELETE`.
- RFC único por empresa.
- Frontend de clientes y proveedores con listado, búsqueda, detalle, alta, edición y activación/desactivación.
- El frontend aplica `activeCompanyId` de ADMIN o la empresa del usuario desde la sesión; el `companyId` no se solicita en los formularios.

### Migración del índice RFC opcional

El índice único de RFC ahora solo incluye RFC no vacíos. Antes de desplegar este cambio en una base que ya tenga los índices anteriores, ejecuta una vez `npm --workspace backend run migrate:partner-taxid-indexes` con `MONGODB_URI` configurada. El comando reemplaza únicamente el índice `companyId_1_taxId_1` en las colecciones `customers` y `suppliers`.

## Fase 6: categorías y productos

- Categorías únicas por empresa.
- Productos con SKU único por empresa.
- Validación de categoría y proveedor pertenecientes a la misma empresa.
- Precios, unidad, existencias iniciales y límites de stock.
- Búsqueda, filtros y paginación.
- Frontend de Productos con listado, búsqueda, filtros por categoría/estado, detalle, alta, edición y activación/desactivación.
- El formulario carga categorías reales y no expone campos de stock; las existencias se gestionan en Inventario.
- Si no hay categorías, el formulario permite crear una categoría mínima mediante el endpoint existente; la administración completa de categorías no se incluye en esta fase.
- Las actualizaciones validan que el producto pertenezca a la empresa del contexto activo; no permiten cambiar el `companyId` de un producto.

## Fase 7: almacenes e inventario

- Almacenes ligados a empresa y sucursal.
- Existencias por producto y almacén.
- Colección `inventory_movements` con producto, almacén, tipo, cantidad, usuario, motivo y referencia.
- Tipos: `PURCHASE`, `SALE`, `ADJUSTMENT`, `TRANSFER`, `RETURN`.
- Actualización transaccional de existencias.
- Bloqueo de salidas con stock insuficiente.
- La pantalla Inventario permite consultar existencias, buscar producto/SKU, filtrar por sucursal y almacén, consultar el historial y registrar entradas, salidas y ajustes.
- Los almacenes se crean ligados a sucursales activas; las operaciones validan en backend que empresa, sucursal, almacén y producto correspondan entre sí y al usuario.
- `Inventory` es la fuente de verdad de existencias. `Product.stock` se conserva por compatibilidad, pero es un campo legado y no se sincroniza ni debe usarse para operaciones de inventario.
- Los ajustes manuales guardan una diferencia firmada: `+N` incrementa y `-N` disminuye. No representan la existencia final; no se admite que el resultado quede por debajo de cero.
- El stock bajo utiliza primero `Inventory.minimumStock` si está configurado; de lo contrario la interfaz usa `Product.minimumStock` como umbral global de referencia. La configuración de mínimos por almacén y su migración quedan pendientes.
- Inventario y movimiento se escriben en una transacción MongoDB. La instancia debe admitir transacciones (replica set o clúster sharded); ante una instancia standalone la operación falla, sin fallback de escrituras parciales.

## Pruebas

- Suite completa: **28 pruebas aprobadas**.
- Rutas protegidas y aislamiento por empresa.
- Validación de campos obligatorios.
- Índices de unicidad y trazabilidad.
- Sin simulación cuando MongoDB no está disponible.

## Observaciones

La persistencia y transacciones requieren MongoDB configurado. Las pruebas actuales validan contratos, aislamiento, movimientos y la indisponibilidad controlada; falta ejecutar pruebas de integración contra una base MongoDB real. La administración de sucursales y la definición de mínimos por almacén siguen fuera del alcance de la pantalla de Inventario.

## Siguiente fase

Ventas y compras con confirmación, actualización de inventario y preparación para registros financieros.
