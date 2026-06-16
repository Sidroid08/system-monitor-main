import dns from 'dns/promises';
import net from 'net';
import { badRequest } from '../../utils/errors.js';

const HTTP_SERVICE_TYPES = new Set(['HTTP', 'API', 'WEB']);
const MAX_ERROR_LENGTH = 500;

export function truncateError(message) {
  if (!message) return null;
  return String(message).slice(0, MAX_ERROR_LENGTH);
}

export function calculateCheckStatus({ error = null, httpStatusCode = null, responseTimeMs = null, expectedStatusCode = 200, timeoutMs = 5000 }) {
  if (error) return 'DOWN';
  if (!httpStatusCode) return 'DOWN';
  if (httpStatusCode === expectedStatusCode) {
    return responseTimeMs !== null && responseTimeMs > Math.floor(timeoutMs * 0.8)
      ? 'DEGRADED'
      : 'UP';
  }
  return httpStatusCode >= 500 ? 'DOWN' : 'DEGRADED';
}

export function summarizeServiceHealth(service, latestCheck = null) {
  return {
    ...service,
    currentStatus: latestCheck?.status ?? service.currentStatus ?? 'UNKNOWN',
    lastCheckedAt: latestCheck?.checkedAt ?? service.lastCheckedAt ?? null,
    lastResponseTimeMs: latestCheck?.responseTimeMs ?? service.lastResponseTimeMs ?? null,
    latestCheck,
  };
}

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  return a === 10
    || a === 127
    || a === 0
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254);
}

function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase();
  return normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:')
    || normalized === '::'
    || normalized.startsWith('::ffff:127.')
    || normalized.startsWith('::ffff:10.')
    || normalized.startsWith('::ffff:192.168.');
}

function isBlockedIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;
}

function blockedHostname(hostname) {
  const lower = hostname.toLowerCase();
  return lower === 'localhost'
    || lower.endsWith('.localhost')
    || lower === 'metadata.google.internal';
}

export function buildCheckUrl(service) {
  if (!HTTP_SERVICE_TYPES.has(service.type)) {
    throw badRequest('Manual HTTP checks support HTTP, API, and WEB services only');
  }
  if (!service.url) throw badRequest('Service URL is required for manual check');

  const url = new URL(service.url);
  if (url.username || url.password) {
    throw badRequest('Service URL must not include credentials');
  }

  if (service.healthPath) {
    url.pathname = service.healthPath.startsWith('/') ? service.healthPath : `/${service.healthPath}`;
  }

  return url;
}

export async function assertSafeCheckTarget(url, resolver = dns.lookup) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw badRequest('Only http and https service URLs are supported');
  }

  if (blockedHostname(url.hostname)) {
    throw badRequest('Service URL host is not allowed for uptime checks');
  }

  if (net.isIP(url.hostname)) {
    if (isBlockedIp(url.hostname)) {
      throw badRequest('Service URL IP is not allowed for uptime checks');
    }
    return;
  }

  const records = await resolver(url.hostname, { all: true, verbatim: false });
  const addresses = Array.isArray(records) ? records : [records];
  if (!addresses.length || addresses.some((r) => isBlockedIp(r.address))) {
    throw badRequest('Service URL resolves to a private or blocked address');
  }
}

export async function performHttpCheck(
  service,
  {
    fetchImpl = globalThis.fetch,
    resolver = dns.lookup,
    now = () => Date.now(),
    checkSource = 'manual',
  } = {},
) {
  const url = buildCheckUrl(service);
  await assertSafeCheckTarget(url, resolver);

  const controller = new AbortController();
  const startedAt = now();
  const timeout = setTimeout(() => controller.abort(), service.timeoutMs);

  try {
    const response = await fetchImpl(url.toString(), {
      method: service.method ?? 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    const responseTimeMs = Math.max(0, now() - startedAt);
    return {
      status: calculateCheckStatus({
        httpStatusCode: response.status,
        responseTimeMs,
        expectedStatusCode: service.expectedStatusCode,
        timeoutMs: service.timeoutMs,
      }),
      httpStatusCode: response.status,
      responseTimeMs,
      errorMessage: null,
      checkSource,
      metadata: {
        method: service.method ?? 'GET',
        expectedStatusCode: service.expectedStatusCode,
      },
    };
  } catch (error) {
    const responseTimeMs = Math.max(0, now() - startedAt);
    return {
      status: 'DOWN',
      httpStatusCode: null,
      responseTimeMs,
      errorMessage: truncateError(error?.name === 'AbortError' ? 'Request timed out' : error?.message ?? 'Request failed'),
      checkSource,
      metadata: {
        method: service.method ?? 'GET',
        expectedStatusCode: service.expectedStatusCode,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}
