import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

export type MetricType = 'cpu' | 'memory' | 'disk' | 'network_in' | 'network_out' | 'load';
export type Platform = 'LINUX' | 'WINDOWS';

interface MetricPoint { timestamp: number; value: number }

interface UseMetricOptions {
  metric: MetricType;
  instance?: string;      // IP address e.g. "10.0.0.5"
  platform?: Platform;
  rangeMinutes?: number;  // default 60
  stepSeconds?: number;   // default 60
  enabled?: boolean;
  refreshInterval?: number; // ms — default 30000
}

interface UseMetricResult {
  data: MetricPoint[];
  current: number | null;  // latest value
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  refetch: () => void;
}

export function useMetric({
  metric,
  instance,
  platform = 'LINUX',
  rangeMinutes = 60,
  stepSeconds = 60,
  enabled = true,
  refreshInterval = 30000,
}: UseMetricOptions): UseMetricResult {
  const { token } = useAuth();
  const [data, setData]         = useState<MetricPoint[]>([]);
  const [current, setCurrent]   = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true); setError(null);

    const now    = Math.floor(Date.now() / 1000);
    const start  = now - rangeMinutes * 60;
    const params = new URLSearchParams({
      metric,
      start: start.toString(),
      end:   now.toString(),
      step:  `${stepSeconds}s`,
      platform,
      ...(instance ? { instance } : {}),
    });

    try {
      const res = await window.fetch(`/api/metrics?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      setFromCache(!!json.fromCache);

      const result = json.data?.data?.result?.[0];
      if (result?.values) {
        const points: MetricPoint[] = result.values.map(([ts, v]: [number, string]) => ({
          timestamp: ts * 1000,
          value: parseFloat(v),
        }));
        setData(points);
        setCurrent(points.at(-1)?.value ?? null);
      } else {
        setData([]); setCurrent(null);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to fetch metrics');
      }
    } finally {
      setLoading(false);
    }
  }, [metric, instance, platform, rangeMinutes, stepSeconds, token, enabled]);

  // Initial fetch
  useEffect(() => { fetch(); }, [fetch]);

  // Auto-refresh
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(fetch, refreshInterval);
    return () => { clearInterval(id); abortRef.current?.abort(); };
  }, [fetch, refreshInterval, enabled]);

  return { data, current, loading, error, fromCache, refetch: fetch };
}

// ─── Multi-metric hook (fetches all 4 at once) ─────────────────────────────
interface UseInstanceMetricsResult {
  cpu:       UseMetricResult;
  memory:    UseMetricResult;
  disk:      UseMetricResult;
  networkIn: UseMetricResult;
}

export function useInstanceMetrics(
  instance?: string,
  platform: Platform = 'LINUX',
  enabled = true,
  refreshInterval = 30000,
): UseInstanceMetricsResult {
  const opts = { instance, platform, enabled, refreshInterval };
  return {
    cpu:       useMetric({ metric: 'cpu',        ...opts }),
    memory:    useMetric({ metric: 'memory',     ...opts }),
    disk:      useMetric({ metric: 'disk',       ...opts }),
    networkIn: useMetric({ metric: 'network_in', ...opts }),
  };
}
