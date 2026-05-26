'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useInstanceMetrics } from '@/hooks/useMetrics';
import { MonitoredInstance } from '@/types';
import DashboardGrid from '@/components/dashboard/DashboardGrid';

export default function OverviewPage() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<MonitoredInstance[]>([]);
  const [selected, setSelected]   = useState<MonitoredInstance | null>(null);
  const [detectedLocal, setDetectedLocal] = useState<MonitoredInstance | null>(null);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds, from prefs

  // Read refresh interval from localStorage prefs
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sidroid-prefs');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.refreshInterval) setRefreshInterval(parsed.refreshInterval);
      }
    } catch {}
  }, []);

  // Load instances from our new /api/instances proxy (with Redis cache)
  useEffect(() => {
    if (!user?.organizationId) return;
    const token = localStorage.getItem('auth_token') || '';

    const load = async () => {
      try {
        const res = await fetch(`/api/instances?organizationId=${user.organizationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const list: MonitoredInstance[] = json.data?.instances || json.data || [];
        setInstances(list);

        // Try to detect which instance the user is browsing from
        try {
          const detectRes = await fetch('/api/detect-local', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const detected = await detectRes.json();
          if (detected?.detected && detected.instance) {
            setDetectedLocal(detected.instance);
            setSelected(detected.instance);
            return;
          }
        } catch {}

        // Default: select first
        if (list.length > 0) setSelected(list[0]);
      } catch (err) {
        console.warn('[Overview] Failed to load instances', err);
      } finally {
        setLoadingInstances(false);
      }
    };

    load();
  }, [user?.organizationId]);

  // Platform-aware metrics for selected instance (match backend sd-targets logic: privateIp preferred)
  const ip       = selected?.privateIp || selected?.publicIp;
  const platform = (selected?.platform || 'LINUX') as 'LINUX' | 'WINDOWS';
  const refreshMs = refreshInterval * 1000;
  const { cpu, memory, disk, networkIn } = useInstanceMetrics(ip, platform, !!ip, refreshMs);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Personalized banner */}
      {detectedLocal && (
        <div className="animate-slide-in" style={{
          padding: '14px 18px', borderRadius: 14,
          background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="status-dot status-dot-active" style={{ width: 9, height: 9 }} />
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--success)' }}>
                Personalized View Active
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                Detected access from <strong style={{ color: 'var(--text-primary)' }}>
                  {detectedLocal.instanceName || detectedLocal.instanceId}
                </strong> · Auto-selected local metrics
              </p>
            </div>
          </div>
          <button onClick={() => setDetectedLocal(null)} className="btn-ghost"
            style={{ fontSize: '0.75rem', padding: '5px 12px' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Header + instance selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {greeting()}, <span className="gradient-text">{user?.name?.split(' ')[0]}</span> 👋
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Organization: <strong style={{ color: 'var(--text-secondary)' }}>{user?.organizationId?.slice(0, 8)}…</strong>
            &nbsp;·&nbsp;
            {instances.length} instance{instances.length !== 1 ? 's' : ''} registered
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {instances.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Target
              </label>
              <select
                value={selected?.id || ''}
                onChange={e => {
                  const inst = instances.find(i => i.id === e.target.value);
                  if (inst) setSelected(inst);
                }}
                className="input-glass"
                style={{ fontSize: '0.82rem', minWidth: 200, padding: '7px 12px' }}
              >
                {instances.map(inst => (
                  <option key={inst.id} value={inst.id}>
                    {inst.instanceName || inst.instanceId} · {inst.publicIp || inst.privateIp || 'No IP'} ({inst.platform})
                  </option>
                ))}
              </select>
            </div>
          )}
          <a href="/instances" className="btn-ghost" style={{ fontSize: '0.78rem', padding: '7px 14px', textDecoration: 'none' }}>
            Manage →
          </a>
        </div>
      </div>

      {/* Metric summary cards */}
      {selected ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {[
            { label: 'CPU Usage',    value: cpu.current,       color: '#6c63ff', unit: '%',    icon: '⚡', result: cpu,       metric: 'cpu' },
            { label: 'Memory',       value: memory.current,    color: '#a855f7', unit: '%',    icon: '🧠', result: memory,    metric: 'memory' },
            { label: 'Disk',         value: disk.current,      color: '#f59e0b', unit: '%',    icon: '💾', result: disk,      metric: 'disk' },
            { label: 'Network In',   value: networkIn.current, color: '#06b6d4', unit: ' B/s', icon: '📡', result: networkIn, metric: 'net' },
          ].map(m => (
            <div
              key={m.label}
              className="glass-card"
              style={{
                padding: '18px 20px',
                background: `linear-gradient(135deg, ${m.color}18, var(--glass-bg))`,
                border: `1px solid ${m.color}30`,
                transition: 'all 0.3s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    {m.label}
                  </p>
                  {m.result.loading ? (
                    <div className="skeleton" style={{ height: 28, width: 80, marginBottom: 6 }} />
                  ) : (
                    <p style={{ fontSize: '1.7rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                      {m.value !== null ? `${typeof m.value === 'number' && m.value > 1000 ? (m.value / 1024).toFixed(1) + 'K' : m.value.toFixed(1)}${m.unit}` : '—'}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: '1.4rem' }}>{m.icon}</span>
              </div>
              {/* Mini sparkline */}
              {!m.result.loading && m.result.data.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 28, marginTop: 10 }}>
                  {m.result.data.slice(-18).map((pt, i) => {
                    const max = Math.max(...m.result.data.slice(-18).map(p => p.value));
                    const pct = max > 0 ? (pt.value / max) * 100 : 20;
                    return (
                      <div key={i} style={{
                        flex: 1, height: `${Math.max(10, pct)}%`,
                        borderRadius: 2, background: `${m.color}60`,
                        transition: 'height 0.3s',
                      }} />
                    );
                  })}
                </div>
              )}
              {m.result.fromCache && (
                <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 4 }}>⚡ cached</p>
              )}
            </div>
          ))}
        </div>
      ) : loadingInstances ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 14 }}>🖥️</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            No instances registered yet
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            Add your first cloud or local machine to start monitoring
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <a href="/aws-accounts" className="btn-primary" style={{ textDecoration: 'none', fontSize: '0.85rem' }}>
              🌩️ Connect AWS
            </a>
            <a href="/agent-setup" className="btn-ghost" style={{ textDecoration: 'none', fontSize: '0.85rem' }}>
              🔧 Setup Agent
            </a>
          </div>
        </div>
      )}

      {/* Full charts grid */}
      {selected && (
        <DashboardGrid
          organizationId={user?.organizationId}
          selectedInstanceId={selected.id}
          selectedInstanceIp={ip}
          platform={platform}
          refreshInterval={refreshMs}
        />
      )}
    </div>
  );
}
