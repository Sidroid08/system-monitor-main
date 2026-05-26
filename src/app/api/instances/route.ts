import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { redisCache } from '@/lib/redis/cache';

const BACKEND = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('organizationId');
  if (!orgId) return NextResponse.json({ success: false, message: 'organizationId required' }, { status: 400 });

  const cacheKey = `instances:org:${orgId}`;

  // Check Redis cache (15s TTL)
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
    // Return empty list so UI doesn't break
    return NextResponse.json({ success: true, data: { instances: [] }, mock: true });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  try {
    const res = await axios.post(`${BACKEND}/instances`, body, {
      headers: {
        authorization: request.headers.get('authorization') || '',
        cookie: request.headers.get('cookie') || '',
        'content-type': 'application/json',
      },
      timeout: 5000,
    });
    // Invalidate cache
    await redisCache.delete(`instances:org:${body.organizationId}`);
    return NextResponse.json({ success: true, data: res.data?.data || res.data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.response?.data?.message || 'Failed to register instance' },
      { status: err?.response?.status || 500 }
    );
  }
}
