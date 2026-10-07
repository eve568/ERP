import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppButton from './AppButton';
import FormField from './FormField';
import { isSessionError, sendTestEmail } from '../services/api';
import { colors, radius, spacing, typography } from '../theme';

export default function EmailTestCard({ token, defaultEmail = '', onSessionExpired, onToast }) {
  const [email, setEmail] = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend() {
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setError('Escribe un correo válido.');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const payload = await sendTestEmail(token, value);
      onToast?.(payload?.message ?? 'Correo de prueba enviado.', 'success');
    } catch (requestError) {
      if (isSessionError(requestError)) {
        onSessionExpired?.();
        return;
      }

      const message = requestError?.message ?? 'No fue posible enviar el correo.';
      setError(message);
      onToast?.(message, 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.title}>Prueba de correo</Text>
        <Text style={styles.subtitle}>
          Comprueba la integración ERP → Render → Resend enviando un correo real.
        </Text>
      </View>

      <View style={styles.form}>
        <FormField
          label="Correo destinatario"
          value={email}
          onChangeText={setEmail}
          placeholder="correo@ejemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={error}
        />
        <AppButton
          label="Enviar correo de prueba"
          onPress={handleSend}
          loading={sending}
          disabled={!email.trim()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  copy: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
  },
  form: {
    gap: spacing.md,
  },
});
