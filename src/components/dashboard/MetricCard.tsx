'use client';

import clsx from 'clsx';
import { Metric } from '@/types';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  threshold?: number;
  icon?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  variant?: 'blue' | 'purple' | 'green' | 'amber' | 'rose' | 'cyan';
  sparklineData?: Metric[];
}

const variantConfig = {
  blue: {
    card: 'metric-card-blue',
    color: '#3b82f6',
    gradient: 'from-blue-500/20 to-transparent',
    text: 'text-blue-400',
    fill: 'rgba(59, 130, 246, 0.15)',
    stroke: '#3b82f6',
  },
  purple: {
    card: 'metric-card-purple',
    color: '#8b5cf6',
    gradient: 'from-violet-500/20 to-transparent',
    text: 'text-violet-400',
    fill: 'rgba(139, 92, 246, 0.15)',
    stroke: '#8b5cf6',
  },
  green: {
    card: 'metric-card-green',
    color: '#22c55e',
    gradient: 'from-emerald-500/20 to-transparent',
    text: 'text-emerald-400',
    fill: 'rgba(34, 197, 94, 0.15)',
    stroke: '#22c55e',
  },
  amber: {
    card: 'metric-card-amber',
    color: '#f59e0b',
    gradient: 'from-amber-500/20 to-transparent',
    text: 'text-amber-400',
    fill: 'rgba(245, 158, 11, 0.15)',
    stroke: '#f59e0b',
  },
  rose: {
    card: 'metric-card-rose',
    color: '#f43f5e',
    gradient: 'from-rose-500/20 to-transparent',
    text: 'text-rose-400',
    fill: 'rgba(244, 63, 94, 0.15)',
    stroke: '#f43f5e',
  },
  cyan: {
    card: 'metric-card-cyan',
    color: '#06b6d4',
    gradient: 'from-cyan-500/20 to-transparent',
    text: 'text-cyan-400',
    fill: 'rgba(6, 182, 212, 0.15)',
    stroke: '#06b6d4',
  },
};

export default function MetricCard({
  title,
  value,
  unit,
  threshold,
  icon,
  trend,
  trendValue,
  variant = 'blue',
  sparklineData,
}: MetricCardProps) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  const isWarning = threshold && !isNaN(numValue) && numValue > threshold;
  const config = variantConfig[variant];

  // Prepare sparkline data for chart (use last 20 points)
  const chartData = sparklineData
    ? sparklineData.slice(-20).map((d) => ({ v: d.value }))
    : [];

  return (
    <div
      className={clsx(
        'relative p-5 rounded-2xl transition-all duration-300 overflow-hidden group',
        config.card,
        isWarning && 'border-red-500/30 bg-red-950/20'
      )}
    >
      {/* Background gradient glow */}
      <div className={clsx(
        'absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-30 transition-opacity group-hover:opacity-50 pointer-events-none',
        `bg-gradient-to-br ${config.gradient}`
      )} />

      {/* Header */}
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          {icon && <span className="text-xl">{icon}</span>}
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h3>
        </div>
        {trend && (
          <div className={clsx(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
            trend === 'up' && 'bg-emerald-500/10 text-emerald-400',
            trend === 'down' && 'bg-red-500/10 text-red-400',
            trend === 'stable' && 'bg-slate-500/10 text-slate-400'
          )}>
            {trend === 'up' && '↑'}
            {trend === 'down' && '↓'}
            {trend === 'stable' && '→'}
            {trendValue}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex items-end gap-2 mb-3 relative z-10 animate-count-up">
        <div className={clsx('text-3xl font-bold tracking-tight', isWarning ? 'text-red-400' : 'text-white')}>
          {isNaN(numValue) ? value : value}
        </div>
        {unit && (
          <div className="text-sm text-slate-500 mb-0.5 font-medium">{unit}</div>
        )}
      </div>

      {/* Sparkline */}
      {chartData.length > 2 && (
        <div className="h-10 -mx-1 relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${variant}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={config.stroke} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={config.stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={config.stroke}
                strokeWidth={1.5}
                fill={`url(#gradient-${variant})`}
                dot={false}
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Threshold warning */}
      {isWarning && (
        <p className="text-[11px] text-red-400/80 mt-2 flex items-center gap-1 relative z-10">
          <span className="status-dot status-dot-danger" />
          Above threshold ({threshold}{unit})
        </p>
      )}
    </div>
  );
}
