import { ok } from '../../utils/apiResponse.js';
import { listInstances, upsertInstance } from './instances.repository.js';
import prisma from '../../lib/prisma.js';

export async function getInstances(req, res) {
  const organizationId = req.query.orgId || req.user?.organizationId || null;
  const instances = await listInstances({ organizationId });
  return ok(res, { instances }, 'Instances fetched');
}

export async function createInstance(req, res) {
  const body = req.body;
  // Ensure the requesting user can only add to their own org
  const organizationId = body.organizationId || req.user?.organizationId;
  if (!organizationId) {
    return res.status(400).json({ success: false, message: 'organizationId is required' });
  }

  const instance = await upsertInstance({
    organizationId,
    instanceId:   body.instanceId || `local-${Date.now()}`,
    instanceName: body.instanceName || null,
    hostname:     body.hostname || null,
    privateIp:    body.privateIp || null,
    publicIp:     body.publicIp || null,
    platform:     body.platform || 'LINUX',
    serviceType:  body.serviceType || 'BARE_METAL',
    region:       body.region || null,
    status:       body.status || 'RUNNING',
    orgLabel:     body.orgLabel || null,
    serviceLabel: body.serviceLabel || null,
    exporterPort: body.exporterPort || (body.platform === 'WINDOWS' ? 9182 : 9100),
    lastSeenAt:   new Date(),
  });

  return res.status(201).json({ success: true, data: instance });
}

export async function updateInstanceStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const updated = await prisma.monitoredInstance.update({
    where: { id },
    data: { status, lastSeenAt: new Date() },
  });
  return ok(res, updated, 'Instance updated');
}

export async function deleteInstance(req, res) {
  const { id } = req.params;
  
  // 1. Find all rules associated with this instance
  const rules = await prisma.alertRule.findMany({ where: { instanceId: id } });
  
  // Dynamic imports to avoid circular dependencies
  const alertCtrl = await import('../alert-rules/alert-rules.controller.js');
  const alertEval = await import('../../workers/alertEvaluator.js');
  
  for (const rule of rules) {
    alertEval.clearCooldown(rule.id);
    await alertCtrl.removeGrafanaRule(rule);
    await prisma.alertRule.delete({ where: { id: rule.id } });
  }

  // 2. Delete the instance itself
  await prisma.monitoredInstance.delete({ where: { id } });
  return ok(res, null, 'Instance permanently deleted');
}

