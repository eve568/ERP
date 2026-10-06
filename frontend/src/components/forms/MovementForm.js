import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppButton from '../AppButton';
import FormActions from '../FormActions';
import FormField from '../FormField';
import PickerField from '../PickerField';
import { isSessionError, listProducts, listWarehouses } from '../../services/api';
import { createInventoryMovement } from '../../services/records';
import { colors, radius, spacing, typography } from '../../theme';

const movementTypes = [
  { value: 'PURCHASE', label: 'Entrada (PURCHASE)' },
  { value: 'SALE', label: 'Salida (SALE)' },
  { value: 'ADJUSTMENT', label: 'Ajuste (ADJUSTMENT)' },
];

const adjustmentDirections = [
  { value: 'INCREASE', label: 'Aumentar existencia' },
  { value: 'DECREASE', label: 'Disminuir existencia' },
];

export default function MovementForm({
  token,
  companyId,
  branchId,
  onCancel,
  onDone,
  onSessionExpired,
}) {
  const [products, setProducts] = useState({ status: 'loading', items: [], pages: 1 });
  const [warehouses, setWarehouses] = useState({ status: 'loading', items: [] });
  const [productId, setProductId] = useState(null);
  const [warehouseId, setWarehouseId] = useState(null);
  const [type, setType] = useState('ADJUSTMENT');
  const [adjustmentDirection, setAdjustmentDirection] = useState('INCREASE');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadReferences = useCallback(async () => {
    setProducts((current) => ({ ...current, status: 'loading' }));
    setWarehouses((current) => ({ ...current, status: 'loading' }));

    try {
      const [productsPayload, warehousesPayload] = await Promise.all([
        listProducts(token, companyId, { limit: 100, status: 'ACTIVE' }),
        listWarehouses(token, companyId, {
          status: 'ACTIVE',
          branchId: branchId || undefined,
        }),
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
  }, [token, companyId, branchId, onSessionExpired]);

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
    if (reason.trim().length > 300) {
      setError('El motivo no puede exceder 300 caracteres.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const payload = {
      productId,
      warehouseId,
      type,
      quantity:
        type === 'ADJUSTMENT' && adjustmentDirection === 'DECREASE'
          ? -parsedQuantity
          : parsedQuantity,
    };

    if (reason.trim()) payload.reason = reason.trim();

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
        Entrada y salida usan los tipos PURCHASE y SALE existentes. El ajuste
        registra una diferencia firmada, no una existencia final.
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
        emptyMessage="Aún no hay almacenes activos. Primero registra un almacén en el módulo Inventario."
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

      {type === 'ADJUSTMENT' ? (
        <PickerField
          label="Dirección del ajuste"
          value={adjustmentDirection}
          options={adjustmentDirections}
          onChange={setAdjustmentDirection}
          isRequired
        />
      ) : null}

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
        maxLength={300}
        editable={!submitting}
      />

      <FormField
        label="Referencia (ObjectId)"
        value={referenceId}
        onChangeText={setReferenceId}
        placeholder="Opcional"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={24}
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
