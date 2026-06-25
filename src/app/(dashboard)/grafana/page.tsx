'use client';

import { useAuth } from '@/context/AuthContext';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MonitoredInstance } from '@/types';

/** Derive the short Grafana UID from a full UUID */
function shortUid(id: string) {
  return `inst-${id.replace(/-/g, '').substring(0, 12)}`;
}

function GrafanaEmbed() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlInstanceId = searchParams.get('instanceId');

  const [isKiosk, setIsKiosk] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [instances, setInstances] = useState<MonitoredInstance[]>([]);
  const [selected, setSelected] = useState<MonitoredInstance | null>(null);
  const [loadingInstances, setLoadingInstances] = useState(true);

  // Use the secure Next.js API proxy
  const grafanaUrl = '/api/grafana';
  const userEmail = user?.email || 'admin@sidroid.com';
  const kioskParam = isKiosk ? '&kiosk=tv' : '';

  // ── Load all instances so we can populate the instance switcher ───────────
  useEffect(() => {
    if (!user?.organizationId) return;
    const token = localStorage.getItem('auth_token') || '';

    fetch(`/api/instances?organizationId=${user.organizationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(json => {
        const list: MonitoredInstance[] = json.data?.instances || json.data || [];
        setInstances(list);

        // Priority 1 — URL param (e.g. clicked "Dashboard" from instances table)
        if (urlInstanceId) {
          const match = list.find(i => i.id === urlInstanceId);
          if (match) { setSelected(match); return; }
        }

        // Priority 2 — last selected instance persisted from Overview page
        try {
          const stored = localStorage.getItem('sidroid-selected-instance');
          if (stored) {
            const parsed = JSON.parse(stored) as MonitoredInstance;
            const match = list.find(i => i.id === parsed.id);
            if (match) { setSelected(match); return; }
          }
        } catch {}

        // Priority 3 — first instance
        if (list.length > 0) setSelected(list[0]);
      })
      .catch(() => {})
      .finally(() => setLoadingInstances(false));
  }, [user?.organizationId, urlInstanceId]);

  // ── Build embed URL ────────────────────────────────────────────────────────
  let embedUrl = '';
  if (selected) {
    embedUrl = `${grafanaUrl}/d/${shortUid(selected.id)}?orgId=1${kioskParam}&refresh=30s&sidroidUser=${encodeURIComponent(userEmail)}`;
  } else if (!loadingInstances) {
    // No instances at all — fall back to multi-org global dashboard
    const orgName = user?.organizationId ?? '.*';
    embedUrl = `${grafanaUrl}/d/multi-org-aws-monitoring/multi-organization-aws-node-monitoring?orgId=1${kioskParam}&var-organization=${orgName}&refresh=30s&sidroidUser=${encodeURIComponent(userEmail)}`;
  }

  // ── Handle instance switcher change ───────────────────────────────────────
  function handleInstanceChange(id: string) {
    const inst = instances.find(i => i.id === id);
    if (!inst) return;
    setSelected(inst);
    setRefreshKey(k => k + 1);
    // Persist so Overview page stays in sync too
    localStorage.setItem('sidroid-selected-instance', JSON.stringify(inst));
    // Update URL without full navigation
    router.replace(`/grafana?instanceId=${id}`, { scroll: false });
  }

  const isWindows = (selected?.platform || '').toUpperCase() === 'WINDOWS';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 'calc(100vh - 100px)' }} className="page-enter">

      {/* ── Header ── */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>📈</span>
            Grafana Dashboard
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Viewing real-time Prometheus telemetry provisioned via VictoriaMetrics
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

          {/* ── Instance Switcher ── */}
          {instances.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '6px 12px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                Target
              </span>
              {/* Platform badge */}
              <span style={{
                fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                background: isWindows ? 'rgba(87,148,242,0.15)' : 'rgba(115,191,105,0.15)',
                color: isWindows ? '#5794F2' : '#73BF69',
                border: `1px solid ${isWindows ? 'rgba(87,148,242,0.3)' : 'rgba(115,191,105,0.3)'}`,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {isWindows ? 'WIN' : 'LINUX'}
              </span>
              <select
                id="grafana-instance-select"
                value={selected?.id || ''}
                onChange={e => handleInstanceChange(e.target.value)}
                className="input-glass"
                style={{ fontSize: '0.82rem', padding: '4px 10px', minWidth: 190, border: 'none', background: 'transparent' }}
              >
                {instances.map(inst => (
                  <option key={inst.id} value={inst.id} style={{ background: '#0f172a', color: '#f1f5f9' }}>
                    {inst.instanceName || inst.instanceId} · {inst.publicIp || inst.privateIp || 'No IP'} ({inst.platform})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Kiosk toggle */}
          <button
            onClick={() => { setIsKiosk(!isKiosk); setRefreshKey(k => k + 1); }}
            className={`btn-ghost text-xs !py-2 !px-3 ${isKiosk ? 'border-blue-500/30 text-blue-400' : ''}`}
            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
          >
            {isKiosk ? '🖥 Kiosk Mode' : '📊 Full UI'}
          </button>

          {/* Refresh */}
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="btn-ghost"
            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
          >
            🔄 Reload
          </button>

          {/* Open in Grafana (full tab) */}
          {embedUrl && (
            <a
              href={embedUrl.replace('&kiosk=tv', '')}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ fontSize: '0.75rem', padding: '6px 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              Open in Grafana <span style={{ fontSize: '0.65rem' }}>↗</span>
            </a>
          )}
        </div>
      </div>

      {/* ── Instance info pill ── */}
      {selected && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10,
          fontSize: '0.78rem', color: 'var(--text-secondary)',
        }}>
          <span className="status-dot status-dot-active" style={{ width: 8, height: 8, flexShrink: 0 }} />
          <span>Monitoring <strong style={{ color: 'var(--text-primary)' }}>{selected.instanceName || selected.instanceId}</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            {selected.privateIp || selected.publicIp}:{selected.exporterPort ?? (isWindows ? 9200 : 9100)}
          </code>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace' }}>
            UID: {shortUid(selected.id)}
          </span>
        </div>
      )}

      {/* ── Iframe ── */}
      <div className="glass-card" style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 500, borderRadius: 16 }}>
        {loadingInstances && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,14,26,0.8)', borderRadius: 16, zIndex: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div className="skeleton" style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading dashboard…</p>
            </div>
          </div>
        )}
        {embedUrl && (
          <iframe
            key={`${refreshKey}-${selected?.id}`}
            src={embedUrl}
            style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', inset: 0, borderRadius: 16 }}
            allow="fullscreen"
            title={`Grafana — ${selected?.instanceName || 'Dashboard'}`}
          />
        )}
        {!embedUrl && !loadingInstances && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: '2rem' }}>📭</span>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No instances found. Register one first.</p>
            <a href="/instances" className="btn-primary" style={{ fontSize: '0.78rem', textDecoration: 'none', padding: '8px 18px' }}>
              Go to Instances →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GrafanaDashboardPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', height: 'calc(100vh - 120px)', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading Dashboard…</div>}>
      <GrafanaEmbed />
    </Suspense>
  );
}
