import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { redisCache } from '@/lib/redis/cache';

const BACKEND = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('orgId');
  const status = request.nextUrl.searchParams.get('status'); // OPEN | ALL
  const cacheKey = `alerts:org:${orgId}:${status}`;

  const cached = await redisCache.get<any>(cacheKey);
  if (cached) return NextResponse.json({ success: true, fromCache: true, data: cached });

  try {
    const res = await axios.get(`${BACKEND}/alerts`, {
      params: { orgId, status },
      headers: { authorization: request.headers.get('authorization') || '' },
      timeout: 5000,
    });
    const data = res.data?.data || res.data;
    await redisCache.set(cacheKey, data, 30); // 30s cache for alerts
    return NextResponse.json({ success: true, data });
  } catch {
    // Return mock alerts so UI renders in dev
    const mock = {
      alerts: [
        { id: '1', title: 'High CPU Usage', description: 'CPU exceeded 90% on ec2-prod-01', severity: 'CRITICAL', status: 'OPEN', source: 'node_exporter', metricName: 'cpu_usage', triggeredAt: new Date().toISOString() },
        { id: '2', title: 'Memory Warning', description: 'Memory at 78% on dev-server', severity: 'HIGH', status: 'OPEN', source: 'node_exporter', metricName: 'memory_usage', triggeredAt: new Date(Date.now() - 300000).toISOString() },
      ],
    };
    return NextResponse.json({ success: true, data: mock, mock: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await axios.post(`${BACKEND}/alerts`, body, {
      headers: { authorization: request.headers.get('authorization') || '' },
      timeout: 5000,
    });
    return NextResponse.json(res.data);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
