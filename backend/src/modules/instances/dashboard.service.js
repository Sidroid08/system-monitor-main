import axios from 'axios';

const GRAFANA_URL = process.env.INTERNAL_GRAFANA_URL || 'http://grafana:3000';
const GRAFANA_AUTH = Buffer.from('admin:admin123').toString('base64');
const GRAFANA_FOLDER_NAME = 'Sidroid Monitoring';

let _cachedFolderUid = null;

const grafana = axios.create({
  baseURL: GRAFANA_URL,
  headers: {
    Authorization: `Basic ${GRAFANA_AUTH}`,
    'Content-Type': 'application/json',
    'X-Disable-Provenance': 'true',
  },
  timeout: 10000,
});

async function ensureGrafanaFolder() {
  if (_cachedFolderUid) return _cachedFolderUid;

  try {
    const { data: folders } = await grafana.get('/api/folders?limit=1000');
    const existing = folders.find(f => f.title === GRAFANA_FOLDER_NAME);
    if (existing) {
      _cachedFolderUid = existing.uid;
      return _cachedFolderUid;
    }
  } catch (e) {
    console.warn('[DashboardService] Could not list folders:', e.message);
  }

  try {
    const { data: created } = await grafana.post('/api/folders', { title: GRAFANA_FOLDER_NAME });
    _cachedFolderUid = created.uid;
    return _cachedFolderUid;
  } catch (e) {
    if (e.response?.status === 409) {
      const { data: folders } = await grafana.get('/api/folders?limit=1000');
      const existing = folders.find(f => f.title === GRAFANA_FOLDER_NAME);
      if (existing) {
        _cachedFolderUid = existing.uid;
        return _cachedFolderUid;
      }
    }
    throw new Error(`Failed to create Grafana folder: ${e.message}`);
  }
}

/**
 * Build a platform-aware Grafana dashboard for this specific instance.
 * Windows → only windows_* PromQL (aggregated to single series).
 * Linux  → only node_* PromQL (aggregated to single series).
 * This ensures exactly ONE line per panel per instance.
 */
function buildInstanceDashboard(instance) {
  const ip = instance.privateIp || instance.publicIp || '';
  const name = instance.instanceName || instance.instanceId;
  const uid = `inst-${instance.id.replace(/-/g, '').substring(0, 12)}`;
  const orgId = instance.organizationId;
  const isWindows = (instance.platform || '').toUpperCase() === 'WINDOWS';

  // Scoped to this specific instance IP + org
  const f = ip
    ? `instance=~".*${ip}.*", organization_id=~"${orgId}"`
    : `organization_id=~"${orgId}"`;

  // Panel colour: one fixed colour per dashboard so it's obvious which instance you're on
  const lineColor = isWindows ? '#5794F2' : '#73BF69';

  // Define panels in a compact declarative style, expand below
  const panelDefs = isWindows
    ? [
        {
          id: 1, title: 'CPU Usage (%)', unit: 'percent',
          gridPos: { h: 8, w: 12, x: 0, y: 0 },
          // avg across all cores → single line
          expr: `100 - (avg by (instance) (rate(windows_cpu_time_total{mode="idle",${f}}[5m])) * 100)`,
        },
        {
          id: 2, title: 'Memory Usage (%)', unit: 'percent',
          gridPos: { h: 8, w: 12, x: 12, y: 0 },
          expr: `(1 - (windows_memory_available_bytes{${f}} / windows_memory_physical_total_bytes{${f}})) * 100`,
        },
        {
          id: 3, title: 'Disk Usage (%) — C:\\', unit: 'percent',
          gridPos: { h: 8, w: 8, x: 0, y: 8 },
          // Only C: drive — keeps it to exactly 1 series
          expr: `100 - ((windows_logical_disk_free_bytes{volume="C:",${f}} / windows_logical_disk_size_bytes{volume="C:",${f}}) * 100)`,
        },
        {
          id: 4, title: 'Network In (total)', unit: 'Bps',
          gridPos: { h: 8, w: 8, x: 8, y: 8 },
          // Sum all non-loopback NICs → single total line
          expr: `sum by (instance) (rate(windows_net_bytes_received_total{nic!~"isatap.*|Local.*|Loopback.*",${f}}[5m]))`,
        },
        {
          id: 5, title: 'Network Out (total)', unit: 'Bps',
          gridPos: { h: 8, w: 8, x: 16, y: 8 },
          expr: `sum by (instance) (rate(windows_net_bytes_sent_total{nic!~"isatap.*|Local.*|Loopback.*",${f}}[5m]))`,
        },
      ]
    : [
        {
          id: 1, title: 'CPU Usage (%)', unit: 'percent',
          gridPos: { h: 8, w: 12, x: 0, y: 0 },
          expr: `100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle",${f}}[5m])) * 100)`,
        },
        {
          id: 2, title: 'Memory Usage (%)', unit: 'percent',
          gridPos: { h: 8, w: 12, x: 12, y: 0 },
          expr: `100 - ((node_memory_MemAvailable_bytes{${f}} / node_memory_MemTotal_bytes{${f}}) * 100)`,
        },
        {
          id: 3, title: 'Disk Usage (%) — /', unit: 'percent',
          gridPos: { h: 8, w: 8, x: 0, y: 8 },
          expr: `100 - ((node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs",${f}} / node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs",${f}}) * 100)`,
        },
        {
          id: 4, title: 'Network In (total)', unit: 'Bps',
          gridPos: { h: 8, w: 8, x: 8, y: 8 },
          expr: `sum by (instance) (rate(node_network_receive_bytes_total{device!~"lo|veth.*",${f}}[5m]))`,
        },
        {
          id: 5, title: 'Network Out (total)', unit: 'Bps',
          gridPos: { h: 8, w: 8, x: 16, y: 8 },
          expr: `sum by (instance) (rate(node_network_transmit_bytes_total{device!~"lo|veth.*",${f}}[5m]))`,
        },
      ];

  const panels = panelDefs.map((p) => ({
    id: p.id,
    title: p.title,
    type: 'timeseries',
    datasource: { type: 'prometheus', uid: 'victoriametrics' },
    gridPos: p.gridPos,
    fieldConfig: {
      defaults: {
        color: { mode: 'fixed', fixedColor: lineColor },
        custom: {
          drawStyle: 'line',
          fillOpacity: 15,
          lineWidth: 2,
          showPoints: 'auto',
          spanNulls: false,
        },
        unit: p.unit || 'short',
      },
      overrides: [],
    },
    options: {
      legend: { displayMode: 'list', placement: 'bottom', showLegend: true },
      tooltip: { mode: 'single', sort: 'none' },
    },
    targets: [
      {
        datasource: { type: 'prometheus', uid: 'victoriametrics' },
        editorMode: 'code',
        expr: p.expr,
        legendFormat: name,
        range: true,
        refId: 'A',
      },
    ],
  }));

  return {
    uid,
    id: null,
    title: `${name} - Monitoring`,
    tags: ['sidroid', 'instance', isWindows ? 'windows' : 'linux'],
    refresh: '30s',
    schemaVersion: 39,
    time: { from: 'now-1h', to: 'now' },
    timepicker: {},
    timezone: 'browser',
    templating: { list: [] },
    annotations: { list: [] },
    links: [],
    liveNow: false,
    fiscalYearStartMonth: 0,
    graphTooltip: 0,
    panels,
  };
}

/**
 * Provision a dedicated Grafana dashboard for this instance.
 * Idempotent — calling it multiple times always overwrites with the latest data.
 */
export async function provisionInstanceDashboard(instance) {
  try {
    const folderUid = await ensureGrafanaFolder();
    const dashboard = buildInstanceDashboard(instance);
    const name = instance.instanceName || instance.instanceId;

    const payload = {
      dashboard,
      folderUid,
      overwrite: true,
      message: `Auto-provisioned by Sidroid for instance ${instance.id}`,
    };

    await grafana.post('/api/dashboards/db', payload);
    console.log(`[DashboardService] ✅ Provisioned dedicated dashboard for "${name}" — UID: ${dashboard.uid}`);
    return dashboard.uid;
  } catch (err) {
    console.error('[DashboardService] ❌ Failed to provision dashboard:', err.response?.data || err.message);
    return null;
  }
}

/**
 * Remove the dedicated Grafana dashboard for a specific instance.
 */
export async function removeInstanceDashboard(instanceId) {
  try {
    const uid = `inst-${instanceId.replace(/-/g, '').substring(0, 12)}`;
    await grafana.delete(`/api/dashboards/uid/${uid}`);
    console.log(`[DashboardService] 🗑️ Removed dedicated dashboard ${uid}`);
  } catch (err) {
    if (err.response?.status === 404) {
      console.log(`[DashboardService] Dashboard already removed or never existed`);
    } else {
      console.error('[DashboardService] Failed to remove dashboard:', err.response?.data || err.message);
    }
  }
}

/**
 * Provision dashboards for ALL existing instances in one shot.
 * Call this on startup or to backfill instances that existed before this feature.
 */
export async function provisionAllInstanceDashboards(instances) {
  console.log(`[DashboardService] Backfilling dashboards for ${instances.length} instances...`);
  for (const instance of instances) {
    await provisionInstanceDashboard(instance);
  }
  console.log(`[DashboardService] Backfill complete.`);
}
