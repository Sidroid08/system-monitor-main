import prisma from '../../lib/prisma.js';

const ruleSelect = {
  id: true, organizationId: true, name: true, description: true,
  promql: true, condition: true, threshold: true, forCycles: true,
  severity: true, isActive: true, state: true,
  lastEvaluatedAt: true, lastFiredAt: true,
  createdAt: true, updatedAt: true,
};

export async function createRule(data) {
  return prisma.alertRule.create({ data, select: ruleSelect });
}

export async function listRules(organizationId, { limit = 50, offset = 0 } = {}) {
  const where = { organizationId };
  const [rules, total] = await Promise.all([
    prisma.alertRule.findMany({ where, select: ruleSelect, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
    prisma.alertRule.count({ where }),
  ]);
  return { rules, total };
}

export async function findRule(id, organizationId) {
  return prisma.alertRule.findFirst({ where: { id, organizationId }, select: ruleSelect });
}

export async function updateRule(id, organizationId, data) {
  return prisma.alertRule.updateMany({ where: { id, organizationId }, data });
}

export async function deleteRule(id, organizationId) {
  return prisma.alertRule.deleteMany({ where: { id, organizationId } });
}
