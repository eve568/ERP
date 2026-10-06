import { apiRequest } from './api';

export async function login(email, password) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

/**
 * Avisa al backend del cierre de sesión. El backend solo confirma;
 * la eliminación real del token ocurre en el cliente (session.js).
 * Nunca lanza: el cierre local no depende de la respuesta.
 */
export async function logout(token) {
  if (!token) {
    return null;
  }

  try {
    return await apiRequest('/api/auth/logout', {
      method: 'POST',
      token,
    });
  } catch (logoutError) {
    return null;
  }
}
