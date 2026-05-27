import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://cloud-ventur-backend:5000/api';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = await fetch(`${API_URL}/alert-rules/${params.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: req.headers.get('Authorization') || '',
      },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const url = new URL(req.url);
    // Extract the sub-action from the URL path: /api/alert-rules/:id/pause or /resume
    const pathParts = url.pathname.split('/');
    const action = pathParts[pathParts.length - 1]; // 'pause' or 'resume'

    const res = await fetch(`${API_URL}/alert-rules/${params.id}/${action}`, {
      method: 'PATCH',
      headers: {
        Authorization: req.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
