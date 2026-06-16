import {
  createAlert,
  resolveOpenUptimeAlerts,
  hasOpenUptimeAlert,
  findOpenAlertForRule,
  resolveAlertById,
} from '../modules/alerts/alerts.repository.js';
import {
  loadActiveRulesForService,
  updateUptimeRuleFiredAt,
  updateUptimeRuleResolvedAt,
} from '../modules/uptime-alert-rules/uptimeAlertRules.repository.js';
import { dispatchAlert, dispatchAlertToChannel } from './notifier.js';
import prisma from './prisma.js';

// ─── Pure condition evaluation ────────────────────────────────────────────────

// service.consecutiveFailures is the value BEFORE createUptimeCheck ran (pre-increment).
// We compute the effective value to compare against the threshold.
export function conditionMet(rule, service, check) {
  const effectiveConsecutiveFailures = check.status === 'DOWN'
    ? (service.consecutiveFailures ?? 0) + 1
    : 0;

  switch (rule.type) {
    case 'SERVICE_DOWN':
      return check.status === 'DOWN';
    case 'SERVICE_DEGRADED':
      return check.status === 'DOWN' || check.status === 'DEGRADED';
    case 'RESPONSE_TIME_ABOVE':
      return typeof check.responseTimeMs === 'number' && check.responseTimeMs > (rule.threshold ?? 0);
    case 'CONSECUTIVE_FAILURES':
      return effectiveConsecutiveFailures >= (rule.threshold ?? 1);
    default:
      return false;
  }
}

// ─── Label builders ───────────────────────────────────────────────────────────

function buildFallbackLabels(service, check) {
  return JSON.stringify({
    serviceId:     service.id,
    serviceName:   service.name,
    serviceSlug:   service.slug,
    type:          service.type,
    responseTimeMs: check.responseTimeMs ?? null,
    httpStatusCode: check.httpStatusCode ?? null,
    checkedAt:     check.checkedAt?.toISOString?.() ?? new Date().toISOString(),
  });
}

function buildRuleLabels(rule, service, check) {
  return JSON.stringify({
    serviceId:      service.id,
    serviceName:    service.name,
    serviceSlug:    service.slug,
    type:           service.type,
    uptimeRuleId:   rule.id,
    ruleType:       rule.type,
    responseTimeMs: check.responseTimeMs ?? null,
    httpStatusCode: check.httpStatusCode ?? null,
    checkedAt:      check.checkedAt?.toISOString?.() ?? new Date().toISOString(),
  });
}

// ─── Dispatch helpers ─────────────────────────────────────────────────────────

async function dispatchToRule(alert, rule, deps) {
  if (rule.notificationChannelId) {
    const channel = await deps.findChannelForDelivery(rule.notificationChannelId, rule.organizationId);
    if (channel) await dispatchAlertToChannel(channel, alert, null);
  } else {
    await deps.dispatch(alert);
  }
}

// ─── Rule-based evaluation ────────────────────────────────────────────────────

async function evaluateOneRule(rule, service, check, now, deps) {
  const firing = deps.conditionMet(rule, service, check);

  if (firing) {
    // Cooldown guard: suppress notification if fired recently.
    const cooldownMs = (rule.cooldownSeconds ?? 300) * 1000;
    const withinCooldown = rule.lastFiredAt &&
      (now.getTime() - new Date(rule.lastFiredAt).getTime()) < cooldownMs;
    if (withinCooldown) return;

    // Dedup: don't open a second alert while one is already active.
    const existing = await deps.findOpenAlertForRule(rule.organizationId, rule.id);
    if (existing) return;

    const alert = await deps.createAlertFn({
      organizationId: rule.organizationId,
      ruleId:         null,
      title:          `[${rule.type}] Service "${service.name}" alert`,
      description:    check.errorMessage
        ?? `Rule ${rule.type} triggered — status: ${check.status}, responseTimeMs: ${check.responseTimeMs ?? 'n/a'}`,
      severity:       rule.severity,
      source:         'uptime-rule',
      metricName:     service.url ?? null,
      labels:         buildRuleLabels(rule, service, check),
      status:         'OPEN',
    });

    await deps.updateRuleFiredAt(rule.id, rule.organizationId, now);
    await deps.writeAuditLog({
      organizationId: rule.organizationId,
      action: 'alert.triggered',
      resourceType: 'uptime_alert_rule',
      resourceId: rule.id,
      metadata: { alertId: alert.id, serviceId: service.id, ruleType: rule.type },
    });

    setImmediate(() => dispatchToRule(alert, rule, deps).catch(() => {}));

  } else {
    // Condition cleared: resolve any open alert for this rule and send recovery notification.
    const existing = await deps.findOpenAlertForRule(rule.organizationId, rule.id);
    if (!existing) return;

    await deps.resolveAlertById(existing.id, rule.organizationId);
    await deps.updateRuleResolvedAt(rule.id, rule.organizationId, now);
    await deps.writeAuditLog({
      organizationId: rule.organizationId,
      action: 'alert.resolved',
      resourceType: 'uptime_alert_rule',
      resourceId: rule.id,
      metadata: { alertId: existing.id, serviceId: service.id, ruleType: rule.type },
    });

    const recoveryAlert = {
      ...existing,
      status:      'RESOLVED',
      resolvedAt:  now,
      title:       `[RESOLVED] ${existing.title}`,
      severity:    'LOW',
      description: `Service "${service.name}" recovered — status is now ${check.status}`,
    };
    setImmediate(() => dispatchToRule(recoveryAlert, rule, deps).catch(() => {}));
  }
}

// ─── Fallback path (no configured rules for this service) ────────────────────

async function handleFallback(service, check, deps) {
  const prevStatus = service.currentStatus ?? 'UNKNOWN';
  const newStatus  = check.status;
  if (newStatus === prevStatus) return;

  const isDown = (s) => s === 'DOWN' || s === 'DEGRADED';

  if (isDown(newStatus)) {
    if (await deps.hasOpen(service.organizationId, service.id)) return;

    const alert = await deps.createAlertFn({
      organizationId: service.organizationId,
      ruleId:         null,
      title:          `Service "${service.name}" is ${newStatus}`,
      description:    check.errorMessage ?? `Uptime check returned status: ${newStatus}`,
      severity:       newStatus === 'DOWN' ? 'HIGH' : 'MEDIUM',
      source:         'uptime-check',
      metricName:     service.url ?? null,
      labels:         buildFallbackLabels(service, check),
      status:         'OPEN',
    });

    setImmediate(() => deps.dispatch(alert).catch(() => {}));

  } else if (newStatus === 'UP' && isDown(prevStatus)) {
    // Find open alerts before resolving so we can send recovery notifications.
    const resolved = await deps.resolveAlertsAndReturn(service.organizationId, service.id);
    if (resolved.length > 0) {
      const recoveryAlert = {
        ...resolved[0],
        status:      'RESOLVED',
        resolvedAt:  new Date(),
        title:       `[RESOLVED] Service "${service.name}" recovered`,
        severity:    'LOW',
        description: `Service is now UP — responseTimeMs: ${check.responseTimeMs ?? 'n/a'}ms`,
      };
      setImmediate(() => deps.dispatch(recoveryAlert).catch(() => {}));
    }
  }
}

// ─── Public entry point ───────────────────────────────────────────────────────

// Called by the uptime worker and manual check controller after each check is stored.
// Accepts injectable deps for unit testing.
export async function handleUptimeStateChange({ service, check }, deps = {}) {
  const now = new Date();
  const {
    loadRules             = (orgId, svcId) => loadActiveRulesForService(orgId, svcId),
    findOpenAlertForRuleFn = findOpenAlertForRule,
    createAlertFn         = createAlert,
    resolveAlertByIdFn    = resolveAlertById,
    updateRuleFiredAt     = updateUptimeRuleFiredAt,
    updateRuleResolvedAt  = updateUptimeRuleResolvedAt,
    hasOpen               = hasOpenUptimeAlert,
    dispatch              = (alert) => dispatchAlert(alert, null),
    resolveAlertsAndReturn = async (orgId, svcId) => {
      // Fetch open alerts, resolve them, return them for recovery notification.
      const open = await prisma.alert.findMany({
        where: {
          organizationId: orgId,
          source: 'uptime-check',
          status: { in: ['OPEN', 'ACKNOWLEDGED'] },
          labels: { contains: `"serviceId":"${svcId}"` },
        },
      });
      if (open.length > 0) {
        await resolveOpenUptimeAlerts(orgId, svcId);
      }
      return open;
    },
    findChannelForDelivery = async (channelId, orgId) => {
      return prisma.notificationChannel.findFirst({
        where: { id: channelId, organizationId: orgId },
      });
    },
    writeAuditLog: auditLog = async () => {},
    conditionMet: conditionMetFn = conditionMet,
  } = deps;

  // Build a unified deps bundle for sub-functions.
  const resolvedDeps = {
    findOpenAlertForRule:   findOpenAlertForRuleFn,
    createAlertFn,
    resolveAlertById:       resolveAlertByIdFn,
    updateRuleFiredAt,
    updateRuleResolvedAt,
    hasOpen,
    dispatch,
    resolveAlertsAndReturn,
    findChannelForDelivery,
    writeAuditLog:          auditLog,
    conditionMet:           conditionMetFn,
  };

  const rules = await loadRules(service.organizationId, service.id);

  if (rules.length === 0) {
    // No configured rules → fallback to simple state-change detection.
    await handleFallback(service, check, resolvedDeps);
    return;
  }

  // Rule-based path: evaluate each rule independently.
  await Promise.allSettled(
    rules.map((rule) => evaluateOneRule(rule, service, check, now, resolvedDeps)),
  );
}
