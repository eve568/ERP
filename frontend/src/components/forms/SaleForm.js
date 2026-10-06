import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppButton from '../AppButton';
import EmptyBlock from '../EmptyBlock';
import FormActions from '../FormActions';
import FormField from '../FormField';
import PickerField from '../PickerField';
import {
  isSessionError,
  listCustomers,
  listInventory,
  listProducts,
  listWarehouses,
} from '../../services/api';
import { createSale } from '../../services/records';
import { colors, radius, spacing, typography } from '../../theme';
import { formatCurrency } from '../../utils/format';

const paymentMethods = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CREDIT', label: 'Crédito' },
];

export default function SaleForm({
  token,
  companyId,
  branchId,
  userRole,
  onCancel,
  onDone,
  onSessionExpired,
}) {
  const [customers, setCustomers] = useState({
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
  const [inventory, setInventory] = useState({
    status: 'idle',
    items: [],
    error: null,
  });
  const [customerId, setCustomerId] = useState(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerPage, setCustomerPage] = useState(1);
  const [warehouseId, setWarehouseId] = useState(null);
  const [productQuery, setProductQuery] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [draftProductId, setDraftProductId] = useState(null);
  const [draftQuantity, setDraftQuantity] = useState('1');
  const [lines, setLines] = useState([]);
  const [lineQuantityDrafts, setLineQuantityDrafts] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadReferences = useCallback(async () => {
    if (!companyId) {
      setCustomers({ status: 'empty', items: [], pages: 1, error: null });
      setWarehouses({ status: 'empty', items: [], error: null });
      return;
    }
    setCustomers((current) => ({ ...current, status: 'loading', error: null }));
    setWarehouses((current) => ({ ...current, status: 'loading', error: null }));

    const [customerResult, warehouseResult] = await Promise.allSettled([
      listCustomers(token, companyId, {
        page: customerPage,
        limit: 100,
        q: customerQuery.trim() || undefined,
        status: 'ACTIVE',
      }),
      listWarehouses(token, companyId, {
        status: 'ACTIVE',
        branchId: userRole === 'ADMIN' ? undefined : branchId || undefined,
      }),
    ]);

    if (customerResult.status === 'fulfilled') {
      const items = Array.isArray(customerResult.value?.data?.items)
        ? customerResult.value.data.items
        : [];
      setCustomers({
        status: items.length ? 'ready' : 'empty',
        items,
        pages: customerResult.value?.data?.pagination?.pages ?? 1,
        error: null,
      });
    } else if (isSessionError(customerResult.reason)) {
      onSessionExpired?.();
      return;
    } else {
      setCustomers({
        status: 'error',
        items: [],
        pages: 1,
        error: customerResult.reason?.message ?? 'No se pudieron cargar los clientes.',
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
    customerPage,
    customerQuery,
    onSessionExpired,
  ]);

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
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token, companyId, productQuery, productPage, onSessionExpired]);

  useEffect(() => {
    loadReferences();
  }, [loadReferences]);

  useEffect(() => {
    if (!warehouseId || !companyId) {
      setInventory({ status: 'idle', items: [], error: null });
      return undefined;
    }
    let cancelled = false;
    setInventory((current) => ({ ...current, status: 'loading', error: null }));
    const timer = setTimeout(async () => {
      try {
        const payload = await listInventory(token, companyId, {
          warehouseId,
        });
        if (cancelled) return;
        const items = Array.isArray(payload?.data) ? payload.data : [];
        setInventory({
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
        setInventory({
          status: 'error',
          items: [],
          error: requestError?.message ?? 'No se pudo cargar la existencia disponible.',
        });
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token, companyId, warehouseId, onSessionExpired]);

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
  const customerOptions = customers.items.map((item) => ({
    value: item._id,
    label: `${item.name}${item.taxId ? ` · ${item.taxId}` : ''}`,
  }));
  const warehouseOptions = warehouses.items.map((item) => ({
    value: item._id,
    label: `${item.name}${item.branchId?.name ? ` · ${item.branchId.name}` : ''}`,
  }));
  const productOptions = products.items.map((item) => {
    const stock = stockByProduct.get(item._id) ?? 0;
    return {
      value: item._id,
      label: `${item.sku} · ${item.name} · ${formatCurrency(item.salePrice)} · Disponible: ${stock}`,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const hasInvalidLineQuantity = Object.entries(lineQuantityDrafts).some(
    ([productId, value]) => {
      const quantity = Number(value);
      return (
        !value ||
        !Number.isFinite(quantity) ||
        quantity < 0.0001 ||
        quantity > (stockByProduct.get(productId) ?? 0)
      );
    }
  );
  const referencesReady =
    customers.status === 'ready' &&
    warehouses.status === 'ready' &&
    products.status === 'ready';
  const blocked =
    !referencesReady || !customerId || !warehouseId || lines.length === 0;

  function addLine() {
    if (!warehouseId) {
      setError('Selecciona el almacén antes de agregar productos.');
      return;
    }
    if (!draftProductId) {
      setError('Selecciona el producto que quieres agregar.');
      return;
    }

    const quantity = Number(draftQuantity);
    if (!Number.isFinite(quantity) || quantity < 0.0001) {
      setError('La cantidad debe ser al menos 0.0001.');
      return;
    }
    const product = products.items.find((item) => item._id === draftProductId);
    if (!product) {
      setError('El producto seleccionado ya no está disponible.');
      return;
    }
    const currentQuantity =
      lines.find((line) => line.productId === product._id)?.quantity ?? 0;
    const available = stockByProduct.get(product._id) ?? 0;
    if (currentQuantity + quantity > available) {
      setError(`Existencia insuficiente. Disponible: ${available}.`);
      return;
    }

    const price = Number(product.salePrice);
    setLines((current) => {
      const existing = current.find((line) => line.productId === product._id);
      if (existing) {
        return current.map((line) =>
          line.productId === product._id
            ? { ...line, quantity: line.quantity + quantity }
            : line
        );
      }
      return [
        ...current,
        {
          productId: product._id,
          name: product.name,
          sku: product.sku,
          unit: product.unit ?? '',
          price: Number.isFinite(price) ? price : 0,
          quantity,
        },
      ];
    });
    setDraftProductId(null);
    setDraftQuantity('1');
    setLineQuantityDrafts((current) => {
      if (!Object.hasOwn(current, product._id)) return current;
      return { ...current, [product._id]: String(currentQuantity + quantity) };
    });
    setError(null);
  }

  function changeLineQuantity(productId, value) {
    setLineQuantityDrafts((current) => ({ ...current, [productId]: value }));
    const nextQuantity = Number(value);
    if (!value || !Number.isFinite(nextQuantity) || nextQuantity < 0.0001) {
      setError('La cantidad debe ser al menos 0.0001.');
      return;
    }
    const available = stockByProduct.get(productId) ?? 0;
    if (nextQuantity > available) {
      setError(`Existencia insuficiente. Disponible: ${available}.`);
      return;
    }
    setLines((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, quantity: nextQuantity } : item
      )
    );
    setError(null);
  }

  function normalizeLineQuantity(productId) {
    const quantity = lines.find((line) => line.productId === productId)?.quantity;
    setLineQuantityDrafts((current) => {
      const next = { ...current };
      if (quantity === undefined) delete next[productId];
      else next[productId] = String(quantity);
      return next;
    });
    setError(null);
  }

  async function submit() {
    if (submitting) return;
    if (!customerId || !warehouseId || !lines.length || hasInvalidLineQuantity) {
      setError(
        hasInvalidLineQuantity
          ? 'Corrige las cantidades del detalle antes de confirmar.'
          : 'Selecciona cliente y almacén, y agrega al menos un producto.'
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createSale(token, {
        companyId,
        customerId,
        warehouseId,
        items: lines.map(({ productId, quantity }) => ({ productId, quantity })),
        paymentMethod,
      });
      onDone('Venta confirmada correctamente.', 'success');
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }
      setError(requestError?.message ?? 'No fue posible confirmar la venta.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.sectionNote}>
        Al confirmar, el backend valida precios y existencias y registra la venta,
        el descuento de inventario y sus movimientos en una sola transacción.
      </Text>

      {customers.status === 'error' ? (
        <Text style={styles.errorText}>{customers.error}</Text>
      ) : null}
      {warehouses.status === 'error' ? (
        <Text style={styles.errorText}>{warehouses.error}</Text>
      ) : null}

      <View style={styles.row}>
        <View style={styles.halfField}>
          <TextInput
            value={customerQuery}
            onChangeText={(value) => {
              setCustomerQuery(value);
              setCustomerPage(1);
              setCustomerId(null);
            }}
            placeholder="Buscar cliente"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            accessibilityLabel="Buscar clientes por nombre o RFC"
            style={styles.search}
          />
          <PickerField
            label="Cliente"
            value={customerId}
            options={customerOptions}
            onChange={setCustomerId}
            loading={customers.status === 'loading'}
            placeholder="Seleccionar cliente"
            emptyMessage="No hay clientes activos que coincidan con la búsqueda."
            disabled={submitting}
            isRequired
          />
          {customers.pages > 1 ? (
            <View style={styles.pagination}>
              <AppButton
                label="Anterior"
                variant="secondary"
                small
                disabled={customerPage <= 1 || submitting}
                onPress={() => {
                  setCustomerPage((page) => Math.max(page - 1, 1));
                  setCustomerId(null);
                }}
              />
              <Text style={styles.helperText}>
                Página {customerPage} de {customers.pages}
              </Text>
              <AppButton
                label="Siguiente"
                variant="secondary"
                small
                disabled={customerPage >= customers.pages || submitting}
                onPress={() => {
                  setCustomerPage((page) => Math.min(page + 1, customers.pages));
                  setCustomerId(null);
                }}
              />
            </View>
          ) : null}
        </View>
        <PickerField
          label="Almacén"
          value={warehouseId}
          options={warehouseOptions}
          onChange={(value) => {
            setWarehouseId(value);
            setLines([]);
            setLineQuantityDrafts({});
            setDraftProductId(null);
            setError(null);
          }}
          loading={warehouses.status === 'loading'}
          placeholder="Seleccionar almacén"
          emptyMessage="No hay almacenes activos disponibles para esta sucursal."
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
        {!warehouseId ? (
          <Text style={styles.helperText}>
            Selecciona un almacén para consultar existencia y disponibilidad.
          </Text>
        ) : inventory.status === 'loading' ? (
          <Text style={styles.helperText}>Consultando existencia real...</Text>
        ) : inventory.status === 'error' ? (
          <Text style={styles.errorText}>{inventory.error}</Text>
        ) : (
          <Text style={styles.helperText}>
            La existencia disponible se consulta desde Inventory para este almacén.
          </Text>
        )}
        {products.status === 'error' ? (
          <Text style={styles.errorText}>{products.error}</Text>
        ) : null}
        <PickerField
          label="Producto"
          value={draftProductId}
          options={productOptions}
          onChange={setDraftProductId}
          loading={products.status === 'loading' || inventory.status === 'loading'}
          placeholder={
            products.status === 'ready'
              ? 'Seleccionar producto'
              : 'Sin productos disponibles'
          }
          emptyMessage={
            warehouseId
              ? 'No hay productos activos que coincidan con la búsqueda.'
              : 'Primero selecciona un almacén.'
          }
          disabled={!warehouseId || submitting}
          isRequired
          hint={products.pages > 1 ? 'Se muestran hasta 100 coincidencias.' : null}
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
            <Text style={styles.helperText}>
              Página {productPage} de {products.pages}
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
        <View style={styles.addRow}>
          <FormField
            label="Cantidad"
            value={draftQuantity}
            onChangeText={setDraftQuantity}
            placeholder="1"
            keyboardType="decimal-pad"
            isRequired
            editable={!submitting}
            style={styles.quantityField}
          />
          <AppButton
            label="Agregar"
            variant="secondary"
            onPress={addLine}
            disabled={!warehouseId || submitting || inventory.status === 'loading'}
            style={styles.addButton}
          />
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Detalle de venta</Text>
        {lines.length ? (
          <View style={styles.lines}>
            {lines.map((line) => (
              <View key={line.productId} style={styles.line}>
                <View style={styles.lineCopy}>
                  <Text style={styles.lineName} numberOfLines={2}>
                    {line.name}
                  </Text>
                  <Text style={styles.lineMeta}>
                    {line.sku} · {formatCurrency(line.price)} por {line.unit || 'unidad'}
                  </Text>
                </View>
                <View style={styles.quantityControl}>
                  <TextInput
                    value={lineQuantityDrafts[line.productId] ?? String(line.quantity)}
                    onChangeText={(value) =>
                      changeLineQuantity(line.productId, value)
                    }
                    onEndEditing={() => normalizeLineQuantity(line.productId)}
                    editable={!submitting}
                    keyboardType="decimal-pad"
                    accessibilityLabel={`Cantidad de ${line.name}`}
                    style={styles.lineQuantityInput}
                  />
                </View>
                <Text style={styles.lineSubtotal}>
                  {formatCurrency(line.price * line.quantity)}
                </Text>
                <Pressable
                  onPress={() => {
                    setLines((current) =>
                      current.filter((item) => item.productId !== line.productId)
                    );
                    setLineQuantityDrafts((current) => {
                      const next = { ...current };
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
            ))}
          </View>
        ) : (
          <EmptyBlock
            title="Carrito vacío"
            message="Selecciona productos disponibles y agrégalos para continuar."
          />
        )}
      </View>

      <PickerField
        label="Método de pago"
        value={paymentMethod}
        options={paymentMethods}
        onChange={setPaymentMethod}
        placeholder="Seleccionar"
        disabled={submitting}
        isRequired
      />

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatCurrency(subtotal) ?? '$0.00'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Impuestos</Text>
          <Text style={styles.summaryValue}>$0.00</Text>
        </View>
        <View style={styles.summaryDivider} />
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
        submitLabel="Confirmar venta"
        submitting={submitting}
        disabled={
          blocked ||
          submitting ||
          inventory.status === 'error' ||
          hasInvalidLineQuantity
        }
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
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
    minWidth: 210,
    gap: spacing.md,
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
  helperText: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-end',
  },
  quantityField: {
    flex: 1,
  },
  addButton: {
    marginBottom: 1,
  },
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
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lineCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  lineName: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  lineMeta: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lineQuantityInput: {
    width: 76,
    minHeight: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  lineSubtotal: {
    minWidth: 62,
    color: colors.text,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textAlign: 'right',
  },
  remove: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pastelPink,
  },
  removeText: {
    color: colors.danger,
    fontSize: typography.size.lg,
    lineHeight: 20,
    fontWeight: typography.weight.bold,
  },
  summary: {
    backgroundColor: colors.pastelCyan,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  summaryDivider: {
    height: 1,
    backgroundColor: colors.primary,
    opacity: 0.35,
  },
  totalLabel: {
    color: colors.secondaryDark,
    fontSize: typography.size.md,
    fontWeight: typography.weight.extraBold,
  },
  totalValue: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.extraBold,
    textAlign: 'right',
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
