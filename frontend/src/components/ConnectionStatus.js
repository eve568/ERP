import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';

import AppButton from './AppButton';
import { colors, radius, shadows, spacing, typography } from '../theme';

/**
 * Estado de conexión con la API: cargando, conectada o error con reintento.
 */
export default function ConnectionStatus({
  status = 'loading',
  health = null,
  error = null,
  onRetry,
}) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [opacity]);

  const dotColor =
    status === 'ready'
      ? colors.success
      : status === 'error'
        ? colors.danger
        : colors.warning;

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />

        <View style={styles.copy}>
          <Text style={styles.title}>Estado del sistema</Text>

          {status === 'ready' && health ? (
            <Text style={styles.text}>
              API conectada · MongoDB {health.database ?? 'desconocido'}
            </Text>
          ) : status === 'error' ? (
            <Text style={styles.errorText}>
              {error ?? 'No fue posible verificar la conexión'}
            </Text>
          ) : (
            <Text style={styles.text}>Comprobando conexión...</Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        {status === 'loading' ? (
          <ActivityIndicator color={colors.primaryDark} />
        ) : onRetry ? (
          <AppButton label="Verificar" variant="secondary" small onPress={onRetry} />
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
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
    gap: spacing.lg,
    ...shadows.small,
  },

  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    marginRight: spacing.md,
  },

  copy: {
    flex: 1,
    minWidth: 0,
  },

  title: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },

  text: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 4,
  },

  errorText: {
    color: colors.danger,
    fontSize: typography.size.xs,
    marginTop: 4,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
