import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://cloud-ventur-backend:5000/api';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId') || '';
    const res = await fetch(`${API_URL}/alert-rules?orgId=${orgId}`, {
      headers: {
        Authorization: req.headers.get('Authorization') || '',
      },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  console.log('API POST /api/alert-rules hit!');
  try {
    const body = await req.json();
    console.log('Body:', body);
    console.log('Sending to:', `${API_URL}/alert-rules`);
    const res = await fetch(`${API_URL}/alert-rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.get('Authorization') || '',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
