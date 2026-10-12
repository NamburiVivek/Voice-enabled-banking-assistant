/**
 * AuthContext.jsx - Global authentication state management.
 * Provides: user, isAuthenticated, isLoading, login, register, logout helpers.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, tokenStore } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);  // true while restoring session

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(() => {
    const restore = async () => {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        setIsLoading(false);
        return;
      }
      try {
        // Silently refresh to get a new access token
        const { data } = await authApi.refresh({ refresh_token: refreshToken });
        tokenStore.set(data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);

        // Fetch the user profile
        const meRes = await authApi.me();
        setUser(meRes.data);
      } catch {
        // Token expired or invalid — clear everything
        tokenStore.clear();
        localStorage.removeItem('refresh_token');
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  // ── Listen for forced logout events (from axios interceptor) ─────────────
  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
      tokenStore.clear();
      localStorage.removeItem('refresh_token');
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login({ email, password });
    tokenStore.set(data.tokens.access_token);
    localStorage.setItem('refresh_token', data.tokens.refresh_token);
    setUser(data.user);
    return data.user;
  }, []);

  // ── Register ──────────────────────────────────────────────────────────────
  const register = useCallback(async (fullName, email, password, confirmPassword) => {
    const { data } = await authApi.register({
      full_name: fullName,
      email,
      password,
      confirm_password: confirmPassword,
    });
    tokenStore.set(data.tokens.access_token);
    localStorage.setItem('refresh_token', data.tokens.refresh_token);
    setUser(data.user);
    return data.user;
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if the API call fails, clear client-side state
    } finally {
      tokenStore.clear();
      localStorage.removeItem('refresh_token');
      setUser(null);
    }
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
