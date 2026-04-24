import { useAuthStore } from '../store/auth';
import * as SecureStore from 'expo-secure-store';
import { logout as apiLogout } from '../api/auth';

export function useAuth() {
  const { userID, isAuthenticated, clearTokens } = useAuthStore();

  const logout = async () => {
    const refresh = await SecureStore.getItemAsync('refresh_token');
    if (refresh) await apiLogout(refresh).catch(() => {});
    await clearTokens();
  };

  return { userID, isAuthenticated, logout };
}
