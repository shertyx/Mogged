import { create } from 'zustand';

interface AuthState {
  userID: string | null;
  isAuthenticated: boolean;
  setTokens: (access: string, refresh: string, userID: string) => void;
  clearTokens: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userID: null,
  isAuthenticated: false,

  setTokens: (access, refresh, userID) => {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user_id', userID);
    set({ userID, isAuthenticated: true });
  },

  clearTokens: () => {
    localStorage.clear();
    set({ userID: null, isAuthenticated: false });
  },

  hydrate: () => {
    const userID = localStorage.getItem('user_id');
    const token = localStorage.getItem('access_token');
    if (userID && token) set({ userID, isAuthenticated: true });
  },
}));
