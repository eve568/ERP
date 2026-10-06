import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import FormActions from '../FormActions';
import FormField from '../FormField';
import PickerField from '../PickerField';
import { isSessionError, listProducts, listWarehouses } from '../../services/api';
import { createInventoryMovement } from '../../services/records';
import { colors, radius, spacing, typography } from '../../theme';

const movementTypes = [
  { value: 'PURCHASE', label: 'Entrada por compra' },
  { value: 'SALE', label: 'Salida por venta' },
  { value: 'ADJUSTMENT', label: 'Ajuste de inventario' },
  { value: 'RETURN', label: 'Devolución' },
  { value: 'TRANSFER', label: 'Transferencia' },
];

export default function MovementForm({ token, companyId, onCancel, onDone, onSessionExpired }) {
  const [products, setProducts] = useState({ status: 'loading', items: [], pages: 1 });
  const [warehouses, setWarehouses] = useState({ status: 'loading', items: [] });
  const [productId, setProductId] = useState(null);
  const [warehouseId, setWarehouseId] = useState(null);
  const [type, setType] = useState('ADJUSTMENT');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadReferences = useCallback(async () => {
    setProducts((current) => ({ ...current, status: 'loading' }));
    setWarehouses((current) => ({ ...current, status: 'loading' }));

    try {
      const [productsPayload, warehousesPayload] = await Promise.all([
        listProducts(token, companyId),
        listWarehouses(token, companyId),
      ]);

      const productItems = Array.isArray(productsPayload?.data?.items)
        ? productsPayload.data.items
        : [];
      const warehouseItems = Array.isArray(warehousesPayload?.data)
        ? warehousesPayload.data
        : [];

      setProducts({
        status: 'ready',
        items: productItems,
        pages: productsPayload?.data?.pagination?.pages ?? 1,
      });
      setWarehouses({ status: 'ready', items: warehouseItems });
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }

      setProducts((current) => ({ ...current, status: 'error' }));
      setWarehouses((current) => ({ ...current, status: 'error' }));
      setError(requestError?.message ?? 'No fue posible cargar productos o almacenes.');
    }
  }, [token, companyId, onSessionExpired]);

  useEffect(() => {
    loadReferences();
  }, [loadReferences]);

  const productOptions = products.items.map((item) => ({
    value: item._id,
    label: `${item.sku} · ${item.name}`,
  }));

  const warehouseOptions = warehouses.items.map((item) => ({
    value: item._id,
    label: item.name,
  }));

  const referencesReady = products.status === 'ready' && warehouses.status === 'ready';
  const hasProducts = productOptions.length > 0;
  const hasWarehouses = warehouseOptions.length > 0;
  const blocked = !referencesReady || !hasProducts || !hasWarehouses;

  async function submit() {
    const parsedQuantity = Number(quantity);

    if (!productId || !warehouseId) {
      setError('Selecciona el producto y el almacén.');
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('La cantidad debe ser un número mayor a 0.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      productId,
      warehouseId,
      type,
      quantity: parsedQuantity,
    };

    if (reason.trim()) payload.reason = reason.trim();
    if (companyId) payload.companyId = companyId;

    try {
      await createInventoryMovement(token, payload);
      onDone('Movimiento registrado correctamente', 'success');
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }

      setError(requestError?.message ?? 'No fue posible registrar el movimiento.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.sectionNote}>
        Solo las salidas por venta descuentan existencia; las demás entradas
        incrementan el inventario del almacén seleccionado.
      </Text>

      <PickerField
        label="Producto"
        value={productId}
        options={productOptions}
        onChange={setProductId}
        loading={products.status === 'loading'}
        placeholder={hasProducts ? 'Seleccionar producto' : 'Sin productos disponibles'}
        emptyMessage="Aún no hay productos en esta empresa. Primero crea un producto en el catálogo."
        isRequired
        hint={products.pages > 1 ? 'Se muestran los primeros 100 productos.' : null}
      />

      <PickerField
        label="Almacén"
        value={warehouseId}
        options={warehouseOptions}
        onChange={setWarehouseId}
        loading={warehouses.status === 'loading'}
        placeholder={hasWarehouses ? 'Seleccionar almacén' : 'Sin almacenes disponibles'}
        emptyMessage="Aún no hay almacenes. Primero registra un almacén en el módulo Inventario (próximamente)."
        isRequired
      />

      <PickerField
        label="Tipo de movimiento"
        value={type}
        options={movementTypes}
        onChange={setType}
        placeholder="Seleccionar tipo"
        isRequired
      />

      <FormField
        label="Cantidad"
        value={quantity}
        onChangeText={setQuantity}
        placeholder="Ej.: 10"
        keyboardType="numeric"
        isRequired
        editable={!submitting}
      />

      <FormField
        label="Motivo"
        value={reason}
        onChangeText={setReason}
        placeholder="Opcional"
        editable={!submitting}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FormActions
        onSubmit={submit}
        onCancel={onCancel}
        submitLabel="Registrar movimiento"
        submitting={submitting}
        disabled={blocked}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },

  sectionNote: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    lineHeight: 18,
  },

  errorBox: {
    backgroundColor: colors.pastelPink,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
  },

  errorText: {
    color: colors.danger,
    fontSize: typography.size.xs,
    lineHeight: 18,
  },
});
