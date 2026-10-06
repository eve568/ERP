import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppButton from '../AppButton';
import FormActions from '../FormActions';
import FormField from '../FormField';
import PickerField from '../PickerField';
import { isSessionError, listCategories } from '../../services/api';
import {
  createCategory,
  createProduct,
  updateProduct,
} from '../../services/records';
import { colors, radius, spacing, typography } from '../../theme';

function getCategoryId(category) {
  if (typeof category === 'string') return category;
  return category?._id ?? category?.id ?? null;
}

function initialValues(product) {
  return {
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    categoryId: getCategoryId(product?.categoryId),
    purchasePrice:
      product?.purchasePrice === undefined
        ? ''
        : String(product.purchasePrice),
    salePrice:
      product?.salePrice === undefined ? '' : String(product.salePrice),
    unit: product?.unit ?? '',
  };
}

function validate(values) {
  const requiredFields = [
    ['sku', 'El SKU es obligatorio.'],
    ['name', 'El nombre es obligatorio.'],
    ['categoryId', 'Selecciona una categoría.'],
    ['purchasePrice', 'El precio de compra es obligatorio.'],
    ['salePrice', 'El precio de venta es obligatorio.'],
    ['unit', 'La unidad es obligatoria.'],
  ];

  for (const [field, message] of requiredFields) {
    if (!String(values[field]).trim()) return message;
  }

  for (const [field, label] of [
    ['purchasePrice', 'El precio de compra'],
    ['salePrice', 'El precio de venta'],
  ]) {
    const value = Number(values[field]);
    if (!Number.isFinite(value) || value < 0) {
      return `${label} debe ser un número mayor o igual a 0.`;
    }
  }

  if (values.sku.trim().length > 60) return 'El SKU no puede exceder 60 caracteres.';
  if (values.name.trim().length > 160) return 'El nombre no puede exceder 160 caracteres.';
  if (values.description.trim().length > 500) return 'La descripción no puede exceder 500 caracteres.';
  if (values.unit.trim().length > 30) return 'La unidad no puede exceder 30 caracteres.';

  return null;
}

export default function ProductForm({
  token,
  companyId,
  product = null,
  onCancel,
  onDone,
  onSessionExpired,
}) {
  const [categories, setCategories] = useState({
    status: 'loading',
    items: [],
    error: null,
  });
  const [values, setValues] = useState(() => initialValues(product));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryError, setCategoryError] = useState(null);
  const isEditing = Boolean(product?._id);

  const loadCategories = useCallback(async () => {
    if (!companyId) {
      setCategories({
        status: 'error',
        items: [],
        error: 'Selecciona una empresa activa antes de continuar.',
      });
      return;
    }

    setCategories((current) => ({ ...current, status: 'loading', error: null }));

    try {
      const payload = await listCategories(token, companyId, { status: 'ACTIVE' });
      const items = Array.isArray(payload?.data) ? payload.data : [];
      const currentCategory = product?.categoryId;
      const currentCategoryId = getCategoryId(currentCategory);

      if (
        currentCategoryId &&
        !items.some((category) => category._id === currentCategoryId) &&
        currentCategory &&
        typeof currentCategory === 'object'
      ) {
        items.push(currentCategory);
      }

      setCategories({
        status: items.length ? 'ready' : 'empty',
        items,
        error: null,
      });
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }

      setCategories({
        status: 'error',
        items: [],
        error:
          requestError?.message ?? 'No fue posible cargar las categorías.',
      });
    }
  }, [token, companyId, product, onSessionExpired]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const categoryOptions = categories.items.map((category) => ({
    value: category._id,
    label:
      category.status === 'INACTIVE'
        ? `${category.name} (inactiva)`
        : category.name,
  }));

  function changeField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  async function saveCategory() {
    const name = categoryName.trim();
    const description = categoryDescription.trim();
    if (!name) {
      setCategoryError('El nombre de la categoría es obligatorio.');
      return;
    }
    if (name.length > 120) {
      setCategoryError('El nombre de la categoría no puede exceder 120 caracteres.');
      return;
    }
    if (description.length > 300) {
      setCategoryError('La descripción no puede exceder 300 caracteres.');
      return;
    }

    setCategorySubmitting(true);
    setCategoryError(null);
    try {
      const payload = await createCategory(token, { name, description });
      const newCategory = payload?.data;
      if (!newCategory?._id) {
        throw new Error('La respuesta al crear la categoría no es válida.');
      }

      setCategories((current) => ({
        status: 'ready',
        items: [...current.items, newCategory].sort((left, right) =>
          left.name.localeCompare(right.name)
        ),
        error: null,
      }));
      changeField('categoryId', newCategory._id);
      setCategoryName('');
      setCategoryDescription('');
      setShowCategoryForm(false);
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }
      setCategoryError(
        requestError?.message ?? 'No fue posible crear la categoría.'
      );
    } finally {
      setCategorySubmitting(false);
    }
  }

  async function submit() {
    const validationError = validate(values);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      sku: values.sku.trim().toUpperCase(),
      name: values.name.trim(),
      description: values.description.trim(),
      categoryId: values.categoryId,
      purchasePrice: Number(values.purchasePrice),
      salePrice: Number(values.salePrice),
      unit: values.unit.trim(),
    };

    try {
      if (isEditing) {
        await updateProduct(token, product._id, payload);
      } else {
        await createProduct(token, payload);
      }

      onDone?.(
        `Producto ${isEditing ? 'actualizado' : 'creado'} correctamente.`,
        'success'
      );
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }

      setError(
        requestError?.message ??
          `No fue posible ${isEditing ? 'actualizar' : 'crear'} el producto.`
      );
    } finally {
      setSubmitting(false);
    }
  }

  const noCategories = categories.status === 'empty';

  return (
    <View style={styles.form}>
      <Text style={styles.sectionNote}>
        Captura los datos del catálogo. Las existencias se administran desde
        Inventario y no se modifican en este formulario.
      </Text>

      <FormField
        label="SKU"
        value={values.sku}
        onChangeText={(value) => changeField('sku', value)}
        placeholder="Ej.: SKU-0001"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={60}
        isRequired
        editable={!submitting}
      />

      <FormField
        label="Nombre"
        value={values.name}
        onChangeText={(value) => changeField('name', value)}
        placeholder="Ej.: Papel tamaño carta"
        maxLength={160}
        isRequired
        editable={!submitting}
      />

      <FormField
        label="Descripción"
        value={values.description}
        onChangeText={(value) => changeField('description', value)}
        placeholder="Descripción del producto"
        maxLength={500}
        editable={!submitting}
      />

      <PickerField
        label="Categoría"
        value={values.categoryId}
        options={categoryOptions}
        onChange={(value) => changeField('categoryId', value)}
        loading={categories.status === 'loading'}
        disabled={categories.status === 'error'}
        placeholder={noCategories ? 'Sin categorías activas' : 'Seleccionar categoría'}
        emptyMessage="No hay categorías activas disponibles."
        error={categories.status === 'error' ? categories.error : null}
        isRequired
      />

      {categories.status === 'error' ? (
        <AppButton
          label="Reintentar carga de categorías"
          variant="secondary"
          small
          onPress={loadCategories}
        />
      ) : null}

      {noCategories ? (
        <View style={styles.categorySetup}>
          <Text style={styles.categoryHint}>
            Para crear productos se requiere una categoría. Puedes crear una
            aquí; la administración completa de categorías sigue pendiente.
          </Text>
          {!showCategoryForm ? (
            <AppButton
              label="Crear categoría"
              variant="secondary"
              small
              onPress={() => setShowCategoryForm(true)}
            />
          ) : (
            <View style={styles.categoryForm}>
              <FormField
                label="Nombre de categoría"
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="Ej.: Papelería"
                maxLength={120}
                isRequired
                editable={!categorySubmitting}
              />
              <FormField
                label="Descripción de categoría"
                value={categoryDescription}
                onChangeText={setCategoryDescription}
                placeholder="Opcional"
                maxLength={300}
                editable={!categorySubmitting}
              />
              {categoryError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{categoryError}</Text>
                </View>
              ) : null}
              <View style={styles.categoryActions}>
                <AppButton
                  label="Cancelar categoría"
                  variant="secondary"
                  small
                  disabled={categorySubmitting}
                  onPress={() => {
                    setShowCategoryForm(false);
                    setCategoryError(null);
                  }}
                />
                <AppButton
                  label="Guardar categoría"
                  small
                  loading={categorySubmitting}
                  onPress={saveCategory}
                />
              </View>
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.row}>
        <FormField
          label="Precio de compra"
          value={values.purchasePrice}
          onChangeText={(value) => changeField('purchasePrice', value)}
          placeholder="0.00"
          keyboardType="numeric"
          isRequired
          editable={!submitting}
          style={styles.half}
        />

        <FormField
          label="Precio de venta"
          value={values.salePrice}
          onChangeText={(value) => changeField('salePrice', value)}
          placeholder="0.00"
          keyboardType="numeric"
          isRequired
          editable={!submitting}
          style={styles.half}
        />
      </View>

      <FormField
        label="Unidad"
        value={values.unit}
        onChangeText={(value) => changeField('unit', value)}
        placeholder="Ej.: pza, kg, caja"
        maxLength={30}
        isRequired
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
        submitLabel={isEditing ? 'Guardar cambios' : 'Crear producto'}
        submitting={submitting}
        disabled={categories.status !== 'ready'}
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

  categoryHint: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    lineHeight: 18,
  },

  categorySetup: {
    gap: spacing.md,
  },

  categoryForm: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },

  categoryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
