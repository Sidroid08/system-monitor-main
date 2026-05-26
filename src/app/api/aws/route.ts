import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { redisCache } from '@/lib/redis/cache';

const BACKEND = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('organizationId');
  const cacheKey = `aws:org:${orgId}`;
  const cached = await redisCache.get<any>(cacheKey);
  if (cached) return NextResponse.json({ success: true, fromCache: true, data: cached });

  try {
    const res = await axios.get(`${BACKEND}/aws`, {
      params: { organizationId: orgId },
      headers: { authorization: request.headers.get('authorization') || '' },
      timeout: 5000,
    });
    const data = res.data?.data || res.data;
    await redisCache.set(cacheKey, data, 30);
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: true, data: [], mock: true });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  try {
    const res = await axios.post(`${BACKEND}/aws`, body, {
      headers: {
        authorization: request.headers.get('authorization') || '',
        'content-type': 'application/json',
      },
      timeout: 5000,
    });
    await redisCache.delete(`aws:org:${body.organizationId}`);
    return NextResponse.json({ success: true, data: res.data?.data || res.data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.response?.data?.message || 'Failed to add AWS account' },
      { status: err?.response?.status || 500 }
    );
  }
}
