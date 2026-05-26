'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]   = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage
    const stored = localStorage.getItem('auth_token');
    if (stored) {
      setToken(stored);
      fetchUser(stored);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async (token: string) => {
    try {
      const response = await apiClient.get('/auth/me');
      const userData = response.data.data;
      setUser(userData);
      localStorage.setItem('auth_token', token);
      document.cookie = `sidroid_user_email=${encodeURIComponent(userData.email)}; path=/; max-age=86400`;
    } catch (error) {
      localStorage.removeItem('auth_token');
      document.cookie = `sidroid_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { token: t, user: userData } = response.data.data;
      localStorage.setItem('auth_token', t);
      document.cookie = `sidroid_user_email=${encodeURIComponent(userData.email)}; path=/; max-age=86400`;
      setToken(t);
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/register', { email, password, name });
      const { token: t, user: userData } = response.data.data;
      localStorage.setItem('auth_token', t);
      document.cookie = `sidroid_user_email=${encodeURIComponent(userData.email)}; path=/; max-age=86400`;
      setToken(t);
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    document.cookie = `sidroid_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, isLoading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
