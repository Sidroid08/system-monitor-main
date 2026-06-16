import {
  isValidMetricName,
  truncateMessage,
  redactAndLimitAttrs,
  parseTimestamp,
  truncateStr,
} from '../../lib/telemetry.js';
import { logBatchSchema, metricBatchSchema } from './ingest.schemas.js';
import * as defaultRepo from './ingest.repository.js';

export function makeIngestController(deps = {}) {
  const repo = deps.repo ?? defaultRepo;

  // ─── POST /api/ingest/logs ─────────────────────────────────────────────────

  async function ingestLogs(req, res) {
    const { organizationId } = req.apiKey;
    const parsed = logBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    }

    const rawItems = parsed.data.logs ?? [parsed.data];
    const accepted = [];
    const rejected = [];

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const serviceId = item.serviceId ?? null;

      if (serviceId) {
        const ok = await repo.serviceExistsInOrg(serviceId, organizationId);
        if (!ok) {
          rejected.push({ index: i, reason: 'serviceId not found in organization' });
          continue;
        }
      }

      accepted.push({
        organizationId,
        serviceId,
        level:       item.level,
        message:     truncateMessage(item.message),
        timestamp:   parseTimestamp(item.timestamp),
        source:      truncateStr(item.source, 100) ?? null,
        environment: truncateStr(item.environment, 50) ?? null,
        traceId:     truncateStr(item.traceId, 128) ?? null,
        spanId:      truncateStr(item.spanId, 64) ?? null,
        requestId:   truncateStr(item.requestId, 128) ?? null,
        attributes:  redactAndLimitAttrs(item.attributes) ?? undefined,
        ingestionSource: 'API_KEY',
      });
    }

    if (accepted.length > 0) {
      await repo.insertLogBatch(accepted);
    }

    return res.status(207).json({
      accepted: accepted.length,
      rejected: rejected.length,
      ...(rejected.length > 0 && { errors: rejected }),
    });
  }

  // ─── POST /api/ingest/metrics ──────────────────────────────────────────────

  async function ingestMetrics(req, res) {
    const { organizationId } = req.apiKey;
    const parsed = metricBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    }

    const rawItems = parsed.data.metrics ?? [parsed.data];
    const accepted = [];
    const rejected = [];

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];

      if (!isValidMetricName(item.name)) {
        rejected.push({ index: i, reason: 'Invalid metric name' });
        continue;
      }

      const serviceId = item.serviceId ?? null;
      if (serviceId) {
        const ok = await repo.serviceExistsInOrg(serviceId, organizationId);
        if (!ok) {
          rejected.push({ index: i, reason: 'serviceId not found in organization' });
          continue;
        }
      }

      accepted.push({
        organizationId,
        serviceId,
        name:      item.name,
        type:      item.type,
        value:     item.value,
        unit:      truncateStr(item.unit, 50) ?? null,
        timestamp: parseTimestamp(item.timestamp),
        tags:      redactAndLimitAttrs(item.tags) ?? undefined,
        ingestionSource: 'API_KEY',
      });
    }

    if (accepted.length > 0) {
      await repo.insertMetricBatch(accepted);
    }

    return res.status(207).json({
      accepted: accepted.length,
      rejected: rejected.length,
      ...(rejected.length > 0 && { errors: rejected }),
    });
  }

  return { ingestLogs, ingestMetrics };
}

const defaultController = makeIngestController();
export const { ingestLogs, ingestMetrics } = defaultController;
