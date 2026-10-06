import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing, typography } from '../theme';

/**
 * Acción rápida del dashboard.
 * - onPress definido   -> botón operativo con feedback de presión.
 * - disabled           -> estado "Próximamente" honesto (sin onPress falso).
 */
export default function QuickActionCard({
  title,
  description,
  icon = '+',
  badge = null,
  disabled = false,
  onPress,
  index = 0,
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 240,
          useNativeDriver: false,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 240,
          useNativeDriver: false,
        }),
      ]).start();
    }, 60 + index * 60);

    return () => clearTimeout(timer);
  }, [index, opacity, translateY]);

  function pressIn() {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: false,
      friction: 8,
      tension: 120,
    }).start();
  }

  function pressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: false,
      friction: 8,
      tension: 120,
    }).start();
  }

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { opacity, transform: [{ translateY }, { scale }] },
      ]}
    >
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.card,
          pressed && !disabled && styles.cardPressed,
          disabled && styles.cardDisabled,
        ]}
      >
        <View style={[styles.icon, disabled && styles.iconDisabled]}>
          <Text style={[styles.iconText, disabled && styles.iconTextDisabled]}>
            {icon}
          </Text>
        </View>

        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>

            {badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        </View>

        {!disabled ? <Text style={styles.arrow}>›</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minWidth: 230,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.small,
  },

  cardPressed: {
    borderColor: colors.primary,
    backgroundColor: colors.pastelCyan,
  },

  cardDisabled: {
    opacity: 0.72,
    borderStyle: 'dashed',
  },

  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.pastelGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconDisabled: {
    backgroundColor: colors.background,
  },

  iconText: {
    color: colors.secondaryDark,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },

  iconTextDisabled: {
    color: colors.textSecondary,
  },

  copy: {
    flex: 1,
    marginLeft: spacing.md,
    minWidth: 0,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  title: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    flexShrink: 1,
  },

  badge: {
    backgroundColor: colors.pastelYellow,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },

  badgeText: {
    color: colors.warning,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },

  description: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 4,
  },

  arrow: {
    color: colors.textSecondary,
    fontSize: typography.size.xxl,
    marginLeft: spacing.sm,
  },
});
