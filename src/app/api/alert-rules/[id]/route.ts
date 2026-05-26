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
