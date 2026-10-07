import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORAGE_KEY = 'erp.session.v1';
let memorySession = null;

function normalizeSession(session) {
  const companyId =
    session?.user?.companyId && typeof session.user.companyId === 'object'
      ? session.user.companyId._id ?? session.user.companyId.id ?? null
      : session?.user?.companyId ?? null;

  return session?.user
    ? {
        ...session,
        user: { ...session.user, companyId },
        activeCompanyId:
          session.user.role === 'ADMIN'
            ? session.activeCompanyId ?? null
            : companyId,
      }
    : session;
}

export async function loadSession() {
  try {
    let raw = null;
    if (Platform.OS === 'web') {
      raw =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem(STORAGE_KEY)
          : null;
    } else {
      raw = await SecureStore.getItemAsync(STORAGE_KEY);
    }

    if (!raw) return memorySession;

    const parsed = normalizeSession(JSON.parse(raw));
    if (parsed?.token && parsed?.user) {
      memorySession = parsed;
      return parsed;
    }
  } catch {
    await clearSession();
  }

  return memorySession;
}

export async function saveSession(session) {
  const normalizedSession = normalizeSession(session);
  memorySession = normalizedSession;
  const value = JSON.stringify(normalizedSession);

  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, value);
      }
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, value);
    }
  } catch {
    // La sesión permanece en memoria aunque el almacenamiento falle.
  }

  return normalizedSession;
}

export async function clearSession() {
  memorySession = null;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    }
  } catch {
    // La sesión en memoria ya fue eliminada.
  }
}
