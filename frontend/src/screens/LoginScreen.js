import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import BrandLogo from '../components/BrandLogo';
import { login } from '../services/auth';
import { colors } from '../theme/colors';

export default function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError('Ingresa tu correo electrónico y contraseña.');
      return;
    }

    setLoading(true);

    try {
      const response = await login(normalizedEmail, password);

      if (!response?.data?.token || !response?.data?.user) {
        throw new Error('La respuesta del servidor no es válida.');
      }

      onLoginSuccess(response.data);
    } catch (requestError) {
      setError(
        requestError?.message ||
          'No fue posible iniciar sesión. Intenta nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.logoContainer}>
            <BrandLogo width={190} height={72} />
          </View>

          <Text style={styles.title}>Bienvenido</Text>

          <Text style={styles.subtitle}>
            Inicia sesión para acceder a tu ERP.
          </Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Correo electrónico</Text>

              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="usuario@empresa.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Contraseña</Text>

              <View style={styles.passwordContainer}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Ingresa tu contraseña"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  onSubmitEditing={handleLogin}
                  style={styles.passwordInput}
                />

                <Pressable
                  onPress={() => setShowPassword((current) => !current)}
                  disabled={loading}
                  style={styles.passwordButton}
                >
                  <Text style={styles.passwordButtonText}>
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.loginButton,
                pressed && !loading ? styles.loginButtonPressed : null,
                loading ? styles.loginButtonDisabled : null,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.loginButtonText}>Iniciar sesión</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.footer}>
            Sistema ERP · Gestión empresarial
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },

  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },

  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
  },

  form: {
    gap: 18,
  },

  field: {
    gap: 8,
  },

  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 15,
  },

  passwordContainer: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },

  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 15,
    color: colors.text,
    fontSize: 15,
  },

  passwordButton: {
    paddingHorizontal: 12,
    height: '100%',
    justifyContent: 'center',
  },

  passwordButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '600',
  },

  errorBox: {
    backgroundColor: colors.pastelPink,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    padding: 12,
  },

  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },

  loginButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  loginButtonPressed: {
    opacity: 0.85,
  },

  loginButtonDisabled: {
    opacity: 0.65,
  },

  loginButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },

  footer: {
    marginTop: 26,
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
});