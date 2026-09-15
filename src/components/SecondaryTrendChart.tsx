import React, { useState, useMemo } from 'react';
import { BenchmarkType } from '../types';
import { formatRate } from '../utils/calculations';

interface SecondaryTrendChartProps {
  benchmark: BenchmarkType;
  benchmarkRate: number;
  benchmarkLabel: string;
  isMoreFavorable: boolean;
  directionCode: 'VND_TO_SGD' | 'SGD_TO_VND';
  todayRate: number;
  dailyPoints: Array<{ date: string; close: number }>;
  currentLastRefreshed?: string | null;
  historyLastRefreshed?: string | null;
}

function formatTimestamp(raw: string | null): string {
  if (!raw || !raw.trim()) return '';
  try {
    const clean = raw.includes('T') ? raw : raw.replace(' ', 'T') + (raw.includes('Z') ? '' : 'Z');
    const date = new Date(clean);
    if (isNaN(date.getTime())) return raw;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch (e) {
    return raw;
  }
}

export const SecondaryTrendChart: React.FC<SecondaryTrendChartProps> = ({
  benchmarkRate,
  benchmarkLabel,
  isMoreFavorable,
  directionCode,
  todayRate,
  dailyPoints,
  currentLastRefreshed,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Normalize historical points sorted chronologically (oldest to newest)
  // Contains ONLY FX_DAILY historical close points returned by /api/fx-history
  const series = useMemo(() => {
    if (!dailyPoints || dailyPoints.length === 0) {
      return [];
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
        // Keep raw date string on error
      }

      return {
        index: idx,
        dateStr: dateLabel,
        rawDate: pt.date,
        rate: pt.close,
        isLatest: idx === sorted.length - 1,
      };
    });
  }, [dailyPoints]);

  const lastHistoricalPoint = series.length > 0 ? series[series.length - 1] : null;

  // Calculate SVG bounds using exclusively historical close points and the benchmark
  const rates = series.map((d) => d.rate);
  const allHistoricalRates = rates.length > 0 ? [...rates, benchmarkRate] : [benchmarkRate];
  const minRate = Math.min(...allHistoricalRates) - 40;
  const maxRate = Math.max(...allHistoricalRates) + 40;
  const rateRange = maxRate - minRate || 1;

  const width = 400;
  const height = 144;
  const paddingTop = 22;
  const paddingBottom = 26;
  const paddingX = 24;

  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  const getX = (index: number) => {
    if (series.length <= 1) return width / 2;
    return paddingX + (index / (series.length - 1)) * innerWidth;
  };

  const getY = (rate: number) => {
    return paddingTop + (1 - (rate - minRate) / rateRange) * innerHeight;
  };

  // Historical polyline coordinates: exclusively FX_DAILY historical closes
  const pointsString = series.map((d, i) => `${getX(i)},${getY(d.rate)}`).join(' ');

  const benchmarkY = getY(benchmarkRate);
  const lastHistoryY = lastHistoricalPoint ? getY(lastHistoricalPoint.rate) : benchmarkY;

  const firstDateLabel = series[0]?.dateStr || '30d ago';
  const lastDateLabel = lastHistoricalPoint?.dateStr || 'Latest close';

  const activePoint = hoveredIdx !== null ? series[hoveredIdx] : null;

  const formattedCurrentDate = formatTimestamp(currentLastRefreshed);

  return (
    <div id="secondary-trend-container" className="w-full bg-slate-50/80 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <span id="chart-title" className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
            30-Day Historical Trend (Secondary Reference)
          </span>
          <span id="chart-caption" className="text-[11px] text-slate-500 block">
            Historical daily closes vs. the {benchmarkLabel}
          </span>
        </div>
        <span id="chart-provider-pill" className="text-[10px] font-medium bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded shrink-0">
          Alpha Vantage FX_DAILY
        </span>
      </div>

      {/* Informational Cards: Current Rate vs. Latest Historical Daily Close */}
      <div id="rate-context-cards" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
        {/* Current Real-Time Rate Card */}
        <div id="current-rate-card" className="bg-white rounded-lg p-3 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isMoreFavorable ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              Current Rate
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              isMoreFavorable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {isMoreFavorable ? 'Favorable vs. benchmark' : 'Less favorable'}
            </span>
          </div>
          <div className="text-base font-bold text-slate-900">
            {formatRate(todayRate)} <span className="text-xs font-normal text-slate-500">VND</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {formattedCurrentDate ? `Last refreshed: ${formattedCurrentDate}` : 'Live quote'}
          </div>
        </div>

        {/* Latest Historical Close Card */}
        <div id="latest-close-card" className="bg-white rounded-lg p-3 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Latest Historical Close
            </span>
            <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
              FX_DAILY
            </span>
          </div>
          <div className="text-base font-bold text-slate-900">
            {lastHistoricalPoint ? formatRate(lastHistoricalPoint.rate) : '—'} <span className="text-xs font-normal text-slate-500">VND</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {lastHistoricalPoint
              ? `${lastHistoricalPoint.dateStr} · final market close`
              : 'End of historical window'}
          </div>
        </div>
      </div>

      {/* SVG Historical Chart */}
      <div className="relative w-full overflow-hidden bg-white/50 rounded-lg p-1.5 border border-slate-200/60">
        <svg
          id="trend-svg"
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block select-none"
        >
          <defs>
            <linearGradient id="historyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#334155" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#334155" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Benchmark horizontal reference line (spans full historical chart) */}
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
            y={Math.max(benchmarkY - 5, paddingTop + 2)}
            fill="#64748b"
            fontSize="10"
            fontWeight="600"
          >
            {benchmarkLabel}: {formatRate(benchmarkRate)} VND
          </text>

          {/* Historical Area fill */}
          {series.length > 1 && (
            <polygon
              points={`${getX(0)},${height - paddingBottom} ${pointsString} ${getX(series.length - 1)},${height - paddingBottom}`}
              fill="url(#historyGradient)"
            />
          )}

          {/* Historical Trend line (strictly contains FX_DAILY close points) */}
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

          {/* Latest Historical Point Anchor Dot (e.g. Sep 11 close) */}
          {lastHistoricalPoint && (
            <circle
              id="latest-historical-marker"
              cx={getX(series.length - 1)}
              cy={lastHistoryY}
              r="3.5"
              fill="#1e293b"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          )}

          {/* X-axis labels: Represent exclusively historical dates */}
          {/* Oldest date in 30d window */}
          <text x={paddingX} y={height - 7} fill="#94a3b8" fontSize="10" fontWeight="500">
            {firstDateLabel}
          </text>

          {/* Approximate 7d position */}
          {series.length > 8 && (
            <text x={getX(Math.floor(series.length * 0.75))} y={height - 7} textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="500">
              ~7d ago
            </text>
          )}

          {/* Final historical close date (e.g. Sep 11) */}
          <text
            x={width - paddingX}
            y={height - 7}
            textAnchor="end"
            fill="#334155"
            fontWeight="600"
            fontSize="10"
          >
            {lastDateLabel}
          </text>

          {/* Interactive touch/hover targets for historical points */}
          {series.map((d, i) => (
            <circle
              key={d.rawDate || i}
              cx={getX(i)}
              cy={getY(d.rate)}
              r="10"
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              onTouchStart={() => setHoveredIdx(i)}
            />
          ))}
        </svg>
      </div>

      {/* Visual Chart Legend */}
      <div id="chart-legend" className="flex items-center gap-3 sm:gap-4 text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-200/60 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-0.5 bg-slate-700 inline-block rounded" />
          <span>30-Day Daily Closes (FX_DAILY)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-0.5 border-b border-dashed border-slate-400 inline-block" />
          <span>{benchmarkLabel} ({formatRate(benchmarkRate)} VND)</span>
        </div>
      </div>

      {/* Point Inspection Pill */}
      <div id="chart-inspection-pill" className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200 gap-1.5 shadow-2xs">
        {activePoint ? (
          <>
            <span className="font-medium text-slate-800">
              <span className="text-slate-500 font-normal">Daily Close ({activePoint.dateStr}): </span>
              <strong className="text-slate-900 font-bold">{formatRate(activePoint.rate)} VND</strong>
            </span>
            <span className="text-[11px] text-slate-500">
              {activePoint.rate < benchmarkRate
                ? `${formatRate(benchmarkRate - activePoint.rate)} VND lower than ${benchmarkLabel}`
                : `${formatRate(activePoint.rate - benchmarkRate)} VND higher than ${benchmarkLabel}`}
            </span>
          </>
        ) : (
          <>
            <span className="font-medium text-slate-800">
              <span className="text-slate-500 font-normal">Latest Close ({lastDateLabel}): </span>
              <strong className="text-slate-900 font-bold">
                {lastHistoricalPoint ? `${formatRate(lastHistoricalPoint.rate)} VND` : '—'}
              </strong>
            </span>
            <span className="text-[11px] text-slate-500">
              Hover over historical points to inspect individual daily closes
            </span>
          </>
        )}
      </div>

      {/* Plain Language Interpretation */}
      <p id="chart-plain-explainer" className="mt-2 text-[11px] text-slate-500 leading-relaxed">
        {directionCode === 'VND_TO_SGD'
          ? (todayRate < benchmarkRate
              ? `The current rate (${formatRate(todayRate)} VND) sits below the ${benchmarkLabel} (${formatRate(benchmarkRate)} VND). When converting VND to SGD, being below the benchmark is favorable because each Singapore Dollar costs fewer Vietnamese Dong.`
              : `The current rate (${formatRate(todayRate)} VND) sits above the ${benchmarkLabel} (${formatRate(benchmarkRate)} VND). When converting VND to SGD, being above the benchmark means each Singapore Dollar costs more Vietnamese Dong.`)
          : (todayRate < benchmarkRate
              ? `The current rate (${formatRate(todayRate)} VND) sits below the ${benchmarkLabel} (${formatRate(benchmarkRate)} VND). When converting SGD to VND, being below the benchmark means you receive fewer Vietnamese Dong than the recent average.`
              : `The current rate (${formatRate(todayRate)} VND) sits above the ${benchmarkLabel} (${formatRate(benchmarkRate)} VND). When converting SGD to VND, being above the benchmark is favorable because you receive more Vietnamese Dong for each Singapore Dollar.`)}
      </p>
    </div>
  );
};
