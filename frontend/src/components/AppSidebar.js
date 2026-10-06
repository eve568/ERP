import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BrandLogo from './BrandLogo';
import { colors, radius, spacing, typography } from '../theme';

const DRAWER_OFFSET = -290;

function SidebarItem({ module, active, onSelect }) {
  const activeOpacity = useRef(
    new Animated.Value(active ? 1 : 0)
  ).current;

  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(activeOpacity, {
      toValue: active ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [active, activeOpacity]);

  const handleSelect = () => {
    onSelect(module.key);
  };

  return (
    <Pressable
      onPress={handleSelect}
      onPressIn={() => {
        Animated.spring(scale, {
          toValue: 0.985,
          useNativeDriver: false,
          friction: 9,
          tension: 140,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: false,
          friction: 9,
          tension: 140,
        }).start();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={module.label}
      style={({ pressed }) => [
        styles.menuItem,
        pressed && styles.menuItemPressed,
        {
          transform: [{ scale }],
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.activeOverlay,
          {
            opacity: activeOpacity,
          },
        ]}
      />

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
        <View style={styles.menuLabelRow}>
          <Text
            style={[
              styles.menuLabel,
              active && styles.menuLabelActive,
            ]}
            numberOfLines={1}
          >
            {module.label}
          </Text>

          {!module.available && (
            <View style={styles.soonBadge}>
              <Text style={styles.soonBadgeText}>
                Próximamente
              </Text>
            </View>
          )}
        </View>

        <Text
          style={[
            styles.menuDetail,
            active && styles.menuDetailActive,
          ]}
          numberOfLines={1}
        >
          {module.detail}
        </Text>
      </View>
    </Pressable>
  );
}

function SidebarContent({
  modules,
  selectedKey,
  onSelect,
}) {
  return (
    <>
      <View style={styles.logoContainer}>
        <BrandLogo
          width={150}
          height={58}
          accessibilityLabel="Logo del ERP"
        />
      </View>

      <View style={styles.divider} />

      <Text style={styles.menuTitle}>
        MENÚ PRINCIPAL
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.menu}
      >
        {modules.map((module) => (
          <SidebarItem
            key={module.key}
            module={module}
            active={selectedKey === module.key}
            onSelect={onSelect}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerTitle}>
          ERP MODULAR
        </Text>

        <Text style={styles.footerText}>
          Sistema empresarial
        </Text>
      </View>
    </>
  );
}

/**
 * Navegación lateral única de la app.
 *
 * variant="fixed"
 * Sidebar permanente para escritorio.
 *
 * variant="drawer"
 * Cajón animado para tablet/móvil.
 */
export default function AppSidebar({
  modules,
  selectedKey,
  onSelect,
  variant = 'fixed',
  open = true,
  onClose,
  width = 270,
}) {
  const translateX = useRef(
    new Animated.Value(
      variant === 'drawer' && !open
        ? DRAWER_OFFSET
        : 0
    )
  ).current;

  useEffect(() => {
    if (variant !== 'drawer') {
      return undefined;
    }

    const animation = Animated.timing(
      translateX,
      {
        toValue: open ? 0 : DRAWER_OFFSET,
        duration: 220,
        useNativeDriver: false,
      }
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [
    open,
    variant,
    translateX,
  ]);

  if (variant === 'drawer') {
    return (
      <>
        {open && (
          <Pressable
            style={styles.backdrop}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar menú"
          />
        )}

        <Animated.View
          pointerEvents={open ? 'auto' : 'none'}
          importantForAccessibility={
            open
              ? 'auto'
              : 'no-hide-descendants'
          }
          accessibilityElementsHidden={!open}
          style={[
            styles.drawer,
            {
              width,
              transform: [
                {
                  translateX,
                },
              ],
            },
          ]}
        >
          <SidebarContent
            modules={modules}
            selectedKey={selectedKey}
            onSelect={onSelect}
          />
        </Animated.View>
      </>
    );
  }

  return (
    <View
      style={[
        styles.fixed,
        {
          width,
        },
      ]}
    >
      <SidebarContent
        modules={modules}
        selectedKey={selectedKey}
        onSelect={onSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fixed: {
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },

  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 40,
    elevation: 8,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    zIndex: 30,
    elevation: 7,
  },

  logoContainer: {
    height: 70,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xl,
    marginHorizontal: spacing.lg,
  },

  menuTitle: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 1.2,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  menu: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },

  menuItemPressed: {
    backgroundColor: colors.background,
  },

  activeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.pastelCyan,
    borderRadius: radius.md,
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
    minWidth: 0,
  },

  menuLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  menuLabel: {
    flexShrink: 1,
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  menuLabelActive: {
    fontWeight: typography.weight.bold,
  },

  soonBadge: {
    backgroundColor: colors.pastelYellow,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },

  soonBadgeText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: typography.weight.bold,
  },

  menuDetail: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 3,
  },

  menuDetailActive: {
    color: colors.secondaryDark,
  },

  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
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
});
