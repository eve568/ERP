import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AppButton from '../AppButton';
import FormActions from '../FormActions';
import FormField from '../FormField';
import PickerField from '../PickerField';
import { isSessionError, listCustomers, listProducts } from '../../services/api';
import { createSale } from '../../services/records';
import { colors, radius, spacing, typography } from '../../theme';
import { formatCurrency } from '../../utils/format';

const paymentMethods = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CREDIT', label: 'Crédito' },
];

export default function SaleForm({ token, companyId, onCancel, onDone, onSessionExpired }) {
  const [customers, setCustomers] = useState({ status: 'loading', items: [], pages: 1 });
  const [products, setProducts] = useState({ status: 'loading', items: [], pages: 1 });
  const [customerId, setCustomerId] = useState(null);
  const [draftProductId, setDraftProductId] = useState(null);
  const [draftQuantity, setDraftQuantity] = useState('1');
  const [lines, setLines] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadReferences = useCallback(async () => {
    setCustomers((current) => ({ ...current, status: 'loading' }));
    setProducts((current) => ({ ...current, status: 'loading' }));

    try {
      const [customersPayload, productsPayload] = await Promise.all([
        listCustomers(token, companyId),
        listProducts(token, companyId),
      ]);

      setCustomers({
        status: 'ready',
        items: Array.isArray(customersPayload?.data?.items) ? customersPayload.data.items : [],
        pages: customersPayload?.data?.pagination?.pages ?? 1,
      });
      setProducts({
        status: 'ready',
        items: Array.isArray(productsPayload?.data?.items) ? productsPayload.data.items : [],
        pages: productsPayload?.data?.pagination?.pages ?? 1,
      });
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }

      setCustomers((current) => ({ ...current, status: 'error' }));
      setProducts((current) => ({ ...current, status: 'error' }));
      setError(requestError?.message ?? 'No fue posible cargar clientes o productos.');
    }
  }, [token, companyId, onSessionExpired]);

  useEffect(() => {
    loadReferences();
  }, [loadReferences]);

  const customerOptions = customers.items.map((item) => ({
    value: item._id,
    label: item.name,
  }));

  const productOptions = products.items.map((item) => ({
    value: item._id,
    label: `${item.sku} · ${item.name}`,
  }));

  const parsedQuantity = Number(draftQuantity);
  const validQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0;

  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const referencesReady = customers.status === 'ready' && products.status === 'ready';
  const hasCustomers = customerOptions.length > 0;
  const hasProducts = productOptions.length > 0;
  const blocked = !referencesReady || !hasCustomers || !hasProducts;

  function addLine() {
    if (!draftProductId) {
      setError('Selecciona el producto que quieres agregar.');
      return;
    }

    if (!validQuantity) {
      setError('La cantidad debe ser un número mayor a 0.');
      return;
    }

    const product = products.items.find((item) => item._id === draftProductId);

    if (!product) {
      setError('El producto seleccionado ya no está disponible.');
      return;
    }

    const price = Number(product.salePrice);

    setLines((current) => {
      const existing = current.find((line) => line.productId === product._id);

      if (existing) {
        return current.map((line) =>
          line.productId === product._id
            ? { ...line, quantity: line.quantity + parsedQuantity }
            : line
        );
      }

      return [
        ...current,
        {
          productId: product._id,
          name: product.name,
          unit: product.unit ?? '',
          price: Number.isFinite(price) ? price : 0,
          quantity: parsedQuantity,
        },
      ];
    });

    setDraftProductId(null);
    setDraftQuantity('1');
    setError(null);
  }

  function removeLine(productId) {
    setLines((current) => current.filter((line) => line.productId !== productId));
  }

  async function submit() {
    if (!customerId) {
      setError('Selecciona el cliente de la venta.');
      return;
    }

    if (!lines.length) {
      setError('Agrega al menos un producto a la venta.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      customerId,
      items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      paymentMethod,
    };

    if (companyId) payload.companyId = companyId;

    try {
      await createSale(token, payload);
      onDone('Venta creada correctamente (borrador)', 'success');
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }

      setError(requestError?.message ?? 'No fue posible crear la venta.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.sectionNote}>
        La venta se guarda como borrador con el precio de venta vigente del
        producto. El descuento de stock ocurre al confirmarla desde el módulo
        Ventas.
      </Text>

      <PickerField
        label="Cliente"
        value={customerId}
        options={customerOptions}
        onChange={setCustomerId}
        loading={customers.status === 'loading'}
        placeholder={hasCustomers ? 'Seleccionar cliente' : 'Sin clientes disponibles'}
        emptyMessage="Aún no hay clientes registrados. Crea uno primero con la acción Nuevo cliente."
        isRequired
        hint={customers.pages > 1 ? 'Se muestran los primeros 100 clientes.' : null}
      />

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Productos de la venta</Text>

        <PickerField
          label="Producto"
          value={draftProductId}
          options={productOptions}
          onChange={setDraftProductId}
          loading={products.status === 'loading'}
          placeholder={hasProducts ? 'Seleccionar producto' : 'Sin productos disponibles'}
          emptyMessage="Aún no hay productos en el catálogo. Crea uno primero con la acción Nuevo producto."
          isRequired
          hint={products.pages > 1 ? 'Se muestran los primeros 100 productos.' : null}
        />

        <View style={styles.addRow}>
          <FormField
            label="Cantidad"
            value={draftQuantity}
            onChangeText={setDraftQuantity}
            placeholder="1"
            keyboardType="numeric"
            isRequired
            editable={!submitting}
            style={styles.quantityField}
          />

          <AppButton
            label="Agregar"
            variant="secondary"
            onPress={addLine}
            disabled={submitting}
            style={styles.addButton}
          />
        </View>

        {lines.length ? (
          <View style={styles.lines}>
            {lines.map((line) => (
              <View key={line.productId} style={styles.line}>
                <View style={styles.lineCopy}>
                  <Text style={styles.lineName} numberOfLines={2}>
                    {line.name}
                  </Text>
                  <Text style={styles.lineMeta}>
                    {line.quantity} × {formatCurrency(line.price)}
                    {line.unit ? ` ${line.unit}` : ''}
                  </Text>
                </View>

                <Text style={styles.lineSubtotal}>
                  {formatCurrency(line.price * line.quantity)}
                </Text>

                <Pressable
                  onPress={() => removeLine(line.productId)}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar ${line.name}`}
                  style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
                >
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyLines}>
            Aún no agregas productos. Selecciona uno y pulsa “Agregar”.
          </Text>
        )}
      </View>

      <PickerField
        label="Método de pago"
        value={paymentMethod}
        options={paymentMethods}
        onChange={setPaymentMethod}
        placeholder="Seleccionar"
        isRequired
      />

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>
            {lines.length ? formatCurrency(subtotal) : '$0.00'}
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {lines.length ? formatCurrency(subtotal) : 'Agrega productos para calcular'}
          </Text>
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
        submitLabel="Crear venta"
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
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
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

  lineSubtotal: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },

  remove: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pastelPink,
  },

  removePressed: {
    opacity: 0.7,
  },

  removeText: {
    color: colors.danger,
    fontSize: typography.size.lg,
    lineHeight: 20,
    fontWeight: typography.weight.bold,
  },

  emptyLines: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    lineHeight: 18,
    fontStyle: 'italic',
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
    flexShrink: 1,
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
