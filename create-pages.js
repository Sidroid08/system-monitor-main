#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

const moreFiles = {
  // Register page
  'src/app/(auth)/register/page.tsx': `'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, name);
      router.push('/dashboard/overview');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md p-8 bg-slate-800 rounded-lg shadow-xl border border-slate-700">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Create Account</h1>
        
        {error && (
          <div className="mb-4 p-4 bg-red-900 text-red-200 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

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

          <div className="mb-4">
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

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <p className="text-center text-slate-400 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
`,

  // Instances page
  'src/app/(dashboard)/instances/page.tsx': `'use client';

import { useAuth } from '@/context/AuthContext';
import InstancesList from '@/components/dashboard/InstancesList';
import { useState } from 'react';

export default function InstancesPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('ALL');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Monitored Instances</h1>
        <p className="text-slate-400 mt-2">
          Manage and monitor all instances in your organization
        </p>
      </div>

      <div className="flex gap-4">
        {['ALL', 'RUNNING', 'STOPPED', 'TERMINATED'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={\`px-4 py-2 rounded-lg font-medium transition \${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }\`}
          >
            {status}
          </button>
        ))}
      </div>

      <InstancesList organizationId={user?.organizationId} />
    </div>
  );
}
`,

  // Organizations page
  'src/app/(dashboard)/organizations/page.tsx': `'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Organization } from '@/types';

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await apiClient.get('/org');
      setOrganizations(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-white">Loading organizations...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Organizations</h1>
        <p className="text-slate-400 mt-2">
          Manage your monitored organizations and AWS accounts
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.map((org) => (
          <div
            key={org.id}
            className="p-6 bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-500 transition cursor-pointer"
          >
            <h3 className="text-xl font-bold text-white mb-2">{org.name}</h3>
            <p className="text-sm text-slate-400 mb-4">{org.slug}</p>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                View
              </button>
              <button className="px-3 py-1 bg-slate-700 text-slate-300 rounded text-sm hover:bg-slate-600">
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {organizations.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-lg">No organizations found</p>
          <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Create Organization
          </button>
        </div>
      )}
    </div>
  );
}
`,

  // Alerts page
  'src/app/(dashboard)/alerts/page.tsx': `'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api/client';
import { Alert } from '@/types';

export default function AlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'OPEN' | 'ALL'>('OPEN');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [user?.organizationId]);

  const fetchAlerts = async () => {
    try {
      if (!user?.organizationId) return;
      
      // This endpoint would need to be implemented in the backend
      const response = await apiClient.get(\`/alerts?orgId=\${user.organizationId}\`);
      setAlerts(response.data.data?.alerts || []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-900/20 text-red-300 border-red-600';
      case 'HIGH':
        return 'bg-orange-900/20 text-orange-300 border-orange-600';
      case 'MEDIUM':
        return 'bg-yellow-900/20 text-yellow-300 border-yellow-600';
      default:
        return 'bg-blue-900/20 text-blue-300 border-blue-600';
    }
  };

  if (loading) {
    return <div className="text-white">Loading alerts...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Alerts</h1>
        <p className="text-slate-400 mt-2">
          Monitor and manage system alerts
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        {(['OPEN', 'ALL'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={\`px-4 py-2 rounded-lg font-medium transition \${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }\`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {alerts.filter(a => filter === 'ALL' || a.status === 'OPEN').map((alert) => (
          <div
            key={alert.id}
            className={\`p-4 rounded-lg border \${severityColor(alert.severity)}\`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{alert.title}</h3>
                {alert.description && (
                  <p className="text-sm opacity-90 mt-1">{alert.description}</p>
                )}
                <div className="flex gap-4 mt-2 text-xs opacity-75">
                  {alert.metricName && <span>Metric: {alert.metricName}</span>}
                  <span>Source: {alert.source || 'System'}</span>
                  <span>Status: {alert.status}</span>
                </div>
              </div>
              <div className="ml-4 flex gap-2">
                <button className="px-3 py-1 bg-slate-700 text-slate-300 rounded text-sm hover:bg-slate-600">
                  Acknowledge
                </button>
                {alert.status === 'OPEN' && (
                  <button className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {alerts.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-lg">No alerts at this time</p>
          <p className="text-sm mt-2">Keep monitoring your systems for health</p>
        </div>
      )}
    </div>
  );
}
`,

  // Settings page
  'src/app/(dashboard)/settings/page.tsx': `'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState({
    theme: 'dark',
    refreshInterval: 30,
    emailAlerts: true,
    notifyOnCritical: true,
    metricsToDisplay: ['cpu', 'memory', 'disk', 'network'],
  });

  const [saveStatus, setSaveStatus] = useState('');

  const handleSave = async () => {
    setSaveStatus('Saving...');
    // Simulate save
    setTimeout(() => {
      setSaveStatus('Saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    }, 1000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-2">
          Manage your preferences and dashboard configuration
        </p>
      </div>

      <div className="space-y-6">
        {/* User Info Section */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4">User Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Name
              </label>
              <input
                type="text"
                value={user?.name || ''}
                disabled
                className="w-full px-4 py-2 bg-slate-700 text-slate-400 rounded border border-slate-600 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2 bg-slate-700 text-slate-400 rounded border border-slate-600 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Role
              </label>
              <input
                type="text"
                value={user?.role || ''}
                disabled
                className="w-full px-4 py-2 bg-slate-700 text-slate-400 rounded border border-slate-600 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Dashboard Preferences */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Dashboard Preferences</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Theme
              </label>
              <select
                value={preferences.theme}
                onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-blue-500"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Metrics Refresh Interval (seconds)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                step="10"
                value={preferences.refreshInterval}
                onChange={(e) => setPreferences({ ...preferences, refreshInterval: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Notifications</h2>
          <div className="space-y-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.emailAlerts}
                onChange={(e) => setPreferences({ ...preferences, emailAlerts: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="ml-3 text-slate-300">Email notifications</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.notifyOnCritical}
                onChange={(e) => setPreferences({ ...preferences, notifyOnCritical: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="ml-3 text-slate-300">Notify on critical alerts only</span>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Save Preferences
          </button>
          {saveStatus && (
            <span className="flex items-center text-green-400">{saveStatus}</span>
          )}
        </div>
      </div>
    </div>
  );
}
`,

  // Redis utility for client-side caching
  'src/lib/redis/cache.ts': `// Client-side Redis-like cache with TTL support
interface CacheEntry<T> {
  value: T;
  expiry?: number;
}

class RedisCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.cache.set(key, { value, expiry });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (entry.expiry && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiry && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  // Get all cache keys
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      keys: this.keys(),
    };
  }

  // Cleanup expired entries
  cleanup(): number {
    let cleaned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry && Date.now() > entry.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }
}

export const redisCache = new RedisCache();
`,

  // Metrics snapshot utility
  'src/lib/redis/snapshots.ts': `import { redisCache } from './cache';
import type { MetricsData } from '@/types';

interface Snapshot {
  instanceId: string;
  timestamp: number;
  data: MetricsData;
}

const SNAPSHOT_KEY_PREFIX = 'metrics_snapshot:';
const SNAPSHOT_TTL = 3600; // 1 hour

export function saveMetricsSnapshot(instanceId: string, data: MetricsData): void {
  const snapshot: Snapshot = {
    instanceId,
    timestamp: Date.now(),
    data,
  };
  
  const key = \`\${SNAPSHOT_KEY_PREFIX}\${instanceId}\`;
  redisCache.set(key, snapshot, SNAPSHOT_TTL);
}

export function getMetricsSnapshot(instanceId: string): Snapshot | null {
  const key = \`\${SNAPSHOT_KEY_PREFIX}\${instanceId}\`;
  return redisCache.get(key);
}

export function getAllSnapshots(): Snapshot[] {
  const snapshots: Snapshot[] = [];
  
  for (const key of redisCache.keys()) {
    if (key.startsWith(SNAPSHOT_KEY_PREFIX)) {
      const snapshot = redisCache.get<Snapshot>(key);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }
  }
  
  return snapshots;
}

export function clearSnapshots(): void {
  for (const key of redisCache.keys()) {
    if (key.startsWith(SNAPSHOT_KEY_PREFIX)) {
      redisCache.delete(key);
    }
  }
}
`,
};

Object.entries(moreFiles).forEach(([filePath, content]) => {
  const fullPath = path.join(projectRoot, filePath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, content);
  console.log(`✓ Created: ${filePath}`);
});

console.log('\\n✓ All additional page and utility files created successfully!');
