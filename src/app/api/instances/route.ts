import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { redisCache } from '@/lib/redis/cache';

const BACKEND = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// ── In-process fallback store (survives Next.js hot-reload within same process) ──
const instanceStore: Map<string, any[]> = new Map();

function getLocalInstances(orgId: string): any[] {
  return instanceStore.get(orgId) || [];
}

function saveLocalInstance(orgId: string, instance: any): any {
  const existing = instanceStore.get(orgId) || [];
  // upsert by instanceId
  const idx = existing.findIndex((i) => i.instanceId === instance.instanceId);
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...instance };
  } else {
    existing.push({ id: `local-${Date.now()}`, ...instance, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  instanceStore.set(orgId, existing);
  return existing[idx >= 0 ? idx : existing.length - 1];
}

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('organizationId');
  if (!orgId) return NextResponse.json({ success: false, message: 'organizationId required' }, { status: 400 });

  const cacheKey = `instances:org:${orgId}`;

  // Check Redis/memory cache (15s TTL)
  const cached = await redisCache.get<any>(cacheKey);
  if (cached) return NextResponse.json({ success: true, fromCache: true, data: cached });

  try {
    const res = await axios.get(`${BACKEND}/instances`, {
      params: { orgId },
      headers: {
        authorization: request.headers.get('authorization') || '',
        cookie: request.headers.get('cookie') || '',
      },
      timeout: 5000,
    });
    const data = res.data?.data || res.data;
    await redisCache.set(cacheKey, data, 15);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    // Backend is down – merge backend fallback with local in-process store
    const localInstances = getLocalInstances(orgId);
    const data = { instances: localInstances };
    return NextResponse.json({ success: true, data, offline: true });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const orgId = body.organizationId;

  try {
    const res = await axios.post(`${BACKEND}/instances`, body, {
      headers: {
        authorization: request.headers.get('authorization') || '',
        cookie: request.headers.get('cookie') || '',
        'content-type': 'application/json',
      },
      timeout: 5000,
    });
    // Invalidate cache on success
    await redisCache.delete(`instances:org:${orgId}`);
    return NextResponse.json({ success: true, data: res.data?.data || res.data }, { status: 201 });
  } catch (err: any) {
    // ── Backend offline fallback: persist in in-process store ──────────────────
    const isNetworkError =
      err?.code === 'ECONNREFUSED' ||
      err?.code === 'ENOTFOUND' ||
      err?.code === 'ETIMEDOUT' ||
      !err?.response;

    if (isNetworkError && orgId) {
      const instance = saveLocalInstance(orgId, {
        organizationId: orgId,
        instanceId:     body.instanceId || `local-${Date.now()}`,
        instanceName:   body.instanceName || null,
        hostname:       body.hostname || null,
        privateIp:      body.privateIp || null,
        publicIp:       body.publicIp || null,
        platform:       body.platform || 'LINUX',
        serviceType:    body.serviceType || 'BARE_METAL',
        region:         body.region || null,
        status:         body.status || 'RUNNING',
        exporterPort:   body.exporterPort ?? (body.platform === 'WINDOWS' ? 9200 : 9100),
        lastSeenAt:     new Date().toISOString(),
      });

      // Bust the GET cache so the new instance shows immediately
      await redisCache.delete(`instances:org:${orgId}`);

      return NextResponse.json(
        { success: true, data: instance, offline: true, message: 'Instance registered locally (backend offline)' },
        { status: 201 }
      );
    }

    // Real backend error (auth failure, validation, etc.)
    return NextResponse.json(
      { success: false, message: err?.response?.data?.message || 'Failed to register instance' },
      { status: err?.response?.status || 500 }
    );
  }
}
