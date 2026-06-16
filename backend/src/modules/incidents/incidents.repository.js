import prisma from '../../lib/prisma.js';

// ─── Status transition table ─────────────────────────────────────────────────

const ALLOWED_TRANSITIONS = new Map([
  ['OPEN',          ['ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED']],
  ['ACKNOWLEDGED',  ['INVESTIGATING', 'RESOLVED']],
  ['INVESTIGATING', ['IDENTIFIED', 'RESOLVED']],
  ['IDENTIFIED',    ['MONITORING', 'RESOLVED']],
  ['MONITORING',    ['RESOLVED']],
  ['RESOLVED',      ['CLOSED']],
  ['CLOSED',        []],
]);

export function isValidTransition(from, to) {
  return ALLOWED_TRANSITIONS.get(from)?.includes(to) ?? false;
}

// ─── Non-terminal statuses (incidents still "active") ────────────────────────

export const ACTIVE_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'IDENTIFIED', 'MONITORING'];

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createIncident(data) {
  return prisma.incident.create({ data });
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function listIncidents(organizationId, { limit = 50, offset = 0, status, severity, serviceId } = {}) {
  const where = { organizationId };
  if (status)    where.status   = status;
  if (severity)  where.severity = severity;
  if (serviceId) where.serviceId = serviceId;

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        _count: { select: { events: true } },
      },
    }),
    prisma.incident.count({ where }),
  ]);

  return { incidents, total };
}

export async function findIncidentById(id, organizationId) {
  return prisma.incident.findFirst({
    where: { id, organizationId },
  });
}

// Find an active (non-terminal) incident linked to a specific alert rule + service.
// Used for deduplication when alerts trigger incident creation.
export async function findActiveIncidentForRule(organizationId, serviceId, alertRuleId) {
  return prisma.incident.findFirst({
    where: {
      organizationId,
      serviceId: serviceId ?? undefined,
      alertRuleId: alertRuleId ?? undefined,
      status: { in: ACTIVE_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Find an active incident linked to a specific alert id.
export async function findActiveIncidentByAlertId(organizationId, alertId) {
  return prisma.incident.findFirst({
    where: {
      organizationId,
      alertId,
      status: { in: ACTIVE_STATUSES },
    },
  });
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateIncident(id, organizationId, data) {
  return prisma.incident.update({
    where: { id_organizationId: { id, organizationId } },
    data,
  }).catch(() => null);
}

// ─── Timeline ────────────────────────────────────────────────────────────────

export async function createIncidentEvent(data) {
  return prisma.incidentEvent.create({ data });
}

export async function listIncidentEvents(incidentId, organizationId) {
  return prisma.incidentEvent.findMany({
    where: { incidentId, organizationId },
    orderBy: { createdAt: 'asc' },
  });
}

// ─── Membership check helper ─────────────────────────────────────────────────

export async function isActiveMember(userId, organizationId) {
  const member = await prisma.organizationMember.findFirst({
    where: { userId, organizationId, status: 'ACTIVE' },
  });
  return member !== null;
}

// ─── Ownership validators ─────────────────────────────────────────────────────

export async function serviceExistsInOrg(serviceId, organizationId) {
  const svc = await prisma.monitoredService.findFirst({
    where: { id: serviceId, organizationId, deletedAt: null },
  });
  return svc !== null;
}

export async function alertExistsInOrg(alertId, organizationId) {
  const alert = await prisma.alert.findFirst({
    where: { id: alertId, organizationId },
  });
  return alert !== null;
}
