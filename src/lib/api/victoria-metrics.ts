// Victoria Metrics client for querying metrics
const VICTORIA_METRICS_URL = process.env.NEXT_PUBLIC_VICTORIA_METRICS_URL || 'http://localhost:8428';

interface QueryOptions {
  query: string;
  start: number;
  end: number;
  step?: string;
}

export async function queryMetrics(options: QueryOptions) {
  const params = new URLSearchParams({
    query: options.query,
    start: options.start.toString(),
    end: options.end.toString(),
    step: options.step || '60s',
  });

  try {
    const response = await fetch(`${VICTORIA_METRICS_URL}/api/v1/query_range?${params}`);
    if (!response.ok) {
      throw new Error(`VictoriaMetrics error: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to query metrics:', error);
    throw error;
  }
}

export function buildMetricQuery(
  metricName: string,
  labels: Record<string, string>
): string {
  const labelPairs = Object.entries(labels)
    .map(([key, value]) => `${key}="${value}"`)
    .join(',');
  return `${metricName}{${labelPairs}}`;
}
