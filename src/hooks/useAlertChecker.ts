'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

export interface AlertThresholds {
  cpu: number;    // % — 0 means disabled
  memory: number; // %
  disk: number;   // %
}

const DEFAULT_THRESHOLDS: AlertThresholds = { cpu: 80, memory: 85, disk: 90 };
const THRESHOLDS_KEY = 'sidroid-thresholds'; // localStorage key: { [instanceId]: AlertThresholds }

// ─── Threshold storage helpers ────────────────────────────────────────────────
export function getThresholds(instanceId: string): AlertThresholds {
  try {
    const all = JSON.parse(localStorage.getItem(THRESHOLDS_KEY) || '{}');
    return { ...DEFAULT_THRESHOLDS, ...(all[instanceId] || {}) };
  } catch { return DEFAULT_THRESHOLDS; }
}

export function setThresholds(instanceId: string, t: AlertThresholds) {
  try {
    const all = JSON.parse(localStorage.getItem(THRESHOLDS_KEY) || '{}');
    all[instanceId] = t;
    localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(all));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('storage'));
  } catch {}
}

// ─── Background alert checker ─────────────────────────────────────────────────
interface Instance {
  id: string;
  instanceName?: string;
  privateIp?: string;
  publicIp?: string;
  platform: 'LINUX' | 'WINDOWS';
  status: string;
  organizationId: string;
}

async function fetchCurrentMetric(
  metric: string,
  ip: string,
  platform: string,
  token: string
): Promise<number | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams({
      metric,
      instance: ip,
      platform,
      start: String(now - 300),
      end: String(now),
      step: '60s',
    });
    const res = await fetch(`/api/metrics?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const json = await res.json();
    const values = json.data?.data?.result?.[0]?.values;
    if (!values?.length) return null;
    return parseFloat(values[values.length - 1][1]);
  } catch { return null; }
}

async function fireAlert(
  organizationId: string,
  instanceId: string,
  instanceName: string,
  metric: string,
  value: number,
  threshold: number,
  token: string
) {
  const metricLabels: Record<string, string> = {
    cpu: 'CPU Usage', memory: 'Memory Usage', disk: 'Disk Usage',
  };
  const label = metricLabels[metric] || metric;
  try {
    await fetch('/api/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        organizationId,
        title: `⚠️ ${label} threshold exceeded on ${instanceName}`,
        description: `${label} is at ${value.toFixed(1)}%, which exceeds your configured threshold of ${threshold}%.`,
        severity: value >= threshold + 15 ? 'CRITICAL' : 'HIGH',
        source: 'threshold-checker',
        metricName: metric,
        instanceId,
      }),
    });
  } catch {}
}

/**
 * useAlertChecker — runs in the background and checks all RUNNING instances
 * against their configured thresholds every `intervalMs` (default 60s).
 */
export function useAlertChecker(intervalMs = 60_000) {
  const { token, user } = useAuth();
  const { addToast } = useToast();
  const firedRef = useRef<Set<string>>(new Set());
  const lastCheckTime = useRef<string>(new Date(Date.now() - intervalMs).toISOString());

  const check = useCallback(async () => {
    if (!token || !user?.organizationId) return;

    // 1. Fetch current instances for org
    let instances: Instance[] = [];
    try {
      const r = await fetch(`/api/instances?organizationId=${user.organizationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        const j = await r.json();
        instances = j.data?.instances || j.data || [];
      }
    } catch { return; }

    const running = instances.filter(i => i.status === 'RUNNING');
    for (const inst of running) {
      const ip = inst.privateIp || inst.publicIp;
      if (!ip) continue;
      const thresholds = getThresholds(inst.id);

      for (const metric of ['cpu', 'memory', 'disk'] as const) {
        const threshold = thresholds[metric];
        if (!threshold || threshold === 0) continue;

        const val = await fetchCurrentMetric(metric, ip, inst.platform, token);
        if (val === null || val < threshold) continue;

        // Cooldown: 1 minute (60_000 ms) instead of 1 hour to make testing easier
        const debounceKey = `${inst.id}:${metric}:${Math.floor(Date.now() / 60_000)}`;
        if (firedRef.current.has(debounceKey)) continue;
        firedRef.current.add(debounceKey);

        const name = inst.instanceName || inst.id;
        await fireAlert(inst.organizationId, inst.id, name, metric, val, threshold, token);

        addToast({
          title: `⚠️ ${name} — ${metric.toUpperCase()} Alert`,
          description: `${metric.toUpperCase()} is at ${val.toFixed(1)}% (threshold: ${threshold}%)`,
          type: 'warning',
        });
      }
    }

    // 3. Poll for new DB Alerts (e.g. from backend email evaluator)
    try {
      const ar = await fetch(`/api/alerts?organizationId=${user.organizationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (ar.ok) {
        const aj = await ar.json();
        const dbAlerts = aj.data?.alerts || aj.data || [];
        const newAlerts = dbAlerts.filter((a: any) => new Date(a.createdAt) > new Date(lastCheckTime.current));
        for (const alert of newAlerts) {
          if (alert.source !== 'threshold-checker') { // avoid duplicate toasts for local ones
            addToast({
              title: `📧 ${alert.title}`,
              description: alert.description,
              type: 'error',
            });
          }
        }
      }
      lastCheckTime.current = new Date().toISOString();
    } catch {}

  }, [token, user, addToast]);

  useEffect(() => {
    if (!token) return;
    check();
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [check, intervalMs, token]);
}
