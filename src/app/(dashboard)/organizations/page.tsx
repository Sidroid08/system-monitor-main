'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api/client';

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count?: { users: number; awsAccounts: number; monitoredInstances: number };
}

export default function OrganizationsPage() {
  const { user } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const res = await apiClient.get(`/organizations/${user?.organizationId}`);
        setOrg(res.data?.data);
      } catch {
        // Mock for dev
        setOrg({
          id: user?.organizationId || 'mock-org',
          name: `${user?.name?.split(' ')[0]}'s Organization`,
          slug: 'my-org',
          createdAt: new Date().toISOString(),
          _count: { users: 1, awsAccounts: 0, monitoredInstances: 0 },
        });
      } finally {
        setLoading(false);
      }
    };
    if (user?.organizationId) fetchOrg();
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="skeleton" style={{ height: 32, width: 200 }} />
        <div className="skeleton" style={{ height: 160 }} />
        <div className="skeleton" style={{ height: 100 }} />
      </div>
    );
  }

  const stats = [
    { label: 'Team Members', value: org?._count?.users ?? 1, icon: '👥' },
    { label: 'Cloud Accounts', value: org?._count?.awsAccounts ?? 0, icon: '🌩️' },
    { label: 'Instances', value: org?._count?.monitoredInstances ?? 0, icon: '🖥️' },
  ];

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>🏢 Organization</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Manage your organization settings, members, and resources
        </p>
      </div>

      {/* Org card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--accent), #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', boxShadow: 'var(--shadow-accent)', flexShrink: 0,
          }}>
            🏢
          </div>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {org?.name}
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              ID: <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--accent)' }}>{org?.id}</code>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {stats.map(s => (
            <div key={s.label} style={{
              padding: '16px', borderRadius: 10,
              background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Org details */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
          Organization Details
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            ['Name', org?.name || ''],
            ['Slug', org?.slug || ''],
            ['Created', org?.createdAt ? new Date(org.createdAt).toLocaleDateString() : ''],
            ['Your Role', user?.role || 'ADMIN'],
          ].map(([label, val]) => (
            <div key={label}>
              <p style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
          Quick Actions
        </h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: '🌩️ Add AWS Account', href: '/aws-accounts' },
            { label: '🔧 Install Agent', href: '/agent-setup' },
            { label: '⚙️ Preferences', href: '/settings' },
          ].map(a => (
            <a key={a.href} href={a.href} className="btn-ghost" style={{ fontSize: '0.82rem', padding: '8px 16px', textDecoration: 'none' }}>
              {a.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
