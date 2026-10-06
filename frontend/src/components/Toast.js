import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { colors, radius, shadows, spacing, typography } from '../theme';

const palettes = {
  success: { backgroundColor: colors.pastelGreen, borderColor: colors.success, textColor: colors.secondaryDark },
  error: { backgroundColor: colors.pastelPink, borderColor: colors.danger, textColor: colors.danger },
  info: { backgroundColor: colors.pastelCyan, borderColor: colors.primaryDark, textColor: colors.secondaryDark },
};

const VISIBLE_MS = 3200;

/**
 * Toast flotante con entrada/salida. Se monta una sola vez en la raíz
 * de la app para que el posicionamiento absoluto funcione en web y Android.
 */
export default function Toast({ toast, onDismiss }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    opacity.setValue(0);
    translateY.setValue(24);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();

    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: false,
        }),
        Animated.timing(translateY, {
          toValue: 24,
          duration: 180,
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          onDismiss?.();
        }
      });
    }, VISIBLE_MS);

    return () => clearTimeout(timerRef.current);
  }, [toast, opacity, translateY, onDismiss]);

  if (!toast) {
    return null;
  }

  const palette = palettes[toast.type] ?? palettes.info;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={[styles.text, { color: palette.textColor }]}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xxl,
    alignSelf: 'center',
    maxWidth: 460,
    zIndex: 100,
    elevation: 12,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    ...shadows.medium,
  },

  text: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
});
