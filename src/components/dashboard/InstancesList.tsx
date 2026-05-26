'use client';

import React, { useEffect, useState } from 'react';
import { MonitoredInstance } from '@/types';
import ConfirmModal from '@/components/ConfirmModal';
import { getThresholds, setThresholds, AlertThresholds } from '@/hooks/useAlertChecker';
import { useToast } from '@/context/ToastContext';

interface InstancesListProps {
  organizationId?: string;
  instances?: MonitoredInstance[];
  onInstanceUpdated?: () => void;
}

const statusConfig: Record<string, { dot: string; badge: string; label: string }> = {
  RUNNING:    { dot: 'status-dot-active',  badge: 'badge-success', label: 'Running'    },
  STOPPED:    { dot: 'status-dot-warning', badge: 'badge-warning', label: 'Stopped'    },
  TERMINATED: { dot: 'status-dot-danger',  badge: 'badge-danger',  label: 'Terminated' },
  UNKNOWN:    { dot: 'status-dot-offline', badge: 'badge-muted',   label: 'Unknown'    },
};

function formatRepeatInterval(seconds?: number): string {
  const s = seconds ?? 300;
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export default function InstancesList({ organizationId, instances: propsInstances, onInstanceUpdated }: InstancesListProps) {
  const { addToast } = useToast();
  const [internalInstances, setInternalInstances] = useState<MonitoredInstance[]>([]);
  const [alertRules, setAlertRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(!propsInstances);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Email Alerts state
  const [emailModal, setEmailModal] = useState<MonitoredInstance | null>(null);
  const [emailForm, setEmailForm] = useState<{ metrics: string[], threshold: number, alertType: string, emails: string, repeatInterval: number }>({ metrics: ['cpu'], threshold: 80, alertType: 'BOTH', emails: '', repeatInterval: 300 });
  const [savingEmailRule, setSavingEmailRule] = useState(false);

  // Web (Local) Alerts state
  const [webModal, setWebModal] = useState<MonitoredInstance | null>(null);
  const [webForm, setWebForm] = useState<AlertThresholds>({ cpu: 0, memory: 0, disk: 0 });

  // Delete instance confirm
  const [confirmDialog, setConfirmDialog] = useState<MonitoredInstance | null>(null);

  // Delete rule confirm
  const [confirmRuleDelete, setConfirmRuleDelete] = useState<string | null>(null);

  // Expanded instances for showing email rules
  const [expandedInstance, setExpandedInstance] = useState<string | null>(null);

  const instances = propsInstances || internalInstances;

  const fetchInstancesAndRules = () => {
    if (!organizationId && !propsInstances) return;
    const token = localStorage.getItem('auth_token') || '';
    
    Promise.allSettled([
      fetch(`/api/instances?organizationId=${organizationId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`/api/alert-rules?orgId=${organizationId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ])
    .then(([instResult, rulesResult]) => {
      if (instResult.status === 'fulfilled') {
        const instRes = instResult.value;
        setInternalInstances(instRes.data?.instances || instRes.data || []);
      }
      if (rulesResult.status === 'fulfilled') {
        const rulesRes = rulesResult.value;
        setAlertRules(rulesRes.data?.rules || []);
      }
    })
    .catch(() => {})
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!propsInstances || alertRules.length === 0) fetchInstancesAndRules();
  }, [organizationId, propsInstances]);

  const handleAction = async (id: string, action: 'start' | 'stop' | 'terminate') => {
    if (action === 'terminate') {
      const inst = instances.find(i => i.id === id);
      if (inst) setConfirmDialog(inst);
      return;
    }
    await executeAction(id, action);
  };

  const executeAction = async (id: string, action: 'start' | 'stop' | 'terminate') => {
    setActionLoading(`${id}-${action}`);
    try {
      const token = localStorage.getItem('auth_token') || '';
      if (action === 'terminate') {
        await fetch(`/api/instances/${id}?organizationId=${organizationId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await fetch(`/api/instances/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: action === 'start' ? 'RUNNING' : 'STOPPED', organizationId }),
        });
      }
      if (onInstanceUpdated) onInstanceUpdated();
      fetchInstancesAndRules();
    } catch (err) {
      addToast({ title: 'Action Failed', description: 'Failed to perform action on instance.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const openWebAlerts = (inst: MonitoredInstance) => {
    setWebForm(getThresholds(inst.id));
    setWebModal(inst);
  };

  const saveWebAlerts = (e: React.FormEvent) => {
    e.preventDefault();
    if (webModal) {
      setThresholds(webModal.id, webForm);
      setWebModal(null);
      addToast({ title: '🔔 Web Alerts Saved', description: `Notification thresholds updated for ${webModal.instanceName || webModal.instanceId}.`, type: 'success' });
    }
  };

  const openEmailAlerts = (inst: MonitoredInstance) => {
    setEmailForm({ metrics: ['cpu'], threshold: 80, alertType: 'BOTH', emails: '', repeatInterval: 300 });
    setEmailModal(inst);
  };

  const saveEmailAlerts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailModal) {
      if (emailForm.metrics.length === 0) {
        addToast({ title: 'Validation Error', description: 'Please select at least one metric.', type: 'warning' });
        return;
      }
      setSavingEmailRule(true);
      try {
        const token = localStorage.getItem('auth_token') || '';
        const results = await Promise.all(emailForm.metrics.map(async metric => {
          const res = await fetch('/api/alert-rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              instanceId: emailModal.id,
              metric: metric,
              threshold: emailForm.threshold,
              alertType: emailForm.alertType,
              emails: emailForm.emails,
              repeatInterval: emailForm.repeatInterval,
            })
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || 'Failed to create alert rule');
          }
          return res.json();
        }));

        const hasGrafanaSuccess = results.some(r => r.grafanaStatus?.success);
        const hasGrafanaError = results.some(r => r.grafanaStatus && !r.grafanaStatus.success);
        const grafanaErrorMsg = results.find(r => r.grafanaStatus && !r.grafanaStatus.success)?.grafanaStatus?.message;

        if (hasGrafanaError) {
          addToast({ title: '⚠️ Partial Success', description: `Rules saved to DB, but Grafana sync failed: ${grafanaErrorMsg}`, type: 'warning' });
        } else if (hasGrafanaSuccess) {
          addToast({ title: '📧 Alert Rules Configured', description: `${emailForm.metrics.length} rule(s) set for ${emailModal.instanceName || emailModal.instanceId} and synced to Grafana successfully!`, type: 'success' });
        } else {
          addToast({ title: '📧 Alert Rules Created', description: `${emailForm.metrics.length} rule(s) set for ${emailModal.instanceName || emailModal.instanceId}. (Custom Engine only)`, type: 'success' });
        }

        setEmailModal(null);
        fetchInstancesAndRules();
      } catch (err: any) {
        addToast({ title: 'Failed to Create Rules', description: err.message || 'Could not create email alert rules. Please try again.', type: 'error' });
      } finally {
        setSavingEmailRule(false);
      }
    }
  };

  const deleteRule = async (ruleId: string) => {
    setConfirmRuleDelete(ruleId);
  };

  const executeDeleteRule = async (ruleId: string) => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      await fetch(`/api/alert-rules/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast({ title: '🗑️ Rule Deleted', description: 'Email alert rule has been removed.', type: 'success' });
      fetchInstancesAndRules();
    } catch {
      addToast({ title: 'Delete Failed', description: 'Could not delete the alert rule. Please try again.', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="glass-card animate-fade-in" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--glass-border)' }}>
          <div className="skeleton" style={{ height: 16, width: 160 }} />
        </div>
        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 40 }} />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="glass-card animate-slide-in" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Monitored Instances</h2>
            <span className="badge badge-accent">{instances.length}</span>
          </div>
        </div>

        {instances.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  {['Name / ID', 'IP Address', 'Platform', 'Status', 'Email Rules', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {instances.map(inst => {
                  const st = statusConfig[inst.status] || statusConfig.UNKNOWN;
                  const isActionLoading = actionLoading?.startsWith(inst.id);
                  const instRules = alertRules.filter(r => r.instanceId === inst.id);
                  const isExpanded = expandedInstance === inst.id;
                  
                  return (
                    <React.Fragment key={inst.id}>
                      <tr
                        style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{inst.instanceName || inst.instanceId}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <code style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>{inst.publicIp || inst.privateIp || '—'}</code>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`badge ${inst.platform === 'WINDOWS' ? 'badge-warning' : 'badge-accent'}`}>
                            {inst.platform === 'WINDOWS' ? '🪟' : '🐧'} {inst.platform}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`badge ${st.badge}`}><span className={`status-dot ${st.dot}`} />{st.label}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button onClick={() => setExpandedInstance(isExpanded ? null : inst.id)} className="badge badge-accent" style={{ background: 'transparent', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>
                            {instRules.length} Rules {isExpanded ? '▲' : '▼'}
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px', display: 'flex', gap: 6 }}>
                          <button onClick={() => openWebAlerts(inst)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.7rem' }} title="Web UI Alerts (Local)">
                            🔔
                          </button>
                          <button onClick={() => openEmailAlerts(inst)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.7rem' }} title="Email Alerts (DB)">
                            📧
                          </button>
                          {inst.status === 'STOPPED' ? (
                            <button onClick={() => handleAction(inst.id, 'start')} disabled={isActionLoading} className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.7rem', color: 'var(--success)' }}>▶️ Start</button>
                          ) : (
                            <button onClick={() => handleAction(inst.id, 'stop')} disabled={isActionLoading} className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.7rem', color: 'var(--warning)' }}>⏸️ Stop</button>
                          )}
                          <button onClick={() => handleAction(inst.id, 'terminate')} disabled={isActionLoading} className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.7rem', color: 'var(--danger)' }} title="Terminate (Delete forever)">🗑️</button>
                        </td>
                      </tr>
                      {isExpanded && instRules.length > 0 && (
                        <tr style={{ background: 'var(--glass-bg)', borderBottom: '1px solid var(--glass-border)' }}>
                          <td colSpan={6} style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Configured Email Rules for {inst.instanceName || inst.id}</h4>
                              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                                {instRules.map(rule => (
                                  <div key={rule.id} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{rule.metric.toUpperCase()} &gt; {rule.threshold}%</div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>To: {rule.emails}</div>
                                      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>Engine: {rule.alertType}</span>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>·</span>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--warning, #f97316)' }}>Every {formatRepeatInterval(rule.repeatInterval)}</span>
                                      </div>
                                    </div>
                                    <button onClick={() => deleteRule(rule.id)} className="btn-ghost" style={{ color: 'var(--danger)', padding: '4px 8px' }}>🗑️ Delete</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, fontSize: '0.9rem' }}>No instances registered</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>Connect an AWS account or install an agent to start monitoring.</p>
          </div>
        )}
      </div>

      {/* Web UI Alerts Modal (The original one) */}
      {webModal && (
        <div className="modal-overlay" onClick={() => setWebModal(null)}>
          <div className="modal-box animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>🔔 Web Notification Thresholds</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>Set local UI toast alerts for <strong>{webModal.instanceName || webModal.instanceId}</strong>.</p>
            <form onSubmit={saveWebAlerts} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(['cpu', 'memory', 'disk'] as const).map(metric => (
                <div key={metric}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {metric.toUpperCase()} Exceeds (%) <span style={{ color: 'var(--text-muted)' }}>(0 to disable)</span>
                  </label>
                  <input
                    type="number" className="input-glass" min="0" max="100" required
                    value={webForm[metric]}
                    onChange={e => setWebForm(p => ({ ...p, [metric]: +e.target.value }))}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>💾 Save Web Alerts</button>
                <button type="button" onClick={() => setWebModal(null)} className="btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Alerts Modal (The new one) */}
      {emailModal && (
        <div className="modal-overlay" onClick={() => setEmailModal(null)}>
          <div className="modal-box animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>📧 Create Email Alert Rule</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>Set persistent email alerts for <strong>{emailModal.instanceName || emailModal.instanceId}</strong>.</p>
            <form onSubmit={saveEmailAlerts} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Metrics (Select Multiple)</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  {['cpu', 'memory', 'disk'].map(m => (
                    <label key={m} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input 
                        type="checkbox" 
                        checked={emailForm.metrics.includes(m)}
                        onChange={(e) => setEmailForm(p => ({ ...p, metrics: e.target.checked ? [...p.metrics, m] : p.metrics.filter(x => x !== m) }))}
                      />
                      {m.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Threshold Exceeds (%)</label>
                <input type="number" className="input-glass" min="0" max="100" required value={emailForm.threshold} onChange={e => setEmailForm(p => ({ ...p, threshold: +e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Evaluation Engine</label>
                <select className="input-glass" value={emailForm.alertType} onChange={e => setEmailForm(p => ({ ...p, alertType: e.target.value }))}>
                  <option value="BOTH">Both (Grafana Native + Sidroid Custom)</option>
                  <option value="GRAFANA">Grafana Native Alerts</option>
                  <option value="CUSTOM">Sidroid Custom Evaluator</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Alert Repeat Frequency</label>
                <select className="input-glass" value={emailForm.repeatInterval} onChange={e => setEmailForm(p => ({ ...p, repeatInterval: +e.target.value }))}>
                  <option value={20}>Every 20 seconds</option>
                  <option value={30}>Every 30 seconds</option>
                  <option value={60}>Every 1 minute</option>
                  <option value={300}>Every 5 minutes</option>
                  <option value={600}>Every 10 minutes</option>
                  <option value={900}>Every 15 minutes</option>
                  <option value={1800}>Every 30 minutes</option>
                  <option value={3600}>Every 1 hour</option>
                </select>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>How often to re-send the alert email while the threshold is continuously exceeded.</p>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Notify Emails (comma separated)</label>
                <input type="text" className="input-glass" placeholder="e.g. admin@sidroid.com" required value={emailForm.emails} onChange={e => setEmailForm(p => ({ ...p, emails: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="submit" disabled={savingEmailRule} className="btn-primary" style={{ flex: 1 }}>{savingEmailRule ? 'Saving...' : '🚀 Create Email Rules'}</button>
                <button type="button" onClick={() => setEmailModal(null)} className="btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDialog}
        title="Delete Instance"
        description={`Are you sure you want to permanently delete ${confirmDialog?.instanceName || confirmDialog?.instanceId}?`}
        confirmText="Delete Forever"
        onConfirm={() => confirmDialog && executeAction(confirmDialog.id, 'terminate')}
        onCancel={() => setConfirmDialog(null)}
      />

      <ConfirmModal
        isOpen={!!confirmRuleDelete}
        title="Delete Alert Rule"
        description="Are you sure you want to delete this email alert rule? This action cannot be undone."
        confirmText="Delete Rule"
        onConfirm={() => { if (confirmRuleDelete) { executeDeleteRule(confirmRuleDelete); setConfirmRuleDelete(null); } }}
        onCancel={() => setConfirmRuleDelete(null)}
      />
    </>
  );
}
