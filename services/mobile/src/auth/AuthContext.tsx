import React, { createContext, useCallback, useContext } from 'react';
import { apiClient } from '../api/client';
import { clearToken, getRefreshToken } from './token-storage';

interface AuthContextValue {
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({ logout: async () => {} });

export function AuthProvider({
  children,
  onLogout,
}: {
  children: React.ReactNode;
  onLogout: () => void;
}) {
  const logout = useCallback(async () => {
    // Send the refresh token so the server invalidates it (no cookie on native).
    const refreshToken = await getRefreshToken();
    await apiClient.post('/auth/logout', refreshToken ? { refreshToken } : undefined).catch(() => {});
    await clearToken();
    onLogout();
  }, [onLogout]);

  return <AuthContext.Provider value={{ logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
