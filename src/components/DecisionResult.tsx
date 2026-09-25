import React from 'react';
import { BenchmarkType, ComparisonResult, FxCurrentData, FxHistoryData } from '../types';
import { SecondaryTrendChart } from './SecondaryTrendChart';
import { CheckCircle2, AlertCircle, HelpCircle, RotateCcw, ChevronDown } from 'lucide-react';
import { formatRate } from '../utils/calculations';
import { getCurrencyInfo } from '../data/currencies';

interface DecisionResultProps {
  benchmark: BenchmarkType;
  result: ComparisonResult;
  current: FxCurrentData;
  history: FxHistoryData;
  onCheckAnother: () => void;
}

/**
 * The single-page answer: the decision card, then the collapsed trend and
 * calculation details. Everything is derived from already-loaded data; nothing here fetches.
 */
export const DecisionResult: React.FC<DecisionResultProps> = ({
  benchmark,
  result,
  current,
  history,
  onCheckAnother,
}) => {
  const isMoreFavorable = result.isMoreFavorable;
  const isUnchanged = result.isUnchanged;
  const base = getCurrencyInfo(result.baseCurrency);
  const quote = getCurrencyInfo(result.quoteCurrency);
  const benchmarkDetail = history.benchmarks[benchmark];

  // Signed difference of today's rate versus the benchmark, in quote currency per base unit
  const signedDifference = result.todayRate - result.benchmarkRate;
  const differenceText = `${signedDifference > 0 ? '+' : signedDifference < 0 ? '−' : ''}${formatRate(Math.abs(signedDifference))} ${quote.code} per ${base.code}`;

  return (
    <section id="decision-result" aria-live="polite" className="w-full max-w-xl mx-auto mt-5 space-y-5">
      {/* Primary Decision */}
      <div
        id="primary-interpretation-card"
        className={`rounded-2xl p-5 sm:p-6 border transition-all ${
          isUnchanged
            ? 'bg-slate-50/90 border-slate-300 text-slate-800'
            : isMoreFavorable
              ? 'bg-emerald-50/70 border-emerald-200/90 text-emerald-950'
              : 'bg-amber-50/70 border-amber-200/90 text-amber-950'
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            id="status-icon-badge"
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isUnchanged
                ? 'bg-slate-600 text-white shadow-xs'
                : isMoreFavorable
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-amber-600 text-white shadow-xs'
            }`}
          >
            {isUnchanged ? (
              <HelpCircle className="w-6 h-6 stroke-[2.2]" />
            ) : isMoreFavorable ? (
              <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />
            ) : (
              <AlertCircle className="w-6 h-6 stroke-[2.2]" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <span
              id="interpretation-pill"
              className={`inline-block text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-1.5 ${
                isUnchanged
                  ? 'bg-slate-200 text-slate-700'
                  : isMoreFavorable
                    ? 'bg-emerald-200/70 text-emerald-800'
                    : 'bg-amber-200/70 text-amber-800'
              }`}
            >
              {result.statusText}
            </span>

            <h2
              id="primary-interpretation-headline"
              className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-display"
            >
              {result.headlineComparison}
            </h2>
          </div>
        </div>

        {/* Compact comparison */}
        <dl id="rate-comparison-rows" className="mt-4 divide-y divide-slate-900/10 text-sm">
          <div id="today-rate-row" className="py-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <dt className="text-slate-600">Today’s rate</dt>
            <dd className="font-bold text-slate-900">1 {base.code} = {formatRate(result.todayRate)} {quote.code}</dd>
          </div>
          <div id="benchmark-rate-row" className="py-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <dt className="text-slate-600">{result.benchmarkName}</dt>
            <dd className="font-semibold text-slate-900">1 {base.code} = {formatRate(result.benchmarkRate)} {quote.code}</dd>
          </div>
          <div id="rate-difference-row" className="py-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <dt className="text-slate-600">Difference</dt>
            <dd className="font-semibold text-slate-900">{differenceText}</dd>
          </div>
        </dl>
      </div>

      {/* Historical trend (collapsed by default) */}
      <details id="trend-details" className="group bg-white rounded-2xl border border-slate-200 shadow-xs">
        <summary className="list-none cursor-pointer select-none px-4 sm:px-6 py-3.5 flex items-center justify-between text-sm font-semibold text-slate-700 min-h-[48px]">
          <span className="group-open:hidden">View 30-day trend</span>
          <span className="hidden group-open:inline">Hide 30-day trend</span>
          <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-3 sm:px-4 pb-4">
          <SecondaryTrendChart
            benchmark={benchmark}
            benchmarkRate={result.benchmarkRate}
            benchmarkLabel={result.benchmarkName}
            isMoreFavorable={isMoreFavorable}
            quoteCurrency={result.quoteCurrency}
            todayRate={result.todayRate}
            dailyPoints={history.daily || []}
            historyDerivation={history.derivation}
            historyProvider={history.provider}
            currentLastRefreshed={current.lastRefreshed}
            historyLastRefreshed={history.lastRefreshed}
          />
        </div>
      </details>

      {/* Calculation details (collapsed by default) */}
      <details id="calculation-details" className="group bg-white rounded-2xl border border-slate-200 shadow-xs">
        <summary className="list-none cursor-pointer select-none px-4 sm:px-6 py-3.5 flex items-center justify-between text-sm font-semibold text-slate-700 min-h-[48px]">
          <span className="group-open:hidden">Show calculation details</span>
          <span className="hidden group-open:inline">Hide calculation details</span>
          <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 sm:px-6 pb-5 space-y-3 text-xs text-slate-600">
          <dl className="divide-y divide-slate-100">
            <div className="py-2 flex flex-wrap justify-between gap-x-3">
              <dt>Today’s rate</dt>
              <dd className="font-semibold text-slate-900">1 {base.code} = {formatRate(result.todayRate)} {quote.code}</dd>
            </div>
            <div className="py-2 flex flex-wrap justify-between gap-x-3">
              <dt>{result.benchmarkName}</dt>
              <dd className="font-semibold text-slate-900">1 {base.code} = {formatRate(result.benchmarkRate)} {quote.code}</dd>
            </div>
            <div className="py-2 flex flex-wrap justify-between gap-x-3">
              <dt>Absolute difference</dt>
              <dd className="font-semibold text-slate-900">
                {formatRate(Math.abs(result.rateDifference))} {quote.code} {result.rateDifference > 0 ? 'lower' : 'higher'} per {base.code}
              </dd>
            </div>
            <div className="py-2 flex flex-wrap justify-between gap-x-3">
              <dt>Percentage difference</dt>
              <dd className="font-semibold text-slate-900">{result.percentDifference}%</dd>
            </div>
            {benchmarkDetail && (
              <div className="py-2 flex flex-wrap justify-between gap-x-3">
                <dt>Observations</dt>
                <dd className="font-semibold text-slate-900">
                  {benchmarkDetail.observationCount} daily rates ({benchmarkDetail.startDate} to {benchmarkDetail.endDate})
                </dd>
              </div>
            )}
            <div className="py-2 flex flex-wrap justify-between gap-x-3">
              <dt>Source</dt>
              <dd className="font-semibold text-slate-900 text-right">
                {current.provider || current.source || 'Exchange-rate provider'}
                {history.methodology ? ` · ${history.methodology}` : ''}
              </dd>
            </div>
          </dl>
        </div>
      </details>

      {/* Check another rate */}
      <button
        id="check-another-rate-btn"
        type="button"
        onClick={onCheckAnother}
        className="w-full py-3.5 px-6 min-h-[48px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
      >
        <RotateCcw className="w-4 h-4" />
        <span>Check another rate</span>
      </button>

    </section>
  );
};
