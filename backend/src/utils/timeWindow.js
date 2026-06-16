import { badRequest } from './errors.js';

export const RANGE_SECONDS = Object.freeze({
  '1h': 60 * 60,
  '24h': 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
});

export const BUCKET_SECONDS = Object.freeze({
  '15s': 15,
  '30s': 30,
  '1m': 60,
  '5m': 5 * 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
  '6h': 6 * 60 * 60,
  '1d': 24 * 60 * 60,
});

export const MAX_RANGE_SECONDS = RANGE_SECONDS['30d'];
export const MAX_BUCKETS = 500;

function asDate(value, fieldName) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw badRequest(`${fieldName} must be a valid date`);
}

export function parsePrometheusTime(value, fieldName) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) {
    const date = new Date(Number(value) * 1000);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return asDate(value, fieldName);
}

export function resolveTimeWindow({
  range,
  from,
  to,
  defaultRange = '24h',
  allowedRanges = Object.keys(RANGE_SECONDS),
  now = new Date(),
  maxRangeSeconds = MAX_RANGE_SECONDS,
} = {}) {
  if (range && (from || to)) {
    throw badRequest('Use either range or from/to, not both');
  }

  if (range) {
    if (!allowedRanges.includes(range) || !RANGE_SECONDS[range]) {
      throw badRequest('Invalid time range');
    }
    const rangeSeconds = RANGE_SECONDS[range];
    return {
      from: new Date(now.getTime() - rangeSeconds * 1000),
      to: now,
      range,
      rangeSeconds,
    };
  }

  const defaultSeconds = RANGE_SECONDS[defaultRange] ?? RANGE_SECONDS['24h'];
  const toDate = to ? asDate(to, 'to') : now;
  const fromDate = from ? asDate(from, 'from') : new Date(toDate.getTime() - defaultSeconds * 1000);

  if (fromDate >= toDate) {
    throw badRequest('from must be before to');
  }

  const rangeSeconds = Math.ceil((toDate.getTime() - fromDate.getTime()) / 1000);
  if (rangeSeconds > maxRangeSeconds) {
    throw badRequest('Time range cannot exceed 30d');
  }

  return { from: fromDate, to: toDate, range: null, rangeSeconds };
}

export function autoBucketForRange(rangeSeconds) {
  if (rangeSeconds <= RANGE_SECONDS['1h']) return '1m';
  if (rangeSeconds <= RANGE_SECONDS['24h']) return '15m';
  if (rangeSeconds <= RANGE_SECONDS['7d']) return '1h';
  return '6h';
}

export function resolveBucket({ bucket = 'auto', rangeSeconds, maxBuckets = MAX_BUCKETS } = {}) {
  const selectedBucket = !bucket || bucket === 'auto' ? autoBucketForRange(rangeSeconds) : bucket;
  const bucketSeconds = BUCKET_SECONDS[selectedBucket];

  if (!bucketSeconds) {
    throw badRequest('Invalid bucket interval');
  }

  const bucketCount = Math.ceil(rangeSeconds / bucketSeconds);
  if (bucketCount > maxBuckets) {
    throw badRequest(`Bucket interval creates more than ${maxBuckets} buckets`);
  }

  return { bucket: selectedBucket, bucketSeconds, bucketCount };
}
