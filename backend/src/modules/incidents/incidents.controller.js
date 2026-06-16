import { ok } from '../../utils/apiResponse.js';
import { badRequest, forbidden, notFound, conflict } from '../../utils/errors.js';
import { writeAuditLog } from '../../lib/auditLogger.js';
import { hasRoleAtLeast, ROLES } from '../../middleware/authorization.js';
import {
  createIncidentSchema,
  updateIncidentSchema,
  acknowledgeSchema,
  assignSchema,
  resolveSchema,
  closeSchema,
  commentSchema,
  listQuerySchema,
} from './incidents.schemas.js';
import {
  createIncident,
  listIncidents,
  findIncidentById,
  updateIncident,
  createIncidentEvent,
  listIncidentEvents,
  isValidTransition,
  isActiveMember,
  serviceExistsInOrg,
  alertExistsInOrg,
} from './incidents.repository.js';

export function makeIncidentsController(deps = {}) {
  const repo = {
    createIncident,
    listIncidents,
    findIncidentById,
    updateIncident,
    createIncidentEvent,
    listIncidentEvents,
    isActiveMember,
    serviceExistsInOrg,
    alertExistsInOrg,
    ...(deps.repo ?? {}),
  };
  const audit = deps.writeAuditLog ?? writeAuditLog;

  // ─── Helpers ────────────────────────────────────────────────────────────────

  async function getIncidentOrThrow(id, organizationId) {
    const incident = await repo.findIncidentById(id, organizationId);
    if (!incident) throw notFound('Incident not found');
    return incident;
  }

  async function addEvent(incidentId, organizationId, actorUserId, type, message, metadata) {
    return repo.createIncidentEvent({ incidentId, organizationId, actorUserId, type, message, metadata });
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  return {
    async create(req, res) {
      const orgId  = req.user.organizationId;
      const userId = req.user.id;
      const body   = createIncidentSchema.parse(req.body);

      if (body.serviceId && !(await repo.serviceExistsInOrg(body.serviceId, orgId))) {
        throw notFound('Service not found');
      }
      if (body.alertId && !(await repo.alertExistsInOrg(body.alertId, orgId))) {
        throw notFound('Alert not found');
      }

      const incident = await repo.createIncident({
        organizationId:  orgId,
        createdByUserId: userId,
        source:          'MANUAL',
        title:           body.title,
        description:     body.description,
        severity:        body.severity,
        serviceId:       body.serviceId,
        alertId:         body.alertId,
        alertRuleId:     body.alertRuleId,
        startedAt:       body.startedAt ? new Date(body.startedAt) : new Date(),
        impactSummary:   body.impactSummary,
        metadata:        body.metadata,
      });

      await addEvent(incident.id, orgId, userId, 'CREATED', `Incident created: ${incident.title}`);

      await audit({
        req,
        organizationId: orgId,
        action: 'incident.created',
        resourceType: 'incident',
        resourceId: incident.id,
        metadata: { title: incident.title, severity: incident.severity, source: 'MANUAL' },
      });

      return ok(res, { incident }, 'Incident created', 201);
    },

    async list(req, res) {
      const orgId = req.user.organizationId;
      const query = listQuerySchema.parse(req.query);
      const { incidents, total } = await repo.listIncidents(orgId, query);
      return ok(res, { incidents, total, limit: query.limit, offset: query.offset }, 'Incidents fetched');
    },

    async get(req, res) {
      const incident = await getIncidentOrThrow(req.params.id, req.user.organizationId);
      return ok(res, { incident }, 'Incident fetched');
    },

    async update(req, res) {
      const orgId    = req.user.organizationId;
      const incident = await getIncidentOrThrow(req.params.id, orgId);

      if (incident.status === 'CLOSED') throw forbidden('Cannot update a closed incident');

      const body    = updateIncidentSchema.parse(req.body);
      const updated = await repo.updateIncident(req.params.id, orgId, body);
      if (!updated) throw notFound('Incident not found');

      await audit({
        req,
        organizationId: orgId,
        action: 'incident.updated',
        resourceType: 'incident',
        resourceId: incident.id,
        metadata: { fields: Object.keys(body) },
      });

      return ok(res, { incident: updated }, 'Incident updated');
    },

    async acknowledge(req, res) {
      const orgId    = req.user.organizationId;
      const userId   = req.user.id;
      const incident = await getIncidentOrThrow(req.params.id, orgId);

      if (!isValidTransition(incident.status, 'ACKNOWLEDGED')) {
        throw conflict(`Cannot move from ${incident.status} to ACKNOWLEDGED`);
      }

      const body = acknowledgeSchema.parse(req.body);
      const now  = new Date();

      const updated = await repo.updateIncident(req.params.id, orgId, {
        status:               'ACKNOWLEDGED',
        acknowledgedByUserId: userId,
        acknowledgedAt:       now,
      });

      await addEvent(
        incident.id, orgId, userId, 'ACKNOWLEDGED',
        body.message ?? 'Incident acknowledged',
        { previousStatus: incident.status },
      );

      await audit({
        req,
        organizationId: orgId,
        action: 'incident.acknowledged',
        resourceType: 'incident',
        resourceId: incident.id,
      });

      return ok(res, { incident: updated }, 'Incident acknowledged');
    },

    async assign(req, res) {
      const orgId    = req.user.organizationId;
      const userId   = req.user.id;
      const incident = await getIncidentOrThrow(req.params.id, orgId);

      if (incident.status === 'CLOSED') throw forbidden('Cannot assign a closed incident');

      const { assignedToUserId } = assignSchema.parse(req.body);

      // DEVELOPER can only assign to self; ADMIN/OWNER can assign anyone in org.
      if (!hasRoleAtLeast(req.user, ROLES.ADMIN) && assignedToUserId !== userId) {
        throw forbidden('Developers can only assign incidents to themselves');
      }

      if (!(await repo.isActiveMember(assignedToUserId, orgId))) {
        throw badRequest('Assignee is not an active member of this organization');
      }

      const updated = await repo.updateIncident(req.params.id, orgId, { assignedToUserId });

      await addEvent(
        incident.id, orgId, userId, 'ASSIGNED',
        `Incident assigned to user ${assignedToUserId}`,
        { assignedToUserId },
      );

      await audit({
        req,
        organizationId: orgId,
        action: 'incident.assigned',
        resourceType: 'incident',
        resourceId: incident.id,
        metadata: { assignedToUserId },
      });

      return ok(res, { incident: updated }, 'Incident assigned');
    },

    async resolve(req, res) {
      const orgId    = req.user.organizationId;
      const userId   = req.user.id;
      const incident = await getIncidentOrThrow(req.params.id, orgId);

      if (!isValidTransition(incident.status, 'RESOLVED')) {
        throw conflict(`Cannot move from ${incident.status} to RESOLVED`);
      }

      const body = resolveSchema.parse(req.body);
      const now  = new Date();

      const updated = await repo.updateIncident(req.params.id, orgId, {
        status:            'RESOLVED',
        resolvedByUserId:  userId,
        resolvedAt:        now,
        resolutionSummary: body.resolutionSummary,
        rootCause:         body.rootCause,
      });

      await addEvent(
        incident.id, orgId, userId, 'RESOLVED',
        body.message ?? 'Incident resolved',
        { previousStatus: incident.status, resolutionSummary: body.resolutionSummary },
      );

      await audit({
        req,
        organizationId: orgId,
        action: 'incident.resolved',
        resourceType: 'incident',
        resourceId: incident.id,
        metadata: { resolutionSummary: body.resolutionSummary },
      });

      return ok(res, { incident: updated }, 'Incident resolved');
    },

    async close(req, res) {
      const orgId    = req.user.organizationId;
      const userId   = req.user.id;
      const incident = await getIncidentOrThrow(req.params.id, orgId);

      if (!isValidTransition(incident.status, 'CLOSED')) {
        throw conflict(`Cannot close an incident that is ${incident.status} — it must be RESOLVED first`);
      }

      const body = closeSchema.parse(req.body);
      const now  = new Date();

      const updated = await repo.updateIncident(req.params.id, orgId, {
        status:   'CLOSED',
        closedAt: now,
      });

      await addEvent(
        incident.id, orgId, userId, 'CLOSED',
        body.message ?? 'Incident closed',
        { previousStatus: incident.status },
      );

      await audit({
        req,
        organizationId: orgId,
        action: 'incident.closed',
        resourceType: 'incident',
        resourceId: incident.id,
      });

      return ok(res, { incident: updated }, 'Incident closed');
    },

    async addComment(req, res) {
      const orgId    = req.user.organizationId;
      const userId   = req.user.id;
      const incident = await getIncidentOrThrow(req.params.id, orgId);

      if (incident.status === 'CLOSED') throw forbidden('Cannot comment on a closed incident');

      const { message } = commentSchema.parse(req.body);

      const event = await addEvent(incident.id, orgId, userId, 'COMMENTED', message);

      await audit({
        req,
        organizationId: orgId,
        action: 'incident.comment_added',
        resourceType: 'incident',
        resourceId: incident.id,
      });

      return ok(res, { event }, 'Comment added', 201);
    },

    async getTimeline(req, res) {
      const orgId    = req.user.organizationId;
      await getIncidentOrThrow(req.params.id, orgId);

      const events = await repo.listIncidentEvents(req.params.id, orgId);
      return ok(res, { events }, 'Timeline fetched');
    },
  };
}

export const {
  create,
  list,
  get,
  update,
  acknowledge,
  assign,
  resolve,
  close,
  addComment,
  getTimeline,
} = makeIncidentsController();
