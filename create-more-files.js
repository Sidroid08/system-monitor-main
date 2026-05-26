#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

const additionalFiles = {
  // Sidebar component
  'src/components/dashboard/Sidebar.tsx': `'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const navItems = [
  { href: '/dashboard/overview', label: 'Overview', icon: '📊' },
  { href: '/dashboard/instances', label: 'Instances', icon: '🖥️' },
  { href: '/dashboard/organizations', label: 'Organizations', icon: '🏢' },
  { href: '/dashboard/alerts', label: 'Alerts', icon: '🚨' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700 overflow-y-auto">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-white">Sidroid</h2>
        <p className="text-xs text-slate-400 mt-1">Monitoring Dashboard</p>
      </div>

      <nav className="px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center px-4 py-2 rounded-lg transition',
              pathname.startsWith(item.href)
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-700'
            )}
          >
            <span className="mr-3">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
`,

  // TopNav component
  'src/components/common/TopNav.tsx': `'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function TopNav() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Organization Dashboard</h1>
          <p className="text-xs text-slate-400">Real-time monitoring and alerts</p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm font-medium text-white">{user?.name}</p>
            <p className="text-xs text-slate-400">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
`,

  // DashboardGrid component
  'src/components/dashboard/DashboardGrid.tsx': `'use client';

import { useEffect, useState } from 'react';
import MetricCard from './MetricCard';
import { apiClient } from '@/lib/api/client';

interface DashboardGridProps {
  organizationId?: string;
}

export default function DashboardGrid({ organizationId }: DashboardGridProps) {
  const [metrics, setMetrics] = useState({
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    networkIn: 0,
    networkOut: 0,
    activeInstances: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [organizationId]);

  const fetchMetrics = async () => {
    try {
      if (!organizationId) return;
      
      const response = await apiClient.get(\`/instances?orgId=\${organizationId}\`);
      // Process instances to calculate aggregate metrics
      // This is a placeholder - real implementation would query VictoriaMetrics
      
      setMetrics({
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        diskUsage: Math.random() * 100,
        networkIn: Math.random() * 1000,
        networkOut: Math.random() * 1000,
        activeInstances: response.data.data.instances.length || 0,
      });
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-white">Loading metrics...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <MetricCard
        title="CPU Usage"
        value={metrics.cpuUsage.toFixed(1)}
        unit="%"
        threshold={80}
        icon="📈"
      />
      <MetricCard
        title="Memory Usage"
        value={metrics.memoryUsage.toFixed(1)}
        unit="%"
        threshold={85}
        icon="💾"
      />
      <MetricCard
        title="Disk Usage"
        value={metrics.diskUsage.toFixed(1)}
        unit="%"
        threshold={90}
        icon="💿"
      />
      <MetricCard
        title="Network In"
        value={metrics.networkIn.toFixed(2)}
        unit="MB/s"
        icon="📥"
      />
      <MetricCard
        title="Network Out"
        value={metrics.networkOut.toFixed(2)}
        unit="MB/s"
        icon="📤"
      />
      <MetricCard
        title="Active Instances"
        value={metrics.activeInstances}
        unit="running"
        icon="🖥️"
      />
    </div>
  );
}
`,

  // MetricCard component
  'src/components/dashboard/MetricCard.tsx': `'use client';

import clsx from 'clsx';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  threshold?: number;
  icon?: string;
}

export default function MetricCard({
  title,
  value,
  unit,
  threshold,
  icon,
}: MetricCardProps) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  const isWarning = threshold && numValue > threshold;

  return (
    <div
      className={clsx(
        'p-6 rounded-lg border transition duration-300',
        'bg-slate-800 border-slate-700',
        isWarning ? 'border-red-500 bg-red-900/20' : ''
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-300">{title}</h3>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>

      <div className="flex items-end space-x-2">
        <div className="text-3xl font-bold text-white">{value}</div>
        {unit && <div className="text-sm text-slate-400 mb-1">{unit}</div>}
      </div>

      {isWarning && (
        <p className="text-xs text-red-400 mt-2">
          ⚠️ Above threshold ({threshold}{unit})
        </p>
      )}
    </div>
  );
}
`,

  // InstancesList component
  'src/components/dashboard/InstancesList.tsx': `'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { MonitoredInstance } from '@/types';

interface InstancesListProps {
  organizationId?: string;
}

export default function InstancesList({ organizationId }: InstancesListProps) {
  const [instances, setInstances] = useState<MonitoredInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInstances();
  }, [organizationId]);

  const fetchInstances = async () => {
    try {
      if (!organizationId) return;
      
      const response = await apiClient.get(\`/instances?orgId=\${organizationId}\`);
      setInstances(response.data.data.instances);
    } catch (error) {
      console.error('Failed to fetch instances:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-white">Loading instances...</div>;
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700">
        <h2 className="text-xl font-bold text-white">Monitored Instances</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Public IP</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Region</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {instances.map((instance) => (
              <tr key={instance.id} className="hover:bg-slate-700/30 transition">
                <td className="px-6 py-4 text-sm text-white">{instance.instanceName || instance.instanceId}</td>
                <td className="px-6 py-4 text-sm text-slate-300">{instance.publicIp || 'N/A'}</td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={\`inline-block px-2 py-1 rounded text-xs font-medium \${
                      instance.status === 'RUNNING'
                        ? 'bg-green-900/30 text-green-300'
                        : 'bg-yellow-900/30 text-yellow-300'
                    }\`}
                  >
                    {instance.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-300">{instance.serviceType}</td>
                <td className="px-6 py-4 text-sm text-slate-300">{instance.region || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {instances.length === 0 && (
        <div className="px-6 py-8 text-center text-slate-400">
          No instances found. Add instances to start monitoring.
        </div>
      )}
    </div>
  );
}
`,

  // Hook: useMetrics
  'src/hooks/useMetrics.ts': `import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Metric } from '@/types';

interface UseMetricsOptions {
  instanceId?: string;
  refreshInterval?: number;
}

export const useMetrics = ({
  instanceId,
  refreshInterval = 30000,
}: UseMetricsOptions = {}) => {
  const [data, setData] = useState<Record<string, Metric[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!instanceId) return;

    const fetchMetrics = async () => {
      try {
        setLoading(true);
        // This would query VictoriaMetrics API
        // Placeholder implementation
        setData({
          cpu: [],
          memory: [],
          disk: [],
          network: [],
          load: [],
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [instanceId, refreshInterval]);

  return { data, loading, error };
};
`,

  // Utility: classNames helper
  'src/utils/classNames.ts': `export const classNames = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};
`,

  // .env.local setup
  'src/lib/api/victoria-metrics.ts': `// Victoria Metrics client for querying metrics
const VICTORIA_METRICS_URL = process.env.NEXT_PUBLIC_VICTORIA_METRICS_URL || 'http://localhost:8428';

interface QueryOptions {
  query: string;
  start: number;
  end: number;
  step?: string;
}

export async function queryMetrics(options: QueryOptions) {
  const params = new URLSearchParams({
    query: options.query,
    start: options.start.toString(),
    end: options.end.toString(),
    step: options.step || '60s',
  });

  try {
    const response = await fetch(\`\${VICTORIA_METRICS_URL}/api/v1/query_range?\${params}\`);
    if (!response.ok) {
      throw new Error(\`VictoriaMetrics error: \${response.statusText}\`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to query metrics:', error);
    throw error;
  }
}

export function buildMetricQuery(
  metricName: string,
  labels: Record<string, string>
): string {
  const labelPairs = Object.entries(labels)
    .map(([key, value]) => \`\${key}="\${value}"\`)
    .join(',');
  return \`\${metricName}{\${labelPairs}}\`;
}
`,
};

// Create all additional files
Object.entries(additionalFiles).forEach(([filePath, content]) => {
  const fullPath = path.join(projectRoot, filePath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, content);
  console.log(`✓ Created: ${filePath}`);
});

console.log('\\n✓ All additional files created successfully!');
