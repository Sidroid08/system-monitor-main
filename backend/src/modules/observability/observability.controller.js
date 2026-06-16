import { z } from 'zod';
import { ok } from '../../utils/apiResponse.js';
import { notFound } from '../../utils/errors.js';
import { resolveBucket, resolveTimeWindow } from '../../utils/timeWindow.js';
import { vmHealthCheck } from '../../lib/vmClient.js';
import { serviceSummaryQuerySchema } from './observability.schemas.js';
import * as defaultRepo from './observability.repository.js';

const serviceParamsSchema = z.object({
  serviceId: z.string().uuid(),
});

export function makeObservabilityController(deps = {}) {
  const repo = deps.repo ?? defaultRepo;
  const checkVictoriaMetrics = deps.vmHealthCheck ?? vmHealthCheck;

  async function overview(req, res) {
    const window = resolveTimeWindow({ range: '24h' });
    const data = await repo.getOverview(req.user.organizationId, window);
    return ok(res, data, 'Observability overview fetched');
  }

  async function serviceSummary(req, res) {
    const { serviceId } = serviceParamsSchema.parse(req.params);
    const query = serviceSummaryQuerySchema.parse(req.query);
    const window = resolveTimeWindow({ range: query.range });
    const bucket = resolveBucket({ bucket: query.bucket, rangeSeconds: window.rangeSeconds });

    const summary = await repo.getServiceSummary(req.user.organizationId, serviceId, {
      ...window,
      bucketSeconds: bucket.bucketSeconds,
      bucketLimit: bucket.bucketCount + 1,
    });

    if (!summary) throw notFound('Service not found');

    return ok(res, {
      window: {
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        range: query.range,
        bucket: bucket.bucket,
        bucketCount: bucket.bucketCount,
      },
      ...summary,
    }, 'Service observability summary fetched');
  }

  async function retentionStatus(req, res) {
    const data = await repo.getRetentionStatus(req.user.organizationId);
    return ok(res, data, 'Telemetry retention status fetched');
  }

  async function victoriaMetricsHealth(req, res) {
    const healthy = await checkVictoriaMetrics();
    if (!healthy) {
      return res.status(503).json({
        success: false,
        message: 'VictoriaMetrics unreachable',
        data: { status: 'unhealthy', reachable: false },
      });
    }
    return ok(res, {
      status: 'healthy',
      reachable: true,
    }, 'VictoriaMetrics health checked');
  }

  return { overview, serviceSummary, retentionStatus, victoriaMetricsHealth };
}

const defaultController = makeObservabilityController();
export const {
  overview,
  serviceSummary,
  retentionStatus,
  victoriaMetricsHealth,
} = defaultController;
