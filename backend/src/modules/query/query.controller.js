import { z } from 'zod';
import { ok } from '../../utils/apiResponse.js';
import { badRequest } from '../../utils/errors.js';
import { queryInstant, queryRange, labelValues } from '../../lib/vmClient.js';

const instantSchema = z.object({
  query: z.string().min(1),
  time: z.string().optional(),
});

const rangeSchema = z.object({
  query: z.string().min(1),
  start: z.string(),
  end: z.string(),
  step: z.string().optional(),
});

const labelsSchema = z.object({
  label: z.string().min(1),
  match: z.string().optional(),
});

export async function instant(req, res) {
  const { query, time } = instantSchema.parse(req.query.query ? req.query : req.body);
  const result = await queryInstant(req.user.organizationId, query, time);
  return ok(res, result, 'Query executed');
}

export async function range(req, res) {
  const { query, start, end, step } = rangeSchema.parse(req.query.query ? req.query : req.body);
  if (!start || !end) throw badRequest('start and end are required for range queries');
  const result = await queryRange(req.user.organizationId, query, start, end, step);
  return ok(res, result, 'Range query executed');
}

export async function labels(req, res) {
  const { label, match } = labelsSchema.parse(req.query);
  const result = await labelValues(req.user.organizationId, label, match);
  return ok(res, result, 'Label values fetched');
}
