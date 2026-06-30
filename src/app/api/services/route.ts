import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { redisCache } from '@/lib/redis/cache';
import crypto from 'crypto';

const VICTORIA_METRICS_URL =
  process.env.INTERNAL_VICTORIA_METRICS_URL ||
  process.env.NEXT_PUBLIC_VICTORIA_METRICS_URL ||
  'http://localhost:8428';

// ─── Windows Service state codes ─────────────────────────────────────────────
const SERVICE_STATE: Record<string, number> = {
  'continue pending': 5,
  'pause pending':    6,
  'paused':           7,
  'running':          4,
  'start pending':    2,
  'stop pending':     3,
  'stopped':          1,
};

const SERVICE_STATE_NAME: Record<number, string> = {
  1: 'Stopped',
  2: 'Start Pending',
  3: 'Stop Pending',
  4: 'Running',
  5: 'Continue Pending',
  6: 'Pause Pending',
  7: 'Paused',
};

// ─── Windows Service start type codes ────────────────────────────────────────
const SERVICE_START_TYPE: Record<number, string> = {
  0: 'Boot',
  1: 'System',
  2: 'Automatic',
  3: 'Manual',
  4: 'Disabled',
};

/**
 * GET /api/services?instance=<ip>&exporterPort=<port>
 *
 * Fetches:
 *  1. windows_service_state{state="running"} — all actively running services
 *  2. windows_service_process               — maps service name → PID + start_time
 *  3. windows_service_info                  — start_type, run_as, path
 *
 * Since the windows_exporter process collector is not enabled, user-space app
 * processes (VSCode, Chrome, etc.) are fetched from the /api/processes endpoint
 * which calls Get-Process via the backend.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const instance  = searchParams.get('instance');
  const portParam = searchParams.get('exporterPort') || '9200';

  if (!instance) {
    return NextResponse.json(
      { success: false, message: 'Provide ?instance=<ip>' },
      { status: 400 }
    );
  }

  const addr = `${instance}:${portParam}`;
  const now  = Math.floor(Date.now() / 1000);

  // ── Cache key — 20-second window ─────────────────────────────────────────
  const cacheKey = `services:${crypto
    .createHash('md5')
    .update(`${addr}:${Math.floor(now / 20)}`)
    .digest('hex')}`;

  const cached = await redisCache.get<any>(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, fromCache: true, data: cached });
  }

  try {
    // Fetch all three metrics in parallel
    const [stateRes, procRes, infoRes] = await Promise.allSettled([
      // 1. Service state — one row per (service, state) — value=1 means that is the CURRENT state
      axios.get(`${VICTORIA_METRICS_URL}/api/v1/query`, {
        params: { query: `windows_service_state{instance="${addr}",state="running"}`, time: now },
        timeout: 8000,
      }),
      // 2. windows_service_process gives PID + timestamp for each running service
      axios.get(`${VICTORIA_METRICS_URL}/api/v1/query`, {
        params: { query: `windows_service_process{instance="${addr}"}`, time: now },
        timeout: 8000,
      }),
      // 3. Service info (start_type, run_as, path_name)
      axios.get(`${VICTORIA_METRICS_URL}/api/v1/query`, {
        params: { query: `windows_service_info{instance="${addr}"}`, time: now },
        timeout: 8000,
      }),
    ]);

    const getResult = (s: PromiseSettledResult<any>): any[] =>
      s.status === 'fulfilled' ? s.value.data?.data?.result || [] : [];

    const stateResults = getResult(stateRes);
    const procResults  = getResult(procRes);
    const infoResults  = getResult(infoRes);

    // ── Build lookups ───────────────────────────────────────────────────────
    // PID → start_time (unix epoch from windows_service_process value)
    const pidByService:       Record<string, number> = {};
    const startTimeByService: Record<string, number> = {};
    procResults.forEach((r: any) => {
      const name = (r.metric?.name || '').toLowerCase();
      const pid  = parseInt(r.metric?.process_id || '0', 10);
      const startTimestamp = parseFloat(r.value?.[1] || '0');
      pidByService[name]       = pid;
      startTimeByService[name] = startTimestamp;
    });

    // Info lookup
    const infoByName: Record<string, any> = {};
    infoResults.forEach((r: any) => {
      const name = (r.metric?.name || '').toLowerCase();
      infoByName[name] = {
        startType:   parseInt(r.metric?.start_type || '3', 10),
        runAs:       r.metric?.run_as || '',
        path:        r.metric?.path_name || r.metric?.image_path || '',
        displayName: r.metric?.display_name || '',
      };
    });

    // ── Build service list from running services ────────────────────────────
    // Each entry in stateResults with state="running" and value=1 is a running service
    const services: any[] = [];
    const seenNames = new Set<string>();

    stateResults.forEach((r: any) => {
      const isActive = r.value?.[1] === '1';
      if (!isActive) return;

      const labels      = r.metric || {};
      const name        = labels.name || '';
      const key         = name.toLowerCase();
      if (seenNames.has(key)) return;
      seenNames.add(key);

      const info          = infoByName[key] || {};
      const displayName   = info.displayName || labels.display_name || name;
      const startTypeNum  = info.startType ?? 3;
      const startTypeName = SERVICE_START_TYPE[startTypeNum] || 'Manual';

      const pid           = pidByService[key] ?? null;
      const startTime     = startTimeByService[key] ?? null;
      const uptimeSeconds = startTime && startTime > 0 ? now - startTime : null;

      services.push({
        type:           'Service',
        name,
        displayName,
        state:          'Running',
        stateCode:      4,
        startType:      startTypeName,
        startTypeCode:  startTypeNum,
        runAs:          info.runAs || '',
        processId:      pid,
        cpuPercent:     null,   // process collector not available
        memoryBytes:    null,
        memoryMB:       null,
        path:           info.path || '',
        uptimeSeconds,
      });
    });

    // Also include stopped / pending services from windows_service_state
    // (fetch the non-running states too, deduplicated by service name, showing
    //  the highest-priority state where value=1)
    const allStateRes = await axios.get(`${VICTORIA_METRICS_URL}/api/v1/query`, {
      params: { query: `windows_service_state{instance="${addr}"}`, time: now },
      timeout: 8000,
    }).catch(() => null);

    const allStateResults: any[] = allStateRes?.data?.data?.result || [];

    // Group by service name, pick the active state (value=1)
    const stoppedByName: Record<string, any> = {};
    allStateResults.forEach((r: any) => {
      const isActive = r.value?.[1] === '1';
      if (!isActive) return;
      const labels  = r.metric || {};
      const name    = labels.name || '';
      const key     = name.toLowerCase();
      if (seenNames.has(key)) return; // already added as running
      const stateStr = labels.state || 'unknown';
      const stateNum = SERVICE_STATE[stateStr] ?? 0;
      stoppedByName[key] = { name, stateStr, stateNum, labels };
    });

    Object.values(stoppedByName).forEach((entry: any) => {
      const { name, stateStr, stateNum, labels } = entry;
      const key         = name.toLowerCase();
      const info        = infoByName[key] || {};
      const displayName = info.displayName || labels.display_name || name;
      const startTypeNum  = info.startType ?? 3;
      const startTypeName = SERVICE_START_TYPE[startTypeNum] || 'Manual';

      services.push({
        type:           'Service',
        name,
        displayName,
        state:          SERVICE_STATE_NAME[stateNum] || stateStr,
        stateCode:      stateNum,
        startType:      startTypeName,
        startTypeCode:  startTypeNum,
        runAs:          info.runAs || '',
        processId:      null,
        cpuPercent:     null,
        memoryBytes:    null,
        memoryMB:       null,
        path:           info.path || '',
        uptimeSeconds:  null,
      });
    });

    // Sort: running first, then alphabetically
    services.sort((a, b) => {
      if (b.stateCode === 4 && a.stateCode !== 4) return 1;
      if (a.stateCode === 4 && b.stateCode !== 4) return -1;
      return a.displayName.localeCompare(b.displayName);
    });

    // ── Summary stats ───────────────────────────────────────────────────────
    const totalServices = services.length;
    const runningCount  = services.filter((s) => s.stateCode === 4).length;
    const stoppedCount  = services.filter((s) => s.stateCode === 1).length;
    const otherCount    = totalServices - runningCount - stoppedCount;

    const payload = {
      services,
      summary: {
        total:   totalServices,
        running: runningCount,
        stopped: stoppedCount,
        other:   otherCount,
        topCpu:  [],
        topMem:  [],
      },
      instance: addr,
      fetchedAt: new Date().toISOString(),
    };

    await redisCache.set(cacheKey, payload, 20);
    return NextResponse.json({ success: true, fromCache: false, data: payload });

  } catch (error: any) {
    console.warn('[services] VictoriaMetrics unavailable:', error.message);

    if (process.env.NODE_ENV !== 'production') {
      const mock = generateMockServices();
      return NextResponse.json({ success: true, mock: true, data: mock });
    }

    return NextResponse.json(
      { success: false, message: 'Metrics backend unavailable' },
      { status: 502 }
    );
  }
}

// ─── Mock data ────────────────────────────────────────────────────────────────
function generateMockServices() {
  const now = Date.now() / 1000;
  const mockServices = [
    { type: 'Service', name: 'wuauserv',    displayName: 'Windows Update',             state: 'Running', stateCode: 4, startType: 'Automatic', startTypeCode: 2, runAs: 'LocalSystem',     processId: 1234, cpuPercent: null, memoryMB: null, path: 'C:\\Windows\\System32\\svchost.exe',  uptimeSeconds: 7200 },
    { type: 'Service', name: 'windefend',   displayName: 'Windows Defender Antivirus', state: 'Running', stateCode: 4, startType: 'Automatic', startTypeCode: 2, runAs: 'LocalSystem',     processId: 2345, cpuPercent: null, memoryMB: null, path: 'C:\\ProgramData\\Microsoft\\Windows Defender\\Platform\\MsMpEng.exe', uptimeSeconds: 18000 },
    { type: 'Service', name: 'wsearch',     displayName: 'Windows Search',             state: 'Running', stateCode: 4, startType: 'Automatic', startTypeCode: 2, runAs: 'LocalSystem',     processId: 3456, cpuPercent: null, memoryMB: null, path: 'C:\\Windows\\System32\\SearchIndexer.exe', uptimeSeconds: 3600 },
    { type: 'Service', name: 'audiosrv',    displayName: 'Windows Audio',              state: 'Running', stateCode: 4, startType: 'Automatic', startTypeCode: 2, runAs: 'LocalService',    processId: 4567, cpuPercent: null, memoryMB: null, path: 'C:\\Windows\\System32\\svchost.exe',  uptimeSeconds: 86400 },
    { type: 'Service', name: 'spooler',     displayName: 'Print Spooler',              state: 'Running', stateCode: 4, startType: 'Automatic', startTypeCode: 2, runAs: 'LocalSystem',     processId: 5678, cpuPercent: null, memoryMB: null, path: 'C:\\Windows\\System32\\spoolsv.exe',  uptimeSeconds: 43200 },
    { type: 'Service', name: 'dnscache',    displayName: 'DNS Client',                 state: 'Running', stateCode: 4, startType: 'Automatic', startTypeCode: 2, runAs: 'NetworkService', processId: 6789, cpuPercent: null, memoryMB: null, path: 'C:\\Windows\\System32\\svchost.exe',  uptimeSeconds: 86000 },
    { type: 'Service', name: 'cryptsvc',    displayName: 'Cryptographic Services',     state: 'Running', stateCode: 4, startType: 'Automatic', startTypeCode: 2, runAs: 'NetworkService', processId: 7890, cpuPercent: null, memoryMB: null, path: 'C:\\Windows\\System32\\svchost.exe',  uptimeSeconds: 72000 },
    { type: 'Service', name: 'lmhosts',     displayName: 'TCP/IP NetBIOS Helper',      state: 'Running', stateCode: 4, startType: 'Manual',    startTypeCode: 3, runAs: 'LocalService',    processId: 8901, cpuPercent: null, memoryMB: null, path: 'C:\\Windows\\System32\\svchost.exe',  uptimeSeconds: 86400 },
    { type: 'Service', name: 'fax',         displayName: 'Fax',                        state: 'Stopped', stateCode: 1, startType: 'Manual',    startTypeCode: 3, runAs: 'LocalSystem',     processId: null, cpuPercent: null, memoryMB: null, path: 'C:\\Windows\\System32\\fxssvc.exe',   uptimeSeconds: null },
    { type: 'Service', name: 'remoteregistry', displayName: 'Remote Registry',         state: 'Stopped', stateCode: 1, startType: 'Disabled',  startTypeCode: 4, runAs: 'LocalService',    processId: null, cpuPercent: null, memoryMB: null, path: 'C:\\Windows\\System32\\svchost.exe',  uptimeSeconds: null },
  ];

  const running = mockServices.filter(s => s.stateCode === 4).length;
  const stopped = mockServices.filter(s => s.stateCode === 1).length;
  return {
    services: mockServices,
    summary: { total: mockServices.length, running, stopped, other: 0, topCpu: [], topMem: [] },
    instance: 'mock:9200',
    fetchedAt: new Date().toISOString(),
    isMock: true,
  };
}
