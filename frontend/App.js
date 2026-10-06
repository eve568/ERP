import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getHealth } from './src/services/api';
import BrandLogo from './src/components/BrandLogo';
import LoginScreen from './src/screens/LoginScreen';

import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from './src/theme';

const modules = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    detail: 'Resumen general',
    icon: '▦',
  },
  {
    key: 'sales',
    label: 'Ventas',
    detail: 'Clientes y ventas',
    icon: '↗',
  },
  {
    key: 'inventory',
    label: 'Inventario',
    detail: 'Existencias y movimientos',
    icon: '□',
  },
  {
    key: 'purchases',
    label: 'Compras',
    detail: 'Proveedores y compras',
    icon: '↓',
  },
  {
    key: 'people',
    label: 'Personas',
    detail: 'Clientes y colaboradores',
    icon: '○',
  },
  {
    key: 'finance',
    label: 'Finanzas',
    detail: 'Ingresos y gastos',
    icon: '$',
  },
];

const stats = [
  {
    label: 'Ventas del periodo',
    value: '$0.00',
    type: 'sales',
  },
  {
    label: 'Productos',
    value: '0',
    type: 'inventory',
  },
  {
    label: 'Clientes',
    value: '0',
    type: 'people',
  },
  {
    label: 'Pendientes',
    value: '0',
    type: 'warning',
  },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [selectedModule, setSelectedModule] = useState('dashboard');

  useEffect(() => {
    if (!session) {
      return;
    }

    getHealth()
      .then((payload) => {
        setHealth(payload.data);
        setError(null);
      })
      .catch((requestError) => {
        setError(requestError.message);
      });
  }, [session]);

  if (!session) {
    return (
      <LoginScreen
        onLoginSuccess={(loginData) => {
          setSession(loginData);
        }}
      />
    );
  }

  const activeModule = modules.find(
    (module) => module.key === selectedModule
  );

  const currentUser = session?.user;

  const userName =
    [currentUser?.firstName, currentUser?.lastName]
      .filter(Boolean)
      .join(' ') || 'Usuario';

  const userInitial =
    currentUser?.firstName?.charAt(0)?.toUpperCase() ||
    currentUser?.email?.charAt(0)?.toUpperCase() ||
    'U';

  const userRole = currentUser?.role || 'Usuario';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.app}>
        {/* SIDEBAR */}
        <View style={styles.sidebar}>
          <View style={styles.logoContainer}>
            <BrandLogo
              width={150}
              height={58}
              accessibilityLabel="Logo del ERP"
            />
          </View>

          <View style={styles.sidebarDivider} />

          <Text style={styles.menuTitle}>MENÚ PRINCIPAL</Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.menu}
          >
            {modules.map((module) => {
              const active = selectedModule === module.key;

              return (
                <Pressable
                  key={module.key}
                  onPress={() => setSelectedModule(module.key)}
                  onClick={() => setSelectedModule(module.key)}
                  accessibilityRole="button"
                  accessibilityLabel={module.label}
                  style={[
                    styles.menuItem,
                    active && styles.menuItemActive,
                  ]}
                >
                  <View
                    style={[
                      styles.menuIcon,
                      active && styles.menuIconActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.menuIconText,
                        active && styles.menuIconTextActive,
                      ]}
                    >
                      {module.icon}
                    </Text>
                  </View>

                  <View style={styles.menuTextContainer}>
                    <Text
                      style={[
                        styles.menuLabel,
                        active && styles.menuLabelActive,
                      ]}
                    >
                      {module.label}
                    </Text>

                    <Text
                      style={[
                        styles.menuDetail,
                        active && styles.menuDetailActive,
                      ]}
                    >
                      {module.detail}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.sidebarFooter}>
            <Text style={styles.footerTitle}>ERP MODULAR</Text>
            <Text style={styles.footerText}>
              Sistema empresarial
            </Text>
          </View>
        </View>

        {/* MAIN */}
        <View style={styles.main}>
          {/* HEADER */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerEyebrow}>
                CENTRO DE OPERACIONES
              </Text>

              <Text style={styles.headerTitle}>
                {activeModule?.label}
              </Text>

              <Text style={styles.headerDescription}>
                {activeModule?.detail}
              </Text>
            </View>

            <View style={styles.headerRight}>
              <View style={styles.platformBadge}>
                <Text style={styles.platformText}>
                  {Platform.OS.toUpperCase()}
                </Text>
              </View>

              <View style={styles.userBadge}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {userInitial}
                  </Text>
                </View>

                <View>
                  <Text style={styles.userName}>
                    {userName}
                  </Text>

                  <Text style={styles.userRole}>
                    {userRole}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {/* CONNECTION */}
            <View style={styles.connectionCard}>
              <View style={styles.connectionLeft}>
                <View
                  style={[
                    styles.connectionIndicator,
                    error
                      ? styles.connectionError
                      : health
                        ? styles.connectionSuccess
                        : styles.connectionLoading,
                  ]}
                />

                <View>
                  <Text style={styles.connectionTitle}>
                    Estado del sistema
                  </Text>

                  {health ? (
                    <Text style={styles.connectionText}>
                      API conectada · MongoDB {health.database}
                    </Text>
                  ) : error ? (
                    <Text style={styles.connectionErrorText}>
                      {error}
                    </Text>
                  ) : (
                    <Text style={styles.connectionText}>
                      Comprobando conexión...
                    </Text>
                  )}
                </View>
              </View>

              {!health && !error && (
                <ActivityIndicator color={colors.primaryDark} />
              )}
            </View>

            {/* STATS */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  Resumen
                </Text>

                <Text style={styles.sectionSubtitle}>
                  Indicadores principales del sistema
                </Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              {stats.map((stat) => (
                <View
                  key={stat.label}
                  style={styles.statCard}
                >
                  <View style={styles.statTop}>
                    <Text style={styles.statLabel}>
                      {stat.label}
                    </Text>

                    <View
                      style={[
                        styles.statIcon,
                        stat.type === 'warning'
                          ? styles.statIconWarning
                          : styles.statIconNormal,
                      ]}
                    >
                      <Text style={styles.statIconText}>
                        {stat.type === 'sales'
                          ? '$'
                          : stat.type === 'inventory'
                            ? '□'
                            : stat.type === 'people'
                              ? '○'
                              : '!'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.statValue}>
                    {stat.value}
                  </Text>

                  <Text style={styles.statDescription}>
                    Datos reales aparecerán aquí
                  </Text>
                </View>
              ))}
            </View>

            {/* MODULE PANEL */}
            <View style={styles.modulePanel}>
              <View style={styles.modulePanelHeader}>
                <View>
                  <Text style={styles.modulePanelEyebrow}>
                    MÓDULO ACTIVO
                  </Text>

                  <Text style={styles.modulePanelTitle}>
                    {activeModule?.label}
                  </Text>
                </View>

                <View style={styles.modulePanelBadge}>
                  <Text style={styles.modulePanelBadgeText}>
                    PREPARADO
                  </Text>
                </View>
              </View>

              <Text style={styles.modulePanelDescription}>
                Este espacio será conectado progresivamente con
                los datos reales de la API. El módulo mantendrá
                las reglas de seguridad, permisos y aislamiento
                por empresa y sucursal.
              </Text>

              <View style={styles.modulePanelFooter}>
                <Text style={styles.modulePanelFooterText}>
                  Arquitectura ERP
                </Text>

                <Text style={styles.modulePanelFooterText}>
                  {activeModule?.detail}
                </Text>
              </View>
            </View>

            {/* QUICK ACCESS */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  Acceso rápido
                </Text>

                <Text style={styles.sectionSubtitle}>
                  Próximas operaciones del sistema
                </Text>
              </View>
            </View>

            <View style={styles.quickGrid}>
              <QuickAction
                title="Nueva venta"
                description="Registrar una operación de venta"
                icon="+"
                onPress={() => setSelectedModule('sales')}
              />

              <QuickAction
                title="Nuevo producto"
                description="Agregar un producto al catálogo"
                icon="+"
                onPress={() => setSelectedModule('inventory')}
              />

              <QuickAction
                title="Nuevo cliente"
                description="Registrar un cliente"
                icon="+"
                onPress={() => setSelectedModule('people')}
              />

              <QuickAction
                title="Movimiento"
                description="Registrar movimiento de inventario"
                icon="+"
                onPress={() => setSelectedModule('inventory')}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function QuickAction({ title, description, icon, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      onClick={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.quickCard,
        pressed && styles.quickCardPressed,
      ]}
    >
      <View style={styles.quickIcon}>
        <Text style={styles.quickIconText}>{icon}</Text>
      </View>

      <View style={styles.quickText}>
        <Text style={styles.quickTitle}>{title}</Text>

        <Text style={styles.quickDescription}>
          {description}
        </Text>
      </View>

      <Text style={styles.quickArrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  app: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },

  /* SIDEBAR */

  sidebar: {
    width: 270,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },

  logoContainer: {
    height: 70,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
  },

  sidebarDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xl,
  },

  menuTitle: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 1.2,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },

  menu: {
    gap: spacing.xs,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },

  menuItemActive: {
    backgroundColor: colors.pastelCyan,
  },

  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },

  menuIconActive: {
    backgroundColor: colors.primary,
  },

  menuIconText: {
    color: colors.textSecondary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },

  menuIconTextActive: {
    color: colors.text,
  },

  menuTextContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },

  menuLabel: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  menuLabelActive: {
    color: colors.text,
  },

  menuDetail: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 3,
  },

  menuDetailActive: {
    color: colors.secondaryDark,
  },

  sidebarFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },

  footerTitle: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },

  footerText: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 4,
  },

  /* MAIN */

  main: {
    flex: 1,
    minWidth: 0,
  },

  header: {
    minHeight: 112,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  headerEyebrow: {
    color: colors.secondaryDark,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 1.2,
  },

  headerTitle: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.extraBold,
    marginTop: 5,
  },

  headerDescription: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginTop: 3,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },

  platformBadge: {
    backgroundColor: colors.pastelGreen,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  platformText: {
    color: colors.secondaryDark,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },

  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  userAvatarText: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },

  userName: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  userRole: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 2,
  },

  content: {
    padding: spacing.xxxl,
    paddingBottom: 60,
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center',
  },

  /* CONNECTION */

  connectionCard: {
    minHeight: 78,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadows.small,
  },

  connectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  connectionIndicator: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    marginRight: spacing.md,
  },

  connectionSuccess: {
    backgroundColor: colors.success,
  },

  connectionError: {
    backgroundColor: colors.danger,
  },

  connectionLoading: {
    backgroundColor: colors.warning,
  },

  connectionTitle: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },

  connectionText: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 4,
  },

  connectionErrorText: {
    color: colors.danger,
    fontSize: typography.size.xs,
    marginTop: 4,
  },

  /* SECTIONS */

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

  /* STATS */

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },

  statCard: {
    flex: 1,
    minWidth: 190,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadows.small,
  },

  statTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  statLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    flex: 1,
  },

  statIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statIconNormal: {
    backgroundColor: colors.pastelCyan,
  },

  statIconWarning: {
    backgroundColor: colors.pastelYellow,
  },

  statIconText: {
    color: colors.secondaryDark,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },

  statValue: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.extraBold,
    marginTop: spacing.lg,
  },

  statDescription: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 5,
  },

  /* MODULE */

  modulePanel: {
    marginTop: spacing.xxxl,
    backgroundColor: colors.text,
    borderRadius: radius.xl,
    padding: spacing.xxxl,
    ...shadows.medium,
  },

  modulePanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  modulePanelEyebrow: {
    color: colors.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 1.2,
  },

  modulePanelTitle: {
    color: colors.surface,
    fontSize: typography.size.xxxl,
    fontWeight: typography.weight.extraBold,
    marginTop: spacing.sm,
  },

  modulePanelBadge: {
    backgroundColor: colors.pastelGreen,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  modulePanelBadgeText: {
    color: colors.secondaryDark,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },

  modulePanelDescription: {
    color: '#D9E4E8',
    fontSize: typography.size.md,
    lineHeight: 24,
    marginTop: spacing.lg,
    maxWidth: 760,
  },

  modulePanelFooter: {
    borderTopWidth: 1,
    borderTopColor: '#40505A',
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  modulePanelFooterText: {
    color: '#9DAEB6',
    fontSize: typography.size.xs,
  },

  /* QUICK ACTIONS */

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },

  quickCard: {
    flex: 1,
    minWidth: 230,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.small,
  },

  quickCardPressed: {
    opacity: 0.82,
  },

  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.pastelGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickIconText: {
    color: colors.secondaryDark,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },

  quickText: {
    flex: 1,
    marginLeft: spacing.md,
  },

  quickTitle: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },

  quickDescription: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 4,
  },

  quickArrow: {
    color: colors.textSecondary,
    fontSize: typography.size.xxl,
    marginLeft: spacing.sm,
  },
});