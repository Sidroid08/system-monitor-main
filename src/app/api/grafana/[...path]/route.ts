import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const GRAFANA_URL = process.env.INTERNAL_GRAFANA_URL || 'http://grafana:3000';
const JWT_SECRET = process.env.SESSION_SECRET || 'your-secret-key-change-in-production';

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(request, params.path);
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(request, params.path);
}

async function handleProxy(request: NextRequest, pathArray: string[]) {
  try {
    // Basic verification of the auth token cookie (or header)
    // To make this seamless, we extract the JWT from the token cookie or Authorization header.
    // We will extract it from the searchParams ?user=email or from a cookie.
    
    // Check search param first (for initial iframe load), then fallback to cookie (for subsequent API calls)
    let email = request.nextUrl.searchParams.get('sidroidUser');
    if (!email) {
      email = request.cookies.get('sidroid_user_email')?.value || null;
    }
    
    if (!email) {
      return NextResponse.json({ error: 'Unauthorized: No Sidroid User provided' }, { status: 401 });
    }

    const path = pathArray ? pathArray.join('/') : '';
    const searchParams = new URLSearchParams(request.nextUrl.searchParams);
    searchParams.delete('sidroidUser'); // Remove it before proxying to Grafana
    
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const targetUrl = `${GRAFANA_URL}/${path}${query}`;

    const headers = new Headers(request.headers);
    headers.set('X-Sidroid-User', email);
    
    // Tell Grafana not to compress to avoid manual decompression issues
    headers.delete('accept-encoding');
    
    // Ensure Grafana knows the original host so it generates correct absolute URLs
    if (request.headers.get('host')) {
      headers.set('Host', request.headers.get('host')!);
    }

    const init: RequestInit = {
      method: request.method,
      headers,
      redirect: 'manual',
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.blob();
    }

    const response = await fetch(targetUrl, init);
    
    const responseHeaders = new Headers(response.headers);
    
    // Remove these headers to prevent the browser from failing with ERR_CONTENT_DECODING_FAILED
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
    
    // Intercept redirect Location header and rewrite it
    if (responseHeaders.has('Location')) {
      const location = responseHeaders.get('Location')!;
      
      // Reconstruct actual client origin instead of Next.js internal Docker origin
      const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host');
      const protoHeader = request.headers.get('x-forwarded-proto') || 'http';
      const actualOrigin = hostHeader ? `${protoHeader}://${hostHeader}` : request.nextUrl.origin;
      
      // If Grafana redirects to http://grafana:3000/..., rewrite to Next.js origin
      if (location.startsWith(GRAFANA_URL)) {
        responseHeaders.set('Location', location.replace(GRAFANA_URL, actualOrigin));
      } else if (location.startsWith('http://localhost:3000')) {
        responseHeaders.set('Location', location.replace('http://localhost:3000', actualOrigin));
      } else if (location.startsWith('http://localhost:8769')) {
        responseHeaders.set('Location', location.replace('http://localhost:8769', actualOrigin));
      }
    }
    
    // Grafana sets cookies (grafana_session). Let them pass through so the iframe works.
    
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('Grafana proxy error:', error);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}
