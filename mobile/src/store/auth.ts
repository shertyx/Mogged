import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  userID: string | null;
  isAuthenticated: boolean;
  setTokens: (access: string, refresh: string, userID: string) => Promise<void>;
  clearTokens: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  userID: null,
  isAuthenticated: false,

  setTokens: async (access, refresh, userID) => {
    await SecureStore.setItemAsync('access_token', access);
    await SecureStore.setItemAsync('refresh_token', refresh);
    await SecureStore.setItemAsync('user_id', userID);
    set({ userID, isAuthenticated: true });
  },

  clearTokens: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user_id');
    set({ userID: null, isAuthenticated: false });
  },

  hydrate: async () => {
    const userID = await SecureStore.getItemAsync('user_id');
    const token = await SecureStore.getItemAsync('access_token');
    if (userID && token) set({ userID, isAuthenticated: true });
  },
}));
