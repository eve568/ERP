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
import PickerField from '../components/PickerField';
import PartnerScreen from './PartnerScreen';
import ProductScreen from './ProductScreen';
import InventoryScreen from './InventoryScreen';
import SalesScreen from './SalesScreen';
import PurchasesScreen from './PurchasesScreen';
import FinanceScreen from './FinanceScreen';
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
    available: true,
  },
  {
    key: 'purchases',
    label: 'Compras',
    detail: 'Proveedores y compras',
    icon: '↓',
    available: true,
  },
  {
    key: 'customers',
    label: 'Clientes',
    detail: 'Cartera de clientes',
    icon: '○',
    available: true,
  },
  {
    key: 'products',
    label: 'Productos',
    detail: 'Catálogo de productos',
    icon: '□',
    available: true,
  },
  {
    key: 'suppliers',
    label: 'Proveedores',
    detail: 'Directorio de proveedores',
    icon: '◇',
    available: true,
  },
  {
    key: 'finance',
    label: 'Finanzas',
    detail: 'Ingresos y gastos',
    icon: '

const quickActions = [
  {
    key: 'customer',
    action: 'customer',
    module: 'customers',
    title: 'Nuevo cliente',
    description: 'Registrar un cliente de la empresa',
    icon: '+',
  },
  {
    key: 'sale',
    action: 'sale',
    module: 'sales',
    title: 'Nueva venta',
    description: 'Crear y confirmar una venta en el almacén seleccionado',
    icon: '+',
  },
  {
    key: 'product',
    action: 'product',
    module: 'products',
    title: 'Nuevo producto',
    description: 'Agregar un producto al catálogo',
    icon: '+',
  },
  {
    key: 'movement',
    action: 'movement',
    module: 'inventory',
    title: 'Movimiento',
    description: 'Registrar entrada, salida o ajuste de inventario',
    icon: '+',
  },
  {
    key: 'purchase',
    action: 'purchase',
    module: 'purchases',
    title: 'Nueva compra',
    description: 'Registrar compra y recibirla en un almacén',
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
  activeCompanyId,
  onActiveCompanyChange,
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
  const [companies, setCompanies] = useState({
    status: 'idle',
    items: [],
    error: null,
  });
  const [companyRefreshTick, setCompanyRefreshTick] = useState(0);
  const [dashboard, setDashboard] = useState({
    status: 'idle',
    data: null,
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
        companyId = companyId._id ?? companyId.id ?? null;
      }

      if (user.role === 'ADMIN') {
        setCompanies({ status: 'loading', items: [], error: null });

        try {
          const payload = await listCompanies(token);
          const companyItems = Array.isArray(payload?.data)
            ? payload.data
            : [];
          const activeCompanies = companyItems.filter(
            (company) => company.status === 'ACTIVE'
          );

          if (cancelled) return;

          setCompanies({
            status: activeCompanies.length ? 'ready' : 'empty',
            items: activeCompanies,
            error: null,
          });

          const preferredId = activeCompanyId ?? companyId;
          const selectedCompany =
            activeCompanies.find((company) => company._id === preferredId) ??
            activeCompanies[0] ??
            null;
          companyId = selectedCompany?._id ?? null;

          if (activeCompanyId !== companyId) {
            onActiveCompanyChange?.(companyId);
          }
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
          setCompanies({
            status: 'error',
            items: [],
            error:
              requestError?.message ??
              'No se pudieron cargar las empresas disponibles',
          });
          return;
        }
      } else {
        setCompanies({ status: 'idle', items: [], error: null });
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
  }, [
    token,
    user.role,
    user.companyId,
    user.branchId,
    activeCompanyId,
    onActiveCompanyChange,
    onSessionExpired,
    companyRefreshTick,
  ]);

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

  const handleModuleSelect = useCallback((key) => {
    setSelectedModule(key);
    setSidebarOpen(false);
  }, []);

  const openDialog = useCallback((action) => {
    if (!context.companyId) {
      onToast?.(
        user.role === 'ADMIN'
          ? 'Selecciona una empresa activa antes de continuar.'
          : 'Tu usuario no tiene una empresa asignada.',
        'error'
      );
      return;
    }

    handleModuleSelect(action.module);
    setDialog({ action, visible: true, seq: Date.now() });
  }, [context.companyId, handleModuleSelect, onToast, user.role]);

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
            {user.role === 'ADMIN' ? (
              <View style={styles.companySelector}>
                <PickerField
                  label="Empresa activa"
                  value={activeCompanyId ?? ''}
                  options={companies.items.map((company) => ({
                    label: company.name,
                    value: company._id,
                  }))}
                  onChange={onActiveCompanyChange}
                  placeholder="Selecciona una empresa"
                  loading={companies.status === 'loading'}
                  disabled={companies.status === 'error'}
                  error={companies.status === 'error' ? companies.error : null}
                  emptyMessage="No hay empresas activas disponibles."
                />
                {companies.status === 'error' ? (
                  <Pressable
                    onPress={() =>
                      setCompanyRefreshTick((tick) => tick + 1)
                    }
                    accessibilityRole="button"
                  >
                    <Text style={styles.retryText}>Reintentar carga de empresas</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

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
                    title={
                      user.role === 'ADMIN'
                        ? 'Selecciona una empresa activa'
                        : 'Sin empresa asignada'
                    }
                    message={
                      user.role === 'ADMIN'
                        ? 'Selecciona una empresa activa para consultar sus indicadores.'
                        : 'Esta sesión no tiene una empresa asociada, por lo que no hay indicadores que mostrar.'
                    }
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
            ) : selectedModule === 'customers' || selectedModule === 'suppliers' ? (
              <PartnerScreen
                key={selectedModule}
                resource={selectedModule}
                token={token}
                companyId={context.companyId}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
            ) : selectedModule === 'products' ? (
              <ProductScreen
                token={token}
                companyId={context.companyId}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
            ) : selectedModule === 'inventory' ? (
              <InventoryScreen
                token={token}
                companyId={context.companyId}
                branchId={user.branchId}
                userRole={user.role}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
            ) : selectedModule === 'sales' ? (
              <SalesScreen
                token={token}
                companyId={context.companyId}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
              />
            ) : selectedModule === 'purchases' ? (
              <PurchasesScreen
                token={token}
                companyId={context.companyId}
                branchId={user.branchId}
                userRole={user.role}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
            ) : selectedModule === 'finance' ? (
              <FinanceScreen
                token={token}
                companyId={context.companyId}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
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
        branchId={user.branchId}
        userRole={user.role}
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

  companySelector: {
    maxWidth: 460,
    marginBottom: spacing.xl,
    zIndex: 2,
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
});,
    available: true,
  },
];

const quickActions = [
  {
    key: 'customer',
    action: 'customer',
    module: 'customers',
    title: 'Nuevo cliente',
    description: 'Registrar un cliente de la empresa',
    icon: '+',
  },
  {
    key: 'sale',
    action: 'sale',
    module: 'sales',
    title: 'Nueva venta',
    description: 'Crear y confirmar una venta en el almacén seleccionado',
    icon: '+',
  },
  {
    key: 'product',
    action: 'product',
    module: 'products',
    title: 'Nuevo producto',
    description: 'Agregar un producto al catálogo',
    icon: '+',
  },
  {
    key: 'movement',
    action: 'movement',
    module: 'inventory',
    title: 'Movimiento',
    description: 'Registrar entrada, salida o ajuste de inventario',
    icon: '+',
  },
  {
    key: 'purchase',
    action: 'purchase',
    module: 'purchases',
    title: 'Nueva compra',
    description: 'Registrar compra y recibirla en un almacén',
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
  activeCompanyId,
  onActiveCompanyChange,
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
  const [companies, setCompanies] = useState({
    status: 'idle',
    items: [],
    error: null,
  });
  const [companyRefreshTick, setCompanyRefreshTick] = useState(0);
  const [dashboard, setDashboard] = useState({
    status: 'idle',
    data: null,
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
        companyId = companyId._id ?? companyId.id ?? null;
      }

      if (user.role === 'ADMIN') {
        setCompanies({ status: 'loading', items: [], error: null });

        try {
          const payload = await listCompanies(token);
          const companyItems = Array.isArray(payload?.data)
            ? payload.data
            : [];
          const activeCompanies = companyItems.filter(
            (company) => company.status === 'ACTIVE'
          );

          if (cancelled) return;

          setCompanies({
            status: activeCompanies.length ? 'ready' : 'empty',
            items: activeCompanies,
            error: null,
          });

          const preferredId = activeCompanyId ?? companyId;
          const selectedCompany =
            activeCompanies.find((company) => company._id === preferredId) ??
            activeCompanies[0] ??
            null;
          companyId = selectedCompany?._id ?? null;

          if (activeCompanyId !== companyId) {
            onActiveCompanyChange?.(companyId);
          }
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
          setCompanies({
            status: 'error',
            items: [],
            error:
              requestError?.message ??
              'No se pudieron cargar las empresas disponibles',
          });
          return;
        }
      } else {
        setCompanies({ status: 'idle', items: [], error: null });
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
  }, [
    token,
    user.role,
    user.companyId,
    user.branchId,
    activeCompanyId,
    onActiveCompanyChange,
    onSessionExpired,
    companyRefreshTick,
  ]);

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

  const handleModuleSelect = useCallback((key) => {
    setSelectedModule(key);
    setSidebarOpen(false);
  }, []);

  const openDialog = useCallback((action) => {
    if (!context.companyId) {
      onToast?.(
        user.role === 'ADMIN'
          ? 'Selecciona una empresa activa antes de continuar.'
          : 'Tu usuario no tiene una empresa asignada.',
        'error'
      );
      return;
    }

    handleModuleSelect(action.module);
    setDialog({ action, visible: true, seq: Date.now() });
  }, [context.companyId, handleModuleSelect, onToast, user.role]);

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
            {user.role === 'ADMIN' ? (
              <View style={styles.companySelector}>
                <PickerField
                  label="Empresa activa"
                  value={activeCompanyId ?? ''}
                  options={companies.items.map((company) => ({
                    label: company.name,
                    value: company._id,
                  }))}
                  onChange={onActiveCompanyChange}
                  placeholder="Selecciona una empresa"
                  loading={companies.status === 'loading'}
                  disabled={companies.status === 'error'}
                  error={companies.status === 'error' ? companies.error : null}
                  emptyMessage="No hay empresas activas disponibles."
                />
                {companies.status === 'error' ? (
                  <Pressable
                    onPress={() =>
                      setCompanyRefreshTick((tick) => tick + 1)
                    }
                    accessibilityRole="button"
                  >
                    <Text style={styles.retryText}>Reintentar carga de empresas</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

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
                    title={
                      user.role === 'ADMIN'
                        ? 'Selecciona una empresa activa'
                        : 'Sin empresa asignada'
                    }
                    message={
                      user.role === 'ADMIN'
                        ? 'Selecciona una empresa activa para consultar sus indicadores.'
                        : 'Esta sesión no tiene una empresa asociada, por lo que no hay indicadores que mostrar.'
                    }
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
            ) : selectedModule === 'customers' || selectedModule === 'suppliers' ? (
              <PartnerScreen
                key={selectedModule}
                resource={selectedModule}
                token={token}
                companyId={context.companyId}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
            ) : selectedModule === 'products' ? (
              <ProductScreen
                token={token}
                companyId={context.companyId}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
            ) : selectedModule === 'inventory' ? (
              <InventoryScreen
                token={token}
                companyId={context.companyId}
                branchId={user.branchId}
                userRole={user.role}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
            ) : selectedModule === 'sales' ? (
              <SalesScreen
                token={token}
                companyId={context.companyId}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
              />
            ) : selectedModule === 'purchases' ? (
              <PurchasesScreen
                token={token}
                companyId={context.companyId}
                branchId={user.branchId}
                userRole={user.role}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
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
        branchId={user.branchId}
        userRole={user.role}
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

  companySelector: {
    maxWidth: 460,
    marginBottom: spacing.xl,
    zIndex: 2,
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
});,
    available: true,
  },
];

const quickActions = [
  {
    key: 'customer',
    action: 'customer',
    module: 'customers',
    title: 'Nuevo cliente',
    description: 'Registrar un cliente de la empresa',
    icon: '+',
  },
  {
    key: 'sale',
    action: 'sale',
    module: 'sales',
    title: 'Nueva venta',
    description: 'Crear y confirmar una venta en el almacén seleccionado',
    icon: '+',
  },
  {
    key: 'product',
    action: 'product',
    module: 'products',
    title: 'Nuevo producto',
    description: 'Agregar un producto al catálogo',
    icon: '+',
  },
  {
    key: 'movement',
    action: 'movement',
    module: 'inventory',
    title: 'Movimiento',
    description: 'Registrar entrada, salida o ajuste de inventario',
    icon: '+',
  },
  {
    key: 'purchase',
    action: 'purchase',
    module: 'purchases',
    title: 'Nueva compra',
    description: 'Registrar compra y recibirla en un almacén',
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
  activeCompanyId,
  onActiveCompanyChange,
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
  const [companies, setCompanies] = useState({
    status: 'idle',
    items: [],
    error: null,
  });
  const [companyRefreshTick, setCompanyRefreshTick] = useState(0);
  const [dashboard, setDashboard] = useState({
    status: 'idle',
    data: null,
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
        companyId = companyId._id ?? companyId.id ?? null;
      }

      if (user.role === 'ADMIN') {
        setCompanies({ status: 'loading', items: [], error: null });

        try {
          const payload = await listCompanies(token);
          const companyItems = Array.isArray(payload?.data)
            ? payload.data
            : [];
          const activeCompanies = companyItems.filter(
            (company) => company.status === 'ACTIVE'
          );

          if (cancelled) return;

          setCompanies({
            status: activeCompanies.length ? 'ready' : 'empty',
            items: activeCompanies,
            error: null,
          });

          const preferredId = activeCompanyId ?? companyId;
          const selectedCompany =
            activeCompanies.find((company) => company._id === preferredId) ??
            activeCompanies[0] ??
            null;
          companyId = selectedCompany?._id ?? null;

          if (activeCompanyId !== companyId) {
            onActiveCompanyChange?.(companyId);
          }
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
          setCompanies({
            status: 'error',
            items: [],
            error:
              requestError?.message ??
              'No se pudieron cargar las empresas disponibles',
          });
          return;
        }
      } else {
        setCompanies({ status: 'idle', items: [], error: null });
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
  }, [
    token,
    user.role,
    user.companyId,
    user.branchId,
    activeCompanyId,
    onActiveCompanyChange,
    onSessionExpired,
    companyRefreshTick,
  ]);

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

  const handleModuleSelect = useCallback((key) => {
    setSelectedModule(key);
    setSidebarOpen(false);
  }, []);

  const openDialog = useCallback((action) => {
    if (!context.companyId) {
      onToast?.(
        user.role === 'ADMIN'
          ? 'Selecciona una empresa activa antes de continuar.'
          : 'Tu usuario no tiene una empresa asignada.',
        'error'
      );
      return;
    }

    handleModuleSelect(action.module);
    setDialog({ action, visible: true, seq: Date.now() });
  }, [context.companyId, handleModuleSelect, onToast, user.role]);

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
            {user.role === 'ADMIN' ? (
              <View style={styles.companySelector}>
                <PickerField
                  label="Empresa activa"
                  value={activeCompanyId ?? ''}
                  options={companies.items.map((company) => ({
                    label: company.name,
                    value: company._id,
                  }))}
                  onChange={onActiveCompanyChange}
                  placeholder="Selecciona una empresa"
                  loading={companies.status === 'loading'}
                  disabled={companies.status === 'error'}
                  error={companies.status === 'error' ? companies.error : null}
                  emptyMessage="No hay empresas activas disponibles."
                />
                {companies.status === 'error' ? (
                  <Pressable
                    onPress={() =>
                      setCompanyRefreshTick((tick) => tick + 1)
                    }
                    accessibilityRole="button"
                  >
                    <Text style={styles.retryText}>Reintentar carga de empresas</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

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
                    title={
                      user.role === 'ADMIN'
                        ? 'Selecciona una empresa activa'
                        : 'Sin empresa asignada'
                    }
                    message={
                      user.role === 'ADMIN'
                        ? 'Selecciona una empresa activa para consultar sus indicadores.'
                        : 'Esta sesión no tiene una empresa asociada, por lo que no hay indicadores que mostrar.'
                    }
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
            ) : selectedModule === 'customers' || selectedModule === 'suppliers' ? (
              <PartnerScreen
                key={selectedModule}
                resource={selectedModule}
                token={token}
                companyId={context.companyId}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
            ) : selectedModule === 'products' ? (
              <ProductScreen
                token={token}
                companyId={context.companyId}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
            ) : selectedModule === 'inventory' ? (
              <InventoryScreen
                token={token}
                companyId={context.companyId}
                branchId={user.branchId}
                userRole={user.role}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
            ) : selectedModule === 'sales' ? (
              <SalesScreen
                token={token}
                companyId={context.companyId}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
              />
            ) : selectedModule === 'purchases' ? (
              <PurchasesScreen
                token={token}
                companyId={context.companyId}
                branchId={user.branchId}
                userRole={user.role}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
            ) : selectedModule === 'finance' ? (
              <FinanceScreen
                token={token}
                companyId={context.companyId}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
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
        branchId={user.branchId}
        userRole={user.role}
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

  companySelector: {
    maxWidth: 460,
    marginBottom: spacing.xl,
    zIndex: 2,
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
});,
    available: true,
  },
];

const quickActions = [
  {
    key: 'customer',
    action: 'customer',
    module: 'customers',
    title: 'Nuevo cliente',
    description: 'Registrar un cliente de la empresa',
    icon: '+',
  },
  {
    key: 'sale',
    action: 'sale',
    module: 'sales',
    title: 'Nueva venta',
    description: 'Crear y confirmar una venta en el almacén seleccionado',
    icon: '+',
  },
  {
    key: 'product',
    action: 'product',
    module: 'products',
    title: 'Nuevo producto',
    description: 'Agregar un producto al catálogo',
    icon: '+',
  },
  {
    key: 'movement',
    action: 'movement',
    module: 'inventory',
    title: 'Movimiento',
    description: 'Registrar entrada, salida o ajuste de inventario',
    icon: '+',
  },
  {
    key: 'purchase',
    action: 'purchase',
    module: 'purchases',
    title: 'Nueva compra',
    description: 'Registrar compra y recibirla en un almacén',
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
  activeCompanyId,
  onActiveCompanyChange,
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
  const [companies, setCompanies] = useState({
    status: 'idle',
    items: [],
    error: null,
  });
  const [companyRefreshTick, setCompanyRefreshTick] = useState(0);
  const [dashboard, setDashboard] = useState({
    status: 'idle',
    data: null,
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
        companyId = companyId._id ?? companyId.id ?? null;
      }

      if (user.role === 'ADMIN') {
        setCompanies({ status: 'loading', items: [], error: null });

        try {
          const payload = await listCompanies(token);
          const companyItems = Array.isArray(payload?.data)
            ? payload.data
            : [];
          const activeCompanies = companyItems.filter(
            (company) => company.status === 'ACTIVE'
          );

          if (cancelled) return;

          setCompanies({
            status: activeCompanies.length ? 'ready' : 'empty',
            items: activeCompanies,
            error: null,
          });

          const preferredId = activeCompanyId ?? companyId;
          const selectedCompany =
            activeCompanies.find((company) => company._id === preferredId) ??
            activeCompanies[0] ??
            null;
          companyId = selectedCompany?._id ?? null;

          if (activeCompanyId !== companyId) {
            onActiveCompanyChange?.(companyId);
          }
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
          setCompanies({
            status: 'error',
            items: [],
            error:
              requestError?.message ??
              'No se pudieron cargar las empresas disponibles',
          });
          return;
        }
      } else {
        setCompanies({ status: 'idle', items: [], error: null });
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
  }, [
    token,
    user.role,
    user.companyId,
    user.branchId,
    activeCompanyId,
    onActiveCompanyChange,
    onSessionExpired,
    companyRefreshTick,
  ]);

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

  const handleModuleSelect = useCallback((key) => {
    setSelectedModule(key);
    setSidebarOpen(false);
  }, []);

  const openDialog = useCallback((action) => {
    if (!context.companyId) {
      onToast?.(
        user.role === 'ADMIN'
          ? 'Selecciona una empresa activa antes de continuar.'
          : 'Tu usuario no tiene una empresa asignada.',
        'error'
      );
      return;
    }

    handleModuleSelect(action.module);
    setDialog({ action, visible: true, seq: Date.now() });
  }, [context.companyId, handleModuleSelect, onToast, user.role]);

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
            {user.role === 'ADMIN' ? (
              <View style={styles.companySelector}>
                <PickerField
                  label="Empresa activa"
                  value={activeCompanyId ?? ''}
                  options={companies.items.map((company) => ({
                    label: company.name,
                    value: company._id,
                  }))}
                  onChange={onActiveCompanyChange}
                  placeholder="Selecciona una empresa"
                  loading={companies.status === 'loading'}
                  disabled={companies.status === 'error'}
                  error={companies.status === 'error' ? companies.error : null}
                  emptyMessage="No hay empresas activas disponibles."
                />
                {companies.status === 'error' ? (
                  <Pressable
                    onPress={() =>
                      setCompanyRefreshTick((tick) => tick + 1)
                    }
                    accessibilityRole="button"
                  >
                    <Text style={styles.retryText}>Reintentar carga de empresas</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

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
                    title={
                      user.role === 'ADMIN'
                        ? 'Selecciona una empresa activa'
                        : 'Sin empresa asignada'
                    }
                    message={
                      user.role === 'ADMIN'
                        ? 'Selecciona una empresa activa para consultar sus indicadores.'
                        : 'Esta sesión no tiene una empresa asociada, por lo que no hay indicadores que mostrar.'
                    }
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
            ) : selectedModule === 'customers' || selectedModule === 'suppliers' ? (
              <PartnerScreen
                key={selectedModule}
                resource={selectedModule}
                token={token}
                companyId={context.companyId}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
            ) : selectedModule === 'products' ? (
              <ProductScreen
                token={token}
                companyId={context.companyId}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
            ) : selectedModule === 'inventory' ? (
              <InventoryScreen
                token={token}
                companyId={context.companyId}
                branchId={user.branchId}
                userRole={user.role}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
            ) : selectedModule === 'sales' ? (
              <SalesScreen
                token={token}
                companyId={context.companyId}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
              />
            ) : selectedModule === 'purchases' ? (
              <PurchasesScreen
                token={token}
                companyId={context.companyId}
                branchId={user.branchId}
                userRole={user.role}
                refreshKey={refreshTick}
                onSessionExpired={onSessionExpired}
                onToast={onToast}
              />
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
        branchId={user.branchId}
        userRole={user.role}
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

  companySelector: {
    maxWidth: 460,
    marginBottom: spacing.xl,
    zIndex: 2,
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