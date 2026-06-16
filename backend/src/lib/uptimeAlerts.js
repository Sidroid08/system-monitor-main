import { createAlert, resolveOpenUptimeAlerts, hasOpenUptimeAlert } from '../modules/alerts/alerts.repository.js';
import { dispatchAlert } from './notifier.js';

const SEVERITY_FOR_STATUS = {
  DOWN:     'HIGH',
  DEGRADED: 'MEDIUM',
};

function isDown(status) {
  return status === 'DOWN' || status === 'DEGRADED';
}

function buildAlertLabels(service) {
  return JSON.stringify({
    serviceId:   service.id,
    serviceName: service.name,
    serviceSlug: service.slug,
    type:        service.type,
  });
}

// Called by the uptime worker after each check is stored.
// Detects UP→DOWN (or UNKNOWN→DOWN) and DOWN→UP status transitions and fires
// or resolves alerts accordingly. Uses injected deps so the function is unit-testable.
export async function handleUptimeStateChange({ service, check }, deps = {}) {
  const {
    createAlertFn    = createAlert,
    resolveAlerts    = resolveOpenUptimeAlerts,
    hasOpen          = hasOpenUptimeAlert,
    dispatch         = (alert) => dispatchAlert(alert, null),
  } = deps;

  const prevStatus = service.currentStatus ?? 'UNKNOWN';
  const newStatus  = check.status;

  if (newStatus === prevStatus) return;

  if (isDown(newStatus)) {
    // Deduplicate: don't fire a second alert if one is already open for this service.
    if (await hasOpen(service.organizationId, service.id)) return;

    const alert = await createAlertFn({
      organizationId: service.organizationId,
      ruleId:         null,
      title:          `Service "${service.name}" is ${newStatus}`,
      description:    check.errorMessage ?? `Uptime check returned status: ${newStatus}`,
      severity:       SEVERITY_FOR_STATUS[newStatus] ?? 'MEDIUM',
      source:         'uptime-check',
      metricName:     service.url ?? null,
      labels:         buildAlertLabels(service),
      status:         'OPEN',
    });

    setImmediate(() => dispatch(alert).catch(() => {}));
  } else if (newStatus === 'UP' && isDown(prevStatus)) {
    await resolveAlerts(service.organizationId, service.id);
  }
}
