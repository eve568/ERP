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
import FormActions from '../components/FormActions';
import FormField from '../components/FormField';
import PickerField from '../components/PickerField';
import MovementForm from '../components/forms/MovementForm';
import {
  isSessionError,
  listBranches,
  listInventory,
  listInventoryMovements,
  listWarehouses,
} from '../services/api';
import { createWarehouse } from '../services/records';
import { colors, radius, spacing, typography } from '../theme';
import { formatDateTime } from '../utils/format';

const tabs = [
  { key: 'stock', label: 'Existencias' },
  { key: 'movements', label: 'Movimientos' },
  { key: 'warehouses', label: 'Almacenes' },
];

const movementTypeOptions = [
  { label: 'Todos los tipos', value: '' },
  { label: 'Entrada (PURCHASE)', value: 'PURCHASE' },
  { label: 'Salida (SALE)', value: 'SALE' },
  { label: 'Ajuste (ADJUSTMENT)', value: 'ADJUSTMENT' },
  { label: 'Transferencia (TRANSFER)', value: 'TRANSFER' },
  { label: 'Devolución (RETURN)', value: 'RETURN' },
];

function normalizeId(value) {
  if (!value) return null;
  return typeof value === 'object' ? value._id ?? value.id ?? null : value;
}

function stateForInventory(row) {
  const quantity = Number(row.quantity ?? 0);
  const globalMinimum = Number(row.productId?.minimumStock ?? 0);
  const warehouseMinimum = Number(row.minimumStock ?? 0);
  const minimum = warehouseMinimum > 0 ? warehouseMinimum : globalMinimum;

  if (quantity <= 0) return { label: 'SIN EXISTENCIA', style: styles.stockEmpty };
  if (minimum > 0 && quantity <= minimum) {
    return { label: 'STOCK BAJO', style: styles.stockLow };
  }
  return { label: 'NORMAL', style: styles.stockNormal };
}

function ResourceState({ status, error, retry, label }) {
  if (status === 'loading') {
    return (
      <View style={styles.stateCard}>
        <ActivityIndicator color={colors.primaryDark} />
        <Text style={styles.stateText}>Cargando {label}...</Text>
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={styles.stateCard}>
        <Text style={styles.errorText}>{error}</Text>
        <AppButton label="Reintentar" variant="secondary" small onPress={retry} />
      </View>
    );
  }
  return null;
}

function WarehouseForm({
  token,
  companyId,
  branches,
  onCancel,
  onDone,
  onSessionExpired,
}) {
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [address, setAddress] = useState('');
  const [responsible, setResponsible] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!name.trim() || !branchId) {
      setError('El nombre y la sucursal son obligatorios.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createWarehouse(token, {
        name: name.trim(),
        branchId,
        address: address.trim(),
        responsible: responsible.trim(),
        ...(companyId ? { companyId } : {}),
      });
      onDone('Almacén creado correctamente.', 'success');
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }
      setError(requestError?.message ?? 'No se pudo crear el almacén.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.formNote}>
        El almacén pertenece a la empresa activa y a una de sus sucursales.
      </Text>
      <FormField
        label="Nombre"
        value={name}
        onChangeText={setName}
        placeholder="Ej.: Almacén central"
        maxLength={160}
        isRequired
        editable={!submitting}
      />
      <PickerField
        label="Sucursal"
        value={branchId}
        options={branches.map((branch) => ({
          value: branch._id,
          label: branch.name,
        }))}
        onChange={setBranchId}
        placeholder="Seleccionar sucursal"
        emptyMessage="No hay sucursales activas en esta empresa."
        disabled={submitting}
        isRequired
      />
      <FormField
        label="Dirección"
        value={address}
        onChangeText={setAddress}
        placeholder="Opcional"
        maxLength={300}
        editable={!submitting}
      />
      <FormField
        label="Responsable"
        value={responsible}
        onChangeText={setResponsible}
        placeholder="Opcional"
        maxLength={160}
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
        submitLabel="Crear almacén"
        submitting={submitting}
        disabled={!branches.length}
      />
    </View>
  );
}

export default function InventoryScreen({
  token,
  companyId,
  branchId: userBranchId,
  userRole,
  refreshKey,
  onSessionExpired,
  onToast,
}) {
  const [activeTab, setActiveTab] = useState('stock');
  const [branches, setBranches] = useState({
    status: 'loading',
    items: [],
    error: null,
  });
  const [warehouses, setWarehouses] = useState({
    status: 'loading',
    items: [],
    error: null,
  });
  const [rows, setRows] = useState({ status: 'loading', items: [], error: null });
  const [movements, setMovements] = useState({
    status: 'loading',
    items: [],
    error: null,
  });
  const [query, setQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState(normalizeId(userBranchId) ?? '');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    const assignedBranchId = normalizeId(userBranchId);
    if (userRole === 'ADMIN') {
      setBranchFilter('');
    } else {
      setBranchFilter(assignedBranchId ?? '');
    }
    setWarehouseFilter('');
  }, [companyId, userRole, userBranchId]);

  useEffect(() => {
    if (!companyId) {
      setBranches({ status: 'empty', items: [], error: null });
      setWarehouses({ status: 'empty', items: [], error: null });
      return undefined;
    }

    let cancelled = false;
    setBranches((current) => ({ ...current, status: 'loading', error: null }));
    setWarehouses((current) => ({ ...current, status: 'loading', error: null }));

    async function loadOptions() {
      const [branchResult, warehouseResult] = await Promise.allSettled([
        listBranches(token, companyId),
        listWarehouses(token, companyId, {
          branchId: branchFilter || undefined,
        }),
      ]);
      if (cancelled) return;

      if (branchResult.status === 'fulfilled') {
        let items = Array.isArray(branchResult.value?.data)
          ? branchResult.value.data.filter((branch) => branch.status === 'ACTIVE')
          : [];
        const assignedBranchId = normalizeId(userBranchId);
        if (userRole !== 'ADMIN' && assignedBranchId) {
          items = items.filter((branch) => branch._id === assignedBranchId);
        }
        setBranches({
          status: items.length ? 'ready' : 'empty',
          items,
          error: null,
        });
      } else if (isSessionError(branchResult.reason)) {
        onSessionExpired?.();
        return;
      } else {
        setBranches({
          status: 'error',
          items: [],
          error:
            branchResult.reason?.message ?? 'No se pudieron cargar las sucursales.',
        });
      }

      if (warehouseResult.status === 'fulfilled') {
        const items = Array.isArray(warehouseResult.value?.data)
          ? warehouseResult.value.data
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
            warehouseResult.reason?.message ??
            'No se pudieron cargar los almacenes.',
        });
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [
    token,
    companyId,
    branchFilter,
    userBranchId,
    userRole,
    refreshKey,
    retryTick,
    onSessionExpired,
  ]);

  useEffect(() => {
    if (!companyId || activeTab !== 'stock') return undefined;
    let cancelled = false;
    setRows((current) => ({ ...current, status: 'loading', error: null }));

    listInventory(token, companyId, {
      warehouseId: warehouseFilter || undefined,
      branchId: branchFilter || undefined,
      q: query.trim() || undefined,
    })
      .then((payload) => {
        if (cancelled) return;
        const items = Array.isArray(payload?.data) ? payload.data : [];
        setRows({ status: items.length ? 'ready' : 'empty', items, error: null });
      })
      .catch((requestError) => {
        if (cancelled) return;
        if (isSessionError(requestError)) {
          onSessionExpired?.();
          return;
        }
        setRows({
          status: 'error',
          items: [],
          error: requestError?.message ?? 'No se pudo cargar el inventario.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    token,
    companyId,
    activeTab,
    warehouseFilter,
    branchFilter,
    query,
    refreshKey,
    retryTick,
    onSessionExpired,
  ]);

  useEffect(() => {
    if (!companyId || activeTab !== 'movements') return undefined;
    let cancelled = false;
    setMovements((current) => ({
      ...current,
      status: 'loading',
      error: null,
    }));

    listInventoryMovements(token, companyId, {
      warehouseId: warehouseFilter || undefined,
      branchId: branchFilter || undefined,
      q: query.trim() || undefined,
      type: movementTypeFilter || undefined,
      limit: 100,
    })
      .then((payload) => {
        if (cancelled) return;
        const items = Array.isArray(payload?.data) ? payload.data : [];
        setMovements({
          status: items.length ? 'ready' : 'empty',
          items,
          error: null,
        });
      })
      .catch((requestError) => {
        if (cancelled) return;
        if (isSessionError(requestError)) {
          onSessionExpired?.();
          return;
        }
        setMovements({
          status: 'error',
          items: [],
          error:
            requestError?.message ?? 'No se pudo cargar el historial de movimientos.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    token,
    companyId,
    activeTab,
    warehouseFilter,
    branchFilter,
    query,
    movementTypeFilter,
    refreshKey,
    retryTick,
    onSessionExpired,
  ]);

  function closeModal() {
    setModal(null);
  }

  function handleSaved(message, type = 'success') {
    closeModal();
    onToast?.(message, type);
    setRetryTick((current) => current + 1);
  }

  const companyUnavailable = !companyId;
  const branchOptions = [
    ...(userRole === 'ADMIN'
      ? [{ value: '', label: 'Todas las sucursales' }]
      : []),
    ...branches.items.map((branch) => ({
      value: branch._id,
      label: branch.name,
    })),
  ];
  const warehouseOptions = [
    { value: '', label: 'Todos los almacenes' },
    ...warehouses.items
      .filter((warehouse) => warehouse.status === 'ACTIVE')
      .map((warehouse) => ({
        value: warehouse._id,
        label: `${warehouse.name}${
          warehouse.branchId?.name ? ` · ${warehouse.branchId.name}` : ''
        }`,
      })),
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Inventario</Text>
          <Text style={styles.subtitle}>
            Existencias y movimientos por almacén de la empresa activa
          </Text>
        </View>
        <AppButton
          label="Registrar movimiento"
          onPress={() => setModal('movement')}
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
          <View style={styles.tabs}>
            {tabs.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: activeTab === tab.key }}
                style={[
                  styles.tab,
                  activeTab === tab.key ? styles.tabActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab.key ? styles.tabTextActive : null,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeTab !== 'warehouses' ? (
            <View style={styles.filters}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar producto o SKU"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.search}
                accessibilityLabel="Buscar inventario por producto o SKU"
              />
              {userRole === 'ADMIN' ? (
                <PickerField
                  label="Sucursal"
                  value={branchFilter}
                  options={branchOptions}
                  onChange={(value) => {
                    setBranchFilter(value);
                    setWarehouseFilter('');
                  }}
                  loading={branches.status === 'loading'}
                  disabled={branches.status === 'error'}
                  style={styles.filterPicker}
                  error={branches.status === 'error' ? branches.error : null}
                />
              ) : null}
              <PickerField
                label="Almacén"
                value={warehouseFilter}
                options={warehouseOptions}
                onChange={setWarehouseFilter}
                loading={warehouses.status === 'loading'}
                disabled={warehouses.status === 'error'}
                style={styles.filterPicker}
                error={warehouses.status === 'error' ? warehouses.error : null}
              />
              {activeTab === 'movements' ? (
                <PickerField
                  label="Tipo de movimiento"
                  value={movementTypeFilter}
                  options={movementTypeOptions}
                  onChange={setMovementTypeFilter}
                  style={styles.filterPicker}
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.warehouseHeading}>
              <Text style={styles.sectionTitle}>Almacenes</Text>
              {userRole === 'ADMIN' ? (
                <PickerField
                  label="Sucursal"
                  value={branchFilter}
                  options={[
                    { value: '', label: 'Todas las sucursales' },
                    ...branches.items.map((branch) => ({
                      value: branch._id,
                      label: branch.name,
                    })),
                  ]}
                  onChange={setBranchFilter}
                  loading={branches.status === 'loading'}
                  disabled={branches.status === 'error'}
                  style={styles.filterPicker}
                  error={branches.status === 'error' ? branches.error : null}
                />
              ) : null}
              <AppButton
                label="Nuevo almacén"
                variant="secondary"
                onPress={() => setModal('warehouse')}
                disabled={branches.status !== 'ready'}
              />
            </View>
          )}

          {activeTab === 'stock' ? (
            <>
              <ResourceState
                status={rows.status}
                error={rows.error}
                retry={() => setRetryTick((current) => current + 1)}
                label="existencias"
              />
              {rows.status === 'empty' ? (
                <EmptyBlock
                  title="Sin existencias registradas"
                  message="Registra una entrada de inventario para crear las existencias de un producto en un almacén."
                />
              ) : null}
              {rows.status === 'ready' ? (
                <View style={styles.list}>
                  {rows.items.map((row) => {
                    const stockState = stateForInventory(row);
                    return (
                      <View
                        key={`${row.warehouseId?._id}-${row.productId?._id}`}
                        style={styles.card}
                      >
                        <View style={styles.cardTop}>
                          <View style={styles.recordIdentity}>
                            <Text style={styles.recordName}>
                              {row.productId?.name ?? 'Producto'}
                            </Text>
                            <Text style={styles.recordMeta}>
                              SKU: {row.productId?.sku ?? '—'}
                            </Text>
                          </View>
                          <Text style={[styles.stockBadge, stockState.style]}>
                            {stockState.label}
                          </Text>
                        </View>
                        <Text style={styles.recordMeta}>
                          Almacén: {row.warehouseId?.name ?? '—'}
                          {row.warehouseId?.branchId?.name
                            ? ` · ${row.warehouseId.branchId.name}`
                            : ''}
                        </Text>
                        <View style={styles.quantityRow}>
                          <Text style={styles.quantity}>
                            {row.quantity} {row.productId?.unit ?? ''}
                          </Text>
                          <Text style={styles.recordMeta}>
                            Mínimo:{' '}
                            {row.minimumStock > 0
                              ? row.minimumStock
                              : row.productId?.minimumStock ?? 0}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : null}

          {activeTab === 'movements' ? (
            <>
              <ResourceState
                status={movements.status}
                error={movements.error}
                retry={() => setRetryTick((current) => current + 1)}
                label="movimientos"
              />
              {movements.status === 'empty' ? (
                <EmptyBlock
                  title="Sin movimientos"
                  message="Los movimientos de inventario aparecerán aquí al registrarse."
                />
              ) : null}
              {movements.status === 'ready' ? (
                <View style={styles.list}>
                  {movements.items.map((movement) => (
                    <View key={movement._id} style={styles.card}>
                      <View style={styles.cardTop}>
                        <View style={styles.recordIdentity}>
                          <Text style={styles.recordName}>
                            {movement.productId?.name ?? 'Producto'}
                          </Text>
                          <Text style={styles.recordMeta}>
                            SKU: {movement.productId?.sku ?? '—'} ·{' '}
                            {movement.warehouseId?.name ?? 'Almacén'}
                            {movement.warehouseId?.branchId?.name
                              ? ` · ${movement.warehouseId.branchId.name}`
                              : ''}
                          </Text>
                        </View>
                        <Text style={styles.movementType}>{movement.type}</Text>
                      </View>
                      <View style={styles.quantityRow}>
                        <Text style={styles.quantity}>
                          {movement.quantity} {movement.productId?.unit ?? ''}
                        </Text>
                        <Text style={styles.recordMeta}>
                          {formatDateTime(movement.createdAt)}
                        </Text>
                      </View>
                      {movement.reason ? (
                        <Text style={styles.recordMeta}>
                          Motivo: {movement.reason}
                        </Text>
                      ) : null}
                      {movement.referenceId ? (
                        <Text style={styles.recordMeta}>
                          Referencia: {movement.referenceId}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          {activeTab === 'warehouses' ? (
            <>
              <ResourceState
                status={warehouses.status}
                error={warehouses.error}
                retry={() => setRetryTick((current) => current + 1)}
                label="almacenes"
              />
              {warehouses.status === 'empty' ? (
                <EmptyBlock
                  title="Sin almacenes"
                  message="Crea un almacén asociado a una sucursal activa antes de registrar movimientos."
                />
              ) : null}
              {warehouses.status === 'ready' ? (
                <View style={styles.list}>
                  {warehouses.items.map((warehouse) => (
                    <View key={warehouse._id} style={styles.card}>
                      <Text style={styles.recordName}>{warehouse.name}</Text>
                      <Text style={styles.recordMeta}>
                        Sucursal: {warehouse.branchId?.name ?? '—'}
                      </Text>
                      {warehouse.address ? (
                        <Text style={styles.recordMeta}>{warehouse.address}</Text>
                      ) : null}
                      {warehouse.responsible ? (
                        <Text style={styles.recordMeta}>
                          Responsable: {warehouse.responsible}
                        </Text>
                      ) : null}
                      <Text style={styles.recordMeta}>
                        Estado: {warehouse.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </>
      )}

      <AppModal
        visible={modal === 'movement'}
        title="Registrar movimiento"
        subtitle="Entrada, salida o ajuste de existencias."
        onClose={closeModal}
        maxWidth={560}
      >
        {modal === 'movement' ? (
          <MovementForm
            token={token}
            companyId={companyId}
            branchId={normalizeId(userBranchId)}
            onCancel={closeModal}
            onDone={handleSaved}
            onSessionExpired={onSessionExpired}
          />
        ) : null}
      </AppModal>

      <AppModal
        visible={modal === 'warehouse'}
        title="Nuevo almacén"
        subtitle="Asocia el almacén con una sucursal activa."
        onClose={closeModal}
        maxWidth={560}
      >
        {modal === 'warehouse' ? (
          <WarehouseForm
            token={token}
            companyId={companyId}
            branches={branches.items}
            onCancel={closeModal}
            onDone={handleSaved}
            onSessionExpired={onSessionExpired}
          />
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
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primaryDark,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  tabTextActive: {
    color: colors.primaryDark,
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
  recordIdentity: {
    flex: 1,
    gap: 4,
  },
  recordName: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  recordMeta: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quantity: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  stockBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  stockNormal: {
    color: colors.secondaryDark,
    backgroundColor: colors.pastelGreen,
  },
  stockLow: {
    color: colors.warning,
    backgroundColor: colors.pastelYellow,
  },
  stockEmpty: {
    color: colors.danger,
    backgroundColor: colors.pastelPink,
  },
  movementType: {
    color: colors.primaryDark,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
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
  warehouseHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 160,
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  form: {
    gap: spacing.lg,
  },
  formNote: {
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
});
