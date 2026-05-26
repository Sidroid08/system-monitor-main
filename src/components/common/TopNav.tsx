'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const routeTitles: Record<string, { title: string; icon: string }> = {
  '/overview':       { title: 'Overview',          icon: '📊' },
  '/instances':      { title: 'Instances',          icon: '🖥️' },
  '/grafana':        { title: 'Grafana Dashboard',  icon: '📈' },
  '/organizations':  { title: 'Organizations',      icon: '🏢' },
  '/alerts':         { title: 'Alerts',             icon: '🚨' },
  '/settings':       { title: 'Settings',           icon: '⚙️' },
  '/aws-accounts':   { title: 'Cloud Accounts',     icon: '🌩️' },
  '/agent-setup':    { title: 'Agent Setup',        icon: '🔧' },
};

export default function TopNav() {
  const pathname  = usePathname();
  const { user }  = useAuth();
  const { theme, toggleTheme } = useTheme();

  const page   = routeTitles[pathname] || { title: 'Dashboard', icon: '🖥️' };
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  return (
    <header className="glass-topbar transition-theme" style={{
      display: 'flex', alignItems: 'center',
      padding: '0 24px', height: 60, flexShrink: 0, gap: 12,
    }}>
      {/* Page title */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '1.1rem' }}>{page.icon}</span>
        <h1 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {page.title}
        </h1>
      </div>

      {/* Right side controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

        {/* Live indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 20,
          background: 'rgba(46,204,113,0.10)',
          border: '1px solid rgba(46,204,113,0.25)',
        }}>
          <span className="status-dot status-dot-active" style={{ width: 6, height: 6 }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 600 }}>Live</span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="btn-icon-sm"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{ fontSize: '1rem' }}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* User avatar chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 12px 5px 6px',
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: 20, cursor: 'default',
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.68rem', fontWeight: 700, color: '#fff',
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            {user?.name?.split(' ')[0] || 'User'}
          </span>
        </div>
      </div>
    </header>
  );
}
