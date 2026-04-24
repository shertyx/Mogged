import { useAuthStore } from '../store/auth';
import { logout as apiLogout } from '../api/auth';

export function useAuth() {
  const { userID, isAuthenticated, clearTokens } = useAuthStore();

  const logout = async () => {
    const refresh = localStorage.getItem('refresh_token');
    if (refresh) await apiLogout(refresh).catch(() => {});
    clearTokens();
    window.location.href = '/login';
  };

  return { userID, isAuthenticated, logout };
}
