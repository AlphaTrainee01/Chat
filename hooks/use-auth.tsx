'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api-client';
import type { SessionUser } from '@/lib/types';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, display_name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: SessionUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.auth.me();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Heartbeat to keep online status fresh while signed in.
  useEffect(() => {
    if (!user) return;
    api.presence.heartbeat().catch(() => {});
    const interval = setInterval(() => api.presence.heartbeat().catch(() => {}), 60000);
    const onUnload = () => {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/presence', '');
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [user]);

  const login = useCallback(async (username: string, password: string) => {
    const { user } = await api.auth.login({ username, password });
    setUser(user);
  }, []);

  const register = useCallback(async (username: string, password: string, display_name?: string) => {
    const { user } = await api.auth.register({ username, password, display_name });
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
