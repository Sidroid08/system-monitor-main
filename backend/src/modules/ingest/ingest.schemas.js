import { z } from 'zod';

const LOG_LEVELS   = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
const METRIC_TYPES = ['GAUGE', 'COUNTER', 'HISTOGRAM'];
const MAX_BATCH    = 100;

// ─── Log schemas ─────────────────────────────────────────────────────────────

export const logItemSchema = z.object({
  level:       z.enum(LOG_LEVELS).default('INFO'),
  message:     z.string().min(1).max(50_000), // raw; truncation happens in controller
  timestamp:   z.string().optional(),
  source:      z.string().max(100).optional(),
  environment: z.string().max(50).optional(),
  traceId:     z.string().max(128).optional(),
  spanId:      z.string().max(64).optional(),
  requestId:   z.string().max(128).optional(),
  serviceId:   z.string().uuid().optional(),
  attributes:  z.record(z.unknown()).optional(),
});

export const logBatchSchema = z.union([
  logItemSchema,
  z.object({
    logs: z.array(logItemSchema).min(1).max(MAX_BATCH),
  }),
]);

// ─── Metric schemas ───────────────────────────────────────────────────────────

export const metricItemSchema = z.object({
  name:      z.string().min(1).max(200),
  type:      z.enum(METRIC_TYPES).default('GAUGE'),
  value:     z.number().finite(),
  unit:      z.string().max(50).optional(),
  timestamp: z.string().optional(),
  serviceId: z.string().uuid().optional(),
  tags:      z.record(z.unknown()).optional(),
});

export const metricBatchSchema = z.union([
  metricItemSchema,
  z.object({
    metrics: z.array(metricItemSchema).min(1).max(MAX_BATCH),
  }),
]);

export const MAX_BATCH_SIZE = MAX_BATCH;
