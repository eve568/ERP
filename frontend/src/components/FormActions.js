import { StyleSheet, View } from 'react-native';

import AppButton from './AppButton';
import { spacing } from '../theme';

/**
 * Fila de acciones de los formularios del dashboard.
 */
export default function FormActions({
  onSubmit,
  onCancel,
  submitLabel = 'Guardar',
  submitting = false,
  disabled = false,
}) {
  return (
    <View style={styles.row}>
      <AppButton
        label="Cancelar"
        variant="secondary"
        onPress={onCancel}
        disabled={submitting}
        style={styles.button}
      />

      <AppButton
        label={submitLabel}
        variant="primary"
        onPress={onSubmit}
        loading={submitting}
        disabled={disabled}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
  },

  button: {
    minWidth: 130,
  },
});
