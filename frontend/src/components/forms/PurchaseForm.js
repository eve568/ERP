import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import AppButton from '../AppButton';
import EmptyBlock from '../EmptyBlock';
import FormActions from '../FormActions';
import FormField from '../FormField';
import PickerField from '../PickerField';
import {
  isSessionError,
  listInventory,
  listProducts,
  listSuppliers,
  listWarehouses,
} from '../../services/api';
import { createPurchase } from '../../services/records';
import { colors, radius, spacing, typography } from '../../theme';
import { formatCurrency } from '../../utils/format';

export default function PurchaseForm({
  token,
  companyId,
  branchId,
  userRole,
  onCancel,
  onDone,
  onSessionExpired,
}) {
  const [suppliers, setSuppliers] = useState({
    status: 'loading',
    items: [],
    pages: 1,
    error: null,
  });
  const [warehouses, setWarehouses] = useState({
    status: 'loading',
    items: [],
    error: null,
  });
  const [products, setProducts] = useState({
    status: 'loading',
    items: [],
    pages: 1,
    error: null,
  });
  const [inventory, setInventory] = useState({ status: 'idle', items: [] });
  const [supplierId, setSupplierId] = useState(null);
  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplierPage, setSupplierPage] = useState(1);
  const [warehouseId, setWarehouseId] = useState(null);
  const [productQuery, setProductQuery] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [draftProductId, setDraftProductId] = useState(null);
  const [draftQuantity, setDraftQuantity] = useState('1');
  const [lines, setLines] = useState([]);
  const [lineDrafts, setLineDrafts] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadSuppliersAndWarehouses = useCallback(async () => {
    if (!companyId) {
      setSuppliers({ status: 'empty', items: [], pages: 1, error: null });
      setWarehouses({ status: 'empty', items: [], error: null });
      return;
    }
    setSuppliers((current) => ({ ...current, status: 'loading', error: null }));
    setWarehouses((current) => ({ ...current, status: 'loading', error: null }));
    const [supplierResult, warehouseResult] = await Promise.allSettled([
      listSuppliers(token, companyId, {
        page: supplierPage,
        limit: 100,
        q: supplierQuery.trim() || undefined,
        status: 'ACTIVE',
      }),
      listWarehouses(token, companyId, {
        status: 'ACTIVE',
        branchId: userRole === 'ADMIN' ? undefined : branchId || undefined,
      }),
    ]);
    if (supplierResult.status === 'fulfilled') {
      const items = Array.isArray(supplierResult.value?.data?.items)
        ? supplierResult.value.data.items
        : [];
      setSuppliers({
        status: items.length ? 'ready' : 'empty',
        items,
        pages: supplierResult.value?.data?.pagination?.pages ?? 1,
        error: null,
      });
    } else if (isSessionError(supplierResult.reason)) {
      onSessionExpired?.();
      return;
    } else {
      setSuppliers({
        status: 'error',
        items: [],
        pages: 1,
        error: supplierResult.reason?.message ?? 'No se pudieron cargar los proveedores.',
      });
    }
    if (warehouseResult.status === 'fulfilled') {
      const items = Array.isArray(warehouseResult.value?.data)
        ? warehouseResult.value.data.filter((item) => item.status === 'ACTIVE')
        : [];
      setWarehouses({
        status: items.length ? 'ready' : 'empty',
        items,
        error: null,
      });
    } else if (isSessionError(warehouseResult.reason)) {
      onSessionExpired?.();
    } else {
      setWarehouses({
        status: 'error',
        items: [],
        error:
          warehouseResult.reason?.message ?? 'No se pudieron cargar los almacenes.',
      });
    }
  }, [
    token,
    companyId,
    branchId,
    userRole,
    supplierPage,
    supplierQuery,
    onSessionExpired,
  ]);

  useEffect(() => {
    loadSuppliersAndWarehouses();
  }, [loadSuppliersAndWarehouses]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!companyId) return;
      setProducts((current) => ({ ...current, status: 'loading', error: null }));
      try {
        const payload = await listProducts(token, companyId, {
          page: productPage,
          limit: 100,
          q: productQuery.trim() || undefined,
          status: 'ACTIVE',
        });
        if (cancelled) return;
        const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
        setProducts({
          status: items.length ? 'ready' : 'empty',
          items,
          pages: payload?.data?.pagination?.pages ?? 1,
          error: null,
        });
      } catch (requestError) {
        if (cancelled) return;
        if (isSessionError(requestError)) {
          onSessionExpired?.();
          return;
        }
        setProducts({
          status: 'error',
          items: [],
          pages: 1,
          error: requestError?.message ?? 'No se pudieron cargar los productos.',
        });
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token, companyId, productPage, productQuery, onSessionExpired]);

  useEffect(() => {
    if (!warehouseId || !companyId) {
      setInventory({ status: 'idle', items: [] });
      return undefined;
    }
    let cancelled = false;
    setInventory((current) => ({ ...current, status: 'loading' }));
    listInventory(token, companyId, { warehouseId })
      .then((payload) => {
        if (cancelled) return;
        setInventory({
          status: 'ready',
          items: Array.isArray(payload?.data) ? payload.data : [],
        });
      })
      .catch((requestError) => {
        if (cancelled) return;
        if (isSessionError(requestError)) {
          onSessionExpired?.();
          return;
        }
        setInventory({ status: 'error', items: [], error: requestError?.message });
      });
    return () => {
      cancelled = true;
    };
  }, [token, companyId, warehouseId, onSessionExpired]);

  const supplierOptions = suppliers.items.map((item) => ({
    value: item._id,
    label: `${item.name}${item.taxId ? ` · ${item.taxId}` : ''}`,
  }));
  const warehouseOptions = warehouses.items.map((item) => ({
    value: item._id,
    label: `${item.name}${item.branchId?.name ? ` · ${item.branchId.name}` : ''}`,
  }));
  const stockByProduct = useMemo(
    () =>
      new Map(
        inventory.items.map((row) => [
          row.productId?._id ?? row.productId,
          Number(row.quantity ?? 0),
        ])
      ),
    [inventory.items]
  );
  const productOptions = products.items.map((product) => ({
    value: product._id,
    label: `${product.sku} · ${product.name} · Costo ref. ${formatCurrency(product.purchasePrice)} · ${product.unit}`,
  }));
  const subtotal = lines.reduce(
    (sum, line) => sum + line.quantity * line.price,
    0
  );
  const invalidLine = Object.values(lineDrafts).some((draft) => {
    const quantity = Number(draft.quantity);
    const price = Number(draft.price);
    return (
      !Number.isFinite(quantity) ||
      quantity < 0.0001 ||
      !Number.isFinite(price) ||
      price < 0
    );
  });
  const blocked =
    suppliers.status !== 'ready' ||
    warehouses.status !== 'ready' ||
    products.status !== 'ready' ||
    !supplierId ||
    !warehouseId ||
    !lines.length ||
    invalidLine;

  function addLine() {
    if (!supplierId || !warehouseId) {
      setError('Selecciona proveedor y almacén antes de agregar productos.');
      return;
    }
    const quantity = Number(draftQuantity);
    if (!Number.isFinite(quantity) || quantity < 0.0001) {
      setError('La cantidad debe ser al menos 0.0001.');
      return;
    }
    const product = products.items.find((item) => item._id === draftProductId);
    if (!product) {
      setError('Selecciona un producto disponible.');
      return;
    }
    const current = lines.find((line) => line.productId === product._id);
    const currentQuantity = current?.quantity ?? 0;
    const price = current?.price ?? Number(product.purchasePrice);
    if (!Number.isFinite(price) || price < 0) {
      setError('El costo de referencia del producto no es válido.');
      return;
    }
    setLines((items) =>
      current
        ? items.map((line) =>
            line.productId === product._id
              ? { ...line, quantity: line.quantity + quantity }
              : line
          )
        : [
            ...items,
            {
              productId: product._id,
              name: product.name,
              sku: product.sku,
              unit: product.unit,
              quantity,
              price,
            },
          ]
    );
    if (lineDrafts[product._id]) {
      setLineDrafts((drafts) => ({
        ...drafts,
        [product._id]: {
          quantity: String(currentQuantity + quantity),
          price: String(price),
        },
      }));
    }
    setDraftProductId(null);
    setDraftQuantity('1');
    setError(null);
  }

  function updateLine(productId, field, value) {
    const line = lines.find((item) => item.productId === productId);
    if (!line) return;
    const draft = {
      quantity: String(line.quantity),
      price: String(line.price),
      ...(lineDrafts[productId] ?? {}),
      [field]: value,
    };
    setLineDrafts((current) => ({ ...current, [productId]: draft }));
    const parsed = Number(value);
    if (!value || !Number.isFinite(parsed) || parsed < (field === 'price' ? 0 : 0.0001)) {
      setError(field === 'price' ? 'El costo debe ser mayor o igual a 0.' : 'La cantidad debe ser al menos 0.0001.');
      return;
    }
    setLines((current) =>
      current.map((item) =>
        item.productId === productId
          ? { ...item, [field]: parsed }
          : item
      )
    );
    setError(null);
  }

  function normalizeLine(productId) {
    const line = lines.find((item) => item.productId === productId);
    if (!line) return;
    setLineDrafts((current) => ({
      ...current,
      [productId]: {
        quantity: String(line.quantity),
        price: String(line.price),
      },
    }));
  }

  async function submit() {
    if (submitting) return;
    if (blocked) {
      setError(
        invalidLine
          ? 'Corrige las cantidades y costos del detalle.'
          : 'Completa proveedor, almacén y agrega al menos un producto.'
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createPurchase(token, {
        companyId,
        supplierId,
        warehouseId,
        items: lines.map(({ productId, quantity, price }) => ({
          productId,
          quantity,
          price,
        })),
      });
      onDone('Compra recibida y registrada correctamente.', 'success');
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }
      setError(requestError?.message ?? 'No fue posible registrar la compra.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.note}>
        Al confirmar, el servidor calcula importes usando los costos unitarios
        capturados y registra compra, inventario y movimientos en una transacción.
        El costo de referencia del catálogo no se modifica.
      </Text>
      {suppliers.error ? <Text style={styles.errorText}>{suppliers.error}</Text> : null}
      {warehouses.error ? <Text style={styles.errorText}>{warehouses.error}</Text> : null}

      <View style={styles.row}>
        <View style={styles.halfField}>
          <TextInput
            value={supplierQuery}
            onChangeText={(value) => {
              setSupplierQuery(value);
              setSupplierPage(1);
              setSupplierId(null);
            }}
            placeholder="Buscar proveedor"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            accessibilityLabel="Buscar proveedor por nombre o RFC"
            style={styles.search}
          />
          <PickerField
            label="Proveedor"
            value={supplierId}
            options={supplierOptions}
            onChange={setSupplierId}
            loading={suppliers.status === 'loading'}
            placeholder="Seleccionar proveedor"
            emptyMessage="No hay proveedores activos para esta búsqueda."
            disabled={submitting}
            isRequired
          />
          {suppliers.pages > 1 ? (
            <View style={styles.pagination}>
              <AppButton
                label="Anterior"
                variant="secondary"
                small
                disabled={supplierPage <= 1 || submitting}
                onPress={() => {
                  setSupplierPage((page) => Math.max(page - 1, 1));
                  setSupplierId(null);
                }}
              />
              <Text style={styles.helper}>
                {supplierPage} / {suppliers.pages}
              </Text>
              <AppButton
                label="Siguiente"
                variant="secondary"
                small
                disabled={supplierPage >= suppliers.pages || submitting}
                onPress={() => {
                  setSupplierPage((page) => Math.min(page + 1, suppliers.pages));
                  setSupplierId(null);
                }}
              />
            </View>
          ) : null}
        </View>
        <PickerField
          label="Almacén de recepción"
          value={warehouseId}
          options={warehouseOptions}
          onChange={(value) => {
            setWarehouseId(value);
            setLines([]);
            setLineDrafts({});
            setDraftProductId(null);
          }}
          loading={warehouses.status === 'loading'}
          placeholder="Seleccionar almacén"
          emptyMessage="No hay almacenes activos para esta sucursal."
          disabled={submitting}
          isRequired
          style={styles.halfField}
        />
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Productos</Text>
        <TextInput
          value={productQuery}
          onChangeText={(value) => {
            setProductQuery(value);
            setProductPage(1);
            setDraftProductId(null);
          }}
          placeholder="Buscar por nombre o SKU"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!submitting}
          accessibilityLabel="Buscar productos por nombre o SKU"
          style={styles.search}
        />
        {products.error ? <Text style={styles.errorText}>{products.error}</Text> : null}
        <PickerField
          label="Producto"
          value={draftProductId}
          options={productOptions}
          onChange={setDraftProductId}
          loading={products.status === 'loading'}
          placeholder="Seleccionar producto"
          emptyMessage="No hay productos activos para esta búsqueda."
          disabled={!warehouseId || submitting}
          isRequired
        />
        {products.pages > 1 ? (
          <View style={styles.pagination}>
            <AppButton
              label="Anterior"
              variant="secondary"
              small
              disabled={productPage <= 1 || submitting}
              onPress={() => {
                setProductPage((page) => Math.max(page - 1, 1));
                setDraftProductId(null);
              }}
            />
            <Text style={styles.helper}>
              {productPage} / {products.pages}
            </Text>
            <AppButton
              label="Siguiente"
              variant="secondary"
              small
              disabled={productPage >= products.pages || submitting}
              onPress={() => {
                setProductPage((page) => Math.min(page + 1, products.pages));
                setDraftProductId(null);
              }}
            />
          </View>
        ) : null}
        <View style={styles.row}>
          <FormField
            label="Cantidad"
            value={draftQuantity}
            onChangeText={setDraftQuantity}
            placeholder="1"
            keyboardType="decimal-pad"
            isRequired
            editable={!submitting}
            style={styles.halfField}
          />
          <AppButton
            label="Agregar producto"
            variant="secondary"
            onPress={addLine}
            disabled={!warehouseId || !supplierId || submitting}
            style={styles.addButton}
          />
        </View>
        {warehouseId && inventory.status === 'ready' ? (
          <Text style={styles.helper}>
            Existencia actual en el almacén cargada desde Inventory. La compra
            incrementará esta cantidad.
          </Text>
        ) : null}
        {inventory.status === 'error' ? (
          <Text style={styles.errorText}>
            {inventory.error ?? 'No se pudo cargar la existencia actual.'}
          </Text>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Detalle de compra</Text>
        {lines.length ? (
          <View style={styles.lines}>
            {lines.map((line) => {
              const drafts = lineDrafts[line.productId] ?? {};
              return (
                <View key={line.productId} style={styles.line}>
                  <View style={styles.lineTitle}>
                    <Text style={styles.productName}>{line.name}</Text>
                    <Text style={styles.helper}>
                      {line.sku} · {line.unit} · Existencia:{' '}
                      {stockByProduct.get(line.productId) ?? 0}
                    </Text>
                  </View>
                  <TextInput
                    value={drafts.quantity ?? String(line.quantity)}
                    onChangeText={(value) =>
                      updateLine(line.productId, 'quantity', value)
                    }
                    onEndEditing={() => normalizeLine(line.productId)}
                    editable={!submitting}
                    keyboardType="decimal-pad"
                    accessibilityLabel={`Cantidad de ${line.name}`}
                    style={styles.lineInput}
                  />
                  <TextInput
                    value={drafts.price ?? String(line.price)}
                    onChangeText={(value) =>
                      updateLine(line.productId, 'price', value)
                    }
                    onEndEditing={() => normalizeLine(line.productId)}
                    editable={!submitting}
                    keyboardType="decimal-pad"
                    accessibilityLabel={`Costo unitario de ${line.name}`}
                    style={styles.lineInput}
                  />
                  <Text style={styles.lineSubtotal}>
                    {formatCurrency(line.quantity * line.price)}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setLines((items) =>
                        items.filter((item) => item.productId !== line.productId)
                      );
                      setLineDrafts((draftsByProduct) => {
                        const next = { ...draftsByProduct };
                        delete next[line.productId];
                        return next;
                      });
                    }}
                    disabled={submitting}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar ${line.name}`}
                    style={styles.remove}
                  >
                    <Text style={styles.removeText}>×</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyBlock
            title="Sin productos"
            message="Busca productos activos y agrégalos a la compra."
          />
        )}
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatCurrency(subtotal) ?? '$0.00'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Impuestos</Text>
          <Text style={styles.summaryValue}>$0.00</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(subtotal) ?? '$0.00'}</Text>
        </View>
      </View>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <FormActions
        onSubmit={submit}
        onCancel={onCancel}
        submitLabel="Confirmar recepción"
        submitting={submitting}
        disabled={blocked || submitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  note: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  halfField: { flex: 1, minWidth: 210, gap: spacing.md },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: typography.size.sm,
  },
  block: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  blockTitle: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  helper: { color: colors.textSecondary, fontSize: typography.size.xs },
  addButton: { marginBottom: 1 },
  lines: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lineTitle: { flex: 1, minWidth: 150, gap: 3 },
  productName: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  lineInput: {
    width: 84,
    minHeight: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: typography.size.xs,
    textAlign: 'right',
  },
  lineSubtotal: {
    minWidth: 70,
    color: colors.text,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textAlign: 'right',
  },
  remove: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.pastelPink,
  },
  removeText: {
    color: colors.danger,
    fontSize: typography.size.lg,
    lineHeight: 20,
    fontWeight: typography.weight.bold,
  },
  summary: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    backgroundColor: colors.pastelCyan,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryLabel: {
    color: colors.secondaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  summaryValue: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  divider: { height: 1, backgroundColor: colors.primary, opacity: 0.4 },
  totalLabel: {
    color: colors.secondaryDark,
    fontSize: typography.size.md,
    fontWeight: typography.weight.extraBold,
  },
  totalValue: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.extraBold,
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
