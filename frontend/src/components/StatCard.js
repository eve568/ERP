import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing, typography } from '../theme';
import Skeleton from './Skeleton';

const tones = {
  normal: { background: colors.pastelCyan, text: colors.secondaryDark },
  success: { background: colors.pastelGreen, text: colors.secondaryDark },
  warning: { background: colors.pastelYellow, text: colors.warning },
  danger: { background: colors.pastelPink, text: colors.danger },
};

/**
 * Tarjeta KPI con estados reales:
 * - loading  -> skeleton
 * - error    -> "Sin datos" + reintentar
 * - sin dato -> "Sin datos"
 * - valor    -> dato real de la API
 */
export default function StatCard({
  label,
  value,
  hint,
  icon = '□',
  tone = 'normal',
  loading = false,
  error = null,
  onRetry,
  index = 0,
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const palette = tones[tone] ?? tones.normal;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: false,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 260,
          useNativeDriver: false,
        }),
      ]).start();
    }, 40 + index * 60);

    return () => clearTimeout(timer);
  }, [index, opacity, translateY]);

  const showError = Boolean(error) && !loading;

  return (
    <Animated.View
      style={[
        styles.card,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.top}>
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>

        <View style={[styles.icon, { backgroundColor: palette.background }]}>
          <Text style={[styles.iconText, { color: palette.text }]}>{icon}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.body}>
          <Skeleton width={92} height={28} />
          <Skeleton width="70%" height={12} style={styles.hintSkeleton} />
        </View>
      ) : showError ? (
        <View style={styles.body}>
          <Text style={styles.emptyValue}>Sin datos</Text>
          <Text style={styles.errorHint} numberOfLines={2}>
            {error}
          </Text>

          {onRetry ? (
            <Pressable
              onPress={onRetry}
              accessibilityRole="button"
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
            >
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : value === null || value === undefined ? (
        <View style={styles.body}>
          <Text style={styles.emptyValue}>Sin datos</Text>
          <Text style={styles.hint} numberOfLines={2}>
            {hint ?? 'Próximamente'}
          </Text>
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Text>
          <Text style={styles.hint} numberOfLines={2}>
            {hint}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 190,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadows.small,
  },

  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },

  label: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },

  body: {
    marginTop: spacing.lg,
  },

  value: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.extraBold,
  },

  emptyValue: {
    color: colors.textSecondary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },

  hint: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 5,
  },

  errorHint: {
    color: colors.danger,
    fontSize: typography.size.xs,
    marginTop: 5,
  },

  hintSkeleton: {
    marginTop: 8,
  },

  retry: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },

  pressed: {
    opacity: 0.7,
  },

  retryText: {
    color: colors.primaryDark,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
});
