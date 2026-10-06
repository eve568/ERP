import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import AppHeader from '../components/AppHeader';
import AppSidebar from '../components/AppSidebar';
import ConnectionStatus from '../components/ConnectionStatus';
import EmptyBlock from '../components/EmptyBlock';
import ModulePlaceholder from '../components/ModulePlaceholder';
import QuickActionCard from '../components/QuickActionCard';
import QuickActionDialog from '../components/QuickActionDialog';
import StatCard from '../components/StatCard';
import {
  getAudit,
  getCompany,
  getDashboard,
  isSessionError,
  listBranches,
  listCompanies,
  listSales,
} from '../services/api';
import { colors, spacing, typography } from '../theme';
import {
  formatCurrency,
  formatDate,
  formatInteger,
  formatRelativeTime,
} from '../utils/format';

const modules = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    detail: 'Resumen general',
    icon: '▦',
    available: true,
  },
  {
    key: 'sales',
    label: 'Ventas',
    detail: 'Clientes y ventas',
    icon: '↗',
    available: true,
  },
  {
    key: 'inventory',
    label: 'Inventario',
    detail: 'Existencias y movimientos',
    icon: '□',
    available: false,
  },
  {
    key: 'purchases',
    label: 'Compras',
    detail: 'Proveedores y compras',
    icon: '↓',
    available: false,
  },
  {
    key: 'people',
    label: 'Personas',
    detail: 'Clientes y colaboradores',
    icon: '○',
    available: false,
  },
  {
    key: 'finance',
    label: 'Finanzas',
    detail: 'Ingresos y gastos',
    icon: '$',
    available: false,
  },
];

const quickActions = [
  {
    key: 'customer',
    action: 'customer',
    title: 'Nuevo cliente',
    description: 'Registrar un cliente de la empresa',
    icon: '+',
  },
  {
    key: 'sale',
    action: 'sale',
    title: 'Nueva venta',
    description: 'Crear una venta en borrador',
    icon: '+',
  },
  {
    key: 'product',
    action: 'product',
    title: 'Nuevo producto',
    description: 'Agregar un producto al catálogo',
    icon: '+',
  },
  {
    key: 'movement',
    action: 'movement',
    title: 'Movimiento',
    description: 'Registrar entrada o salida de inventario',
    icon: '+',
  },
];

const auditVerbs = {
  POST: 'Creó',
  PUT: 'Actualizó',
  PATCH: 'Actualizó',
  DELETE: 'Archivó',
};

function greetingForNow() {
  const hour = new Date().getHours();

  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function SectionHeader({ title, subtitle }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

export default function DashboardScreen({
  session,
  health,
  healthStatus,
  healthError,
  onRetryHealth,
  onLogout,
  onSessionExpired,
  onToast,
}) {
  const { width } = useWindowDimensions();
  const token = session?.token;
  const user = session?.user ?? {};

  const [selectedModule, setSelectedModule] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [context, setContext] = useState({
    status: 'loading',
    companyId: null,
    companyName: null,
    branchName: null,
  });
  const [dashboard, setDashboard] = useState({
    status: 'idle',
    data: null,
    error: null,
  });
  const [sales, setSales] = useState({
    status: 'idle',
    items: [],
    error: null,
  });
  const [audit, setAudit] = useState({
    status: 'idle',
    items: [],
    error: null,
  });
  const [refreshTick, setRefreshTick] = useState(0);
  const [dialog, setDialog] = useState({
    action: null,
    visible: false,
    seq: null,
  });

  const enterOpacity = useRef(new Animated.Value(0)).current;
  const enterY = useRef(new Animated.Value(16)).current;

  const isDesktop = width >= 1024;
  const compact = width < 768;

  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Usuario';

  const userInitial =
    user.firstName?.charAt(0)?.toUpperCase() ||
    user.email?.charAt(0)?.toUpperCase() ||
    'U';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(enterOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: false,
      }),
      Animated.timing(enterY, {
        toValue: 0,
        duration: 260,
        useNativeDriver: false,
      }),
    ]).start();
  }, [enterOpacity, enterY]);

  /* Resuelve la empresa y sucursal activas. */
  useEffect(() => {
    let cancelled = false;

    async function resolveContext() {
      setContext((current) => ({ ...current, status: 'loading' }));

      let companyId = user.companyId ?? null;

      if (companyId && typeof companyId === 'object') {
        companyId = companyId._id ?? null;
      }

      if (!companyId) {
        try {
          const payload = await listCompanies(token);
          const companies = Array.isArray(payload?.data)
            ? payload.data
            : [];
          companyId = companies[0]?._id ?? null;
        } catch (requestError) {
          if (cancelled) return;

          if (isSessionError(requestError)) {
            onSessionExpired?.();
            return;
          }

          setContext({
            status: 'error',
            companyId: null,
            companyName: null,
            branchName: null,
          });
          return;
        }
      }

      if (!companyId) {
        if (!cancelled) {
          setContext({
            status: 'empty',
            companyId: null,
            companyName: null,
            branchName: null,
          });
        }
        return;
      }

      const [companyResult, branchesResult] = await Promise.allSettled([
        getCompany(token, companyId),
        listBranches(token, companyId),
      ]);

      if (cancelled) return;

      const companyName =
        companyResult.status === 'fulfilled'
          ? companyResult.value?.data?.name ?? null
          : null;

      let branchName = null;

      if (branchesResult.status === 'fulfilled' && user.branchId) {
        const branches = Array.isArray(branchesResult.value?.data)
          ? branchesResult.value.data
          : [];

        branchName =
          branches.find((branch) => branch._id === user.branchId)?.name ??
          null;
      }

      setContext({
        status: 'ready',
        companyId,
        companyName,
        branchName,
      });
    }

    if (token) {
      resolveContext();
    }

    return () => {
      cancelled = true;
    };
  }, [token, user.companyId, user.branchId, onSessionExpired]);

  /* Carga los indicadores y la actividad del dashboard. */
  useEffect(() => {
    if (!token) return undefined;

    if (context.status !== 'ready') {
      setDashboard({
        status:
          context.status === 'error'
            ? 'error'
            : context.status === 'loading'
              ? 'loading'
              : 'empty',
        data: null,
        error:
          context.status === 'error'
            ? 'No se pudo resolver la empresa activa'
            : null,
      });
      setAudit({ status: 'empty', items: [], error: null });
      return undefined;
    }

    let cancelled = false;

    async function load() {
      setDashboard((current) => ({
        status: 'loading',
        data: current.data,
        error: null,
      }));
      setAudit((current) => ({
        status: 'loading',
        items: current.items,
        error: null,
      }));

      const [dashboardResult, auditResult] = await Promise.allSettled([
        getDashboard(token, context.companyId),
        getAudit(token, context.companyId),
      ]);

      if (cancelled) return;

      if (dashboardResult.status === 'fulfilled') {
        setDashboard({
          status: 'ready',
          data: dashboardResult.value?.data ?? null,
          error: null,
        });
      } else {
        if (isSessionError(dashboardResult.reason)) {
          onSessionExpired?.();
          return;
        }

        setDashboard({
          status: 'error',
          data: null,
          error:
            dashboardResult.reason?.message ??
            'No fue posible cargar el resumen',
        });
      }

      if (auditResult.status === 'fulfilled') {
        const items = Array.isArray(auditResult.value?.data)
          ? auditResult.value.data
          : [];

        setAudit({
          status: items.length ? 'ready' : 'empty',
          items,
          error: null,
        });
      } else {
        if (isSessionError(auditResult.reason)) {
          onSessionExpired?.();
          return;
        }

        setAudit({
          status: 'error',
          items: [],
          error:
            auditResult.reason?.message ??
            'No fue posible cargar la actividad',
        });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [token, context, refreshTick, onSessionExpired]);

  /* Carga ventas al abrir el módulo. */
  useEffect(() => {
    if (!token || selectedModule !== 'sales') return undefined;

    if (context.status !== 'ready') {
      setSales({
        status: context.status === 'loading' ? 'loading' : 'error',
        items: [],
        error:
          context.status === 'loading'
            ? null
            : 'No se pudo resolver la empresa activa',
      });
      return undefined;
    }

    let cancelled = false;

    async function loadSales() {
      setSales((current) => ({
        status: 'loading',
        items: current.items,
        error: null,
      }));

      try {
        const payload = await listSales(token, context.companyId);

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
          error:
            requestError?.message ?? 'No se pudieron cargar las ventas',
        });
      }
    }

    loadSales();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    selectedModule,
    context.status,
    context.companyId,
    refreshTick,
    onSessionExpired,
  ]);

  const handleModuleSelect = useCallback((key) => {
    setSelectedModule(key);
    setSidebarOpen(false);
  }, []);

  const openDialog = useCallback((action) => {
    setDialog({ action, visible: true, seq: Date.now() });
  }, []);

  const closeDialog = useCallback(() => {
    setDialog((current) => ({ ...current, visible: false }));
  }, []);

  const handleDialogDone = useCallback(
    (message, type = 'success') => {
      setDialog((current) => ({ ...current, visible: false }));
      onToast?.(message, type);
      setRefreshTick((tick) => tick + 1);
    },
    [onToast],
  );

  const activeModule =
    modules.find((module) => module.key === selectedModule) ?? modules[0];

  const data = dashboard.data;
  const loadingDashboard =
    dashboard.status === 'loading' || dashboard.status === 'idle';
  const dashboardError =
    dashboard.status === 'error' ? dashboard.error : null;

  const kpis = [
    {
      key: 'sales',
      label: 'Ventas confirmadas',
      value: data ? formatCurrency(data.sales?.total) : null,
      hint: data
        ? `${formatInteger(data.sales?.count) ?? 0} ventas confirmadas o pagadas`
        : 'Sin datos',
      icon: '$',
      tone: 'success',
    },
    {
      key: 'customers',
      label: 'Clientes activos',
      value: data ? formatInteger(data.customers) : null,
      hint: 'Cartera vigente de la empresa',
      icon: '○',
      tone: 'normal',
    },
    {
      key: 'products',
      label: 'Productos activos',
      value: data ? formatInteger(data.products) : null,
      hint: 'Catálogo vigente de la empresa',
      icon: '□',
      tone: 'normal',
    },
    {
      key: 'lowStock',
      label: 'Stock bajo',
      value: data ? formatInteger(data.lowStock) : null,
      hint:
        data && Number(data.lowStock) > 0
          ? 'Productos por debajo del mínimo'
          : 'Sin alertas de inventario',
      icon: '!',
      tone: 'warning',
    },
    {
      key: 'income',
      label: 'Ingresos registrados',
      value: data ? formatCurrency(data.income) : null,
      hint: 'Acumulado de ingresos',
      icon: '↑',
      tone: 'success',
    },
    {
      key: 'expenses',
      label: 'Gastos registrados',
      value: data ? formatCurrency(data.expenses) : null,
      hint: 'Acumulado de gastos',
      icon: '↓',
      tone: 'normal',
    },
  ];

  const showDashboardBody = selectedModule === 'dashboard';

  return (
    <View style={styles.shell}>
      <AppSidebar
        modules={modules}
        selectedKey={selectedModule}
        onSelect={handleModuleSelect}
        variant={isDesktop ? 'fixed' : 'drawer'}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        width={270}
      />

      <View style={styles.main}>
        <AppHeader
          moduleLabel={activeModule.label}
          moduleDetail={activeModule.detail}
          user={{
            name: userName,
            initial: userInitial,
            email: user.email ?? '',
            role: user.role ?? 'Usuario',
          }}
          company={context.companyName}
          branch={context.branchName}
          token={token}
          companyId={context.companyId}
          onSessionExpired={onSessionExpired}
          onLogout={onLogout}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          showMenuButton={!isDesktop}
          width={width}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            compact ? styles.contentCompact : null,
          ]}
        >
          <Animated.View
            style={{
              opacity: enterOpacity,
              transform: [{ translateY: enterY }],
            }}
          >
            <View style={styles.greeting}>
              <Text style={styles.greetingTitle}>
                {greetingForNow()}, {user.firstName ?? 'Usuario'}
              </Text>

              <Text style={styles.greetingSubtitle}>
                {context.companyName ?? 'Sin empresa asignada'}
                {context.branchName ? ` · ${context.branchName}` : ''} ·{' '}
                {formatDate(new Date())}
              </Text>
            </View>

            <ConnectionStatus
              status={healthStatus}
              health={health}
              error={healthError}
              onRetry={onRetryHealth}
            />

            {showDashboardBody ? (
              <>
                <SectionHeader
                  title="Resumen"
                  subtitle="Indicadores reales de la empresa activa"
                />

                {dashboard.status === 'empty' ? (
                  <EmptyBlock
                    title="Sin empresa asignada"
                    message="Esta sesión no tiene una empresa asociada, por lo que no hay indicadores que mostrar."
                  />
                ) : (
                  <View style={styles.statsGrid}>
                    {kpis.map((kpi, index) => (
                      <StatCard
                        key={kpi.key}
                        label={kpi.label}
                        value={kpi.value}
                        hint={kpi.hint}
                        icon={kpi.icon}
                        tone={kpi.tone}
                        index={index}
                        loading={loadingDashboard}
                        error={dashboardError}
                        onRetry={() => setRefreshTick((tick) => tick + 1)}
                      />
                    ))}
                  </View>
                )}

                <SectionHeader
                  title="Acciones rápidas"
                  subtitle="Operaciones conectadas con la API"
                />

                <View style={styles.quickGrid}>
                  {quickActions.map((action, index) => (
                    <QuickActionCard
                      key={action.key}
                      title={action.title}
                      description={action.description}
                      icon={action.icon}
                      index={index}
                      onPress={() => openDialog(action)}
                    />
                  ))}
                </View>

                <SectionHeader
                  title="Actividad reciente"
                  subtitle="Últimos registros de auditoría del sistema"
                />

                {audit.status === 'loading' || audit.status === 'idle' ? (
                  <View style={styles.activityCard}>
                    <Text style={styles.activityMuted}>
                      Cargando actividad...
                    </Text>
                  </View>
                ) : audit.status === 'ready' ? (
                  <View style={styles.activityCard}>
                    {audit.items.slice(0, 6).map((entry, index) => (
                      <View
                        key={entry._id ?? index}
                        style={[
                          styles.activityRow,
                          index === 0 ? styles.activityRowFirst : null,
                        ]}
                      >
                        <View style={styles.activityMethod}>
                          <Text style={styles.activityMethodText}>
                            {entry.action}
                          </Text>
                        </View>

                        <View style={styles.activityCopy}>
                          <Text
                            style={styles.activityModule}
                            numberOfLines={1}
                          >
                            {auditVerbs[entry.action] ?? 'Modificó'}{' '}
                            {entry.module}
                          </Text>
                          <Text style={styles.activityTime}>
                            {formatRelativeTime(entry.timestamp)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : audit.status === 'error' ? (
                  <View style={styles.activityCard}>
                    <Text style={styles.activityError}>{audit.error}</Text>
                  </View>
                ) : (
                  <EmptyBlock
                    title="Sin actividad registrada"
                    message="Cuando se creen o actualicen registros, aparecerán aquí."
                  />
                )}
              </>
            ) : selectedModule === 'sales' ? (
              <>
                <SectionHeader
                  title="Ventas"
                  subtitle="Ventas registradas para la empresa activa"
                />

                {sales.status === 'loading' || sales.status === 'idle' ? (
                  <View style={styles.recordCard}>
                    <Text style={styles.recordMuted}>Cargando ventas...</Text>
                  </View>
                ) : sales.status === 'error' ? (
                  <View style={styles.recordCard}>
                    <Text style={styles.recordError}>{sales.error}</Text>
                    <Pressable
                      onPress={() => setRefreshTick((tick) => tick + 1)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.retryText}>Reintentar</Text>
                    </Pressable>
                  </View>
                ) : sales.status === 'empty' ? (
                  <EmptyBlock
                    title="Sin ventas registradas"
                    message="Cuando existan ventas para esta empresa, aparecerán aquí."
                  />
                ) : (
                  <View style={styles.recordsList}>
                    {sales.items.map((sale) => (
                      <View key={sale._id} style={styles.recordCard}>
                        <View style={styles.recordTop}>
                          <Text style={styles.recordTitle}>
                            {sale.customerId?.name ?? 'Cliente'}
                          </Text>
                          <Text style={styles.recordStatus}>
                            {sale.status ?? 'Sin estado'}
                          </Text>
                        </View>

                        <Text style={styles.recordMuted}>
                          {sale.createdAt
                            ? formatDate(new Date(sale.createdAt))
                            : 'Fecha no disponible'}
                        </Text>

                        <Text style={styles.recordAmount}>
                          {formatCurrency(sale.total)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <ModulePlaceholder
                module={activeModule}
                onBack={() => handleModuleSelect('dashboard')}
              />
            )}
          </Animated.View>
        </ScrollView>
      </View>

      <QuickActionDialog
        key={dialog.seq ?? 'no-dialog'}
        action={dialog.action}
        visible={dialog.visible}
        token={token}
        companyId={context.companyId}
        onClose={closeDialog}
        onDone={handleDialogDone}
        onSessionExpired={onSessionExpired}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },

  main: {
    flex: 1,
    minWidth: 0,
  },

  content: {
    padding: spacing.xxxl,
    paddingBottom: 60,
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center',
    gap: 0,
  },

  contentCompact: {
    padding: spacing.lg,
    paddingBottom: 40,
  },

  greeting: {
    marginBottom: spacing.xl,
  },

  greetingTitle: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.extraBold,
  },

  greetingSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginTop: 6,
  },

  sectionHeader: {
    marginTop: spacing.xxxl,
    marginBottom: spacing.lg,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.extraBold,
  },

  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginTop: 4,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },

  recordsList: {
    gap: spacing.md,
  },

  recordCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },

  recordTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  recordTitle: {
    flex: 1,
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },

  recordStatus: {
    color: colors.secondaryDark,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },

  recordMuted: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginTop: spacing.sm,
  },

  recordAmount: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginTop: spacing.md,
  },

  recordError: {
    color: colors.danger,
    fontSize: typography.size.sm,
    marginBottom: spacing.md,
  },

  retryText: {
    color: colors.secondaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },

  activityCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.lg,
  },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  activityRowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },

  activityMethod: {
    minWidth: 62,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.pastelCyan,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },

  activityMethodText: {
    color: colors.secondaryDark,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },

  activityCopy: {
    flex: 1,
    minWidth: 0,
  },

  activityModule: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  activityTime: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 2,
  },

  activityMuted: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
  },

  activityError: {
    color: colors.danger,
    fontSize: typography.size.sm,
  },
});