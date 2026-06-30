import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/processes
 * Proxies to the Host Agent running natively on Windows (port 9201).
 * All aggregation, categorization, and display name mapping is done in host-agent.js.
 */
export async function GET(_req: NextRequest) {
  try {
    const res = await fetch('http://host.docker.internal:9201/api/processes', {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: `Host agent returned ${res.status}` },
        { status: res.status }
      );
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (err: any) {
    console.warn('[/api/processes] Host agent unreachable:', err.message);
    return NextResponse.json(
      {
        success: false,
        message: 'Host agent not reachable. Make sure host-agent.js is running: node host-agent.js',
      },
      { status: 502 }
    );
  }
}
