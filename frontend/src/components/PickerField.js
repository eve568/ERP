import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Skeleton from './Skeleton';
import { colors, radius, spacing, typography } from '../theme';

/**
 * Selector desplegable sin modales anidados: la lista se despliega
 * dentro del propio formulario, igual en web y Android.
 */
export default function PickerField({
  label,
  value,
  options = [],
  onChange,
  placeholder = 'Seleccionar',
  loading = false,
  disabled = false,
  error = null,
  hint = null,
  emptyMessage = 'Sin opciones disponibles',
  isRequired = false,
  style,
}) {
  const [open, setOpen] = useState(false);
  const listOpacity = useRef(new Animated.Value(0)).current;
  const listY = useRef(new Animated.Value(-6)).current;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    Animated.parallel([
      Animated.timing(listOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: false,
      }),
      Animated.timing(listY, {
        toValue: 0,
        duration: 160,
        useNativeDriver: false,
      }),
    ]).start();

    return undefined;
  }, [open, listOpacity, listY]);

  const selected = options.find((option) => option.value === value) ?? null;

  function toggle() {
    if (disabled || loading) return;
    setOpen((current) => !current);
  }

  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>
        {label}
        {isRequired ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <Pressable
        onPress={toggle}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled: disabled || loading }}
        style={({ pressed }) => [
          styles.control,
          error ? styles.controlError : null,
          (disabled || loading) && styles.controlDisabled,
          pressed && !disabled && styles.controlPressed,
        ]}
      >
        <Text
          style={[styles.controlText, !selected && styles.placeholder]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>

        <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      {loading ? (
        <Skeleton width="100%" height={40} style={styles.loading} />
      ) : null}

      {open && !loading ? (
        <Animated.View
          style={[styles.list, { opacity: listOpacity, transform: [{ translateY: listY }] }]}
        >
          {options.length ? (
            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
              {options.map((option) => {
                const isActive = option.value === value;

                return (
                  <Pressable
                    key={String(option.value)}
                    onPress={() => {
                      onChange?.(option.value);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.option,
                      isActive && styles.optionActive,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <Text
                      style={[styles.optionText, isActive && styles.optionTextActive]}
                      numberOfLines={2}
                    >
                      {option.label}
                    </Text>

                    {isActive ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.empty}>{emptyMessage}</Text>
          )}
        </Animated.View>
      ) : null}

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },

  label: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  required: {
    color: colors.danger,
  },

  control: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },

  controlPressed: {
    borderColor: colors.primary,
    backgroundColor: colors.pastelCyan,
  },

  controlError: {
    borderColor: colors.danger,
  },

  controlDisabled: {
    opacity: 0.6,
  },

  controlText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.size.md,
  },

  placeholder: {
    color: colors.textSecondary,
  },

  chevron: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
  },

  loading: {
    marginTop: 4,
  },

  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },

  scroll: {
    maxHeight: 208,
  },

  option: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  optionActive: {
    backgroundColor: colors.pastelCyan,
  },

  optionPressed: {
    backgroundColor: colors.background,
  },

  optionText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.size.sm,
  },

  optionTextActive: {
    fontWeight: typography.weight.bold,
  },

  check: {
    color: colors.secondaryDark,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },

  empty: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    padding: spacing.lg,
    textAlign: 'center',
  },

  error: {
    color: colors.danger,
    fontSize: typography.size.xs,
  },

  hint: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
  },
});
