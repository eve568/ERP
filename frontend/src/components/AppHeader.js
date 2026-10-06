import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from './AppButton';
import Skeleton from './Skeleton';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { formatRelativeTime } from '../utils/format';
import { getNotifications, isSessionError } from '../services/api';

function MenuButton({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Abrir menú"
      style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
    >
      <View style={styles.menuBar} />
      <View style={styles.menuBar} />
      <View style={styles.menuBar} />
    </Pressable>
  );
}

function NotificationsPanel({ state, onClose, onRetry }) {
  const unread = state.items.filter((item) => !item.readAt).length;

  return (
    <View style={[styles.panel, styles.notificationsPanel]} accessibilityRole="menu">
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Avisos</Text>

        <Text style={styles.panelMeta}>
          {state.status === 'ready'
            ? unread
              ? `${unread} sin leer`
              : 'Sin avisos sin leer'
            : ' '}
        </Text>
      </View>

      {state.status === 'loading' ? (
        <View style={styles.loadingBox}>
          <Skeleton width="100%" height={40} />
          <Skeleton width="100%" height={40} />
          <Skeleton width="80%" height={40} />
        </View>
      ) : state.status === 'error' ? (
        <View style={styles.emptyBox}>
          <Text style={styles.errorText}>
            {state.error ?? 'No fue posible cargar los avisos.'}
          </Text>

          <AppButton label="Reintentar" variant="secondary" small onPress={onRetry} />
        </View>
      ) : !state.items.length ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Sin notificaciones por ahora.</Text>
        </View>
      ) : (
        <ScrollView style={styles.notifScroll} showsVerticalScrollIndicator={false}>
          {state.items.slice(0, 20).map((item, index) => (
            <View
              key={item._id ?? index}
              style={[styles.notifItem, !item.readAt && styles.notifItemUnread]}
            >
              <Text style={styles.notifTitle} numberOfLines={1}>
                {item.title}
              </Text>

              <Text style={styles.notifMessage} numberOfLines={2}>
                {item.message}
              </Text>

              <Text style={styles.notifTime}>
                {formatRelativeTime(item.createdAt)}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function UserPanel({ user, company, branch, onLogout }) {
  return (
    <View style={[styles.panel, styles.userPanel]} accessibilityRole="menu">
      <Text style={styles.userName} numberOfLines={1}>
        {user.name}
      </Text>

      <Text style={styles.userEmail} numberOfLines={1}>
        {user.email}
      </Text>

      <View style={styles.userMetaList}>
        <View style={styles.userMetaRow}>
          <Text style={styles.userMetaLabel}>Rol</Text>
          <Text style={styles.userMetaValue}>{user.role}</Text>
        </View>

        <View style={styles.userMetaRow}>
          <Text style={styles.userMetaLabel}>Empresa</Text>
          <Text style={styles.userMetaValue} numberOfLines={1}>
            {company ?? 'Sin empresa asignada'}
          </Text>
        </View>

        <View style={styles.userMetaRow}>
          <Text style={styles.userMetaLabel}>Sucursal</Text>
          <Text style={styles.userMetaValue} numberOfLines={1}>
            {branch ?? 'Sin sucursal asignada'}
          </Text>
        </View>
      </View>

      <AppButton label="Cerrar sesión" variant="danger" small onPress={onLogout} />
    </View>
  );
}

/**
 * Header de la app: contexto de módulo, empresa/sucursal, avisos
 * (datos reales de /api/notifications) y menú de usuario con logout.
 */
export default function AppHeader({
  moduleLabel,
  moduleDetail,
  user,
  company,
  branch,
  token,
  companyId,
  onSessionExpired,
  onLogout,
  onToggleSidebar,
  showMenuButton = false,
  width = 1200,
}) {
  const [panel, setPanel] = useState(null);
  const [notifications, setNotifications] = useState({
    status: 'idle',
    items: [],
    error: null,
  });
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const compact = width < 768;
  const showContext = width >= 980;

  const loadNotifications = useCallback(async () => {
    if (!token || !companyId) {
      setNotifications({ status: 'ready', items: [], error: null });
      return;
    }

    setNotifications((current) => ({ ...current, status: 'loading', error: null }));

    try {
      const payload = await getNotifications(token, companyId);
      const items = Array.isArray(payload?.data) ? payload.data : [];
      setNotifications({ status: 'ready', items, error: null });
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }

      setNotifications({
        status: 'error',
        items: [],
        error: requestError?.message ?? null,
      });
    }
  }, [token, companyId, onSessionExpired]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    Animated.timing(backdropOpacity, {
      toValue: panel ? 1 : 0,
      duration: 140,
      useNativeDriver: false,
    }).start();
  }, [panel, backdropOpacity]);

  const unread = notifications.items.filter((item) => !item.readAt).length;

  function togglePanel(name) {
    setPanel((current) => (current === name ? null : name));
  }

  return (
    <View style={styles.header}>
      {showMenuButton ? <MenuButton onPress={onToggleSidebar} /> : null}

      <View style={styles.titleBlock}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {company ? company : 'CENTRO DE OPERACIONES'}
        </Text>

        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>
          {moduleLabel}
        </Text>

        {compact ? null : (
          <Text style={styles.description} numberOfLines={1}>
            {branch ? `${moduleDetail} · ${branch}` : moduleDetail}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => togglePanel('notifications')}
          accessibilityRole="button"
          accessibilityLabel={`Avisos${unread ? `, ${unread} sin leer` : ''}`}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>Avisos</Text>

          {unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          ) : null}
        </Pressable>

        {showContext ? (
          <View style={styles.platformBadge}>
            <Text style={styles.platformText}>{Platform.OS.toUpperCase()}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => togglePanel('user')}
          accessibilityRole="button"
          accessibilityLabel="Menú de usuario"
          style={({ pressed }) => [styles.user, pressed && styles.pressed]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.initial}</Text>
          </View>

          {compact ? null : (
            <View style={styles.userCopy}>
              <Text style={styles.userNameRow} numberOfLines={1}>
                {user.name}
              </Text>
              <Text style={styles.userRole} numberOfLines={1}>
                {user.role}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {panel ? (
        <Pressable
          style={[styles.panelBackdrop, { opacity: backdropOpacity }]}
          onPress={() => setPanel(null)}
          accessibilityRole="button"
          accessibilityLabel="Cerrar menú"
        />
      ) : null}

      {panel === 'notifications' ? (
        <NotificationsPanel
          state={notifications}
          onClose={() => setPanel(null)}
          onRetry={loadNotifications}
        />
      ) : null}

      {panel === 'user' ? (
        <UserPanel
          user={user}
          company={company}
          branch={branch}
          onLogout={onLogout}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 96,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
    zIndex: 20,
  },

  menuButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  menuBar: {
    width: 18,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.text,
  },

  pressed: {
    opacity: 0.75,
  },

  titleBlock: {
    flex: 1,
    minWidth: 0,
  },

  eyebrow: {
    color: colors.secondaryDark,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  title: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.extraBold,
    marginTop: 4,
  },

  titleCompact: {
    fontSize: typography.size.xl,
  },

  description: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginTop: 3,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },

  actionText: {
    color: colors.text,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },

  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },

  badgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: typography.weight.bold,
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

  user: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: colors.surface,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },

  userCopy: {
    maxWidth: 160,
  },

  userNameRow: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  userRole: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 2,
  },

  panelBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
  },

  panel: {
    position: 'absolute',
    top: '100%',
    right: spacing.xl,
    zIndex: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    ...shadows.medium,
  },

  userPanel: {
    width: 280,
    padding: spacing.xl,
    gap: spacing.sm,
  },

  notificationsPanel: {
    width: 330,
    padding: spacing.lg,
  },

  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },

  panelTitle: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.extraBold,
  },

  panelMeta: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
  },

  loadingBox: {
    gap: spacing.sm,
  },

  emptyBox: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },

  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    textAlign: 'center',
  },

  errorText: {
    color: colors.danger,
    fontSize: typography.size.xs,
    textAlign: 'center',
  },

  notifScroll: {
    maxHeight: 320,
  },

  notifItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },

  notifItemUnread: {
    backgroundColor: colors.pastelCyan,
    borderColor: colors.primary,
  },

  notifTitle: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },

  notifMessage: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 3,
  },

  notifTime: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 5,
  },

  userMetaList: {
    gap: 6,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },

  userMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  userMetaLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
  },

  userMetaValue: {
    flexShrink: 1,
    color: colors.text,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    textAlign: 'right',
  },
});
