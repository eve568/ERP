import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

/**
 * Campo de formulario compartido por los diálogos del dashboard.
 */
export default function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = 'sentences',
  autoCorrect = true,
  maxLength,
  editable = true,
  error = null,
  hint = null,
  isRequired = false,
  style,
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>
        {label}
        {isRequired ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        maxLength={maxLength}
        editable={editable}
        style={[styles.input, error ? styles.inputError : null]}
      />

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

  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: typography.size.md,
  },

  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.pastelPink,
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
