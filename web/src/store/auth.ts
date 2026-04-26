import { create } from 'zustand';

interface AuthState {
  userID: string | null;
  username: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  setTokens: (access: string, refresh: string, userID: string) => void;
  setAdmin: (isAdmin: boolean) => void;
  setUsername: (username: string) => void;
  clearTokens: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userID: null,
  username: null,
  isAdmin: false,
  isAuthenticated: false,

  setTokens: (access, refresh, userID) => {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user_id', userID);
    set({ userID, isAuthenticated: true });
  },

  setAdmin: (isAdmin) => {
    localStorage.setItem('is_admin', isAdmin ? '1' : '');
    set({ isAdmin });
  },

  setUsername: (username) => {
    localStorage.setItem('username', username);
    set({ username });
  },

  clearTokens: () => {
    localStorage.clear();
    set({ userID: null, username: null, isAdmin: false, isAuthenticated: false });
  },

  hydrate: () => {
    const userID = localStorage.getItem('user_id');
    const token = localStorage.getItem('access_token');
    const isAdmin = localStorage.getItem('is_admin') === '1';
    const username = localStorage.getItem('username');
    if (userID && token) set({ userID, username, isAdmin, isAuthenticated: true });
  },
}));
