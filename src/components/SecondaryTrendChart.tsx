import React, { useState, useMemo } from 'react';
import { BenchmarkType } from '../types';
import { formatNumberWithCommas, formatRate } from '../utils/calculations';

interface SecondaryTrendChartProps {
  benchmark: BenchmarkType;
  benchmarkRate: number;
  benchmarkLabel: string;
  isMoreFavorable: boolean;
  directionCode: 'VND_TO_SGD' | 'SGD_TO_VND';
  todayRate: number;
  dailyPoints: Array<{ date: string; close: number }>;
}

export const SecondaryTrendChart: React.FC<SecondaryTrendChartProps> = ({
  benchmarkRate,
  benchmarkLabel,
  isMoreFavorable,
  directionCode,
  todayRate,
  dailyPoints,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Normalize points sorted chronologically (oldest to newest)
  const series = useMemo(() => {
    if (!dailyPoints || dailyPoints.length === 0) {
      return [{ index: 0, dateStr: 'Today', rate: todayRate, rawDate: '' }];
    }

    const sorted = [...dailyPoints].sort((a, b) => a.date.localeCompare(b.date));

    return sorted.map((pt, idx) => {
      let dateLabel = pt.date;
      try {
        const d = new Date(`${pt.date}T00:00:00Z`);
        dateLabel = d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });
      } catch (e) {
        // Fallback to raw date string
      }

      return {
        index: idx,
        dateStr: dateLabel,
        rawDate: pt.date,
        rate: pt.close,
        isLatest: idx === sorted.length - 1,
      };
    });
  }, [dailyPoints, todayRate]);

  // Calculate SVG bounds
  const rates = series.map((d) => d.rate);
  const minRate = Math.min(...rates, todayRate, benchmarkRate) - 60;
  const maxRate = Math.max(...rates, todayRate, benchmarkRate) + 60;
  const rateRange = maxRate - minRate || 1;

  const width = 380;
  const height = 140;
  const paddingX = 22;
  const paddingTop = 24;
  const paddingBottom = 26;

  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  const getX = (index: number) => {
    if (series.length <= 1) return width / 2;
    return paddingX + (index / (series.length - 1)) * innerWidth;
  };

  const getY = (rate: number) => {
    return paddingTop + (1 - (rate - minRate) / rateRange) * innerHeight;
  };

  // Path for polyline
  const pointsString = series.map((d, i) => `${getX(i)},${getY(d.rate)}`).join(' ');

  // Today coordinate (represented at the latest time on the right)
  const todayX = getX(series.length - 1);
  const todayY = getY(todayRate);
  const benchmarkY = getY(benchmarkRate);

  const activePoint = hoveredIdx !== null ? series[hoveredIdx] : series[series.length - 1];

  const firstDateLabel = series[0]?.dateStr || '30d ago';
  const lastDateLabel = series[series.length - 1]?.dateStr || 'Today';

  const isTodayBelow = todayRate < benchmarkRate;

  return (
    <div id="secondary-trend-container" className="w-full bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 overflow-hidden">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div>
          <span id="chart-title" className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
            30-Day Rate Context (Secondary Reference)
          </span>
          <span id="chart-caption" className="text-[11px] text-slate-500 block">
            Daily historical close prices to help you visualize today’s rate position
          </span>
        </div>
        <span id="chart-provider-pill" className="text-[10px] font-medium bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded shrink-0">
          Alpha Vantage FX_DAILY
        </span>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          id="trend-svg"
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block select-none"
        >
          {/* Subtle gradient under line */}
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Benchmark horizontal reference line */}
          <line
            id="benchmark-reference-line"
            x1={paddingX}
            y1={benchmarkY}
            x2={width - paddingX}
            y2={benchmarkY}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
          <text
            x={paddingX + 2}
            y={Math.max(benchmarkY - 6, 12)}
            fill="#64748b"
            fontSize="10.5"
            fontWeight="600"
          >
            {benchmarkLabel}: {formatRate(benchmarkRate)} VND
          </text>

          {/* Area fill */}
          {series.length > 1 && (
            <polygon
              points={`${getX(0)},${height - paddingBottom} ${pointsString} ${todayX},${height - paddingBottom}`}
              fill="url(#trendGradient)"
            />
          )}

          {/* Trend line */}
          {series.length > 1 && (
            <polyline
              fill="none"
              stroke="#334155"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsString}
            />
          )}

          {/* Today point marker */}
          <circle
            id="today-rate-outer-ring"
            cx={todayX}
            cy={todayY}
            r="6"
            className={isMoreFavorable ? 'fill-emerald-100 stroke-emerald-600' : 'fill-amber-100 stroke-amber-600'}
            strokeWidth="2"
          />
          <circle
            id="today-rate-center-dot"
            cx={todayX}
            cy={todayY}
            r="3"
            className={isMoreFavorable ? 'fill-emerald-600' : 'fill-amber-600'}
          />

          {/* Today label callout */}
          <text
            x={todayX - 8}
            y={Math.min(Math.max(todayY + (isTodayBelow ? 16 : -8), 14), height - paddingBottom - 4)}
            textAnchor="end"
            fill="#0f172a"
            fontSize="11"
            fontWeight="700"
          >
            Today: {formatRate(todayRate)} VND
          </text>

          {/* X-axis labels */}
          <text x={paddingX} y={height - 8} fill="#94a3b8" fontSize="10.5" fontWeight="500">
            {firstDateLabel}
          </text>
          {series.length > 8 && (
            <text x={getX(Math.floor(series.length * 0.75))} y={height - 8} fill="#94a3b8" fontSize="10.5" fontWeight="500">
              ~7d ago
            </text>
          )}
          <text x={todayX} y={height - 8} textAnchor="end" fill="#334155" fontWeight="700" fontSize="10.5">
            {lastDateLabel}
          </text>

          {/* Interactive touch/hover points */}
          {series.map((d, i) => (
            <circle
              key={d.rawDate || i}
              cx={getX(i)}
              cy={getY(d.rate)}
              r="12"
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              onTouchStart={() => setHoveredIdx(i)}
            />
          ))}
        </svg>
      </div>

      {activePoint && (
        <div id="chart-inspection-pill" className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200 gap-1">
          <span className="font-medium text-slate-800">
            {activePoint.dateStr}: <strong className="text-slate-900 font-bold">{formatRate(activePoint.rate)} VND</strong>
          </span>
          <span className="text-[11px] text-slate-500">
            {activePoint.rate < benchmarkRate
              ? `${formatRate(benchmarkRate - activePoint.rate)} VND lower than ${benchmarkLabel}`
              : `${formatRate(activePoint.rate - benchmarkRate)} VND higher than ${benchmarkLabel}`}
          </span>
        </div>
      )}

      <p id="chart-plain-explainer" className="mt-2 text-[11px] text-slate-500 leading-relaxed">
        {directionCode === 'VND_TO_SGD'
          ? (isTodayBelow
              ? 'Today’s rate sits below the dotted benchmark line. When converting VND to SGD, being below the line is favorable because each Singapore Dollar costs fewer Vietnamese Dong.'
              : 'Today’s rate sits above the dotted benchmark line. When converting VND to SGD, being above the line means each Singapore Dollar costs more Vietnamese Dong.')
          : (isTodayBelow
              ? 'Today’s rate sits below the dotted benchmark line. When converting SGD to VND, being below the line means you receive fewer Vietnamese Dong than the recent benchmark.'
              : 'Today’s rate sits above the dotted benchmark line. When converting SGD to VND, being above the line is favorable because you receive more Vietnamese Dong for each Singapore Dollar.')}
      </p>
    </div>
  );
};
