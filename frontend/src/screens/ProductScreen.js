import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppButton from '../components/AppButton';
import AppModal from '../components/AppModal';
import EmptyBlock from '../components/EmptyBlock';
import PickerField from '../components/PickerField';
import ProductForm from '../components/forms/ProductForm';
import { isSessionError, listCategories, listProducts } from '../services/api';
import { updateProduct } from '../services/records';
import { colors, radius, spacing, typography } from '../theme';
import { formatCurrency } from '../utils/format';

const PAGE_SIZE = 20;
const statusOptions = [
  { label: 'Todos los estados', value: '' },
  { label: 'Activos', value: 'ACTIVE' },
  { label: 'Inactivos', value: 'INACTIVE' },
];

function ProductDetails({ product }) {
  const details = [
    ['SKU', product.sku],
    ['Categoría', product.categoryId?.name],
    ['Descripción', product.description],
    ['Precio de compra', formatCurrency(product.purchasePrice)],
    ['Precio de venta', formatCurrency(product.salePrice)],
    ['Unidad', product.unit],
    ['Estado', product.status === 'ACTIVE' ? 'Activo' : 'Inactivo'],
  ];

  return (
    <View style={styles.details}>
      {details.map(([label, value]) =>
        value === undefined || value === null || value === '' ? null : (
          <View key={label} style={styles.detailField}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{String(value)}</Text>
          </View>
        )
      )}
    </View>
  );
}

function ProductListState({ status, error, onRetry }) {
  if (status === 'loading') {
    return (
      <View style={styles.stateCard}>
        <ActivityIndicator color={colors.primaryDark} />
        <Text style={styles.stateText}>Cargando productos...</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.stateCard}>
        <Text style={styles.errorText}>{error}</Text>
        <AppButton
          label="Reintentar"
          variant="secondary"
          small
          onPress={onRetry}
        />
      </View>
    );
  }

  return null;
}

export default function ProductScreen({
  token,
  companyId,
  refreshKey,
  onSessionExpired,
  onToast,
}) {
  const [categories, setCategories] = useState({
    status: 'loading',
    items: [],
    error: null,
  });
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);
  const [products, setProducts] = useState({
    status: 'loading',
    items: [],
    pagination: { page: 1, pages: 1, total: 0 },
    error: null,
  });
  const [modal, setModal] = useState({ mode: null, product: null });
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!companyId) {
      setCategories({ status: 'empty', items: [], error: null });
      return undefined;
    }

    let cancelled = false;

    async function load() {
      setCategories((current) => ({
        ...current,
        status: 'loading',
        error: null,
      }));

      try {
        const payload = await listCategories(token, companyId, {
          status: 'ACTIVE',
        });
        if (cancelled) return;
        const items = Array.isArray(payload?.data) ? payload.data : [];
        setCategories({
          status: items.length ? 'ready' : 'empty',
          items,
          error: null,
        });
      } catch (requestError) {
        if (cancelled) return;
        if (isSessionError(requestError)) {
          onSessionExpired?.();
          return;
        }
        setCategories({
          status: 'error',
          items: [],
          error:
            requestError?.message ?? 'No se pudieron cargar las categorías.',
        });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [token, companyId, refreshKey, refreshTick, onSessionExpired]);

  useEffect(() => {
    if (!companyId) {
      setProducts({
        status: 'empty',
        items: [],
        pagination: { page: 1, pages: 1, total: 0 },
        error: null,
      });
      return undefined;
    }

    let cancelled = false;
    setProducts((current) => ({ ...current, status: 'loading', error: null }));

    listProducts(token, companyId, {
      page,
      limit: PAGE_SIZE,
      q: query.trim() || undefined,
      status: statusFilter || undefined,
      categoryId: categoryFilter || undefined,
    })
      .then((payload) => {
        if (cancelled) return;
        const data = payload?.data ?? {};
        const items = Array.isArray(data.items) ? data.items : [];
        const pagination = data.pagination ?? {
          page,
          pages: 1,
          total: items.length,
        };
        const pages = Math.max(pagination.pages ?? 1, 1);
        if (page > pages) {
          setPage(pages);
          return;
        }
        setProducts({
          status: items.length ? 'ready' : 'empty',
          items,
          pagination: {
            page: pagination.page ?? page,
            pages,
            total: pagination.total ?? items.length,
          },
          error: null,
        });
      })
      .catch((requestError) => {
        if (cancelled) return;
        if (isSessionError(requestError)) {
          onSessionExpired?.();
          return;
        }
        setProducts({
          status: 'error',
          items: [],
          pagination: { page, pages: 1, total: 0 },
          error:
            requestError?.message ?? 'No se pudieron cargar los productos.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    token,
    companyId,
    query,
    categoryFilter,
    statusFilter,
    page,
    refreshKey,
    refreshTick,
    onSessionExpired,
  ]);

  function openCreate() {
    setModal({ mode: 'create', product: null });
  }

  function closeModal() {
    setModal({ mode: null, product: null });
  }

  function handleSaved(message, type) {
    closeModal();
    onToast?.(message, type);
    setRefreshTick((current) => current + 1);
  }

  async function toggleStatus(product) {
    setBusyId(product._id);
    try {
      await updateProduct(token, product._id, {
        status: product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      onToast?.(
        `Producto ${
          product.status === 'ACTIVE' ? 'desactivado' : 'activado'
        } correctamente.`,
        'success'
      );
      setRefreshTick((current) => current + 1);
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }
      onToast?.(
        requestError?.message ?? 'No se pudo actualizar el estado del producto.',
        'error'
      );
    } finally {
      setBusyId(null);
    }
  }

  const companyUnavailable = !companyId;
  const pageCount = products.pagination.pages;
  const selectedProduct = modal.product;

  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Productos</Text>
          <Text style={styles.subtitle}>
            Catálogo de la empresa activa · {products.pagination.total} en total
          </Text>
        </View>
        <AppButton
          label="Nuevo producto"
          onPress={openCreate}
          disabled={companyUnavailable}
        />
      </View>

      {companyUnavailable ? (
        <EmptyBlock
          title="Empresa no disponible"
          message="Selecciona una empresa activa o verifica que tu usuario esté asociado a una empresa."
        />
      ) : (
        <>
          <View style={styles.filters}>
            <TextInput
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="Buscar por nombre o SKU"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.search}
              accessibilityLabel="Buscar productos por nombre o SKU"
            />
            <PickerField
              label="Categoría"
              value={categoryFilter}
              options={[
                { label: 'Todas las categorías', value: '' },
                ...categories.items.map((category) => ({
                  label: category.name,
                  value: category._id,
                })),
              ]}
              loading={categories.status === 'loading'}
              disabled={categories.status === 'error'}
              onChange={(value) => {
                setCategoryFilter(value);
                setPage(1);
              }}
              style={styles.filterPicker}
              error={categories.status === 'error' ? categories.error : null}
              emptyMessage="No hay categorías activas disponibles."
            />
            {categories.status === 'error' ? (
              <AppButton
                label="Reintentar categorías"
                variant="secondary"
                small
                onPress={() => setRefreshTick((current) => current + 1)}
              />
            ) : null}
            <PickerField
              label="Estado"
              value={statusFilter}
              options={statusOptions}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              style={styles.filterPicker}
            />
          </View>

          <ProductListState
            status={products.status}
            error={products.error}
            onRetry={() => setRefreshTick((current) => current + 1)}
          />

          {products.status === 'empty' ? (
            <EmptyBlock
              title={
                query.trim() || categoryFilter || statusFilter
                  ? 'Sin resultados'
                  : 'Sin productos'
              }
              message={
                query.trim() || categoryFilter || statusFilter
                  ? 'No hay productos que coincidan con los filtros aplicados.'
                  : 'Aún no hay productos registrados para esta empresa.'
              }
            />
          ) : null}

          {products.status === 'ready' ? (
            <View style={styles.list}>
              {products.items.map((product) => (
                <View key={product._id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.productIdentity}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productMeta}>
                        SKU: {product.sku} · {product.categoryId?.name ?? 'Sin categoría'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        product.status === 'ACTIVE'
                          ? styles.statusActive
                          : styles.statusInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          product.status === 'ACTIVE'
                            ? styles.statusActiveText
                            : styles.statusInactiveText,
                        ]}
                      >
                        {product.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.productPrice}>
                    Venta: {product.salePrice} · Costo: {product.purchasePrice}{' '}
                    · {product.unit}
                  </Text>

                  <View style={styles.actions}>
                    <AppButton
                      label="Ver"
                      variant="secondary"
                      small
                      onPress={() => setModal({ mode: 'details', product })}
                    />
                    <AppButton
                      label="Editar"
                      variant="secondary"
                      small
                      onPress={() => setModal({ mode: 'edit', product })}
                    />
                    <AppButton
                      label={product.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                      variant={product.status === 'ACTIVE' ? 'danger' : 'primary'}
                      small
                      loading={busyId === product._id}
                      disabled={Boolean(busyId)}
                      onPress={() => toggleStatus(product)}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {products.status !== 'error' &&
          products.status !== 'loading' &&
          pageCount > 1 ? (
            <View style={styles.pagination}>
              <AppButton
                label="Anterior"
                variant="secondary"
                small
                disabled={page <= 1}
                onPress={() => setPage((current) => Math.max(current - 1, 1))}
              />
              <Text style={styles.pageText}>
                Página {products.pagination.page} de {pageCount}
              </Text>
              <AppButton
                label="Siguiente"
                variant="secondary"
                small
                disabled={page >= pageCount}
                onPress={() =>
                  setPage((current) => Math.min(current + 1, pageCount))
                }
              />
            </View>
          ) : null}
        </>
      )}

      <AppModal
        visible={modal.mode === 'create' || modal.mode === 'edit'}
        title={`${modal.mode === 'edit' ? 'Editar' : 'Nuevo'} producto`}
        subtitle="Información del catálogo de la empresa activa."
        onClose={closeModal}
        maxWidth={560}
      >
        {modal.mode === 'create' || modal.mode === 'edit' ? (
          <ProductForm
            key={`${modal.mode}-${selectedProduct?._id ?? 'new'}`}
            token={token}
            companyId={companyId}
            product={selectedProduct}
            onCancel={closeModal}
            onDone={handleSaved}
            onSessionExpired={onSessionExpired}
          />
        ) : null}
      </AppModal>

      <AppModal
        visible={modal.mode === 'details'}
        title={selectedProduct?.name ?? 'Producto'}
        subtitle="Información del catálogo"
        onClose={closeModal}
        maxWidth={520}
        footer={
          <>
            <AppButton
              label="Cerrar"
              variant="secondary"
              onPress={closeModal}
            />
            <AppButton
              label="Editar"
              onPress={() => setModal({ mode: 'edit', product: selectedProduct })}
            />
          </>
        }
      >
        {modal.mode === 'details' && selectedProduct ? (
          <ProductDetails product={selectedProduct} />
        ) : null}
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
  },

  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  headingCopy: {
    flex: 1,
  },

  title: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.extraBold,
  },

  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginTop: 4,
  },

  filters: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.md,
  },

  search: {
    flex: 1,
    minWidth: 220,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: typography.size.sm,
  },

  filterPicker: {
    width: 220,
  },

  list: {
    gap: spacing.md,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  productIdentity: {
    flex: 1,
    gap: 4,
  },

  productName: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },

  productMeta: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
  },

  productPrice: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },

  statusActive: {
    backgroundColor: colors.pastelGreen,
  },

  statusInactive: {
    backgroundColor: colors.pastelPink,
  },

  statusText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },

  statusActiveText: {
    color: colors.secondaryDark,
  },

  statusInactiveText: {
    color: colors.danger,
  },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },

  stateCard: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },

  stateText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
  },

  errorText: {
    color: colors.danger,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },

  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },

  pageText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
  },

  details: {
    gap: spacing.lg,
  },

  detailField: {
    gap: spacing.xs,
  },

  detailLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
  },

  detailValue: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});
