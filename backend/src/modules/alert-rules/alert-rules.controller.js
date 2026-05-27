import { ok } from '../../utils/apiResponse.js';
import prisma from '../../lib/prisma.js';
import axios from 'axios';
import { clearCooldown } from '../../workers/alertEvaluator.js';

const GRAFANA_URL = process.env.INTERNAL_GRAFANA_URL || 'http://cloud-ventur-grafana:3000';
const GRAFANA_AUTH = Buffer.from('admin:admin123').toString('base64');
const GRAFANA_FOLDER_UID = 'cfn8991l3iqyod'; // "Sidroid Monitoring" folder

const grafana = axios.create({
  baseURL: GRAFANA_URL,
  headers: {
    Authorization: `Basic ${GRAFANA_AUTH}`,
    'Content-Type': 'application/json',
    'X-Disable-Provenance': 'true',
  },
  timeout: 10000,
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function resolveInstanceIp(dbInstanceId) {
  if (!dbInstanceId || dbInstanceId === 'ALL') return null;
  try {
    const inst = await prisma.monitoredInstance.findUnique({
      where: { id: dbInstanceId },
      select: { privateIp: true, publicIp: true, exporterPort: true }
    });
    if (!inst) return null;
    return inst.privateIp || inst.publicIp || null;
  } catch {
    return null;
  }
}

function buildPromQL(metric, instanceIp) {
  const f = instanceIp ? `instance=~".*${instanceIp}.*"` : '';
  switch (metric) {
    case 'cpu':
      return f
        ? `max((100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle",${f}}[5m])) * 100)) or (100 - (avg by (instance) (rate(windows_cpu_time_total{mode="idle",${f}}[5m])) * 100)))`
        : `max((100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)) or (100 - (avg by (instance) (rate(windows_cpu_time_total{mode="idle"}[5m])) * 100)))`;
    case 'memory':
      return f
        ? `max((100 - ((node_memory_MemAvailable_bytes{${f}} / node_memory_MemTotal_bytes{${f}}) * 100)) or ((1 - (windows_memory_available_bytes{${f}} / windows_memory_physical_total_bytes{${f}})) * 100))`
        : `max((100 - ((node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100)) or ((1 - (windows_memory_available_bytes / windows_memory_physical_total_bytes)) * 100))`;
    case 'disk':
      return f
        ? `max((100 - ((node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs",${f}} / node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs",${f}}) * 100)) or (100 - ((windows_logical_disk_free_bytes{volume!~"HarddiskVolume.*",${f}} / windows_logical_disk_size_bytes{volume!~"HarddiskVolume.*",${f}}) * 100)))`
        : `max((100 - ((node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"}) * 100)) or (100 - ((windows_logical_disk_free_bytes{volume!~"HarddiskVolume.*"} / windows_logical_disk_size_bytes{volume!~"HarddiskVolume.*"}) * 100)))`;
    default:
      return null;
  }
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create (or update) a Grafana email contact point for this alert rule.
 * Retries up to 3 times with exponential backoff to handle Grafana's
 * "could not find object using provided id and hash" race condition bug
 * that occurs when multiple rules are created in rapid succession.
 * Returns the contact point UID.
 */
async function createGrafanaContactPoint(emailList, ruleDbId) {
  const cpName = `sidroid-rule-${ruleDbId}`;
  const settings = {
    addresses: emailList.join(';'),
    singleEmail: false,
  };

  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        const backoffMs = attempt * 800;
        console.log(`[Grafana] Retrying contact point creation (attempt ${attempt}/${maxAttempts}) after ${backoffMs}ms...`);
        await sleep(backoffMs);
      }

      const res = await grafana.post('/api/v1/provisioning/contact-points', {
        name: cpName,
        type: 'email',
        settings,
        disableResolveMessage: false,
      });
      console.log(`[Grafana] Contact point created: ${res.data.uid}`);
      return res.data.uid;
    } catch (e) {
      lastError = e;
      const status = e.response?.status;
      const errMsg = e.response?.data?.message || e.message || '';

      if (status === 409) {
        const all = await grafana.get('/api/v1/provisioning/contact-points');
        const existing = all.data.find(cp => cp.name === cpName);
        if (existing) {
          console.log(`[Grafana] Contact point already exists, reusing UID: ${existing.uid}`);
          return existing.uid;
        }
      }

      if (status === 500 && errMsg.includes('could not find object')) {
        console.warn(`[Grafana] Contact point creation hit race condition (attempt ${attempt}/${maxAttempts}): ${errMsg}`);
        continue;
      }

      throw e;
    }
  }

  throw lastError;
}

/**
 * Convert seconds to a Grafana/Alertmanager duration string.
 */
function secondsToGrafanaDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

/**
 * Append a route to Grafana's notification policy tree.
 */
async function addNotificationRoute(ruleDbId, contactPointUid, repeatIntervalSeconds = 300) {
  try {
    const policyRes = await grafana.get('/api/v1/provisioning/policies');
    const policy = policyRes.data;

    if (!policy.routes) policy.routes = [];

    policy.routes = policy.routes.filter(
      r => !(r.object_matchers || []).some(m => m[0] === 'sidroid_rule_id' && m[2] === ruleDbId)
    );

    const grafanaDuration = secondsToGrafanaDuration(repeatIntervalSeconds);

    policy.routes.unshift({
      receiver: `sidroid-rule-${ruleDbId}`,
      object_matchers: [['sidroid_rule_id', '=', ruleDbId]],
      group_by: ['alertname'],
      group_wait: '0s',
      group_interval: grafanaDuration,
      repeat_interval: grafanaDuration,
      continue: false,
    });

    await grafana.put('/api/v1/provisioning/policies', policy);
    console.log(`[Grafana] Notification route added for rule ${ruleDbId} | repeat_interval: ${grafanaDuration}`);
  } catch (e) {
    console.error('[Grafana] Failed to update notification policy:', e?.response?.data || e.message);
  }
}

/**
 * Remove a notification route for a given rule DB id.
 */
async function removeNotificationRoute(ruleDbId) {
  try {
    const policyRes = await grafana.get('/api/v1/provisioning/policies');
    const policy = policyRes.data;
    if (!policy.routes) return;
    policy.routes = policy.routes.filter(
      r => !(r.object_matchers || []).some(m => m[0] === 'sidroid_rule_id' && m[2] === ruleDbId)
    );
    await grafana.put('/api/v1/provisioning/policies', policy);
  } catch (e) {
    console.error('[Grafana] Failed to remove notification route:', e.message);
  }
}

/**
 * Fully remove a rule's Grafana alert rule + contact point + notification route.
 * Safe to call even if UIDs are null.
 */
export async function removeGrafanaRule(rule) {
  if (rule?.grafanaRuleUid) {
    try {
      await grafana.delete(`/api/v1/provisioning/alert-rules/${rule.grafanaRuleUid}`);
      console.log(`[Grafana] Alert rule deleted: ${rule.grafanaRuleUid}`);
    } catch (e) {
      console.error('[Grafana] Failed to delete alert rule:', e?.response?.data || e.message);
    }
  }

  if (rule?.grafanaContactUid) {
    try {
      await grafana.delete(`/api/v1/provisioning/contact-points/${rule.grafanaContactUid}`);
      console.log(`[Grafana] Contact point deleted: ${rule.grafanaContactUid}`);
    } catch (e) {
      console.error('[Grafana] Failed to delete contact point:', e?.response?.data || e.message);
    }
  }

  if (rule) await removeNotificationRoute(rule.id);
}

/**
 * Provision a Grafana alert rule for the given DB rule object.
 * Returns { grafanaRuleUid, grafanaContactUid } on success.
 */
async function provisionGrafanaRule(rule) {
  const { metric, threshold, emails, repeatInterval, id } = rule;
  const thresholdNum = parseFloat(threshold);
  const repeatIntervalNum = Math.min(3600, Math.max(20, parseInt(repeatInterval) || 300));
  const emailList = emails.split(',').map(e => e.trim()).filter(Boolean);

  const instanceIp = await resolveInstanceIp(rule.instanceId);
  const expr = buildPromQL(metric, instanceIp);
  if (!expr) throw new Error(`Unknown metric: ${metric}`);

  const grafanaContactUid = await createGrafanaContactPoint(emailList, id);

  const metricLabel = { cpu: 'CPU Usage', memory: 'Memory Usage', disk: 'Disk Usage' }[metric] || metric;
  const instanceLabel = instanceIp ? ` (${instanceIp})` : ' (All Instances)';

  const grafanaPayload = {
    title: `Sidroid_${metric.toUpperCase()}_${id.substring(0, 8)}`,
    folderUID: GRAFANA_FOLDER_UID,
    ruleGroup: 'SidroidRules',
    condition: 'C',
    data: [
      {
        refId: 'A',
        datasourceUid: 'victoriametrics',
        model: { expr, refId: 'A', instant: true },
        relativeTimeRange: { from: 600, to: 0 }
      },
      {
        refId: 'C',
        datasourceUid: '__expr__',
        model: {
          conditions: [{
            evaluator: { params: [thresholdNum], type: 'gt' },
            operator: { type: 'and' },
            query: { params: ['A'] },
            reducer: { params: [], type: 'last' },
            type: 'query'
          }],
          expression: 'A',
          refId: 'C',
          type: 'threshold'
        }
      }
    ],
    execErrState: 'Alerting',
    noDataState: 'NoData',
    for: '1m',
    labels: {
      severity: 'critical',
      sidroid_rule_id: id,
    },
    annotations: {
      summary: `${metricLabel}${instanceLabel} exceeded ${thresholdNum}%`,
      description: `Sidroid alert: ${metricLabel} threshold of ${thresholdNum}% has been exceeded. Check your dashboard immediately.`,
    }
  };

  const grafanaRes = await grafana.post('/api/v1/provisioning/alert-rules', grafanaPayload);
  const grafanaRuleUid = grafanaRes.data.uid;
  console.log(`[Grafana] Alert rule provisioned with UID: ${grafanaRuleUid}`);

  await sleep(500);
  await addNotificationRoute(id, grafanaContactUid, repeatIntervalNum);

  return { grafanaRuleUid, grafanaContactUid };
}

// ─── Route handlers ──────────────────────────────────────────────────────────

export async function getAlertRules(req, res) {
  const organizationId = req.query.orgId || req.user?.organizationId;
  const rules = await prisma.alertRule.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' }
  });
  return ok(res, { rules }, 'Alert rules fetched');
}

export async function createAlertRule(req, res) {
  const { instanceId, metric, threshold, alertType, emails, repeatInterval } = req.body;
  const organizationId = req.user?.organizationId;

  if (!organizationId || !metric || threshold === undefined || !emails) {
    return res.status(400).json({ success: false, message: 'Missing required fields: metric, threshold, emails are required.' });
  }

  const thresholdNum = parseFloat(threshold);
  const repeatIntervalNum = Math.min(3600, Math.max(20, parseInt(repeatInterval) || 300));
  const emailList = emails.split(',').map(e => e.trim()).filter(Boolean);

  const rule = await prisma.alertRule.create({
    data: {
      organizationId,
      instanceId: instanceId || 'ALL',
      metric,
      threshold: thresholdNum,
      alertType,
      emails,
      repeatInterval: repeatIntervalNum,
      grafanaRuleUid: null,
      grafanaContactUid: null,
    }
  });

  console.log(`[Alert Rule] Created DB rule: ${rule.id} | Metric: ${metric} | Threshold: ${thresholdNum}% | Emails: ${emails} | Repeat every: ${repeatIntervalNum}s`);

  let grafanaRuleUid = null;
  let grafanaContactUid = null;
  let grafanaStatus = null;

  if (alertType === 'GRAFANA' || alertType === 'BOTH') {
    try {
      const uids = await provisionGrafanaRule({ ...rule, emailList });
      grafanaRuleUid = uids.grafanaRuleUid;
      grafanaContactUid = uids.grafanaContactUid;

      await prisma.alertRule.update({
        where: { id: rule.id },
        data: { grafanaRuleUid, grafanaContactUid }
      });

      grafanaStatus = { success: true, message: 'Grafana alert rule provisioned successfully' };
    } catch (error) {
      console.error('[Grafana] Failed to provision alert rule:', error?.response?.data || error.message);
      grafanaStatus = { success: false, message: 'Grafana provisioning failed: ' + (error?.response?.data?.message || error.message) };
    }
  }

  const updatedRule = await prisma.alertRule.findUnique({ where: { id: rule.id } });
  return res.status(201).json({
    success: true,
    data: updatedRule,
    message: 'Alert rule created',
    grafanaStatus
  });
}

export async function deleteAlertRule(req, res) {
  const { id } = req.params;

  const rule = await prisma.alertRule.findUnique({ where: { id } });

  // 1. Clear in-memory cooldown IMMEDIATELY so the custom evaluator stops on next poll
  clearCooldown(id);

  // 2. Remove from Grafana (rule + contact point + notification route)
  await removeGrafanaRule(rule);

  // 3. Delete from DB
  await prisma.alertRule.delete({ where: { id } });
  return ok(res, null, 'Alert rule deleted');
}

export async function pauseAlertRule(req, res) {
  const { id } = req.params;

  const rule = await prisma.alertRule.findUnique({ where: { id } });
  if (!rule) return res.status(404).json({ success: false, message: 'Alert rule not found' });

  // 1. Clear cooldown so the custom evaluator stops immediately on next poll
  clearCooldown(id);

  // 2. Remove from Grafana (delete the Grafana rule to stop Grafana emails)
  //    We store the fact that it was paused — on resume we re-provision it
  await removeGrafanaRule(rule);

  // 3. Mark as paused in DB, clear Grafana UIDs (will be re-created on resume)
  const updated = await prisma.alertRule.update({
    where: { id },
    data: {
      isPaused: true,
      grafanaRuleUid: null,
      grafanaContactUid: null,
    }
  });

  console.log(`[Alert Rule] Paused rule ${id} — Grafana alerts removed, custom engine skipping.`);
  return ok(res, { rule: updated }, 'Alert rule paused');
}

export async function resumeAlertRule(req, res) {
  const { id } = req.params;

  const rule = await prisma.alertRule.findUnique({ where: { id } });
  if (!rule) return res.status(404).json({ success: false, message: 'Alert rule not found' });

  let grafanaRuleUid = null;
  let grafanaContactUid = null;
  let grafanaStatus = null;

  // Re-provision Grafana alert rule if needed
  if (rule.alertType === 'GRAFANA' || rule.alertType === 'BOTH') {
    try {
      const uids = await provisionGrafanaRule(rule);
      grafanaRuleUid = uids.grafanaRuleUid;
      grafanaContactUid = uids.grafanaContactUid;
      grafanaStatus = { success: true };
    } catch (error) {
      console.error('[Grafana] Failed to re-provision on resume:', error?.response?.data || error.message);
      grafanaStatus = { success: false, message: error?.response?.data?.message || error.message };
    }
  }

  const updated = await prisma.alertRule.update({
    where: { id },
    data: {
      isPaused: false,
      grafanaRuleUid,
      grafanaContactUid,
    }
  });

  console.log(`[Alert Rule] Resumed rule ${id}.`);
  return ok(res, { rule: updated, grafanaStatus }, 'Alert rule resumed');
}
