import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { getHealth } from './src/services/api';
import { logout } from './src/services/auth';
import { clearSession, loadSession, saveSession } from './src/services/session';
import Toast from './src/components/Toast';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';

import { colors } from './src/theme';

export default function App() {
  const [session, setSession] = useState(() => loadSession());
  const [health, setHealth] = useState(null);
  const [healthStatus, setHealthStatus] = useState('loading');
  const [healthError, setHealthError] = useState(null);
  const [healthTick, setHealthTick] = useState(0);
  const [toast, setToast] = useState(null);
  const [notice, setNotice] = useState(null);

  /* Estado de conexión con la API (con reintento manual) */
  useEffect(() => {
    if (!session) {
      setHealth(null);
      setHealthStatus('loading');
      setHealthError(null);
      return undefined;
    }

    let cancelled = false;

    setHealthStatus('loading');
    setHealthError(null);

    getHealth()
      .then((payload) => {
        if (cancelled) return;
        setHealth(payload.data);
        setHealthStatus('ready');
      })
      .catch((requestError) => {
        if (cancelled) return;
        setHealth(null);
        setHealthStatus('error');
        setHealthError(requestError?.message ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [session, healthTick]);

  const handleLoginSuccess = useCallback((loginData) => {
    saveSession(loginData);
    setSession(loginData);
    setNotice(null);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout(session?.token);
    clearSession();
    setSession(null);
    setNotice('Sesión cerrada correctamente.');
  }, [session?.token]);

  const handleSessionExpired = useCallback(() => {
    clearSession();
    setSession(null);
    setNotice('Tu sesión expiró. Inicia sesión nuevamente.');
  }, []);

  const pushToast = useCallback((message, type = 'info') => {
    setToast({ id: Date.now(), message, type });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const retryHealth = useCallback(() => {
    setHealthTick((tick) => tick + 1);
  }, []);

  if (!session) {
    return <LoginScreen notice={notice} onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.app}>
        <DashboardScreen
          session={session}
          health={health}
          healthStatus={healthStatus}
          healthError={healthError}
          onRetryHealth={retryHealth}
          onLogout={handleLogout}
          onSessionExpired={handleSessionExpired}
          onToast={pushToast}
        />

        <Toast toast={toast} onDismiss={dismissToast} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  app: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
