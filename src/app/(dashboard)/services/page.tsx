'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MonitoredInstance } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WindowsService {
  name: string;
  displayName: string;
  state: string;
  stateCode: number;
  startType: string;
  startTypeCode: number;
  runAs: string;
  processId: number | null;
  cpuPercent: number | null;
  memoryBytes: number | null;
  memoryMB: number | null;
  path: string;
  type?: string;
  uptimeSeconds?: number | null;
}

interface ServicesSummary {
  total: number;
  running: number;
  stopped: number;
  other: number;
  topCpu: WindowsService[];
  topMem: WindowsService[];
}

interface ServicesData {
  services: WindowsService[];
  summary: ServicesSummary;
  instance: string;
  fetchedAt: string;
  isMock?: boolean;
}

// ─── Sort indicator component ────────────────────────────────────────────────
function SortIndicator({
  col, sortBy, sortDir,
}: {
  col: 'name' | 'cpu' | 'memory' | 'state';
  sortBy: 'name' | 'cpu' | 'memory' | 'state';
  sortDir: 'asc' | 'desc';
}) {
  if (sortBy !== col) return <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>↕</span>;
  return <span style={{ color: 'var(--accent)', fontSize: '0.65rem' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

function stateColor(code: number) {
  if (code === 4) return { bg: 'rgba(46,204,113,0.12)', border: 'rgba(46,204,113,0.30)', text: 'var(--success)', dot: 'status-dot-active' };
  if (code === 1) return { bg: 'rgba(90,90,122,0.12)',  border: 'rgba(90,90,122,0.25)',  text: 'var(--text-muted)', dot: 'status-dot-offline' };
  return { bg: 'rgba(243,156,18,0.12)', border: 'rgba(243,156,18,0.30)', text: 'var(--warning)', dot: 'status-dot-warning' };
}

function startTypeColor(type: string) {
  if (type === 'Automatic') return 'badge-accent';
  if (type === 'Disabled')  return 'badge-danger';
  if (type === 'Manual')    return 'badge-warning';
  return 'badge-muted';
}

// ─── Mini horizontal bar ─────────────────────────────────────────────────────
function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, pct)}%`,
            background: color,
            borderRadius: 99,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, color, glow,
}: {
  icon: string; label: string; value: string | number; sub?: string; color: string; glow: string;
}) {
  return (
    <div
      className="glass-card"
      style={{
        padding: '18px 20px',
        background: `linear-gradient(135deg, ${color}18, var(--glass-bg))`,
        border: `1px solid ${color}30`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            {label}
          </p>
          <p style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {value}
          </p>
          {sub && (
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>{sub}</p>
          )}
        </div>
        <div
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: `${color}20`, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem', boxShadow: `0 4px 14px ${glow}`,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Top Resource Table ───────────────────────────────────────────────────────
function TopResourceList({
  title, icon, color, items, accessor, unit, maxVal,
}: {
  title: string; icon: string; color: string;
  items: WindowsService[];
  accessor: (s: WindowsService) => number | null;
  unit: string;
  maxVal: number;
}) {
  if (!items.length) return null;
  return (
    <div className="glass-card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
        <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((s, i) => {
          const val = accessor(s) ?? 0;
          const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
          return (
            <div key={s.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i + 1}. {s.displayName}
                </span>
                <span style={{ fontSize: '0.72rem', color, fontWeight: 600, marginLeft: 8, flexShrink: 0 }}>
                  {unit === 'MB' ? `${val.toFixed(1)} MB` : `${val.toFixed(2)}%`}
                </span>
              </div>
              <MiniBar pct={pct} color={color} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Format Uptime ────────────────────────────────────────────────────────────
function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null || isNaN(seconds)) return '—';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

// ─── Service Detail Drawer ────────────────────────────────────────────────────
function ServiceDetailDrawer({
  service, onClose, totalMem,
}: {
  service: WindowsService; onClose: () => void; totalMem: number;
}) {
  const sc = stateColor(service.stateCode);
  const cpuPct = service.cpuPercent ?? 0;
  const memPct = totalMem > 0 && service.memoryMB ? (service.memoryMB / totalMem) * 100 : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box animate-scale-in"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 520, textAlign: 'left', padding: '28px 28px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="status-dot" style={{ width: 8, height: 8, background: sc.text === 'var(--success)' ? 'var(--success)' : sc.text === 'var(--warning)' ? 'var(--warning)' : 'var(--text-muted)', animation: service.stateCode === 4 ? 'pulse-glow-green 2s infinite' : 'none' }} />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{service.displayName}</h2>
            </div>
            <code style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{service.name}</code>
          </div>
          <button onClick={onClose} className="btn-icon-sm" style={{ flexShrink: 0 }}>✕</button>
        </div>

        {/* State badges */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {service.type === 'Process' && (
            <span className="badge" style={{ background: 'rgba(52, 152, 219, 0.12)', border: '1px solid rgba(52, 152, 219, 0.3)', color: '#3498db' }}>
              <span className="status-dot status-dot-active" style={{ background: '#3498db', boxShadow: '0 0 8px #3498db' }} /> Process
            </span>
          )}
          <span className="badge" style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
            <span className={`status-dot ${sc.dot}`} /> {service.state}
          </span>
          {service.type !== 'Process' && (
            <span className={`badge ${startTypeColor(service.startType)}`}>{service.startType}</span>
          )}
          {service.processId && (
            <span className="badge badge-muted">PID {service.processId}</span>
          )}
        </div>

        {/* Resource meters */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.18)' }}>
            <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>CPU Usage</p>
            {service.cpuPercent != null ? (
              <>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{cpuPct.toFixed(2)}%</p>
                <MiniBar pct={cpuPct} color="#6c63ff" />
              </>
            ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Not tracked</p>}
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.18)' }}>
            <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Memory</p>
            {service.memoryMB != null ? (
              <>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{service.memoryMB.toFixed(1)} MB</p>
                <MiniBar pct={memPct} color="#a855f7" />
                <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 4 }}>{memPct.toFixed(1)}% of total</p>
              </>
            ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Not tracked</p>}
          </div>
        </div>

        {/* Meta info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Uptime',     value: formatUptime(service.uptimeSeconds) },
            { label: 'Run As',     value: service.runAs || '—' },
            { label: 'Path',       value: service.path  || '—', mono: true },
          ].filter(r => r.value !== '—' || r.label === 'Path').map(row => (
            <div key={row.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 60, paddingTop: 1 }}>{row.label}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: row.mono ? 'JetBrains Mono, monospace' : undefined, wordBreak: 'break-all', flex: 1 }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function ServicesPage() {
  const { user, token } = useAuth();

  const [instances, setInstances] = useState<MonitoredInstance[]>([]);
  const [selected, setSelected] = useState<MonitoredInstance | null>(null);

  const [servicesData, setServicesData] = useState<ServicesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<'ALL' | 'RUNNING' | 'STOPPED' | 'OTHER'>('ALL');
  const [startTypeFilter, setStartTypeFilter] = useState<'ALL' | 'Automatic' | 'Manual' | 'Disabled'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SERVICE' | 'PROCESS'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'cpu' | 'memory' | 'state'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [visibleCount, setVisibleCount] = useState(20);
  const [activeTab, setActiveTab] = useState<'table' | 'top'>('table');
  const [detailService, setDetailService] = useState<WindowsService | null>(null);

  // Load instances
  useEffect(() => {
    if (!user?.organizationId) return;
    const auth = token || localStorage.getItem('auth_token') || '';
    fetch(`/api/instances?organizationId=${user.organizationId}`, {
      headers: { Authorization: `Bearer ${auth}` },
    })
      .then(r => r.json())
      .then(json => {
        const list: MonitoredInstance[] = json.data?.instances || json.data || [];
        setInstances(list);
        // Prefer Windows instances
        const win = list.find(i => i.platform === 'WINDOWS' && i.status === 'RUNNING');
        const first = win || list[0] || null;
        setSelected(first);
      })
      .catch(() => {});
  }, [user?.organizationId, token]);

  // Fetch services and processes data
  const fetchServices = useCallback(async () => {
    if (!selected) return;
    const ip   = selected.privateIp || selected.publicIp;
    const port = selected.exporterPort || (selected.platform === 'WINDOWS' ? 9200 : 9100);
    if (!ip) return;

    setLoading(true);
    setError(null);
    try {
      const auth = token || localStorage.getItem('auth_token') || '';
      
      // Fetch both endpoints in parallel
      const [servicesRes, processesRes] = await Promise.all([
        fetch(`/api/services?instance=${ip}&exporterPort=${port}`, { headers: { Authorization: `Bearer ${auth}` } }),
        // Only fetch processes if it's a Windows machine for now, since our backend logic uses PowerShell Get-Process
        selected.platform === 'WINDOWS' 
          ? fetch(`/api/processes`, { headers: { Authorization: `Bearer ${auth}` } })
          : Promise.resolve(null)
      ]);

      const servicesJson = await servicesRes.json();
      if (!servicesJson.success) throw new Error(servicesJson.message || 'Failed to fetch services');
      
      let processesJson = null;
      if (processesRes && processesRes.ok) {
        processesJson = await processesRes.json();
      }

      // Merge the data
      const mergedData = { ...servicesJson.data };
      
      if (processesJson && processesJson.success && processesJson.data?.processes) {
        // Add processes to the services list
        mergedData.services = [
          ...(mergedData.services || []),
          ...processesJson.data.processes
        ];
        
        // Update summary
        const procCount = processesJson.data.processes.length;
        mergedData.summary.total += procCount;
        mergedData.summary.running += procCount; // All fetched processes are running
      }

      setServicesData(mergedData);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }, [selected, token]);

  useEffect(() => {
    fetchServices();
    const id = setInterval(fetchServices, 30000);
    return () => clearInterval(id);
  }, [fetchServices]);

  // Filtering + sorting
  const displayedServices = useMemo(() => {
    if (!servicesData) return [];
    let list = [...servicesData.services];

    if (stateFilter !== 'ALL') {
      list = list.filter(s => {
        if (stateFilter === 'RUNNING') return s.stateCode === 4;
        if (stateFilter === 'STOPPED') return s.stateCode === 1;
        return s.stateCode !== 4 && s.stateCode !== 1;
      });
    }

    if (startTypeFilter !== 'ALL') {
      list = list.filter(s => s.startType === startTypeFilter);
    }

    if (typeFilter !== 'ALL') {
      list = list.filter(s => {
        if (typeFilter === 'PROCESS') return s.type === 'Process';
        if (typeFilter === 'SERVICE') return s.type !== 'Process';
        return true;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.displayName.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.runAs.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':   cmp = a.displayName.localeCompare(b.displayName); break;
        case 'cpu':    cmp = (a.cpuPercent ?? -1) - (b.cpuPercent ?? -1); break;
        case 'memory': cmp = (a.memoryMB ?? -1)   - (b.memoryMB ?? -1);  break;
        case 'state':  cmp = a.stateCode - b.stateCode; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [servicesData, search, stateFilter, startTypeFilter, typeFilter, sortBy, sortDir]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(20);
  }, [search, stateFilter, startTypeFilter, typeFilter, sortBy, sortDir]);

  const totalMem = useMemo(() => {
    if (!servicesData) return 0;
    return servicesData.services.reduce((sum, s) => sum + (s.memoryMB ?? 0), 0);
  }, [servicesData]);

  const maxCpu = useMemo(() => {
    if (!servicesData) return 0;
    return Math.max(...servicesData.services.map(s => s.cpuPercent ?? 0), 0.001);
  }, [servicesData]);

  const toggleSort = (col: 'name' | 'cpu' | 'memory' | 'state') => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const isPlatformWindows = selected?.platform === 'WINDOWS';

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            ⚙️ Services Monitor
          </h1>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Windows services — state, resource usage & contribution
            {lastRefresh && (
              <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                · refreshed {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {instances.length > 0 && (
            <select
              className="input-glass"
              style={{ fontSize: '0.82rem', minWidth: 220, padding: '7px 12px' }}
              value={selected?.id || ''}
              onChange={e => {
                const inst = instances.find(i => i.id === e.target.value);
                if (inst) setSelected(inst);
              }}
            >
              {instances.map(inst => (
                <option key={inst.id} value={inst.id} style={{ background: '#0f172a', color: '#f1f5f9' }}>
                  {inst.instanceName || inst.instanceId} · {inst.platform}
                </option>
              ))}
            </select>
          )}
          <button onClick={fetchServices} disabled={loading} className="btn-ghost" style={{ fontSize: '0.8rem', padding: '7px 14px' }}>
            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '↻'} Refresh
          </button>
        </div>
      </div>

      {/* ── Platform warning ─────────────────────────────────────────────────── */}
      {selected && !isPlatformWindows && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(243,156,18,0.08)', border: '1px solid rgba(243,156,18,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>⚠️</span>
          <p style={{ fontSize: '0.82rem', color: 'var(--warning)' }}>
            <strong>{selected.instanceName || selected.instanceId}</strong> is a Linux instance. Windows Services are only available for Windows instances (port 9200 / windows_exporter).
          </p>
        </div>
      )}

      {/* ── Mock data badge ───────────────────────────────────────────────────── */}
      {servicesData?.isMock && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.20)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🧪</span>
          <p style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>Showing <strong>mock data</strong> — connect a Windows instance with windows_exporter on port 9200 for live data.</p>
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,78,106,0.08)', border: '1px solid rgba(255,78,106,0.25)' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--danger)' }}>⚠️ {error}</p>
        </div>
      )}

      {/* ── Loading skeleton ──────────────────────────────────────────────────── */}
      {loading && !servicesData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      )}

      {/* ── Summary stat cards ────────────────────────────────────────────────── */}
      {servicesData && (
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
          <StatCard icon="⚙️" label="Total Services"   value={servicesData.summary.total}   color="#6c63ff"  glow="rgba(108,99,255,0.25)" />
          <StatCard icon="🟢" label="Running"           value={servicesData.summary.running} color="#2ecc71"  glow="rgba(46,204,113,0.25)"  sub={`${Math.round(servicesData.summary.running / servicesData.summary.total * 100)}% active`} />
          <StatCard icon="⭕" label="Stopped"           value={servicesData.summary.stopped} color="#ff4e6a"  glow="rgba(255,78,106,0.20)"  sub={`${Math.round(servicesData.summary.stopped / servicesData.summary.total * 100)}% inactive`} />
          <StatCard
            icon="🧠"
            label="Total Memory"
            value={`${totalMem.toFixed(0)} MB`}
            color="#a855f7"
            glow="rgba(168,85,247,0.20)"
            sub="across all services"
          />
        </div>
      )}

      {/* ── Tab navigation ────────────────────────────────────────────────────── */}
      {servicesData && (
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'table', label: '📋 All Services', count: displayedServices.length },
            { key: 'top',   label: '🏆 Top Resource Consumers' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '6px 16px', borderRadius: 20,
                fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', border: '1px solid',
                background: activeTab === tab.key ? 'var(--accent-subtle)' : 'var(--glass-bg)',
                borderColor: activeTab === tab.key ? 'var(--accent-border)' : 'var(--glass-border)',
                color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span style={{ marginLeft: 6, fontSize: '0.7rem', opacity: 0.7 }}>({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ────────────────── TABLE TAB ────────────────────────────────────────── */}
      {servicesData && activeTab === 'table' && (
        <>
          {/* Filters row */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="input-glass"
              placeholder="🔍 Search services…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 180, maxWidth: 320, fontSize: '0.82rem' }}
            />
            {/* State filter pills */}
            {(['ALL', 'RUNNING', 'STOPPED', 'OTHER'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStateFilter(f)}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 500,
                  cursor: 'pointer', border: '1px solid',
                  background: stateFilter === f ? 'var(--accent-subtle)' : 'var(--glass-bg)',
                  borderColor: stateFilter === f ? 'var(--accent-border)' : 'var(--glass-border)',
                  color: stateFilter === f ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                }}
              >
                {f === 'ALL' ? 'All' : f === 'RUNNING' ? '🟢 Running' : f === 'STOPPED' ? '⭕ Stopped' : '🟡 Other'}
              </button>
            ))}

            <div style={{ width: '1px', height: 24, background: 'var(--glass-border)', margin: '0 4px' }} />

            {/* Type filter pills */}
            {(['ALL', 'SERVICE', 'PROCESS'] as const).map(f => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 500,
                  cursor: 'pointer', border: '1px solid',
                  background: typeFilter === f ? 'var(--accent-subtle)' : 'var(--glass-bg)',
                  borderColor: typeFilter === f ? 'var(--accent-border)' : 'var(--glass-border)',
                  color: typeFilter === f ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                }}
              >
                {f === 'ALL' ? 'All Types' : f === 'SERVICE' ? '⚙️ Services' : '💻 Apps'}
              </button>
            ))}

            <select
              className="input-glass"
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              value={startTypeFilter}
              onChange={e => setStartTypeFilter(e.target.value as any)}
            >
              <option value="ALL">All Start Types</option>
              <option value="Automatic">Automatic</option>
              <option value="Manual">Manual</option>
              <option value="Disabled">Disabled</option>
            </select>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {displayedServices.length} / {servicesData.summary.total} services
            </span>
          </div>

          {/* Table */}
          <div className="glass-card animate-slide-in" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                    {[
                      { label: 'Service',    col: 'name'   as const },
                      { label: 'State',      col: 'state'  as const },
                      { label: 'Start Type', col: null },
                      { label: 'Run As',     col: null },
                      { label: 'CPU',        col: 'cpu'    as const },
                      { label: 'Memory',     col: 'memory' as const },
                    ].map(({ label, col }) => (
                      <th
                        key={label}
                        onClick={col ? () => toggleSort(col) : undefined}
                        style={{
                          padding: '10px 16px', textAlign: 'left',
                          fontSize: '0.62rem', fontWeight: 700,
                          color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
                          cursor: col ? 'pointer' : 'default',
                          userSelect: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {label} {col && <SortIndicator col={col} sortBy={sortBy} sortDir={sortDir} />}
                      </th>
                    ))}
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedServices.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        🔍 No services match your filters
                      </td>
                    </tr>
                  ) : displayedServices.slice(0, visibleCount).map(svc => {
                    const sc = stateColor(svc.stateCode);
                    return (
                      <tr
                        key={svc.name}
                        style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Service name */}
                        <td style={{ padding: '10px 16px', maxWidth: 220 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {svc.displayName}
                          </div>
                          <code style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{svc.name}</code>
                        </td>

                        {/* State */}
                        <td style={{ padding: '10px 16px' }}>
                          <span className="badge" style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                            <span className={`status-dot ${sc.dot}`} />
                            {svc.state}
                          </span>
                        </td>

                        {/* Start type */}
                        <td style={{ padding: '10px 16px' }}>
                          <span className={`badge ${startTypeColor(svc.startType)}`}>{svc.startType}</span>
                        </td>

                        {/* Run as */}
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{svc.runAs || '—'}</span>
                        </td>

                        {/* CPU */}
                        <td style={{ padding: '10px 16px', minWidth: 120 }}>
                          {svc.cpuPercent != null ? (
                            <div>
                              <span style={{ fontSize: '0.78rem', color: '#6c63ff', fontWeight: 600, display: 'block', marginBottom: 3 }}>
                                {svc.cpuPercent.toFixed(2)}%
                              </span>
                              <MiniBar pct={(svc.cpuPercent / maxCpu) * 100} color="#6c63ff" />
                            </div>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}
                        </td>

                        {/* Memory */}
                        <td style={{ padding: '10px 16px', minWidth: 120 }}>
                          {svc.memoryMB != null ? (
                            <div>
                              <span style={{ fontSize: '0.78rem', color: '#a855f7', fontWeight: 600, display: 'block', marginBottom: 3 }}>
                                {svc.memoryMB.toFixed(1)} MB
                              </span>
                              <MiniBar pct={totalMem > 0 ? (svc.memoryMB / totalMem) * 100 : 0} color="#a855f7" />
                            </div>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}
                        </td>

                        {/* Details button */}
                        <td style={{ padding: '10px 16px' }}>
                          <button
                            onClick={() => setDetailService(svc)}
                            className="btn-ghost"
                            style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                          >
                            Info →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Load More Button */}
            {visibleCount < displayedServices.length && (
              <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.01)' }}>
                <button
                  onClick={() => setVisibleCount(c => Math.min(c + 50, displayedServices.length))}
                  className="btn-glass"
                  style={{ padding: '8px 24px', fontSize: '0.8rem', fontWeight: 600, borderRadius: 20 }}
                >
                  Load More ({displayedServices.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ────────────────── TOP CONSUMERS TAB ────────────────────────────────── */}
      {servicesData && activeTab === 'top' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <TopResourceList
            title="Top CPU Consumers"
            icon="⚡"
            color="#6c63ff"
            items={servicesData.summary.topCpu}
            accessor={s => s.cpuPercent}
            unit="%"
            maxVal={maxCpu}
          />
          <TopResourceList
            title="Top Memory Consumers"
            icon="🧠"
            color="#a855f7"
            items={servicesData.summary.topMem}
            accessor={s => s.memoryMB}
            unit="MB"
            maxVal={servicesData.summary.topMem[0]?.memoryMB ?? 1}
          />

          {/* State breakdown chart */}
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span>📊</span>
              <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>Service State Breakdown</h3>
            </div>
            {[
              { label: 'Running', count: servicesData.summary.running, total: servicesData.summary.total, color: '#2ecc71' },
              { label: 'Stopped', count: servicesData.summary.stopped, total: servicesData.summary.total, color: '#ff4e6a' },
              { label: 'Other',   count: servicesData.summary.other,   total: servicesData.summary.total, color: '#f39c12' },
            ].map(row => (
              <div key={row.label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{row.label}</span>
                  <span style={{ fontSize: '0.78rem', color: row.color, fontWeight: 600 }}>{row.count} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({Math.round(row.count / row.total * 100)}%)</span></span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.total > 0 ? (row.count / row.total) * 100 : 0}%`, background: row.color, borderRadius: 99, transition: 'width 0.7s ease' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Start type breakdown */}
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span>🚀</span>
              <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>Start Type Distribution</h3>
            </div>
            {(['Automatic', 'Manual', 'Disabled', 'Boot', 'System'] as const).map(type => {
              const count = servicesData.services.filter(s => s.startType === type).length;
              if (count === 0) return null;
              const pct = (count / servicesData.summary.total) * 100;
              const colors: Record<string, string> = { Automatic: '#6c63ff', Manual: '#f39c12', Disabled: '#ff4e6a', Boot: '#06b6d4', System: '#2ecc71' };
              const color = colors[type] || '#6c63ff';
              return (
                <div key={type} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{type}</span>
                    <span style={{ fontSize: '0.75rem', color, fontWeight: 600 }}>{count} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.7s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────────── */}
      {!servicesData && !loading && !error && (
        <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 14 }}>⚙️</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No Windows Instance Selected</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            Register a Windows instance with <code style={{ fontFamily: 'JetBrains Mono, monospace', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 4 }}>windows_exporter</code> running on port 9200 to see service metrics.
          </p>
          <a href="/agent-setup" className="btn-ghost" style={{ textDecoration: 'none', fontSize: '0.85rem' }}>
            🔧 Setup Agent
          </a>
        </div>
      )}

      {/* ── Service detail modal ──────────────────────────────────────────────── */}
      {detailService && (
        <ServiceDetailDrawer
          service={detailService}
          onClose={() => setDetailService(null)}
          totalMem={totalMem}
        />
      )}
    </div>
  );
}
