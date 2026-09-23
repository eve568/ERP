# Fases 5-7 - Relaciones, catálogo e inventario

## Estado

**COMPLETADO CON OBSERVACIONES**

## Fase 5: clientes y proveedores

- Modelos aislados por empresa.
- Búsqueda, filtros, paginación y actualización.
- Desactivación lógica mediante `DELETE`.
- RFC único por empresa.

## Fase 6: categorías y productos

- Categorías únicas por empresa.
- Productos con SKU único por empresa.
- Validación de categoría y proveedor pertenecientes a la misma empresa.
- Precios, unidad, existencias iniciales y límites de stock.
- Búsqueda, filtros y paginación.

## Fase 7: almacenes e inventario

- Almacenes ligados a empresa y sucursal.
- Existencias por producto y almacén.
- Colección `inventory_movements` con producto, almacén, tipo, cantidad, usuario, motivo y referencia.
- Tipos: `PURCHASE`, `SALE`, `ADJUSTMENT`, `TRANSFER`, `RETURN`.
- Actualización transaccional de existencias.
- Bloqueo de salidas con stock insuficiente.

## Pruebas

- Suite completa: **28 pruebas aprobadas**.
- Rutas protegidas y aislamiento por empresa.
- Validación de campos obligatorios.
- Índices de unicidad y trazabilidad.
- Sin simulación cuando MongoDB no está disponible.

## Observaciones

La persistencia y transacciones requieren MongoDB Atlas configurado. Las pruebas actuales validan contratos, seguridad, modelos e indisponibilidad controlada; falta ejecutar pruebas de integración contra una base MongoDB real.

## Siguiente fase

Ventas y compras con confirmación, actualización de inventario y preparación para registros financieros.
