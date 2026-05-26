#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

const files = {
  // Global styles
  'src/styles/globals.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  color: #e2e8f0;
  overflow-x: hidden;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.5);
}

::-webkit-scrollbar-thumb {
  background: #64748b;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Animations */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-in {
  animation: slideIn 0.3s ease-out;
}
`,

  // Auth context
  'src/context/AuthContext.tsx': `'use client';

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
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetchUser(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async (token: string) => {
    try {
      const response = await apiClient.get('/auth/me');
      setUser(response.data.data);
      localStorage.setItem('auth_token', token);
    } catch (error) {
      localStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { token, user: userData } = response.data.data;
      localStorage.setItem('auth_token', token);
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/register', { email, password, name });
      const { token, user: userData } = response.data.data;
      localStorage.setItem('auth_token', token);
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, register }}>
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
`,

  // Redis context
  'src/context/RedisContext.tsx': `'use client';

import React, { createContext, useContext } from 'react';

interface RedisContextType {
  cache: Map<string, any>;
  set: (key: string, value: any, ttl?: number) => void;
  get: (key: string) => any;
  remove: (key: string) => void;
  clear: () => void;
}

const RedisContext = createContext<RedisContextType | undefined>(undefined);

export const RedisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Client-side Redis-like cache
  const cache = new Map<string, { value: any; expiry?: number }>();

  const set = (key: string, value: any, ttl?: number) => {
    const expiry = ttl ? Date.now() + ttl * 1000 : undefined;
    cache.set(key, { value, expiry });
  };

  const get = (key: string) => {
    const item = cache.get(key);
    if (!item) return null;
    if (item.expiry && Date.now() > item.expiry) {
      cache.delete(key);
      return null;
    }
    return item.value;
  };

  const remove = (key: string) => {
    cache.delete(key);
  };

  const clear = () => {
    cache.clear();
  };

  return (
    <RedisContext.Provider value={{ cache, set, get, remove, clear }}>
      {children}
    </RedisContext.Provider>
  );
};

export const useRedisCache = () => {
  const context = useContext(RedisContext);
  if (!context) {
    throw new Error('useRedisCache must be used within RedisProvider');
  }
  return context;
};
`,

  // API client
  'src/lib/api/client.ts': `import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  return config;
});

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
`,

  // Types
  'src/types/index.ts': `export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonitoredInstance {
  id: string;
  organizationId: string;
  awsAccountId?: string;
  instanceId: string;
  instanceName?: string;
  hostname?: string;
  privateIp?: string;
  publicIp?: string;
  platform: 'LINUX' | 'WINDOWS';
  serviceType: 'EC2' | 'VM' | 'BARE_METAL' | 'CONTAINER';
  region?: string;
  status: 'RUNNING' | 'STOPPED' | 'TERMINATED' | 'UNKNOWN';
  orgLabel?: string;
  serviceLabel?: string;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Metric {
  timestamp: number;
  value: number;
  unit?: string;
}

export interface MetricsData {
  cpu: Metric[];
  memory: Metric[];
  disk: Metric[];
  network: Metric[];
  load: Metric[];
}

export interface Alert {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source?: string;
  metricName?: string;
  instanceId?: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  triggeredAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardPreferences {
  organizationId: string;
  selectedInstances: string[];
  metrics: string[];
  refreshInterval: number;
  theme: 'light' | 'dark';
}
`,

  // Home page
  'src/app/page.tsx': `import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
`,

  // Login page
  'src/app/(auth)/login/page.tsx': `'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md p-8 bg-slate-800 rounded-lg shadow-xl border border-slate-700">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Sidroid Dashboard</h1>
        
        {error && (
          <div className="mb-4 p-4 bg-red-900 text-red-200 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="text-center text-slate-400 mt-6">
          Don't have an account?{' '}
          <Link href="/register" className="text-blue-400 hover:text-blue-300">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
`,

  // Dashboard page
  'src/app/(dashboard)/layout.tsx': `'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import TopNav from '@/components/common/TopNav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-slate-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
`,

  // Dashboard overview page
  'src/app/(dashboard)/overview/page.tsx': `'use client';

import { useAuth } from '@/context/AuthContext';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import InstancesList from '@/components/dashboard/InstancesList';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-2">
          Welcome back, {user?.name}! Here's your organization's monitoring overview.
        </p>
      </div>

      <DashboardGrid organizationId={user?.organizationId} />
      <InstancesList organizationId={user?.organizationId} />
    </div>
  );
}
`,
};

// Create all files
Object.entries(files).forEach(([filePath, content]) => {
  const fullPath = path.join(projectRoot, filePath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, content);
  console.log(`✓ Created: ${filePath}`);
});

console.log('\\n✓ All files created successfully!');
