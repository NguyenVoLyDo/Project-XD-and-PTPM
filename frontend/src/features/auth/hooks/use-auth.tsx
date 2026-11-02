'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserProfile, CurrentActor, RoleType } from '../types';
import { authApi } from '../api/auth.api';
import { LoginFormData, RegisterFormData } from '../schemas/auth.schema';

interface AuthContextType {
  user: UserProfile | null;
  actor: CurrentActor | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginFormData) => Promise<void>;
  register: (data: RegisterFormData) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: RoleType, profileId?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [actor, setActor] = useState<CurrentActor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const generation = authApi.getSessionGeneration();
    try {
      const profile = await authApi.getMe();
      if (generation !== authApi.getSessionGeneration()) return;
      setUser(profile);
      setActor({
        userId: profile.userId,
        activeRole: profile.activeRole,
        activeProfileId: profile.activeProfileId,
      });
    } catch (error) {
      if (generation !== authApi.getSessionGeneration()) return;
      if ((error as {status?: number})?.status === 401 || (error as {status?: number})?.status === 403) {
        authApi.setAccessToken(null);
        setUser(null);
        setActor(null);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Attempt to load existing user session or refresh token
    const token = authApi.getAccessToken();
    const hasPriorSession = typeof window !== 'undefined' && localStorage.getItem('dc_has_session') === 'true';
    if (token) {
      refreshUser().catch(() => setIsLoading(false));
    } else if (hasPriorSession) {
      // Try refresh cookie only if user previously logged in
      authApi
        .refresh()
        .then(() => refreshUser())
        .catch(() => {
          localStorage.removeItem('dc_has_session');
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [refreshUser]);


  useEffect(() => {
    const expired = () => { setUser(null); setActor(null); setIsLoading(false); };
    const storageChanged = (event: StorageEvent) => {
      if (event.key !== 'dc_access_token' && event.key !== 'dc_session_generation') return;
      expired();
      if (authApi.getAccessToken()) void refreshUser().catch(() => {});
    };
    window.addEventListener('dc-session-expired', expired);
    window.addEventListener('storage', storageChanged);
    return () => { window.removeEventListener('dc-session-expired', expired); window.removeEventListener('storage', storageChanged); };
  }, [refreshUser]);

  const login = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(data);
      setActor({
        userId: res.userId,
        activeRole: res.activeRole,
        activeProfileId: res.activeProfileId,
      });
      localStorage.setItem('dc_has_session', 'true');
      await refreshUser();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      await authApi.register(data);
      // Automatically log in after registration
      await login({ email: data.email, password: data.password });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
      localStorage.removeItem('dc_has_session');
      setUser(null);
      setActor(null);
    } finally {
      setIsLoading(false);
    }
  };

  const switchRole = async (role: RoleType, profileId?: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.switchActiveRole(role, profileId);
      setActor(res.currentActor);
      await refreshUser();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        actor,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        switchRole,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
