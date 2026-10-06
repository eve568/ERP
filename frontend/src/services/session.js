import { Platform } from 'react-native';

const STORAGE_KEY = 'erp.session.v1';

let memorySession = null;

/**
 * Persistencia de sesión.
 * - Web: localStorage (sobrevive a recargas de la SPA en Cloudflare).
 * - Android/iOS: memoria (sin dependencias nativas nuevas).
 */
function canUseStorage() {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.localStorage !== 'undefined'
  );
}

export function loadSession() {
  if (canUseStorage()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw);

        if (parsed?.token && parsed?.user) {
          memorySession = parsed;
          return parsed;
        }
      }
    } catch (loadError) {
      // Almacenamiento no disponible o corrupto: sesión solo en memoria.
    }
  }

  return memorySession;
}

export function saveSession(session) {
  const companyId =
    session?.user?.companyId && typeof session.user.companyId === 'object'
      ? session.user.companyId._id ?? session.user.companyId.id ?? null
      : session?.user?.companyId ?? null;
  const normalizedSession = session?.user
    ? {
        ...session,
        user: { ...session.user, companyId },
        activeCompanyId:
          session.user.role === 'ADMIN'
            ? session.activeCompanyId ?? null
            : companyId,
      }
    : session;

  memorySession = normalizedSession;

  if (canUseStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedSession));
    } catch (saveError) {
      // Si el almacenamiento falla, la sesión sigue viva en memoria.
    }
  }
}

export function clearSession() {
  memorySession = null;

  if (canUseStorage()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (clearError) {
      // Nada que hacer: ya no hay sesión que limpiar.
    }
  }
}
