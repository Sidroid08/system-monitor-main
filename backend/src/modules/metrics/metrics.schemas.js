import { z } from 'zod';
import { BUCKET_SECONDS, RANGE_SECONDS } from '../../utils/timeWindow.js';

const METRIC_TYPES = ['GAUGE', 'COUNTER', 'HISTOGRAM'];
const AGGREGATIONS = ['avg', 'min', 'max', 'sum', 'count'];
const GROUP_BY_FIELDS = ['serviceId', 'name'];

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

function groupByValue(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

export const aggregateMetricsQuerySchema = z.object({
  serviceId:   z.string().uuid().optional(),
  name:        z.string().min(1).max(200).optional(),
  range:       z.enum(Object.keys(RANGE_SECONDS)).optional(),
  from:        z.coerce.date().optional(),
  to:          z.coerce.date().optional(),
  bucket:      z.enum(['auto', ...Object.keys(BUCKET_SECONDS)]).default('auto'),
  aggregation: z.enum(AGGREGATIONS).default('avg'),
  groupBy:     z.preprocess(
    groupByValue,
    z.array(z.enum(GROUP_BY_FIELDS)).max(2).default([]),
  ),
});
