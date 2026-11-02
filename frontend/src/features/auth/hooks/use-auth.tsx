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
    try {
      const profile = await authApi.getMe();
      setUser(profile);
      setActor({
        userId: profile.userId,
        activeRole: profile.activeRole,
        activeProfileId: profile.activeProfileId,
      });
    } catch {
      setUser(null);
      setActor(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Attempt to load existing user session or refresh token
    const token = authApi.getAccessToken();
    if (token) {
      refreshUser();
    } else {
      // Try refresh cookie
      authApi
        .refresh()
        .then(() => refreshUser())
        .catch(() => {
          setIsLoading(false);
        });
    }
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
