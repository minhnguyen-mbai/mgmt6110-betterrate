import React, { useState } from 'react';
import { MOCK_30_DAYS_SERIES, TODAY_RATE, AVERAGE_7D, AVERAGE_30D } from '../data/mockRates';
import { BenchmarkType } from '../types';
import { formatNumberWithCommas } from '../utils/calculations';

interface SecondaryTrendChartProps {
  benchmark: BenchmarkType;
  isMoreFavorable: boolean;
  directionCode: 'VND_TO_SGD' | 'SGD_TO_VND';
}

export const SecondaryTrendChart: React.FC<SecondaryTrendChartProps> = ({
  benchmark,
  isMoreFavorable,
  directionCode,
}) => {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const benchmarkRate = benchmark === '7d' ? AVERAGE_7D : AVERAGE_30D;
  const benchmarkLabel = benchmark === '7d' ? '7-day average' : '30-day average';

  // Calculate SVG bounds
  const rates = MOCK_30_DAYS_SERIES.map((d) => d.rate);
  const minRate = Math.min(...rates, benchmarkRate) - 80;
  const maxRate = Math.max(...rates, benchmarkRate) + 80;
  const rateRange = maxRate - minRate || 1;

  const width = 380;
  const height = 135;
  const paddingX = 20;
  const paddingTop = 22;
  const paddingBottom = 26;

  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  const getX = (index: number) => paddingX + (index / (MOCK_30_DAYS_SERIES.length - 1)) * innerWidth;
  const getY = (rate: number) => paddingTop + (1 - (rate - minRate) / rateRange) * innerHeight;

  // Path for the line
  const points = MOCK_30_DAYS_SERIES.map((d, i) => `${getX(i)},${getY(d.rate)}`).join(' ');

  // Today coordinate
  const todayX = getX(MOCK_30_DAYS_SERIES.length - 1);
  const todayY = getY(TODAY_RATE);
  const benchmarkY = getY(benchmarkRate);

  const activePoint = hoveredDay !== null
    ? MOCK_30_DAYS_SERIES.find((d) => d.dayIndex === hoveredDay)
    : MOCK_30_DAYS_SERIES[MOCK_30_DAYS_SERIES.length - 1];

  return (
    <div id="secondary-trend-container" className="w-full bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 overflow-hidden">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div>
          <span id="chart-title" className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
            30-Day Rate Context (Secondary Reference)
          </span>
          <span id="chart-caption" className="text-[11px] text-slate-500 block">
            Simulated mock rates to help you visualize today’s position
          </span>
        </div>
        <span id="chart-mock-pill" className="text-[10px] font-medium bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded shrink-0">
          Mock Data
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
            {benchmarkLabel}: {formatNumberWithCommas(benchmarkRate)} VND
          </text>

          {/* Area fill */}
          <polygon
            points={`${getX(0)},${height - paddingBottom} ${points} ${todayX},${height - paddingBottom}`}
            fill="url(#trendGradient)"
          />

          {/* Trend line */}
          <polyline
            fill="none"
            stroke="#334155"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

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
            y={todayY + 16}
            textAnchor="end"
            fill="#0f172a"
            fontSize="11"
            fontWeight="700"
          >
            Today: {formatNumberWithCommas(TODAY_RATE)} VND
          </text>

          {/* X-axis labels */}
          <text x={paddingX} y={height - 8} fill="#94a3b8" fontSize="10.5" fontWeight="500">
            30d ago
          </text>
          <text x={getX(23)} y={height - 8} fill="#94a3b8" fontSize="10.5" fontWeight="500">
            7d ago
          </text>
          <text x={todayX} y={height - 8} textAnchor="end" fill="#334155" fontWeight="700" fontSize="10.5">
            Today
          </text>

          {/* Interactive touch/hover points */}
          {MOCK_30_DAYS_SERIES.map((d, i) => (
            <circle
              key={d.dayIndex}
              cx={getX(i)}
              cy={getY(d.rate)}
              r="10"
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredDay(d.dayIndex)}
              onMouseLeave={() => setHoveredDay(null)}
              onTouchStart={() => setHoveredDay(d.dayIndex)}
            />
          ))}
        </svg>
      </div>

      {activePoint && (
        <div id="chart-inspection-pill" className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200 gap-1">
          <span className="font-medium text-slate-800">
            {activePoint.dateStr}: <strong className="text-slate-900 font-bold">{formatNumberWithCommas(activePoint.rate)} VND</strong>
          </span>
          <span className="text-[11px] text-slate-500">
            {activePoint.rate < benchmarkRate
              ? `${formatNumberWithCommas(benchmarkRate - activePoint.rate)} VND lower than ${benchmarkLabel}`
              : `${formatNumberWithCommas(activePoint.rate - benchmarkRate)} VND higher than ${benchmarkLabel}`}
          </span>
        </div>
      )}

      <p id="chart-plain-explainer" className="mt-2 text-[11px] text-slate-500 leading-relaxed">
        {directionCode === 'VND_TO_SGD'
          ? 'Notice that today sits below the dotted benchmark line. When converting VND to SGD, being below the line means each Singapore Dollar costs fewer Vietnamese Dong.'
          : 'Notice that today sits below the dotted benchmark line. When converting SGD to VND, being below the line means you receive fewer Vietnamese Dong than the recent average.'}
      </p>
    </div>
  );
};
