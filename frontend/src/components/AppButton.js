import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

const variants = {
  primary: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
    textColor: colors.surface,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    textColor: colors.text,
  },
  danger: {
    backgroundColor: colors.pastelPink,
    borderColor: colors.danger,
    textColor: colors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    textColor: colors.primaryDark,
  },
};

/**
 * Botón compartido con feedback de presión (web + Android).
 */
export default function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  small = false,
  style,
}) {
  const palette = variants[variant] ?? variants.primary;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.textColor} size="small" />
      ) : (
        <Text
          style={[
            styles.label,
            small && styles.labelSmall,
            { color: palette.textColor },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  small: {
    minHeight: 36,
    paddingHorizontal: spacing.lg,
  },

  pressed: {
    opacity: 0.82,
  },

  disabled: {
    opacity: 0.55,
  },

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },

  labelSmall: {
    fontSize: typography.size.xs,
  },
});
