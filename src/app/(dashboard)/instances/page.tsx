'use client';

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import InstancesList from '@/components/dashboard/InstancesList';

const STATUS_FILTERS = ['ALL', 'RUNNING', 'STOPPED', 'TERMINATED'];

const emptyForm = {
  instanceName: '', privateIp: '', publicIp: '',
  platform: 'LINUX' as 'LINUX' | 'WINDOWS',
  serviceType: 'BARE_METAL' as 'BARE_METAL' | 'EC2' | 'VM',
  port: '9100',
};

export default function InstancesPage() {
  const { user, token } = useAuth();
  const { addToast } = useToast();
  const [filter, setFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Ref to trigger a refetch inside InstancesList
  const refetchRef = useRef<(() => void) | null>(null);

  const set = (k: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setForm(p => {
        const next = { ...p, [k]: value };
        if (k === 'platform') {
          next.port = value === 'WINDOWS' ? '9200' : '9100';
        }
        return next;
      });
    };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      const res = await fetch('/api/instances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({
          organizationId: user?.organizationId,
          instanceId: `local-${Date.now()}`,
          instanceName: form.instanceName,
          privateIp: form.privateIp || undefined,
          publicIp: form.publicIp || undefined,
          platform: form.platform,
          serviceType: form.serviceType,
          status: 'RUNNING',
          exporterPort: parseInt(form.port || (form.platform === 'WINDOWS' ? '9200' : '9100'), 10),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to register instance');
      }

      // Close modal and reset form
      setShowModal(false);
      setForm(emptyForm);

      // Show success toast
      addToast({
        title: '✅ Instance Registered',
        description: `${form.instanceName} has been added and is now being monitored.`,
        type: 'success',
      });

      // Trigger re-fetch in InstancesList
      refetchRef.current?.();

    } catch (err: any) {
      setError(err?.message || 'Failed to register instance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setForm(emptyForm);
    setError('');
  }, []);

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>🖥️ Instances</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
            All monitored machines in your organization
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/aws-accounts" className="btn-ghost" style={{ fontSize: '0.82rem', padding: '8px 14px', textDecoration: 'none' }}>
            🌩️ Add Cloud
          </a>
          <button onClick={() => setShowModal(true)} className="btn-primary" style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
            + Register Local
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: '6px 14px', borderRadius: 20,
              fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
              border: '1px solid',
              background: filter === s ? 'var(--accent-subtle)' : 'var(--glass-bg)',
              borderColor: filter === s ? 'var(--accent-border)' : 'var(--glass-border)',
              color: filter === s ? 'var(--accent)' : 'var(--text-secondary)',
              transition: 'all 0.2s',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Instances list — pass refetch binder & submitting flag */}
      <InstancesList
        organizationId={user?.organizationId}
        onBindRefetch={(fn) => { refetchRef.current = fn; }}
        pendingRegistration={submitting}
      />

      {/* Register modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-box animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                🔧 Register Local Instance
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Add a machine running node_exporter or windows_exporter
              </p>
            </div>

            {error && (
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,78,106,0.10)', border: '1px solid rgba(255,78,106,0.25)', color: 'var(--danger)', fontSize: '0.82rem' }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: '0.76rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Instance Name *
                </label>
                <input className="input-glass" required placeholder="e.g. my-laptop, dev-server" value={form.instanceName} onChange={set('instanceName')} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: '0.76rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Platform
                  </label>
                  <select className="input-glass" value={form.platform} onChange={set('platform')}>
                    <option value="LINUX">🐧 Linux / macOS</option>
                    <option value="WINDOWS">🪟 Windows</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: '0.76rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Type
                  </label>
                  <select className="input-glass" value={form.serviceType} onChange={set('serviceType')}>
                    <option value="BARE_METAL">Bare Metal / Local</option>
                    <option value="EC2">AWS EC2</option>
                    <option value="VM">Virtual Machine</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: '0.76rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Private IP
                  </label>
                  <input className="input-glass" placeholder="192.168.1.100" value={form.privateIp} onChange={set('privateIp')} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: '0.76rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Public IP (optional)
                  </label>
                  <input className="input-glass" placeholder="1.2.3.4" value={form.publicIp} onChange={set('publicIp')} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: '0.76rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Exporter Port
                </label>
                <input className="input-glass" value={form.port} onChange={set('port')}
                  placeholder={form.platform === 'LINUX' ? '9100 (node_exporter)' : '9200 (windows_exporter)'} />
                <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Linux: 9100 · Windows: 9200
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {submitting ? (
                    <>
                      <span className="spinner" style={{ width: 14, height: 14 }} />
                      Registering…
                    </>
                  ) : '✓ Register Instance'}
                </button>
                <button type="button" onClick={handleCloseModal} className="btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
