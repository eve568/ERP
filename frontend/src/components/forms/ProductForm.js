import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import FormActions from '../FormActions';
import FormField from '../FormField';
import PickerField from '../PickerField';
import { isSessionError, listCategories } from '../../services/api';
import { createProduct } from '../../services/records';
import { colors, radius, spacing, typography } from '../../theme';

export default function ProductForm({ token, companyId, onCancel, onDone, onSessionExpired }) {
  const [categories, setCategories] = useState({ status: 'loading', items: [] });
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [unit, setUnit] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadCategories = useCallback(async () => {
    setCategories((current) => ({ ...current, status: 'loading' }));

    try {
      const payload = await listCategories(token, companyId);
      const items = Array.isArray(payload?.data) ? payload.data : [];
      setCategories({ status: 'ready', items });
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }

      setCategories({ status: 'error', items: [] });
      setError(requestError?.message ?? 'No fue posible cargar las categorías.');
    }
  }, [token, companyId, onSessionExpired]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const options = categories.items.map((item) => ({
    value: item._id,
    label: item.name,
  }));

  const needsCategory = categories.status === 'ready' && !categories.items.length;

  async function submit() {
    if (!sku.trim() || !name.trim() || !categoryId || !unit.trim()) {
      setError('Completa SKU, nombre, categoría y unidad.');
      return;
    }

    const pricePurchase = Number(purchasePrice);
    const priceSale = Number(salePrice);

    if (!Number.isFinite(pricePurchase) || pricePurchase < 0 ||
        !Number.isFinite(priceSale) || priceSale < 0) {
      setError('Los precios deben ser números mayores o iguales a 0.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      categoryId,
      purchasePrice: pricePurchase,
      salePrice: priceSale,
      unit: unit.trim(),
    };

    if (companyId) payload.companyId = companyId;

    try {
      await createProduct(token, payload);
      onDone('Producto creado correctamente', 'success');
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }

      setError(requestError?.message ?? 'No fue posible crear el producto.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.sectionNote}>
        El producto se agrega al catálogo de la empresa con estado activo.
      </Text>

      <FormField
        label="SKU"
        value={sku}
        onChangeText={setSku}
        placeholder="Ej.: SKU-0001"
        autoCapitalize="characters"
        autoCorrect={false}
        isRequired
        editable={!submitting}
      />

      <FormField
        label="Nombre"
        value={name}
        onChangeText={setName}
        placeholder="Ej.: Papel tamaño carta"
        isRequired
        editable={!submitting}
      />

      <PickerField
        label="Categoría"
        value={categoryId}
        options={options}
        onChange={setCategoryId}
        loading={categories.status === 'loading'}
        placeholder={needsCategory ? 'Sin categorías disponibles' : 'Seleccionar categoría'}
        emptyMessage="Aún no hay categorías en esta empresa. Primero crea una categoría en el módulo Catálogos (próximamente)."
        isRequired
        hint={
          needsCategory
            ? 'No es posible crear productos sin una categoría.'
            : null
        }
      />

      <View style={styles.row}>
        <FormField
          label="Precio de compra"
          value={purchasePrice}
          onChangeText={setPurchasePrice}
          placeholder="0.00"
          keyboardType="numeric"
          isRequired
          editable={!submitting}
          style={styles.half}
        />

        <FormField
          label="Precio de venta"
          value={salePrice}
          onChangeText={setSalePrice}
          placeholder="0.00"
          keyboardType="numeric"
          isRequired
          editable={!submitting}
          style={styles.half}
        />
      </View>

      <FormField
        label="Unidad"
        value={unit}
        onChangeText={setUnit}
        placeholder="Ej.: pza, kg, caja"
        isRequired
        editable={!submitting}
        hint="Sin existencia inicial: el stock se registra con movimientos de inventario."
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FormActions
        onSubmit={submit}
        onCancel={onCancel}
        submitLabel="Crear producto"
        submitting={submitting}
        disabled={needsCategory || categories.status !== 'ready'}
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

  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },

  half: {
    flex: 1,
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
