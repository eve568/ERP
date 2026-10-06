import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

/**
 * Estado vacío honesto: no inventa cifras ni simula contenido.
 */
export default function EmptyBlock({ title, message }) {
  return (
    <View style={styles.block}>
      <View style={styles.dot} />

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },

  dot: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.pastelYellow,
    marginBottom: spacing.xs,
  },

  title: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },

  message: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    textAlign: 'center',
    maxWidth: 520,
    lineHeight: 20,
  },
});
