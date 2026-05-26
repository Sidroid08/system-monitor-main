'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAlertChecker } from '@/hooks/useAlertChecker';

const navGroups = [
  {
    label: 'Monitoring',
    items: [
      { href: '/overview',      label: 'Overview',      icon: '📊' },
      { href: '/instances',     label: 'Instances',     icon: '🖥️' },
      { href: '/alerts',        label: 'Alerts',        icon: '🚨' },
      { href: '/grafana',       label: 'Grafana',       icon: '📈' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { href: '/aws-accounts',  label: 'Cloud Accounts', icon: '🌩️' },
      { href: '/agent-setup',   label: 'Agent Setup',    icon: '🔧' },
      { href: '/organizations', label: 'Organizations',  icon: '🏢' },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/settings', label: 'Settings', icon: '⚙️' },
    ],
  },
];

export default function Sidebar() {
  const pathname  = usePathname();
  const { user, logout } = useAuth();
  const router    = useRouter();
  const [refreshInterval, setRefreshInterval] = useState(30);

  // Read refresh interval from localStorage and keep it in sync
  useEffect(() => {
    const read = () => {
      try {
        const stored = localStorage.getItem('sidroid-prefs');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.refreshInterval) setRefreshInterval(parsed.refreshInterval);
        }
      } catch {}
    };
    read();
    // Update when settings page saves
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);

  // Run the global alert threshold checker
  useAlertChecker(refreshInterval * 1000);

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
  const handleLogout = () => { logout(); router.push('/login'); };

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      borderRight: '1px solid var(--glass-border)',
      transition: 'background 0.3s, border-color 0.3s',
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent), #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', boxShadow: 'var(--shadow-accent)', flexShrink: 0,
          }}>
            ⚡
          </div>
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Sidroid</p>
            <p style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Monitor Platform
            </p>
          </div>
        </div>
      </div>

      {/* Navigation groups */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
        {navGroups.map(group => (
          <div key={group.label} style={{ marginBottom: 6 }}>
            <p style={{
              padding: '8px 10px 4px',
              fontSize: '0.58rem', fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.12em',
            }}>
              {group.label}
            </p>
            {group.items.map(item => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '8px 10px', borderRadius: 9, marginBottom: 1,
                    border: '1px solid transparent',
                    textDecoration: 'none', position: 'relative',
                    transition: 'all 0.18s',
                    background: isActive ? 'var(--accent-subtle)' : 'transparent',
                    borderColor: isActive ? 'var(--accent-border)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {isActive && (
                    <div style={{
                      position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                      width: 3, height: 16, borderRadius: '0 3px 3px 0',
                      background: 'linear-gradient(180deg, var(--accent), #a855f7)',
                    }} />
                  )}
                  <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: isActive ? 600 : 400 }}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Status chip */}
      <div style={{ padding: '8px 10px' }}>
        <div style={{
          padding: '9px 12px', borderRadius: 10,
          background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span className="status-dot status-dot-active" />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)' }}>Systems Online</span>
          </div>
          <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Telemetry active · {refreshInterval}s refresh</p>
        </div>
      </div>

      {/* User profile */}
      <div style={{
        margin: '4px 8px 10px',
        padding: '10px 12px', borderRadius: 12,
        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.78rem', fontWeight: 700, color: '#fff', flexShrink: 0,
          boxShadow: '0 2px 8px var(--accent-glow)',
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>Signed in as</p>
          <p style={{
            fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {user?.name || 'User'}
          </p>
        </div>
        <button
          onClick={handleLogout} title="Sign out"
          className="btn-icon-sm"
          style={{ width: 28, height: 28, fontSize: '0.8rem', flexShrink: 0 }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = 'rgba(255,78,106,0.15)';
            el.style.borderColor = 'var(--danger)';
            el.style.color = 'var(--danger)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = 'var(--glass-bg)';
            el.style.borderColor = 'var(--glass-border)';
            el.style.color = 'var(--text-secondary)';
          }}
        >
          🚪
        </button>
      </div>
    </aside>
  );
}
