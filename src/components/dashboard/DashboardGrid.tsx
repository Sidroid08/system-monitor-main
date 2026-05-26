'use client';

import { useState, useEffect } from 'react';
import TimeSeriesChart from './TimeSeriesChart';
import { useInstanceMetrics } from '@/hooks/useMetrics';
import { getThresholds } from '@/hooks/useAlertChecker';

interface DashboardGridProps {
  organizationId?: string;
  selectedInstanceId?: string;
  selectedInstanceIp?: string;
  platform?: 'LINUX' | 'WINDOWS';
  refreshInterval?: number; // ms, default 30000
}



function getTrend(data: { value: number }[]) {
  if (data.length < 5) return { dir: 'stable' as const, label: '—' };
  const latest = data.at(-1)!.value;
  const prev   = data.at(-5)!.value;
  const diff   = latest - prev;
  const pct    = prev !== 0 ? ((diff / prev) * 100).toFixed(1) : '0';
  if (diff > 0.5)  return { dir: 'up' as const,   label: `+${pct}%` };
  if (diff < -0.5) return { dir: 'down' as const,  label: `${pct}%` };
  return { dir: 'stable' as const, label: '0%' };
}

export default function DashboardGrid({
  selectedInstanceId,
  selectedInstanceIp,
  platform = 'LINUX',
  refreshInterval = 30000,
}: DashboardGridProps) {
  const { cpu, memory, disk, networkIn } = useInstanceMetrics(
    selectedInstanceIp,
    platform,
    !!selectedInstanceIp,
    refreshInterval
  );

  const cpuVal    = cpu.current;
  const memVal    = memory.current;
  const diskVal   = disk.current;
  const netInVal  = networkIn.current;

  const [thresholds, setThresholdsState] = useState({ cpu: 80, memory: 85, disk: 90 });

  useEffect(() => {
    const loadThresholds = () => {
      if (selectedInstanceId) {
        setThresholdsState(getThresholds(selectedInstanceId));
      }
    };
    loadThresholds();
    window.addEventListener('storage', loadThresholds);
    return () => window.removeEventListener('storage', loadThresholds);
  }, [selectedInstanceId]);

  const cpuTrend  = getTrend(cpu.data);
  const memTrend  = getTrend(memory.data);

  // Skeleton state
  if (cpu.loading && memory.loading) {
    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card" style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 12, width: '50%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 28, width: '70%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 28 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[...Array(2)].map((_, i) => (
            <div key={i} className="glass-card" style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 12, width: '40%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 160 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: 'CPU Usage',      value: cpuVal,   unit: '%',    icon: '⚡', color: '#6c63ff',
      trend: cpuTrend, data: cpu.data,     loading: cpu.loading,
      fromCache: cpu.fromCache, threshold: thresholds.cpu,
    },
    {
      title: 'Memory',         value: memVal,   unit: '%',    icon: '🧠', color: '#a855f7',
      trend: memTrend, data: memory.data,  loading: memory.loading,
      fromCache: memory.fromCache, threshold: thresholds.memory,
    },
    {
      title: 'Disk Usage',     value: diskVal,  unit: '%',    icon: '💾', color: '#f59e0b',
      trend: null, data: disk.data,    loading: disk.loading,
      fromCache: disk.fromCache, threshold: thresholds.disk,
    },
    {
      title: 'Network In',     value: netInVal !== null ? netInVal / 1024 : null, unit: ' KB/s', icon: '📡', color: '#06b6d4',
      trend: null, data: networkIn.data, loading: networkIn.loading,
      fromCache: networkIn.fromCache, threshold: null,
    },
  ];

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Connection banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)' }}>
        <span className="status-dot status-dot-active" />
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Monitoring <code style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
            {selectedInstanceIp}:{platform === 'WINDOWS' ? '9200' : '9100'}
          </code>
          &nbsp;·&nbsp;
          {platform === 'LINUX' ? 'node_exporter' : 'windows_exporter'}
          &nbsp;·&nbsp;
          <span style={{ color: 'var(--text-muted)' }}>{Math.round(refreshInterval / 1000)}s refresh</span>
        </span>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
        {cards.map(c => {
          const isOver = c.threshold && c.value !== null && c.value > c.threshold;
          const accentColor = isOver ? '#ff4e6a' : c.color;
          return (
            <div
              key={c.title}
              className="glass-card"
              style={{
                padding: '18px 20px',
                background: `linear-gradient(135deg, ${accentColor}15, var(--glass-bg))`,
                border: `1px solid ${accentColor}25`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <p style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {c.title}
                </p>
                <span style={{ fontSize: '1.1rem' }}>{c.icon}</span>
              </div>

              {c.loading ? (
                <div className="skeleton" style={{ height: 32, width: '70%' }} />
              ) : (
                <p style={{ fontSize: '1.8rem', fontWeight: 700, color: isOver ? '#ff4e6a' : 'var(--text-primary)', lineHeight: 1 }}>
                  {c.value !== null ? `${c.value.toFixed(1)}${c.unit}` : '—'}
                </p>
              )}

              {c.trend && (
                <p style={{
                  marginTop: 5, fontSize: '0.7rem', fontWeight: 600,
                  color: c.trend.dir === 'up' ? '#ff9a3c' : c.trend.dir === 'down' ? '#2ecc71' : 'var(--text-muted)',
                }}>
                  {c.trend.dir === 'up' ? '↑' : c.trend.dir === 'down' ? '↓' : '→'} {c.trend.label}
                </p>
              )}

              {/* Mini sparkline */}
              {c.data.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24, marginTop: 10 }}>
                  {c.data.slice(-16).map((pt, i) => {
                    const max = Math.max(...c.data.slice(-16).map(p => p.value));
                    const pct = max > 0 ? (pt.value / max) * 100 : 20;
                    return <div key={i} style={{ flex: 1, height: `${Math.max(8, pct)}%`, borderRadius: 2, background: `${accentColor}55`, transition: 'height 0.3s' }} />;
                  })}
                </div>
              )}

              {isOver && (
                <div style={{ marginTop: 8, fontSize: '0.65rem', color: '#ff4e6a', fontWeight: 600 }}>
                  ⚠ Threshold exceeded ({c.threshold}%)
                </div>
              )}
              {c.fromCache && (
                <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 3 }}>⚡ from cache</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Time Series Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14 }}>
        <TimeSeriesChart title="CPU Usage %" data={cpu.data} color="#6c63ff" unit="%" gradientId="cpu-grad" />
        <TimeSeriesChart title="Memory Usage %" data={memory.data} color="#a855f7" unit="%" gradientId="mem-grad" />
        <TimeSeriesChart title="Disk Usage %" data={disk.data} color="#f59e0b" unit="%" gradientId="disk-grad" />
        <TimeSeriesChart title="Network In (bytes/s)" data={networkIn.data} color="#06b6d4" unit=" B/s" gradientId="netin-grad" />
      </div>
    </div>
  );
}
