import { z } from 'zod';

const METRIC_TYPES = ['GAUGE', 'COUNTER', 'HISTOGRAM'];

export const listMetricsQuerySchema = z.object({
  serviceId: z.string().uuid().optional(),
  name:      z.string().max(200).optional(),
  type:      z.enum(METRIC_TYPES).optional(),
  from:      z.coerce.date().optional(),
  to:        z.coerce.date().optional(),
  cursor:    z.string().optional(),
  limit:     z.coerce.number().int().min(1).max(500).default(50),
});

export const listMetricNamesQuerySchema = z.object({
  serviceId: z.string().uuid().optional(),
  prefix:    z.string().max(100).optional(),
});
