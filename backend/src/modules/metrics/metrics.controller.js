import { listMetricsQuerySchema, listMetricNamesQuerySchema } from './metrics.schemas.js';
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

  return { listMetrics, listMetricNames };
}

const defaultController = makeMetricsController();
export const { listMetrics, listMetricNames } = defaultController;
