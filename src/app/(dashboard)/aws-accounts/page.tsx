'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api/client';

interface AwsAccount {
  id: string;
  accountName: string;
  accountId: string;
  region: string;
  authMode: 'STATIC_KEYS' | 'ASSUME_ROLE';
  isActive: boolean;
  createdAt: string;
}

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
  'eu-west-1', 'eu-west-2', 'eu-central-1', 'sa-east-1',
];

const emptyForm = {
  accountName: '', accountId: '', region: 'us-east-1',
  accessKeyId: '', secretAccessKey: '',
  roleArn: '', externalId: '',
  authMode: 'STATIC_KEYS' as 'STATIC_KEYS' | 'ASSUME_ROLE',
};

export default function AwsAccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AwsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchAccounts(); }, [user?.organizationId]);

  const fetchAccounts = async () => {
    try {
      if (!user?.organizationId) return;
      const res = await apiClient.get(`/aws?organizationId=${user.organizationId}`);
      setAccounts(res.data?.data || []);
    } catch {
      setAccounts([]); // empty if backend not available
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      await apiClient.post('/aws', { ...form, organizationId: user?.organizationId });
      setSuccess('AWS account connected successfully!');
      setShowForm(false);
      setForm(emptyForm);
      fetchAccounts();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to connect AWS account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSync = async (id: string, name: string) => {
    setSyncingId(id);
    try {
      await apiClient.post(`/aws/${id}/sync`);
      setSuccess(`✓ Synced ${name} — instances discovered`);
      setTimeout(() => setSuccess(''), 4000);
    } catch {
      setError('Sync failed. Check your AWS credentials and instance tags.');
    } finally {
      setSyncingId(null);
    }
  };

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>🌩️ Cloud Accounts</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Connect AWS accounts to auto-discover EC2 instances tagged <code style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 4, fontSize: '0.8rem' }}>Monitor=true</code>
          </p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setError(''); }} className="btn-primary">
          {showForm ? '✕ Cancel' : '+ Connect AWS Account'}
        </button>
      </div>

      {/* Success/Error banners */}
      {success && (
        <div className="animate-slide-in" style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(46,204,113,0.10)', border: '1px solid rgba(46,204,113,0.25)', color: 'var(--success)', fontSize: '0.875rem' }}>
          ✓ {success}
        </div>
      )}
      {error && (
        <div className="animate-slide-in" style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,78,106,0.10)', border: '1px solid rgba(255,78,106,0.25)', color: 'var(--danger)', fontSize: '0.875rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="glass-card animate-scale-in" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
            Connect AWS Account
          </h2>

          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Account Name *
                </label>
                <input className="input-glass" required placeholder="e.g. Production AWS" value={form.accountName} onChange={set('accountName')} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  AWS Account ID (12 digits) *
                </label>
                <input className="input-glass" required placeholder="123456789012" maxLength={12}
                  pattern="\d{12}" value={form.accountId} onChange={set('accountId')} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Default Region *
                </label>
                <select className="input-glass" value={form.region} onChange={set('region')}>
                  {AWS_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Auth Mode
                </label>
                <select className="input-glass" value={form.authMode} onChange={set('authMode')}>
                  <option value="STATIC_KEYS">Static Keys (Access Key + Secret)</option>
                  <option value="ASSUME_ROLE">IAM Role ARN</option>
                </select>
              </div>
            </div>

            {form.authMode === 'STATIC_KEYS' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    AWS Access Key ID *
                  </label>
                  <input className="input-glass" required placeholder="AKIAIOSFODNN7EXAMPLE" value={form.accessKeyId} onChange={set('accessKeyId')} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    AWS Secret Access Key *
                  </label>
                  <input className="input-glass" type="password" required placeholder="••••••••••••••••••••"
                    value={form.secretAccessKey} onChange={set('secretAccessKey')} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    IAM Role ARN *
                  </label>
                  <input className="input-glass" required placeholder="arn:aws:iam::123456789012:role/MonitorRole"
                    value={form.roleArn} onChange={set('roleArn')} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    External ID (optional)
                  </label>
                  <input className="input-glass" placeholder="optional-external-id"
                    value={form.externalId} onChange={set('externalId')} />
                </div>
              </div>
            )}

            {/* Security note */}
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
              fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6,
            }}>
              🔒 <strong style={{ color: 'var(--accent)' }}>Security note:</strong> Credentials are stored encrypted in the database.
              Use an IAM user with <strong>read-only EC2 permissions</strong> (<code>ec2:DescribeInstances</code>) only.
              Never use root account credentials.
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Connecting…</> : '🔗 Connect Account'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Accounts list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>☁️</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            No AWS accounts connected
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Connect your first AWS account to start discovering EC2 instances.
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            + Connect AWS Account
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {accounts.map(acc => (
            <div key={acc.id} className="glass-card" style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: '1.1rem' }}>☁️</span>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{acc.accountName}</h3>
                    <span className="badge badge-accent">{acc.region}</span>
                    <span className={`badge ${acc.isActive ? 'badge-success' : 'badge-muted'}`}>
                      {acc.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    Account ID: {acc.accountId} · {acc.authMode === 'STATIC_KEYS' ? '🔑 Static Keys' : '🔐 IAM Role'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleSync(acc.id, acc.accountName)}
                    disabled={syncingId === acc.id}
                    className="btn-primary"
                    style={{ fontSize: '0.78rem', padding: '7px 14px' }}
                  >
                    {syncingId === acc.id
                      ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Syncing…</>
                      : '🔄 Sync Instances'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="glass-card" style={{ padding: '22px', marginTop: 8 }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
          📋 How cloud monitoring works
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {[
            { step: '1', title: 'Tag EC2 instances', desc: 'Add tag Monitor=true to instances you want to monitor' },
            { step: '2', title: 'Install node_exporter', desc: 'Run install_node_exporter.sh on each EC2 instance' },
            { step: '3', title: 'Sync & Monitor', desc: 'Hit Sync — instances appear in your dashboard automatically' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)',
              }}>{s.step}</div>
              <div>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{s.title}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
