import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const BACKEND = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const res = await axios.post(`${BACKEND}/aws/${id}/sync`, {}, {
      headers: { authorization: request.headers.get('authorization') || '' },
      timeout: 30000, // sync can take a while
    });
    return NextResponse.json({ success: true, data: res.data?.data || res.data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.response?.data?.message || 'Sync failed' },
      { status: err?.response?.status || 500 }
    );
  }
}
