import { ok } from '../../utils/apiResponse.js';
import { notFound } from '../../utils/errors.js';
import { createAlertRuleSchema, updateAlertRuleSchema } from './alertRules.schemas.js';
import { createRule, listRules, findRule, updateRule, deleteRule } from './alertRules.repository.js';

export async function create(req, res) {
  const data = createAlertRuleSchema.parse(req.body);
  const rule = await createRule({ ...data, organizationId: req.user.organizationId });
  return ok(res, { rule }, 'Alert rule created', 201);
}

export async function list(req, res) {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const { rules, total } = await listRules(req.user.organizationId, { limit, offset });
  return ok(res, { rules, total, limit, offset }, 'Alert rules fetched');
}

export async function get(req, res) {
  const rule = await findRule(req.params.id, req.user.organizationId);
  if (!rule) throw notFound('Alert rule not found');
  return ok(res, { rule }, 'Alert rule fetched');
}

export async function update(req, res) {
  const data = updateAlertRuleSchema.parse(req.body);
  const result = await updateRule(req.params.id, req.user.organizationId, data);
  if (result.count === 0) throw notFound('Alert rule not found');
  return ok(res, null, 'Alert rule updated');
}

export async function remove(req, res) {
  const result = await deleteRule(req.params.id, req.user.organizationId);
  if (result.count === 0) throw notFound('Alert rule not found');
  return ok(res, null, 'Alert rule deleted');
}
