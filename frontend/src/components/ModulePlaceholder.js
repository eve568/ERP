import { StyleSheet, Text, View } from 'react-native';

import AppButton from './AppButton';
import { colors, radius, shadows, spacing, typography } from '../theme';

/**
 * Placeholder honesto para módulos que todavía no tienen pantallas
 * conectadas. No simula datos ni funciones inexistentes.
 */
export default function ModulePlaceholder({ module, onBack }) {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>MÓDULO</Text>
          <Text style={styles.title}>{module?.label}</Text>
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>Próximamente</Text>
        </View>
      </View>

      <Text style={styles.description}>
        Este módulo todavía no tiene pantallas conectadas. La estructura, los
        permisos y el aislamiento por empresa y sucursal ya existen en el
        backend; las vistas se conectarán en las siguientes fases.
      </Text>

      <Text style={styles.meta}>{module?.detail}</Text>

      <View style={styles.footer}>
        <AppButton label="Volver al resumen" variant="primary" small onPress={onBack} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: spacing.xxxl,
    backgroundColor: colors.panelBackground,
    borderRadius: radius.xl,
    padding: spacing.xxxl,
    ...shadows.medium,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  headerCopy: {
    flex: 1,
    minWidth: 0,
  },

  eyebrow: {
    color: colors.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 1.2,
  },

  title: {
    color: colors.surface,
    fontSize: typography.size.xxxl,
    fontWeight: typography.weight.extraBold,
    marginTop: spacing.sm,
  },

  badge: {
    backgroundColor: colors.pastelYellow,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  badgeText: {
    color: colors.secondaryDark,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },

  description: {
    color: colors.panelText,
    fontSize: typography.size.md,
    lineHeight: 24,
    marginTop: spacing.lg,
    maxWidth: 760,
  },

  meta: {
    color: colors.panelMuted,
    fontSize: typography.size.xs,
    marginTop: spacing.lg,
  },

  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    flexDirection: 'row',
  },
});
