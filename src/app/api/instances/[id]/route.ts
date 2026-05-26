import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { redisCache } from '@/lib/redis/cache';

const BACKEND = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const authHeaders = (req: NextRequest) => ({
  authorization: req.headers.get('authorization') || '',
  cookie: req.headers.get('cookie') || '',
  'content-type': 'application/json',
});

/** PATCH /api/instances/[id] — stop, start, or update an instance */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  try {
    const res = await axios.patch(`${BACKEND}/instances/${params.id}`, body, {
      headers: authHeaders(request),
      timeout: 5000,
    });
    // Invalidate org cache so list refreshes
    if (body.organizationId) {
      await redisCache.delete(`instances:org:${body.organizationId}`);
    }
    return NextResponse.json({ success: true, data: res.data?.data || res.data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.response?.data?.message || 'Failed to update instance' },
      { status: err?.response?.status || 500 }
    );
  }
}

/** DELETE /api/instances/[id] — permanently remove instance */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const orgId = request.nextUrl.searchParams.get('organizationId');
  try {
    await axios.delete(`${BACKEND}/instances/${params.id}`, {
      headers: authHeaders(request),
      timeout: 5000,
    });
    if (orgId) await redisCache.delete(`instances:org:${orgId}`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.response?.data?.message || 'Failed to delete instance' },
      { status: err?.response?.status || 500 }
    );
  }
}
