import { env } from '../config/env.js';

// VictoriaMetrics supports ?extra_label=key=value to force-append a label filter
// to ALL selectors in a query. This is the correct way to enforce tenant isolation
// without parsing PromQL — no regex, no AST walking required.
// Docs: https://docs.victoriametrics.com/#prometheus-querying-api-enhancements

const DEFAULT_TIMEOUT_MS = 15_000;

function baseParams(organizationId) {
  const p = new URLSearchParams();
  p.set('extra_label', `organization_id=${organizationId}`);
  return p;
}

async function vmFetch(path, params, signal) {
  const url = `${env.victoriaMetricsUrl}${path}?${params.toString()}`;
  const res = await fetch(url, {
    signal: signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  const body = await res.json();

  if (!res.ok) {
    const msg = body?.error ?? body?.message ?? `VictoriaMetrics returned ${res.status}`;
    const err = new Error(msg);
    err.statusCode = res.status >= 500 ? 502 : res.status;
    throw err;
  }

  return body;
}

// Instant query — returns a scalar/vector at a single point in time.
// promql: any PromQL expression
// time:   RFC3339 or Unix timestamp (default: now)
export async function queryInstant(organizationId, promql, time) {
  const params = baseParams(organizationId);
  params.set('query', promql);
  if (time) params.set('time', time);
  return vmFetch('/api/v1/query', params);
}

// Range query — returns a matrix of values over a time range.
export async function queryRange(organizationId, promql, start, end, step) {
  const params = baseParams(organizationId);
  params.set('query', promql);
  params.set('start', start);
  params.set('end', end);
  if (step) params.set('step', step);
  return vmFetch('/api/v1/query_range', params);
}

// Label values — used for building dropdowns (e.g. list all node names for an org).
export async function labelValues(organizationId, labelName, match) {
  const params = baseParams(organizationId);
  if (match) params.set('match[]', match);
  return vmFetch(`/api/v1/label/${encodeURIComponent(labelName)}/values`, params);
}

// Health check against VictoriaMetrics (no org scope needed).
export async function vmHealthCheck() {
  const res = await fetch(`${env.victoriaMetricsUrl}/health`, {
    signal: AbortSignal.timeout(3_000),
  });
  return res.ok;
}
