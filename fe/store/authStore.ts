import { create } from 'zustand';
import { clearSocketAuth } from '@/lib/socket';
import { useChatStore } from './chatStore';
import { useUiStore } from './uiStore';

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  status?: 'online' | 'offline' | 'away';
  last_seen?: string;
}

export interface AuthStoreState {
  user: User | null;
  token: string | null;
  blockedUsers: string[]; // IDs of users WE blocked
  blockedByUsers: string[]; // IDs of users who blocked US
  hasHydrated: boolean;
  isLoading: boolean;
  error: string | null;

  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setBlockedUsers: (ids: string[]) => void;
  setBlockedByUsers: (ids: string[]) => void;
  addBlockedUser: (userId: string) => void;
  removeBlockedUser: (userId: string) => void;
  addBlockedByUser: (userId: string) => void;
  removeBlockedByUser: (userId: string) => void;
  hydrate: () => void;
  logout: () => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStoreState>((set) => {
  return {
    user: null,
    token: null,
    blockedUsers: [],
    blockedByUsers: [],
    hasHydrated: false,
    isLoading: false,
    error: null,

    setUser: (user) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(user));
      }
      set({ user });
    },
    setToken: (token) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }
      set({ token });
    },
    setBlockedUsers: (ids) => set({ blockedUsers: ids }),
    setBlockedByUsers: (ids) => set({ blockedByUsers: ids }),
    addBlockedUser: (userId) => set((state) => ({ blockedUsers: [...state.blockedUsers, userId] })),
    removeBlockedUser: (userId) => set((state) => ({ blockedUsers: state.blockedUsers.filter(id => id !== userId) })),
    addBlockedByUser: (userId) => set((state) => ({ blockedByUsers: [...state.blockedByUsers, userId] })),
    removeBlockedByUser: (userId) => set((state) => ({ blockedByUsers: state.blockedByUsers.filter(id => id !== userId) })),
    hydrate: () => {
      if (typeof window === 'undefined') return;

      const token = localStorage.getItem('token');
      const userRaw = localStorage.getItem('user');
      let user: User | null = null;

      if (userRaw) {
        try {
          user = JSON.parse(userRaw);
        } catch {
          user = null;
        }
      }

      set({ token, user, hasHydrated: true });
    },
    logout: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      clearSocketAuth();
      useChatStore.getState().reset();
      useUiStore.getState().reset();
      set({ user: null, token: null });
    },
    setError: (error) => set({ error }),
    setIsLoading: (loading) => set({ isLoading: loading }),
  };
});

