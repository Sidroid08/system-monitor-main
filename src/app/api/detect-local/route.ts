import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const BACKEND_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  // Support parameter mapping for easy manual testing on local host
  let clientIp = request.nextUrl.searchParams.get('mock_ip');
  
  if (!clientIp) {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      clientIp = forwardedFor.split(',')[0].trim();
    } else {
      clientIp = request.headers.get('x-real-ip') || '127.0.0.1';
    }
  }

  // Strip port if present in IP address (e.g. 127.0.0.1:3000)
  if (clientIp.includes(':')) {
    clientIp = clientIp.split(':')[0];
  }

  try {
    const response = await axios.get(`${BACKEND_API_URL}/instances`, {
      headers: {
        Authorization: authHeader,
      },
    });

    const instances = response.data?.data?.instances || [];

    // Find instance matching clientIp
    const matchedInstance = instances.find(
      (inst: any) =>
        (inst.publicIp && inst.publicIp === clientIp) ||
        (inst.privateIp && inst.privateIp === clientIp)
    );

    if (matchedInstance) {
      return NextResponse.json({
        success: true,
        detected: true,
        ip: clientIp,
        instance: matchedInstance,
      });
    }

    return NextResponse.json({
      success: true,
      detected: false,
      ip: clientIp,
      message: `No monitored instance found matching client IP: ${clientIp}`,
    });
  } catch (error: any) {
    console.error('Error in detect-local API:', error.message);
    return NextResponse.json(
      {
        success: false,
        message: error.response?.data?.message || 'Failed to detect local instance',
      },
      { status: error.response?.status || 500 }
    );
  }
}
