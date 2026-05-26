'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Metric } from '@/types';
import { format } from 'date-fns';

interface TimeSeriesChartProps {
  title: string;
  data: Metric[];
  color?: string;
  unit?: string;
  height?: number;
  gradientId?: string;
  /** Optional raw value → display string override for Y axis ticks */
  yTickFormatter?: (v: number) => string;
}

// Smart formatter: converts raw bytes/s into KB/s or MB/s for compact Y-axis labels
function formatBytes(v: number): string {
  if (v >= 1_048_576) return `${(v / 1_048_576).toFixed(1)}M`;
  if (v >= 1_024)    return `${(v / 1_024).toFixed(1)}K`;
  return `${v.toFixed(0)}`;
}

const CustomTooltip = ({ active, payload, unit }: any) => {
  if (!active || !payload?.length) return null;

  const point = payload[0];
  let display = `${Number(point.value).toFixed(2)}${unit || ''}`;
  if (unit === ' B/s') {
    const raw = Number(point.value);
    if (raw >= 1_048_576) display = `${(raw / 1_048_576).toFixed(2)} MB/s`;
    else if (raw >= 1_024) display = `${(raw / 1_024).toFixed(2)} KB/s`;
    else display = `${raw.toFixed(2)} B/s`;
  }

  return (
    <div className="glass-card px-3 py-2 shadow-xl border border-slate-700/50 !rounded-lg">
      <p className="text-[10px] text-slate-400 mb-0.5">
        {format(new Date(point.payload.timestamp), 'HH:mm:ss')}
      </p>
      <p className="text-sm font-bold text-white">{display}</p>
    </div>
  );
};

export default function TimeSeriesChart({
  title,
  data,
  color = '#3b82f6',
  unit = '%',
  height = 200,
  gradientId = 'chart-gradient',
  yTickFormatter,
}: TimeSeriesChartProps) {
  const chartData = data.map((d) => ({
    timestamp: d.timestamp,
    value: d.value,
  }));

  // Byte charts need slightly wider Y-axis but not excessive
  const isBytes = unit === ' B/s';
  const leftMargin = isBytes ? -4 : -10;
  const yAxisWidth = isBytes ? 44 : 40;

  const defaultTickFmt = isBytes
    ? (v: number) => formatBytes(v)
    : (v: number) => `${v}${unit}`;
  const tickFmt = yTickFormatter ?? defaultTickFmt;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        {chartData.length > 0 && (
          <span className="text-xs text-slate-500">{chartData.length} data points</span>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center text-slate-500 text-sm" style={{ height }}>
          No data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: leftMargin, bottom: 5 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => format(new Date(ts), 'HH:mm')}
              stroke="rgba(148,163,184,0.2)"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="rgba(148,163,184,0.2)"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={tickFmt}
              width={yAxisWidth}
            />
            <Tooltip content={<CustomTooltip unit={unit} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, stroke: color, strokeWidth: 2, fill: '#0a0e1a' }}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
