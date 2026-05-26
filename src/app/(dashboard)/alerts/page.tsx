'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api/client';
import { Alert } from '@/types';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/context/ToastContext';

const SEVERITY_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  CRITICAL: { bg: 'rgba(255,78,106,0.10)', color: '#ff4e6a', border: 'rgba(255,78,106,0.30)', label: '🔴 Critical' },
  HIGH:     { bg: 'rgba(243,156,18,0.10)', color: '#f39c12', border: 'rgba(243,156,18,0.30)', label: '🟠 High' },
  MEDIUM:   { bg: 'rgba(108,99,255,0.10)', color: '#6c63ff', border: 'rgba(108,99,255,0.30)', label: '🟣 Medium' },
  LOW:      { bg: 'rgba(46,204,113,0.10)', color: '#2ecc71', border: 'rgba(46,204,113,0.30)', label: '🟢 Low' },
};

type FilterType = 'ALL' | 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export default function AlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<FilterType>('OPEN');
  const [loading, setLoading] = useState(true);
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'single' | 'bulk'; id?: string; title: string; description: string } | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, [user?.organizationId]);

  const fetchAlerts = async () => {
    try {
      if (!user?.organizationId) return;
      const res = await apiClient.get(`/alerts?orgId=${user.organizationId}`);
      setAlerts(res.data.data?.alerts || []);
    } catch {
      // Use mock data if backend not running
      setAlerts([
        { id: '1', title: 'High CPU Usage', description: 'CPU usage exceeded 90% threshold on ec2-prod-01', severity: 'CRITICAL', status: 'OPEN', source: 'node_exporter', metricName: 'cpu_usage', triggeredAt: new Date().toISOString() } as any,
        { id: '2', title: 'Memory Warning', description: 'Memory usage at 78% on ec2-prod-02', severity: 'HIGH', status: 'OPEN', source: 'node_exporter', metricName: 'memory_usage', triggeredAt: new Date(Date.now() - 300000).toISOString() } as any,
        { id: '3', title: 'Disk Space Low', description: 'Disk usage at 85% on ec2-staging-01', severity: 'MEDIUM', status: 'ACKNOWLEDGED', source: 'node_exporter', metricName: 'disk_usage', triggeredAt: new Date(Date.now() - 3600000).toISOString() } as any,
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      fetchAlerts();
      addToast({ type: 'success', title: `Alert ${newStatus.toLowerCase()}` });
    } catch {
      addToast({ type: 'error', title: 'Action failed' });
    }
  };

  const handleDelete = async () => {
    if (!confirmDialog) return;
    try {
      const token = localStorage.getItem('auth_token') || '';
      
      if (confirmDialog.type === 'single' && confirmDialog.id) {
        await fetch(`/api/alerts/${confirmDialog.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      } else if (confirmDialog.type === 'bulk') {
        await Promise.all(Array.from(selectedAlerts).map(id =>
          fetch(`/api/alerts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
        ));
        setSelectedAlerts(new Set());
      }
      fetchAlerts();
      addToast({ type: 'success', title: 'Alert(s) deleted' });
    } catch {
      addToast({ type: 'error', title: 'Failed to delete alert(s)' });
    } finally {
      setConfirmDialog(null);
    }
  };

  const filtered = filter === 'ALL' ? alerts : alerts.filter(a => a.status === filter);

  const toggleSelectAll = () => {
    if (selectedAlerts.size === filtered.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(filtered.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedAlerts);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedAlerts(newSet);
  };

  const counts = {
    ALL: alerts.length,
    OPEN: alerts.filter(a => a.status === 'OPEN').length,
    ACKNOWLEDGED: alerts.filter(a => a.status === 'ACKNOWLEDGED').length,
    RESOLVED: alerts.filter(a => a.status === 'RESOLVED').length,
  };

  const tabs: FilterType[] = ['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'];

  if (loading) {
    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="skeleton" style={{ height: 32, width: 180 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 34, width: 100, borderRadius: 20 }} />)}
        </div>
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 90 }} />)}
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>🚨 Alerts</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {counts.OPEN} active alert{counts.OPEN !== 1 ? 's' : ''} · Auto-refresh every 60s
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          className="btn-ghost"
          style={{ fontSize: '0.82rem', padding: '8px 16px' }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Filter tabs and Bulk Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => { setFilter(tab); setSelectedAlerts(new Set()); }}
              style={{
                padding: '7px 16px', borderRadius: 20,
                fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
                border: '1px solid',
                background: filter === tab ? 'var(--accent-subtle)' : 'var(--glass-bg)',
                borderColor: filter === tab ? 'var(--accent-border)' : 'var(--glass-border)',
                color: filter === tab ? 'var(--accent)' : 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}
            >
              {tab} <span style={{ opacity: 0.7, fontSize: '0.72rem', marginLeft: 4 }}>{counts[tab]}</span>
            </button>
          ))}
        </div>

        {selectedAlerts.size > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedAlerts.size} selected</span>
            <button
              className="btn-ghost"
              style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--danger)' }}
              onClick={() => setConfirmDialog({ type: 'bulk', title: 'Delete Selected Alerts', description: `Are you sure you want to permanently delete ${selectedAlerts.size} selected alert(s)?` })}
            >
              🗑️ Delete Selected
            </button>
          </div>
        )}
      </div>

      {/* Select All Checkbox */}
      {filtered.length > 0 && (
        <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <input 
            type="checkbox" 
            checked={selectedAlerts.size === filtered.length && filtered.length > 0} 
            onChange={toggleSelectAll} 
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Select All</span>
        </div>
      )}

      {/* Alert list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((alert) => {
          const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.LOW;
          return (
            <div
              key={alert.id}
              className="animate-slide-in"
              style={{
                padding: '18px 20px',
                borderRadius: 14,
                background: style.bg,
                border: `1px solid ${style.border}`,
              }}
            >
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ paddingTop: 2 }}>
                  <input 
                    type="checkbox" 
                    checked={selectedAlerts.has(alert.id)} 
                    onChange={() => toggleSelect(alert.id)}
                    style={{ cursor: 'pointer' }} 
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{
                        padding: '2px 9px', borderRadius: 12,
                        fontSize: '0.68rem', fontWeight: 700,
                        background: style.bg, color: style.color,
                        border: `1px solid ${style.border}`,
                      }}>
                        {style.label}
                      </span>
                      <span style={{
                        padding: '2px 9px', borderRadius: 12,
                        fontSize: '0.68rem', fontWeight: 600,
                        background: 'var(--glass-bg)', color: 'var(--text-muted)',
                        border: '1px solid var(--glass-border)',
                      }}>
                        {alert.status}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {alert.title}
                    </h3>
                    {alert.description && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {alert.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {alert.metricName && <span>📈 {alert.metricName}</span>}
                      {alert.source && <span>🔍 {alert.source}</span>}
                      <span>🕐 {new Date(alert.triggeredAt || Date.now()).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {alert.status === 'OPEN' && (
                        <button onClick={() => handleStatusUpdate(alert.id, 'ACKNOWLEDGED')} className="btn-ghost" style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                          Acknowledge
                        </button>
                      )}
                      {alert.status !== 'RESOLVED' && (
                        <button onClick={() => handleStatusUpdate(alert.id, 'RESOLVED')} className="btn-primary" style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'var(--success)', boxShadow: 'none' }}>
                          Resolve
                        </button>
                      )}
                    </div>
                    <button 
                      onClick={() => setConfirmDialog({ type: 'single', id: alert.id, title: 'Delete Alert', description: `Are you sure you want to permanently delete the alert "${alert.title}"?` })} 
                      className="btn-ghost" 
                      style={{ padding: '4px 8px', fontSize: '0.7rem', color: 'var(--danger)', alignSelf: 'flex-end' }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            No {filter.toLowerCase()} alerts
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            All systems are healthy. Keep monitoring!
          </p>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDialog}
        title={confirmDialog?.title || ''}
        description={confirmDialog?.description || ''}
        confirmText="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
