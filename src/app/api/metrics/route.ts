import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { redisCache } from '@/lib/redis/cache';
import crypto from 'crypto';

const BACKEND_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
// INTERNAL_VICTORIA_METRICS_URL uses Docker internal network (victoriametrics:8428)
// NEXT_PUBLIC_ variant is localhost:8767 which doesn't resolve inside the container
const VICTORIA_METRICS_URL = process.env.INTERNAL_VICTORIA_METRICS_URL || process.env.NEXT_PUBLIC_VICTORIA_METRICS_URL || 'http://localhost:8428';

// ─── Platform-aware PromQL builders ────────────────────────────────────────
export function buildPromQL(metric: string, instance: string, platform: 'LINUX' | 'WINDOWS'): string {
  const win = platform === 'WINDOWS';
  const port = win ? '9200' : '9100';
  const addr = `${instance}:${port}`;

  switch (metric) {
    case 'cpu':
      return win
        ? `100 - (avg(rate(windows_cpu_time_total{mode="idle",instance="${addr}"}[5m])) * 100)`
        : `100 - (avg(irate(node_cpu_seconds_total{mode="idle",instance="${addr}"}[5m])) * 100)`;

    case 'memory':
      return win
        // windows_exporter v0.31+ uses windows_memory_* (not windows_os_/windows_cs_)
        ? `(1 - (windows_memory_available_bytes{instance="${addr}"} / windows_memory_physical_total_bytes{instance="${addr}"})) * 100`
        : `100 - ((node_memory_MemAvailable_bytes{instance="${addr}"} / node_memory_MemTotal_bytes{instance="${addr}"}) * 100)`;

    case 'disk':
      return win
        ? `100 - ((windows_logical_disk_free_bytes{instance="${addr}",volume!="HarddiskVolume*"} / windows_logical_disk_size_bytes{instance="${addr}",volume!="HarddiskVolume*"}) * 100)`
        : `100 - ((node_filesystem_avail_bytes{instance="${addr}",mountpoint="/",fstype!="tmpfs"} / node_filesystem_size_bytes{instance="${addr}",mountpoint="/",fstype!="tmpfs"}) * 100)`;

    case 'network_in':
      return win
        ? `rate(windows_net_bytes_received_total{instance="${addr}"}[5m])`
        : `rate(node_network_receive_bytes_total{instance="${addr}",device!~"lo|veth.*"}[5m])`;

    case 'network_out':
      return win
        ? `rate(windows_net_bytes_sent_total{instance="${addr}"}[5m])`
        : `rate(node_network_transmit_bytes_total{instance="${addr}",device!~"lo|veth.*"}[5m])`;

    case 'load':
      return win
        ? `windows_system_processor_queue_length{instance="${addr}"}`
        : `node_load1{instance="${addr}"}`;

    default:
      return metric; // raw PromQL passthrough
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  // Auth check (skip in dev if no token)
  if (authHeader) {
    try {
      await axios.get(`${BACKEND_API_URL}/auth/me`, {
        headers: { Authorization: authHeader },
        timeout: 3000,
      });
    } catch {
      // In dev, tolerate auth failures to allow local testing
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }
    }
  }

  const searchParams = request.nextUrl.searchParams;
  const rawQuery  = searchParams.get('query');
  const metric    = searchParams.get('metric');        // named metric shortcut
  const instance  = searchParams.get('instance');     // IP of the target
  const platform  = (searchParams.get('platform') || 'LINUX') as 'LINUX' | 'WINDOWS';
  const start     = searchParams.get('start');
  const end       = searchParams.get('end');
  const step      = searchParams.get('step') || '60s';
  const instant   = searchParams.get('instant') === 'true'; // instant vs range

  // Build the final PromQL
  let query = rawQuery;
  if (metric && instance) {
    query = buildPromQL(metric, instance, platform);
  }

  if (!query || !start || !end) {
    return NextResponse.json(
      { success: false, message: 'Provide (query|metric+instance), start, end' },
      { status: 400 }
    );
  }

  // Redis cache key
  const cacheKey = `metrics:${crypto.createHash('md5').update(`${query}:${start}:${end}:${step}`).digest('hex')}`;

  try {
    // Check cache first (Redis → in-memory fallback, built into redisCache)
    const cached = await redisCache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, fromCache: true, data: cached });
    }

    // Query VictoriaMetrics
    const endpoint = instant
      ? `${VICTORIA_METRICS_URL}/api/v1/query`
      : `${VICTORIA_METRICS_URL}/api/v1/query_range`;

    const params = instant
      ? { query, time: end }
      : { query, start, end, step };

    const vmRes = await axios.get(endpoint, { params, timeout: 8000 });
    const data = vmRes.data;

    // Cache for 15 s (metrics are near-realtime, Redis TTL)
    await redisCache.set(cacheKey, data, 15);

    return NextResponse.json({ success: true, fromCache: false, data });

  } catch (error: any) {
    console.warn('[metrics] VictoriaMetrics unavailable:', error.message);

    // Return mock data in development so UI still renders
    if (process.env.NODE_ENV !== 'production') {
      const mock = generateMockMetrics(query, parseFloat(start!), parseFloat(end!), step);
      await redisCache.set(cacheKey, mock, 5);
      return NextResponse.json({ success: true, mock: true, data: mock });
    }

    return NextResponse.json({ success: false, message: 'Metrics backend unavailable' }, { status: 502 });
  }
}

// ─── Mock generator for dev mode ────────────────────────────────────────────
function generateMockMetrics(query: string, start: number, end: number, step: string) {
  let stepSec = 60;
  if (step.endsWith('s')) stepSec = parseInt(step) || 60;
  else if (step.endsWith('m')) stepSec = (parseInt(step) || 1) * 60;

  const points: [number, string][] = [];
  for (let t = start; t <= end; t += stepSec) {
    let v = 30;
    if (query.includes('cpu'))       v = 20 + Math.sin(t / 3600) * 15 + Math.random() * 10;
    else if (query.includes('mem'))  v = 55 + Math.cos(t / 7200) * 8  + Math.random() * 3;
    else if (query.includes('disk')) v = 60 + (t - start) / (end - start) * 2;
    else if (query.includes('net'))  v = 200 + Math.sin(t / 900) * 150 + Math.random() * 50;
    else if (query.includes('load')) v = 0.5 + Math.random() * 2;
    else v = Math.random() * 80 + 10;

    v = Math.max(0, Math.min(query.includes('net') || query.includes('load') ? 9999 : 100, v));
    points.push([t, v.toFixed(2)]);
  }

  return {
    status: 'success',
    data: {
      resultType: 'matrix',
      result: [{
        metric: { __name__: query.split('{')[0], instance: 'mock:9100', job: 'node-exporter' },
        values: points,
      }],
    },
  };
}
