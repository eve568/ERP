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
import PurchaseForm from '../components/forms/PurchaseForm';
import { getPurchase, isSessionError, listPurchases } from '../services/api';
import { colors, radius, spacing, typography } from '../theme';
import { formatCurrency, formatDateTime } from '../utils/format';

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'RECEIVED', label: 'Recibida' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

function DetailValue({ label, value, strong = false }) {
  return (
    <View style={styles.detailField}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, strong ? styles.detailStrong : null]}>
        {value || '—'}
      </Text>
    </View>
  );
}

function PurchaseDetail({ purchase, loading, error }) {
  if (loading) {
    return (
      <View style={styles.stateCard}>
        <ActivityIndicator color={colors.primaryDark} />
        <Text style={styles.muted}>Cargando detalle...</Text>
      </View>
    );
  }
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (!purchase) return null;

  return (
    <View style={styles.detail}>
      <View style={styles.detailGrid}>
        <DetailValue label="Folio" value={purchase._id} />
        <DetailValue label="Fecha" value={formatDateTime(purchase.createdAt)} />
        <DetailValue label="Proveedor" value={purchase.supplierId?.name} />
        <DetailValue label="RFC / Tax ID" value={purchase.supplierId?.taxId} />
        <DetailValue label="Almacén" value={purchase.warehouseId?.name} />
        <DetailValue
          label="Sucursal"
          value={purchase.warehouseId?.branchId?.name}
        />
        <DetailValue label="Estado" value={purchase.status} />
      </View>
      <Text style={styles.detailHeading}>Productos recibidos</Text>
      {purchase.items?.length ? (
        <View style={styles.detailLines}>
          {purchase.items.map((item, index) => (
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
        <Text style={styles.muted}>La compra no tiene detalle de productos.</Text>
      )}
      <View style={styles.totals}>
        <DetailValue label="Subtotal" value={formatCurrency(purchase.subtotal)} />
        <DetailValue label="Impuestos" value={formatCurrency(purchase.tax ?? 0)} />
        <DetailValue
          label="Descuento"
          value={formatCurrency(purchase.discount ?? 0)}
        />
        <DetailValue label="Total" value={formatCurrency(purchase.total)} strong />
      </View>
    </View>
  );
}

export default function PurchasesScreen({
  token,
  companyId,
  branchId,
  userRole,
  refreshKey,
  onSessionExpired,
  onToast,
}) {
  const [purchases, setPurchases] = useState({
    status: 'loading',
    items: [],
    error: null,
  });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(null);
  const [detail, setDetail] = useState({
    status: 'idle',
    purchase: null,
    error: null,
  });
  const [retryTick, setRetryTick] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  function handleCreated(message, type = 'success') {
    setCreateOpen(false);
    onToast?.(message, type);
    setRetryTick((tick) => tick + 1);
  }

  useEffect(() => {
    if (!companyId) {
      setPurchases({
        status: 'error',
        items: [],
        error: 'No se pudo resolver la empresa activa.',
      });
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setPurchases((current) => ({ ...current, status: 'loading', error: null }));
      try {
        const payload = await listPurchases(token, companyId, {
          q: query.trim() || undefined,
          status: statusFilter || undefined,
          limit: 100,
        });
        if (cancelled) return;
        const items = Array.isArray(payload?.data) ? payload.data : [];
        setPurchases({
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
        setPurchases({
          status: 'error',
          items: [],
          error: requestError?.message ?? 'No se pudieron cargar las compras.',
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
    query,
    statusFilter,
    refreshKey,
    retryTick,
    onSessionExpired,
  ]);

  useEffect(() => {
    if (!selectedPurchaseId) {
      setDetail({ status: 'idle', purchase: null, error: null });
      return undefined;
    }
    let cancelled = false;
    setDetail({ status: 'loading', purchase: null, error: null });
    getPurchase(token, companyId, selectedPurchaseId)
      .then((payload) => {
        if (!cancelled) {
          setDetail({
            status: 'ready',
            purchase: payload?.data ?? null,
            error: null,
          });
        }
      })
      .catch((requestError) => {
        if (cancelled) return;
        if (isSessionError(requestError)) {
          onSessionExpired?.();
          return;
        }
        setDetail({
          status: 'error',
          purchase: null,
          error: requestError?.message ?? 'No se pudo cargar el detalle.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPurchaseId, token, companyId, onSessionExpired]);

  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Compras</Text>
          <Text style={styles.subtitle}>
            Recepciones registradas en la empresa activa
          </Text>
        </View>
        <AppButton
          label="Nueva compra"
          onPress={() => setCreateOpen(true)}
          disabled={!companyId}
        />
      </View>
      <View style={styles.filters}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por folio o proveedor"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Buscar compras por folio o proveedor"
          style={styles.search}
        />
        <PickerField
          label="Estado"
          value={statusFilter}
          options={statusOptions}
          onChange={setStatusFilter}
          style={styles.statusPicker}
        />
      </View>
      {purchases.status === 'loading' ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primaryDark} />
          <Text style={styles.muted}>Cargando compras...</Text>
        </View>
      ) : null}
      {purchases.status === 'error' ? (
        <View style={styles.stateCard}>
          <Text style={styles.errorText}>{purchases.error}</Text>
          <AppButton
            label="Reintentar"
            variant="secondary"
            small
            onPress={() => setRetryTick((tick) => tick + 1)}
          />
        </View>
      ) : null}
      {purchases.status === 'empty' ? (
        <EmptyBlock
          title="Sin compras"
          message="No hay compras que coincidan con los filtros seleccionados."
        />
      ) : null}
      {purchases.status === 'ready' ? (
        <>
          <View style={styles.list}>
            {purchases.items.map((purchase) => (
              <Pressable
                key={purchase._id}
                onPress={() => setSelectedPurchaseId(purchase._id)}
                accessibilityRole="button"
                accessibilityLabel={`Ver detalle de compra ${purchase._id}`}
                style={({ pressed }) => [
                  styles.card,
                  pressed ? styles.cardPressed : null,
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.identity}>
                    <Text style={styles.supplierName}>
                      {purchase.supplierId?.name ?? 'Proveedor'}
                    </Text>
                    <Text style={styles.muted}>Folio: {purchase._id}</Text>
                  </View>
                  <Text style={styles.statusBadge}>{purchase.status}</Text>
                </View>
                <View style={styles.cardBottom}>
                  <Text style={styles.muted}>
                    {formatDateTime(purchase.createdAt)}
                    {purchase.warehouseId?.name
                      ? ` · ${purchase.warehouseId.name}`
                      : ''}
                  </Text>
                  <Text style={styles.total}>
                    {formatCurrency(purchase.total)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
          {purchases.items.length === 100 ? (
            <Text style={styles.muted}>
              Mostrando hasta 100 compras. Usa búsqueda y filtros para acotar resultados.
            </Text>
          ) : null}
        </>
      ) : null}
      <AppModal
        visible={createOpen}
        title="Nueva compra"
        subtitle="Registra una compra y recibe los productos en un almacén."
        onClose={() => setCreateOpen(false)}
        maxWidth={860}
      >
        {createOpen ? (
          <PurchaseForm
            token={token}
            companyId={companyId}
            branchId={branchId}
            userRole={userRole}
            onCancel={() => setCreateOpen(false)}
            onDone={handleCreated}
            onSessionExpired={onSessionExpired}
          />
        ) : null}
      </AppModal>
      <AppModal
        visible={Boolean(selectedPurchaseId)}
        title="Detalle de compra"
        subtitle="Importes y productos registrados."
        onClose={() => setSelectedPurchaseId(null)}
        maxWidth={680}
      >
        <PurchaseDetail
          purchase={detail.purchase}
          loading={detail.status === 'loading'}
          error={detail.error}
        />
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg },
  heading: { flexDirection: 'row', justifyContent: 'space-between' },
  headingCopy: { flex: 1 },
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
  statusPicker: { width: 220 },
  list: { gap: spacing.md },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  cardPressed: { backgroundColor: colors.pastelCyan },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  identity: { flex: 1, gap: 4 },
  supplierName: {
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
  cardBottom: {
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
  muted: { color: colors.textSecondary, fontSize: typography.size.xs },
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
  detail: { gap: spacing.lg },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  detailField: { flex: 1, minWidth: 130, gap: 3 },
  detailLabel: { color: colors.textSecondary, fontSize: typography.size.xs },
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
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLineCopy: { flex: 1, gap: 3 },
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
  totals: { gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
});
