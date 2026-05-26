import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { redisCache } from '@/lib/redis/cache';

const BACKEND = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const cacheKey = `org:${id}`;
  const cached = await redisCache.get<any>(cacheKey);
  if (cached) return NextResponse.json({ success: true, fromCache: true, data: cached });

  try {
    const res = await axios.get(`${BACKEND}/org/${id}`, {
      headers: { authorization: request.headers.get('authorization') || '' },
      timeout: 5000,
    });
    const data = res.data?.data || res.data;
    await redisCache.set(cacheKey, data, 60); // org data changes rarely, cache 60s
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, message: 'Organization not found' }, { status: 404 });
  }
}
