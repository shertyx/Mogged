import { apiRequest } from './client';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export function getOAuthURL(): string {
  return `${API_URL}/auth/login`;
}

export async function exchangeCallback(code: string, state: string) {
  return apiRequest<{ access_token: string; refresh_token: string; user_id: string }>(
    `/auth/callback?code=${code}&state=${state}`
  );
}

export async function logout(refreshToken: string) {
  return apiRequest<void>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}
