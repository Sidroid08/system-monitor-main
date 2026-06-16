import {
  aggregateMetricsQuerySchema,
  listMetricsQuerySchema,
  listMetricNamesQuerySchema,
} from './metrics.schemas.js';
import { notFound } from '../../utils/errors.js';
import { resolveBucket, resolveTimeWindow } from '../../utils/timeWindow.js';
import * as defaultRepo from './metrics.repository.js';

export function makeMetricsController(deps = {}) {
  const repo = deps.repo ?? defaultRepo;

  async function listMetrics(req, res) {
    const parsed = listMetricsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    }

    const { limit, ...filters } = parsed.data;
    const organizationId = req.user.organizationId;

    const { rows, nextCursor } = await repo.listMetrics(organizationId, { ...filters, limit });
    return res.json({ data: rows, nextCursor });
  }

  async function listMetricNames(req, res) {
    const parsed = listMetricNamesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    }

    const organizationId = req.user.organizationId;
    const names = await repo.listMetricNames(organizationId, parsed.data);
    return res.json({ data: names });
  }

  async function aggregateMetrics(req, res) {
    const parsed = aggregateMetricsQuerySchema.safeParse(req.query);
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

    const rows = await repo.aggregateMetrics(organizationId, {
      serviceId: query.serviceId,
      name: query.name,
      from: window.from,
      to: window.to,
      bucketSeconds: bucket.bucketSeconds,
      aggregation: query.aggregation,
      groupBy: [...new Set(query.groupBy)],
    });

    return res.json({
      data: rows,
      meta: {
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        range: query.range ?? null,
        bucket: bucket.bucket,
        bucketCount: bucket.bucketCount,
        aggregation: query.aggregation,
        groupBy: [...new Set(query.groupBy)],
      },
    });
  }

  return { listMetrics, listMetricNames, aggregateMetrics };
}

const defaultController = makeMetricsController();
export const { listMetrics, listMetricNames, aggregateMetrics } = defaultController;
