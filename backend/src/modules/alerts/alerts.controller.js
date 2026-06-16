import { ok } from '../../utils/apiResponse.js';
import { notFound } from '../../utils/errors.js';
import { writeAuditLog } from '../../lib/auditLogger.js';
import { listAlertsSchema, updateAlertSchema } from './alerts.schemas.js';
import { listAlerts, findAlert, updateAlertStatus } from './alerts.repository.js';

export function makeAlertsController(deps = {}) {
  const {
    repo = { listAlerts, findAlert, updateAlertStatus },
    auditLog = writeAuditLog,
  } = deps;

  return {
    async list(req, res) {
      const { status, severity, ruleId, source, limit, offset } = listAlertsSchema.parse(req.query);
      const { alerts, total } = await repo.listAlerts(req.user.organizationId, { status, severity, ruleId, source, limit, offset });
      return ok(res, { alerts, total, limit, offset }, 'Alerts fetched');
    },

    async get(req, res) {
      const alert = await repo.findAlert(req.params.id, req.user.organizationId);
      if (!alert) throw notFound('Alert not found');
      return ok(res, { alert }, 'Alert fetched');
    },

    async update(req, res) {
      const { status } = updateAlertSchema.parse(req.body);
      const result = await repo.updateAlertStatus(req.params.id, req.user.organizationId, status);
      if (result.count === 0) throw notFound('Alert not found');
      await auditLog({
        req,
        organizationId: req.user.organizationId,
        action: `alert.${status.toLowerCase()}`,
        resourceType: 'alert',
        resourceId: req.params.id,
        metadata: { status },
      });
      return ok(res, null, `Alert ${status.toLowerCase()}`);
    },
  };
}

export const { list, get, update } = makeAlertsController();
