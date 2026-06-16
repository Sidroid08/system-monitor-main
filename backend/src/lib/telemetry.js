// ─── Telemetry shared utilities ───────────────────────────────────────────────

// Metric name: Prometheus-compatible — letter/underscore/colon start, then
// letters/digits/underscores/colons/hyphens/dots, max 200 chars.
const METRIC_NAME_RE = /^[a-zA-Z_:][a-zA-Z0-9_:.-]{0,199}$/;

// Sensitive key patterns to redact from attributes/tags (case-insensitive).
const SENSITIVE_KEYS = [
  'password', 'passwd', 'secret', 'token', 'authorization',
  'apikey', 'api_key', 'cookie', 'credential', 'credentials',
  'private_key', 'access_key', 'secret_key',
];

const MAX_ATTRS_KEYS  = 50;
const MAX_KEY_LEN     = 100;
const MAX_VALUE_LEN   = 500;
const MAX_MESSAGE_LEN = 5000;

export function isValidMetricName(name) {
  return typeof name === 'string' && METRIC_NAME_RE.test(name);
}

export function truncateMessage(msg) {
  if (typeof msg !== 'string') return String(msg ?? '').slice(0, MAX_MESSAGE_LEN);
  return msg.length > MAX_MESSAGE_LEN ? msg.slice(0, MAX_MESSAGE_LEN) : msg;
}

export function redactAndLimitAttrs(attrs) {
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return undefined;

  const result = {};
  let count = 0;

  for (const [rawKey, rawVal] of Object.entries(attrs)) {
    if (count >= MAX_ATTRS_KEYS) break;

    const key = String(rawKey).slice(0, MAX_KEY_LEN);
    const lkey = key.toLowerCase().replace(/[-\s]/g, '_');

    if (SENSITIVE_KEYS.some((s) => lkey === s || lkey.includes(s))) continue;

    const val = rawVal === null || rawVal === undefined
      ? null
      : typeof rawVal === 'object'
        ? JSON.stringify(rawVal).slice(0, MAX_VALUE_LEN)
        : String(rawVal).slice(0, MAX_VALUE_LEN);

    result[key] = val;
    count++;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function parseTimestamp(ts) {
  if (!ts) return new Date();
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return new Date();
  const now = Date.now();
  // Reject timestamps more than 24h in the future or more than 30 days old.
  if (d.getTime() > now + 86_400_000) return new Date();
  if (d.getTime() < now - 30 * 86_400_000) return new Date();
  return d;
}

export function truncateStr(s, max) {
  if (typeof s !== 'string') return undefined;
  return s.slice(0, max) || undefined;
}
