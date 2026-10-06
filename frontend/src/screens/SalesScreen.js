import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppButton from '../components/AppButton';
import AppModal from '../components/AppModal';
import EmptyBlock from '../components/EmptyBlock';
import PickerField from '../components/PickerField';
import { getSale, isSessionError, listSales } from '../services/api';
import { colors, radius, spacing, typography } from '../theme';
import { formatCurrency, formatDateTime } from '../utils/format';

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'CONFIRMED', label: 'Confirmada' },
  { value: 'PAID', label: 'Pagada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

function SaleDetail({ sale, loading, error }) {
  if (loading) {
    return (
      <View style={styles.detailState}>
        <ActivityIndicator color={colors.primaryDark} />
        <Text style={styles.muted}>Cargando detalle...</Text>
      </View>
    );
  }
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (!sale) return null;

  return (
    <View style={styles.detail}>
      <View style={styles.detailGrid}>
        <DetailField label="Folio" value={sale._id} />
        <DetailField label="Fecha" value={formatDateTime(sale.createdAt)} />
        <DetailField label="Cliente" value={sale.customerId?.name ?? '—'} />
        <DetailField
          label="RFC / Tax ID"
          value={sale.customerId?.taxId ?? '—'}
        />
        <DetailField
          label="Almacén"
          value={sale.warehouseId?.name ?? 'No asignado'}
        />
        <DetailField
          label="Sucursal"
          value={sale.warehouseId?.branchId?.name ?? '—'}
        />
        <DetailField label="Estado" value={sale.status} />
        <DetailField label="Método de pago" value={sale.paymentMethod} />
      </View>

      <Text style={styles.detailHeading}>Productos</Text>
      {sale.items?.length ? (
        <View style={styles.detailLines}>
          {sale.items.map((item, index) => (
            <View
              key={`${item.productId?._id ?? item.productId}-${index}`}
              style={styles.detailLine}
            >
              <View style={styles.detailLineCopy}>
                <Text style={styles.productName}>
                  {item.productId?.name ?? 'Producto'}
                </Text>
                <Text style={styles.muted}>
                  SKU: {item.productId?.sku ?? '—'} · {item.quantity} ×{' '}
                  {formatCurrency(item.price)}
                </Text>
              </View>
              <Text style={styles.amount}>{formatCurrency(item.subtotal)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>La venta no tiene detalle de productos.</Text>
      )}

      <View style={styles.detailTotals}>
        <DetailField label="Subtotal" value={formatCurrency(sale.subtotal)} />
        <DetailField label="Impuestos" value={formatCurrency(sale.tax ?? 0)} />
        <DetailField label="Descuento" value={formatCurrency(sale.discount ?? 0)} />
        <DetailField label="Total" value={formatCurrency(sale.total)} strong />
      </View>
    </View>
  );
}

function DetailField({ label, value, strong = false }) {
  return (
    <View style={styles.detailField}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, strong ? styles.detailStrong : null]}>
        {value || '—'}
      </Text>
    </View>
  );
}

export default function SalesScreen({
  token,
  companyId,
  refreshKey,
  onSessionExpired,
}) {
  const [sales, setSales] = useState({
    status: 'loading',
    items: [],
    error: null,
  });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [detail, setDetail] = useState({
    status: 'idle',
    sale: null,
    error: null,
  });
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!companyId) {
      setSales({
        status: 'error',
        items: [],
        error: 'No se pudo resolver la empresa activa.',
      });
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSales((current) => ({
        ...current,
        status: 'loading',
        error: null,
      }));
      try {
        const payload = await listSales(token, companyId, {
          status: statusFilter || undefined,
          q: query.trim() || undefined,
          limit: 100,
        });
        if (cancelled) return;
        const items = Array.isArray(payload?.data) ? payload.data : [];
        setSales({
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
        setSales({
          status: 'error',
          items: [],
          error: requestError?.message ?? 'No se pudieron cargar las ventas.',
        });
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    token,
    companyId,
    statusFilter,
    query,
    refreshKey,
    retryTick,
    onSessionExpired,
  ]);

  useEffect(() => {
    if (!selectedSaleId) {
      setDetail({ status: 'idle', sale: null, error: null });
      return undefined;
    }
    let cancelled = false;
    setDetail({ status: 'loading', sale: null, error: null });
    getSale(token, companyId, selectedSaleId)
      .then((payload) => {
        if (cancelled) return;
        setDetail({
          status: 'ready',
          sale: payload?.data ?? null,
          error: null,
        });
      })
      .catch((requestError) => {
        if (cancelled) return;
        if (isSessionError(requestError)) {
          onSessionExpired?.();
          return;
        }
        setDetail({
          status: 'error',
          sale: null,
          error: requestError?.message ?? 'No se pudo cargar el detalle.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSaleId, token, companyId, onSessionExpired]);

  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Ventas</Text>
          <Text style={styles.subtitle}>
            Historial de ventas reales de la empresa activa
          </Text>
        </View>
      </View>

      <View style={styles.filters}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por folio o cliente"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.search}
          accessibilityLabel="Buscar ventas por folio o cliente"
        />
        <PickerField
          label="Estado"
          value={statusFilter}
          options={statusOptions}
          onChange={setStatusFilter}
          style={styles.statusPicker}
        />
      </View>

      {sales.status === 'loading' ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primaryDark} />
          <Text style={styles.muted}>Cargando ventas...</Text>
        </View>
      ) : null}
      {sales.status === 'error' ? (
        <View style={styles.stateCard}>
          <Text style={styles.errorText}>{sales.error}</Text>
          <AppButton
            label="Reintentar"
            variant="secondary"
            small
            onPress={() => setRetryTick((current) => current + 1)}
          />
        </View>
      ) : null}
      {sales.status === 'empty' ? (
        <EmptyBlock
          title="Sin ventas"
          message="No hay ventas que coincidan con los filtros seleccionados."
        />
      ) : null}
      {sales.status === 'ready' ? (
        <>
          <View style={styles.list}>
            {sales.items.map((sale) => (
              <Pressable
                key={sale._id}
                onPress={() => setSelectedSaleId(sale._id)}
                accessibilityRole="button"
                accessibilityLabel={`Ver detalle de la venta ${sale._id}`}
                style={({ pressed }) => [
                  styles.saleCard,
                  pressed ? styles.saleCardPressed : null,
                ]}
              >
                <View style={styles.saleCardTop}>
                  <View style={styles.saleIdentity}>
                    <Text style={styles.customerName}>
                      {sale.customerId?.name ?? 'Cliente'}
                    </Text>
                    <Text style={styles.muted}>
                      Folio: {sale._id}
                    </Text>
                  </View>
                  <Text style={styles.statusBadge}>{sale.status}</Text>
                </View>
                <View style={styles.saleCardBottom}>
                  <Text style={styles.muted}>
                    {formatDateTime(sale.createdAt)}
                    {sale.warehouseId?.name
                      ? ` · ${sale.warehouseId.name}`
                      : ''}
                  </Text>
                  <Text style={styles.total}>{formatCurrency(sale.total)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
          {sales.items.length === 100 ? (
            <Text style={styles.limitNote}>
              Mostrando hasta 100 ventas. Usa la búsqueda o los filtros para acotar resultados.
            </Text>
          ) : null}
        </>
      ) : null}

      <AppModal
        visible={Boolean(selectedSaleId)}
        title="Detalle de venta"
        subtitle="Información registrada en la empresa activa."
        onClose={() => setSelectedSaleId(null)}
        maxWidth={680}
      >
        <SaleDetail
          sale={detail.sale}
          loading={detail.status === 'loading'}
          error={detail.error}
        />
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
  statusPicker: {
    width: 220,
  },
  list: {
    gap: spacing.md,
  },
  saleCard: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  saleCardPressed: {
    backgroundColor: colors.pastelCyan,
  },
  saleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  saleIdentity: {
    flex: 1,
    gap: 4,
  },
  customerName: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  statusBadge: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    color: colors.primaryDark,
    backgroundColor: colors.pastelCyan,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  saleCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  total: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.extraBold,
  },
  muted: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
  },
  limitNote: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
  },
  stateCard: {
    minHeight: 120,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
  detail: {
    gap: spacing.lg,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  detailField: {
    flex: 1,
    minWidth: 130,
    gap: 3,
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
  detailStrong: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.extraBold,
  },
  detailHeading: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  detailLines: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLineCopy: {
    flex: 1,
    gap: 3,
  },
  productName: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  amount: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  detailTotals: {
    paddingTop: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailState: {
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
