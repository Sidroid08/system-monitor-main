'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [prefs, setPrefs] = useState({
    refreshInterval: 30,
    victoriaMetricsUrl: '',
    grafanaUrl: '',
    emailAlerts: true,
    criticalOnly: false,
  });
  const [saved, setSaved] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sidroid-prefs');
      if (stored) setPrefs(JSON.parse(stored));
      setPrefs(p => ({
        ...p,
        victoriaMetricsUrl: process.env.NEXT_PUBLIC_VICTORIA_METRICS_URL || 'http://localhost:8428',
        grafanaUrl: process.env.NEXT_PUBLIC_GRAFANA_URL || 'http://localhost:3001',
      }));
    } catch {}
  }, []);

  const handleSave = () => {
    localStorage.setItem('sidroid-prefs', JSON.stringify(prefs));
    // Dispatch storage event so Sidebar and other listeners update immediately
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'sidroid-prefs',
      newValue: JSON.stringify(prefs),
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="glass-card" style={{ padding: '24px', overflow: 'hidden' }}>
      <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 18 }}>
        {title}
      </h2>
      {children}
    </div>
  );

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label style={{ display: 'block', marginBottom: 6, fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
      {children}
    </label>
  );

  const FieldRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 16 }}>
      <Label>{label}</Label>
      {children}
    </div>
  );

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '10px 0', borderBottom: '1px solid var(--glass-border)' }}>
      <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{label}</span>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12, position: 'relative', cursor: 'pointer', transition: 'all 0.2s',
          background: checked ? 'var(--accent)' : 'var(--glass-hover)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: checked ? 22 : 3,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }} />
      </div>
    </label>
  );

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680 }}>
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>⚙️ Settings</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Manage your account, preferences, and integrations
        </p>
      </div>

      {/* User Profile */}
      <Card title="👤 User Profile">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.3rem', fontWeight: 700, color: '#fff', flexShrink: 0,
            boxShadow: 'var(--shadow-accent)',
          }}>
            {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
          </div>
          <div>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>{user?.name}</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{user?.email}</p>
            <span className="badge badge-accent" style={{ marginTop: 4 }}>{user?.role || 'ADMIN'}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[['Name', user?.name || ''], ['Email', user?.email || ''], ['Organization ID', user?.organizationId || ''], ['Role', user?.role || 'ADMIN']].map(([label, val]) => (
            <div key={label}>
              <Label>{label}</Label>
              <input className="input-glass" value={val} disabled readOnly
                style={{ opacity: 0.7, cursor: 'not-allowed', fontSize: '0.8rem' }} />
            </div>
          ))}
        </div>
      </Card>

      {/* Appearance */}
      <Card title="🎨 Appearance">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
              Currently using {theme} theme
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="btn-ghost"
            style={{ fontSize: '0.82rem', padding: '8px 16px' }}
          >
            Switch to {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </Card>

      {/* Dashboard */}
      <Card title="📊 Dashboard Preferences">
        <FieldRow label="Metrics refresh interval (seconds)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range" min={10} max={120} step={10}
              value={prefs.refreshInterval}
              onChange={e => setPrefs({ ...prefs, refreshInterval: +e.target.value })}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
            />
            <span style={{
              minWidth: 40, textAlign: 'center', fontSize: '0.875rem',
              fontWeight: 600, color: 'var(--accent)',
              background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
              borderRadius: 8, padding: '3px 8px',
            }}>
              {prefs.refreshInterval}s
            </span>
          </div>
        </FieldRow>
        <div>
          <Toggle checked={prefs.emailAlerts} onChange={v => setPrefs({ ...prefs, emailAlerts: v })} label="Email alert notifications" />
          <Toggle checked={prefs.criticalOnly} onChange={v => setPrefs({ ...prefs, criticalOnly: v })} label="Only notify on Critical severity" />
        </div>
      </Card>

      {/* Integrations */}
      <Card title="🔌 Integration URLs">
        <FieldRow label="VictoriaMetrics URL">
          <input
            className="input-glass" placeholder="http://localhost:8428"
            value={prefs.victoriaMetricsUrl}
            onChange={e => setPrefs({ ...prefs, victoriaMetricsUrl: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Grafana URL">
          <input
            className="input-glass" placeholder="http://localhost:3001"
            value={prefs.grafanaUrl}
            onChange={e => setPrefs({ ...prefs, grafanaUrl: e.target.value })}
          />
        </FieldRow>
      </Card>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={handleSave} className="btn-primary">
          💾 Save Preferences
        </button>
        {saved && (
          <span className="animate-fade-in" style={{ fontSize: '0.875rem', color: 'var(--success)', fontWeight: 500 }}>
            ✓ Saved successfully
          </span>
        )}
      </div>
    </div>
  );
}
