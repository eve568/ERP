const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'La API no está disponible');
  return payload;
}

export async function getHealth() {
  return apiRequest('/api/health');
}