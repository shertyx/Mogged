import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('access_token');
}

async function refreshTokens(): Promise<string | null> {
  const refresh = await SecureStore.getItemAsync('refresh_token');
  if (!refresh) return null;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  await SecureStore.setItemAsync('access_token', data.access_token);
  return data.access_token;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let token = await getToken();
  const doFetch = async (t: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(options.headers ?? {}),
      },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    token = await refreshTokens();
    if (!token) throw new Error('unauthenticated');
    res = await doFetch(token);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
