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
import PartnerForm, {
  partnerFieldDefinitions,
  partnerFields,
} from '../components/forms/PartnerForm';
import PickerField from '../components/PickerField';
import {
  activateCustomer,
  activateSupplier,
  deactivateCustomer,
  deactivateSupplier,
} from '../services/records';
import {
  isSessionError,
  listCustomers,
  listSuppliers,
} from '../services/api';
import { colors, radius, spacing, typography } from '../theme';
import { formatDate } from '../utils/format';

const PAGE_SIZE = 20;

const resourceConfig = {
  customers: {
    title: 'Clientes',
    singular: 'cliente',
    list: listCustomers,
    activate: activateCustomer,
    deactivate: deactivateCustomer,
  },
  suppliers: {
    title: 'Proveedores',
    singular: 'proveedor',
    list: listSuppliers,
    activate: activateSupplier,
    deactivate: deactivateSupplier,
  },
};

const statusOptions = [
  { label: 'Todos los estados', value: '' },
  { label: 'Activos', value: 'ACTIVE' },
  { label: 'Inactivos', value: 'INACTIVE' },
];

function DetailField({ label, value }) {
  if (value === undefined || value === null || value === '') return null;

  return (
    <View style={styles.detailField}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{String(value)}</Text>
    </View>
  );
}

function ListState({ status, error, onRetry, resourceLabel }) {
  if (status === 'loading') {
    return (
      <View style={styles.stateCard}>
        <ActivityIndicator color={colors.primaryDark} />
        <Text style={styles.stateText}>Cargando {resourceLabel}...</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.stateCard}>
        <Text style={styles.errorText}>{error}</Text>
        <AppButton label="Reintentar" variant="secondary" small onPress={onRetry} />
      </View>
    );
  }

  return null;
}

export default function PartnerScreen({
  resource: resourceName,
  token,
  companyId,
  refreshKey,
  onSessionExpired,
  onToast,
}) {
  const config = resourceConfig[resourceName];
  const resource = partnerFields[resourceName];
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);
  const [listState, setListState] = useState({
    status: 'loading',
    items: [],
    pagination: { page: 1, pages: 1, total: 0 },
    error: null,
  });
  const [modal, setModal] = useState({ mode: null, record: null });
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!companyId) {
      setListState({
        status: 'empty',
        items: [],
        pagination: { page: 1, pages: 1, total: 0 },
        error: null,
      });
      return undefined;
    }

    let cancelled = false;
    setListState((current) => ({
      ...current,
      status: 'loading',
      error: null,
    }));

    config
      .list(token, companyId, {
        page,
        limit: PAGE_SIZE,
        q: query.trim() || undefined,
        status: statusFilter || undefined,
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
        setListState({
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
        setListState({
          status: 'error',
          items: [],
          pagination: { page, pages: 1, total: 0 },
          error:
            requestError?.message ??
            `No se pudieron cargar ${config.title.toLowerCase()}.`,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    config,
    token,
    companyId,
    query,
    statusFilter,
    page,
    refreshTick,
    refreshKey,
    onSessionExpired,
  ]);

  function openCreate() {
    setModal({ mode: 'create', record: null });
  }

  function closeModal() {
    setModal({ mode: null, record: null });
  }

  function handleSaved(message, type) {
    closeModal();
    onToast?.(message, type);
    setRefreshTick((current) => current + 1);
  }

  async function changeStatus(record) {
    setBusyId(record._id);

    try {
      if (record.status === 'ACTIVE') {
        await config.deactivate(token, record._id);
      } else {
        await config.activate(token, record._id);
      }

      onToast?.(
        `${config.singular.charAt(0).toUpperCase()}${config.singular.slice(1)} ${
          record.status === 'ACTIVE' ? 'desactivado' : 'activado'
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
        requestError?.message ??
          `No se pudo actualizar el estado del ${config.singular}.`,
        'error'
      );
    } finally {
      setBusyId(null);
    }
  }

  const pageCount = listState.pagination.pages;
  const activeRecord = modal.record;
  const companyUnavailable = !companyId;

  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.subtitle}>
            Registros de la empresa activa · {listState.pagination.total} en total
          </Text>
        </View>
        <AppButton
          label={`Nuevo ${config.singular}`}
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
              placeholder={`Buscar ${config.title.toLowerCase()} por nombre, RFC o correo`}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.search}
              accessibilityLabel={`Buscar ${config.title.toLowerCase()}`}
            />
            <PickerField
              label="Estado"
              value={statusFilter}
              options={statusOptions}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              style={styles.statusPicker}
            />
          </View>

          <ListState
            status={listState.status}
            error={listState.error}
            onRetry={() => setRefreshTick((current) => current + 1)}
            resourceLabel={config.title.toLowerCase()}
          />

          {listState.status === 'empty' ? (
            <EmptyBlock
              title={
                query.trim() || statusFilter
                  ? 'Sin resultados'
                  : `Sin ${config.title.toLowerCase()}`
              }
              message={
                query.trim() || statusFilter
                  ? 'No hay registros que coincidan con los filtros aplicados.'
                  : `Aún no hay ${config.title.toLowerCase()} registrados para esta empresa.`
              }
            />
          ) : null}

          {listState.status === 'ready' ? (
            <View style={styles.list}>
              {listState.items.map((record) => (
                <View key={record._id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.recordIdentity}>
                      <Text style={styles.recordName}>{record.name}</Text>
                      <Text style={styles.recordMeta}>
                        {record.taxId || 'RFC no capturado'}
                        {record.email ? ` · ${record.email}` : ''}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        record.status === 'ACTIVE'
                          ? styles.statusActive
                          : styles.statusInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          record.status === 'ACTIVE'
                            ? styles.statusActiveText
                            : styles.statusInactiveText,
                        ]}
                      >
                        {record.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </Text>
                    </View>
                  </View>

                  {record.phone ? (
                    <Text style={styles.recordMeta}>Tel. {record.phone}</Text>
                  ) : null}

                  <View style={styles.actions}>
                    <AppButton
                      label="Ver"
                      variant="secondary"
                      small
                      onPress={() => setModal({ mode: 'details', record })}
                    />
                    <AppButton
                      label="Editar"
                      variant="secondary"
                      small
                      onPress={() => setModal({ mode: 'edit', record })}
                    />
                    <AppButton
                      label={record.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                      variant={record.status === 'ACTIVE' ? 'danger' : 'primary'}
                      small
                      loading={busyId === record._id}
                      disabled={Boolean(busyId)}
                      onPress={() => changeStatus(record)}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {listState.status !== 'error' && listState.status !== 'loading' &&
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
                Página {listState.pagination.page} de {pageCount}
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
        title={`${modal.mode === 'edit' ? 'Editar' : 'Nuevo'} ${config.singular}`}
        subtitle="Los cambios se guardan en la empresa activa."
        onClose={closeModal}
        maxWidth={560}
      >
        {modal.mode === 'create' || modal.mode === 'edit' ? (
          <PartnerForm
            key={`${resourceName}-${modal.mode}-${activeRecord?._id ?? 'new'}`}
            resource={resourceName}
            record={activeRecord}
            token={token}
            onCancel={closeModal}
            onDone={handleSaved}
            onSessionExpired={onSessionExpired}
          />
        ) : null}
      </AppModal>

      <AppModal
        visible={modal.mode === 'details'}
        title={activeRecord?.name ?? config.singular}
        subtitle={`Información del ${config.singular}`}
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
              onPress={() => setModal({ mode: 'edit', record: activeRecord })}
            />
          </>
        }
      >
        {modal.mode === 'details' && activeRecord ? (
          <View style={styles.details}>
            <DetailField
              label="Estado"
              value={activeRecord.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
            />
            {resource.fields.map((field) => (
              <DetailField
                key={field}
                label={partnerFieldDefinitions[field].label}
                value={activeRecord[field]}
              />
            ))}
            <DetailField
              label="Fecha de registro"
              value={
                activeRecord.createdAt
                  ? formatDate(new Date(activeRecord.createdAt))
                  : null
              }
            />
          </View>
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

  statusPicker: {
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
