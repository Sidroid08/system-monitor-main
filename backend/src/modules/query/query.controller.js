import { z } from 'zod';
import { ok } from '../../utils/apiResponse.js';
import { badRequest } from '../../utils/errors.js';
import { BUCKET_SECONDS, parsePrometheusTime, resolveBucket, resolveTimeWindow } from '../../utils/timeWindow.js';
import { queryInstant, queryRange, labelValues } from '../../lib/vmClient.js';

const instantSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  time: z.string().max(80).optional(),
});

const rangeSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  start: z.string().min(1).max(80),
  end: z.string().min(1).max(80),
  step: z.enum(['auto', ...Object.keys(BUCKET_SECONDS)]).default('auto'),
});

const labelsSchema = z.object({
  label: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).max(100),
  match: z.string().trim().min(1).max(500).optional(),
});

export async function instant(req, res) {
  const { query, time } = instantSchema.parse(req.query.query ? req.query : req.body);
  if (time) parsePrometheusTime(time, 'time');
  const result = await queryInstant(req.user.organizationId, query, time);
  return ok(res, result, 'Query executed');
}

export async function range(req, res) {
  const { query, start, end, step } = rangeSchema.parse(req.query.query ? req.query : req.body);
  if (!start || !end) throw badRequest('start and end are required for range queries');
  const window = resolveTimeWindow({
    from: parsePrometheusTime(start, 'start'),
    to: parsePrometheusTime(end, 'end'),
  });
  const bucket = resolveBucket({ bucket: step, rangeSeconds: window.rangeSeconds });
  const result = await queryRange(req.user.organizationId, query, start, end, bucket.bucket);
  return ok(res, result, 'Range query executed');
}

export async function labels(req, res) {
  const { label, match } = labelsSchema.parse(req.query);
  const result = await labelValues(req.user.organizationId, label, match);
  return ok(res, result, 'Label values fetched');
}
