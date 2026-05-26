import { ok } from '../../utils/apiResponse.js';
import { listAlerts, createAlert, updateAlertStatus, getDashboardStats } from './alerts.repository.js';

export async function getAlerts(req, res) {
  const orgId    = req.query.orgId || req.user?.organizationId;
  const status   = req.query.status;   // OPEN | ACKNOWLEDGED | RESOLVED | ALL
  const severity = req.query.severity; // LOW | MEDIUM | HIGH | CRITICAL
  const alerts   = await listAlerts({
    organizationId: orgId,
    ...(status && status !== 'ALL' ? { status } : {}),
    ...(severity ? { severity } : {}),
  });
  return ok(res, { alerts }, 'Alerts fetched');
}

export async function postAlert(req, res) {
  const { organizationId, title, description, severity, source, metricName, instanceId } = req.body;
  const orgId = organizationId || req.user?.organizationId;
  if (!orgId || !title) {
    return res.status(400).json({ success: false, message: 'organizationId and title are required' });
  }
  const alert = await createAlert({ organizationId: orgId, title, description, severity, source, metricName, instanceId });
  return res.status(201).json({ success: true, data: alert });
}

export async function patchAlert(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const resolvedAt = status === 'RESOLVED' ? new Date() : null;
  const alert = await updateAlertStatus(id, status, resolvedAt);
  return ok(res, alert, 'Alert updated');
}

export async function getStats(req, res) {
  const orgId = req.query.orgId || req.user?.organizationId;
  const stats  = await getDashboardStats(orgId);
  return ok(res, stats, 'Dashboard stats');
}

export async function deleteAlert(req, res) {
  const { id } = req.params;
  const { deleteAlert: removeAlert } = await import('./alerts.repository.js');
  await removeAlert(id);
  return ok(res, null, 'Alert deleted');
}
