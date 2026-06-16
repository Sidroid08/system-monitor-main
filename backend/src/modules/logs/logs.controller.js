import { listLogsQuerySchema, logStatsQuerySchema } from './logs.schemas.js';
import { notFound } from '../../utils/errors.js';
import { resolveBucket, resolveTimeWindow } from '../../utils/timeWindow.js';
import * as defaultRepo from './logs.repository.js';

export function makeLogsController(deps = {}) {
  const repo = deps.repo ?? defaultRepo;

  async function listLogs(req, res) {
    const parsed = listLogsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    }

    const { limit, ...filters } = parsed.data;
    const organizationId = req.user.organizationId;

    const { rows, nextCursor } = await repo.listLogs(organizationId, { ...filters, limit });
    return res.json({ data: rows, nextCursor });
  }

  async function getLog(req, res) {
    const organizationId = req.user.organizationId;
    const entry = await repo.findLogById(req.params.id, organizationId);
    if (!entry) return res.status(404).json({ error: 'Log entry not found' });
    return res.json(entry);
  }

  async function getLogStats(req, res) {
    const parsed = logStatsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    }

    const organizationId = req.user.organizationId;
    const query = parsed.data;

    if (query.serviceId && !(await repo.serviceExistsInOrg(organizationId, query.serviceId))) {
      throw notFound('Service not found');
    }

    const window = resolveTimeWindow({
      range: query.range,
      from: query.from,
      to: query.to,
    });
    const bucket = resolveBucket({ bucket: query.bucket, rangeSeconds: window.rangeSeconds });

    const stats = await repo.getLogStats(organizationId, {
      serviceId: query.serviceId,
      level: query.level,
      from: window.from,
      to: window.to,
      bucketSeconds: bucket.bucketSeconds,
    });

    return res.json({
      data: stats,
      meta: {
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        range: query.range ?? null,
        bucket: bucket.bucket,
        bucketCount: bucket.bucketCount,
        level: query.level ?? null,
      },
    });
  }

  return { listLogs, getLog, getLogStats };
}

const defaultController = makeLogsController();
export const { listLogs, getLog, getLogStats } = defaultController;
