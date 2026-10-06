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

function readStoredSession() {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(STORAGE_KEY);
  }

  return SecureStore.getItem(STORAGE_KEY);
}

function writeStoredSession(value) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
    return;
  }

  SecureStore.setItem(STORAGE_KEY, value);
}

function removeStoredSession() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    return;
  }

  SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
}

export function loadSession() {
  try {
    const raw = readStoredSession();
    if (!raw) return memorySession;

    const parsed = normalizeSession(JSON.parse(raw));
    if (parsed?.token && parsed?.user) {
      memorySession = parsed;
      return parsed;
    }
  } catch {
    removeStoredSession();
  }

  return memorySession;
}

export function saveSession(session) {
  const normalizedSession = normalizeSession(session);
  memorySession = normalizedSession;

  try {
    writeStoredSession(JSON.stringify(normalizedSession));
  } catch {
    // La sesión permanece en memoria aunque el almacenamiento del dispositivo falle.
  }

  return normalizedSession;
}

export function clearSession() {
  memorySession = null;
  try {
    removeStoredSession();
  } catch {
    // La sesión en memoria ya fue eliminada.
  }
}
