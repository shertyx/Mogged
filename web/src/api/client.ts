function getToken(): string | null {
  return localStorage.getItem('access_token');
}

async function refreshTokens(): Promise<string | null> {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return null;
  const res = await fetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  localStorage.setItem('access_token', data.access_token);
  return data.access_token;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let token = getToken();
  const doFetch = (t: string | null) =>
    fetch(path, {
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
    if (!token) {
      localStorage.clear();
      window.location.href = '/login';
      throw new Error('unauthenticated');
    }
    res = await doFetch(token);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
