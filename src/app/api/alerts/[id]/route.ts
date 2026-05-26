import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const BACKEND = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const res = await axios.patch(`${BACKEND}/alerts/${params.id}`, body, {
      headers: { authorization: request.headers.get('authorization') || '' },
      timeout: 5000,
    });
    return NextResponse.json(res.data);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = await axios.delete(`${BACKEND}/alerts/${params.id}`, {
      headers: { authorization: request.headers.get('authorization') || '' },
      timeout: 5000,
    });
    return NextResponse.json(res.data);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
