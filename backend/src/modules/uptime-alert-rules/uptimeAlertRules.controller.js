import { ok } from '../../utils/apiResponse.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { writeAuditLog } from '../../lib/auditLogger.js';
import {
  createUptimeAlertRuleSchema,
  updateUptimeAlertRuleSchema,
  listUptimeAlertRulesSchema,
} from './uptimeAlertRules.schemas.js';
import {
  createUptimeAlertRule,
  listUptimeAlertRules,
  findUptimeAlertRule,
  updateUptimeAlertRule,
  deleteUptimeAlertRule,
  serviceExistsInOrg,
  channelExistsInOrg,
} from './uptimeAlertRules.repository.js';

async function assertCrossOrgSafe(orgId, { serviceId, notificationChannelId }, deps) {
  if (serviceId) {
    const ok = await deps.serviceExistsInOrg(serviceId, orgId);
    if (!ok) throw badRequest('serviceId not found in this organization');
  }
  if (notificationChannelId) {
    const ok = await deps.channelExistsInOrg(notificationChannelId, orgId);
    if (!ok) throw badRequest('notificationChannelId not found in this organization');
  }
}

export function makeUptimeAlertRulesController(deps = {}) {
  const repo = {
    createUptimeAlertRule,
    listUptimeAlertRules,
    findUptimeAlertRule,
    updateUptimeAlertRule,
    deleteUptimeAlertRule,
    serviceExistsInOrg,
    channelExistsInOrg,
    ...(deps.repo ?? {}),
  };
  const audit = deps.auditLog ?? writeAuditLog;

  return {
    async list(req, res) {
      const { serviceId, isActive, limit, offset } = listUptimeAlertRulesSchema.parse(req.query);
      const { rules, total } = await repo.listUptimeAlertRules(
        req.user.organizationId, { serviceId, isActive, limit, offset },
      );
      return ok(res, { rules, total, limit, offset }, 'Uptime alert rules fetched');
    },

    async get(req, res) {
      const rule = await repo.findUptimeAlertRule(req.params.id, req.user.organizationId);
      if (!rule) throw notFound('Uptime alert rule not found');
      return ok(res, { rule }, 'Uptime alert rule fetched');
    },

    async create(req, res) {
      const data = createUptimeAlertRuleSchema.parse(req.body);
      await assertCrossOrgSafe(req.user.organizationId, data, repo);

      const rule = await repo.createUptimeAlertRule({
        ...data,
        organizationId: req.user.organizationId,
        createdByUserId: req.user.id,
      });

      await audit({
        req,
        organizationId: req.user.organizationId,
        action: 'uptime_alert_rule.created',
        resourceType: 'uptime_alert_rule',
        resourceId: rule.id,
        metadata: { name: rule.name, type: rule.type, severity: rule.severity },
      });

      return ok(res, { rule }, 'Uptime alert rule created', 201);
    },

    async update(req, res) {
      const data = updateUptimeAlertRuleSchema.parse(req.body);
      await assertCrossOrgSafe(req.user.organizationId, data, repo);

      const result = await repo.updateUptimeAlertRule(req.params.id, req.user.organizationId, data);
      if (result.count === 0) throw notFound('Uptime alert rule not found');

      await audit({
        req,
        organizationId: req.user.organizationId,
        action: 'uptime_alert_rule.updated',
        resourceType: 'uptime_alert_rule',
        resourceId: req.params.id,
        metadata: { fields: Object.keys(data) },
      });

      return ok(res, null, 'Uptime alert rule updated');
    },

    async remove(req, res) {
      const result = await repo.deleteUptimeAlertRule(req.params.id, req.user.organizationId);
      if (result.count === 0) throw notFound('Uptime alert rule not found');

      await audit({
        req,
        organizationId: req.user.organizationId,
        action: 'uptime_alert_rule.deleted',
        resourceType: 'uptime_alert_rule',
        resourceId: req.params.id,
      });

      return ok(res, null, 'Uptime alert rule deleted');
    },
  };
}

export const { list, get, create, update, remove } = makeUptimeAlertRulesController();
