import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import FormActions from '../FormActions';
import FormField from '../FormField';
import { createCustomer } from '../../services/records';
import { isSessionError } from '../../services/api';
import { colors, radius, spacing, typography } from '../../theme';

export default function CustomerForm({ token, companyId, onCancel, onDone, onSessionExpired }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('El nombre del cliente es obligatorio.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = { name: trimmedName };

    if (email.trim()) payload.email = email.trim();
    if (phone.trim()) payload.phone = phone.trim();
    if (taxId.trim()) payload.taxId = taxId.trim();
    if (companyId) payload.companyId = companyId;

    try {
      await createCustomer(token, payload);
      onDone('Cliente creado correctamente', 'success');
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }

      setError(requestError?.message ?? 'No fue posible crear el cliente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.sectionNote}>
        Los campos marcados con * son obligatorios. El resto puede completarse
        más adelante.
      </Text>

      <FormField
        label="Nombre o razón social"
        value={name}
        onChangeText={setName}
        placeholder="Ej.: Distribuidora Norte"
        isRequired
        editable={!submitting}
      />

      <FormField
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        placeholder="cliente@empresa.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!submitting}
      />

      <FormField
        label="Teléfono"
        value={phone}
        onChangeText={setPhone}
        placeholder="Ej.: 55 1234 5678"
        keyboardType="phone-pad"
        editable={!submitting}
      />

      <FormField
        label="RFC / identificación fiscal"
        value={taxId}
        onChangeText={setTaxId}
        placeholder="Opcional"
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!submitting}
        hint="Si ya existe un registro con este RFC en la empresa, el backend lo rechazará."
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FormActions
        onSubmit={submit}
        onCancel={onCancel}
        submitLabel="Crear cliente"
        submitting={submitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },

  sectionNote: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    lineHeight: 18,
  },

  errorBox: {
    backgroundColor: colors.pastelPink,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
  },

  errorText: {
    color: colors.danger,
    fontSize: typography.size.xs,
    lineHeight: 18,
  },
});
