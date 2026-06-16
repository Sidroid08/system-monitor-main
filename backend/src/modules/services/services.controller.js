import { ok } from '../../utils/apiResponse.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { writeAuditLog } from '../../lib/auditLogger.js';
import {
  createServiceSchema,
  updateServiceSchema,
  validateServiceDefinition,
} from './services.schemas.js';
import {
  createService,
  listServices,
  findServiceById,
  updateService,
  softDeleteService,
  createUptimeCheck,
} from './services.repository.js';
import { performHttpCheck } from './services.health.js';

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'service';
}

function cleanUpdateData(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

export function makeServicesController(deps = {}) {
  const repo = {
    createService,
    listServices,
    findServiceById,
    updateService,
    softDeleteService,
    createUptimeCheck,
    ...(deps.repo ?? {}),
  };
  const checker = deps.performHttpCheck ?? performHttpCheck;
  const audit = deps.writeAuditLog ?? writeAuditLog;
  const onCheckStored = deps.onCheckStored ?? null;

  return {
    async create(req, res) {
      const payload = createServiceSchema.parse(req.body);
      const service = await repo.createService({
        ...payload,
        slug: slugify(payload.name),
        organizationId: req.user.organizationId,
        createdByUserId: req.user.id,
      });

      await audit({
        req,
        organizationId: req.user.organizationId,
        action: 'service.created',
        resourceType: 'monitored_service',
        resourceId: service.id,
        metadata: { name: service.name, type: service.type, environment: service.environment },
      });

      return ok(res, { service }, 'Service created', 201);
    },

    async list(req, res) {
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const offset = Number(req.query.offset ?? 0);
      const { services, total } = await repo.listServices(req.user.organizationId, { limit, offset });
      return ok(res, { services, total, limit, offset }, 'Services fetched');
    },

    async get(req, res) {
      const service = await repo.findServiceById(req.params.id, req.user.organizationId);
      if (!service) throw notFound('Service not found');
      return ok(res, { service }, 'Service fetched');
    },

    async update(req, res) {
      const existing = await repo.findServiceById(req.params.id, req.user.organizationId);
      if (!existing) throw notFound('Service not found');

      const payload = updateServiceSchema.parse(req.body);
      const merged = { ...existing, ...payload };
      validateServiceDefinition(merged);

      const updateData = cleanUpdateData({
        ...payload,
        slug: payload.name ? slugify(payload.name) : undefined,
      });
      const service = await repo.updateService(req.params.id, req.user.organizationId, updateData);
      if (!service) throw notFound('Service not found');

      await audit({
        req,
        organizationId: req.user.organizationId,
        action: 'service.updated',
        resourceType: 'monitored_service',
        resourceId: service.id,
        metadata: { fields: Object.keys(updateData) },
      });

      return ok(res, { service }, 'Service updated');
    },

    async remove(req, res) {
      const count = await repo.softDeleteService(req.params.id, req.user.organizationId);
      if (count === 0) throw notFound('Service not found');

      await audit({
        req,
        organizationId: req.user.organizationId,
        action: 'service.deleted',
        resourceType: 'monitored_service',
        resourceId: req.params.id,
      });

      return ok(res, null, 'Service deleted');
    },

    async check(req, res) {
      const service = await repo.findServiceById(req.params.id, req.user.organizationId);
      if (!service) throw notFound('Service not found');
      if (!service.isActive) throw badRequest('Service is inactive');

      const result = await checker(service);
      const check = await repo.createUptimeCheck(req.user.organizationId, service.id, result);

      // Fire-and-forget: notification failure must not fail the check response.
      if (onCheckStored) {
        setImmediate(() => onCheckStored({ service, check }).catch(() => {}));
      }

      await audit({
        req,
        organizationId: req.user.organizationId,
        action: 'service.check_triggered',
        resourceType: 'monitored_service',
        resourceId: service.id,
        metadata: { status: check.status, responseTimeMs: check.responseTimeMs },
      });

      return ok(res, { check }, 'Uptime check completed', 201);
    },
  };
}

// Lazily resolve the uptime alert hook to avoid a circular import at module load.
// The function is imported here rather than at top-level so the import chain
// (services.controller → uptimeAlerts → alerts.repository → prisma) only
// executes when the server or worker actually instantiates the controller.
async function defaultOnCheckStored(ctx) {
  const { handleUptimeStateChange } = await import('../../lib/uptimeAlerts.js');
  return handleUptimeStateChange(ctx);
}

export const { create, list, get, update, remove, check } = makeServicesController({
  onCheckStored: defaultOnCheckStored,
});
