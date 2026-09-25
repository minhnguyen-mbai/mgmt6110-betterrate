import React from 'react';
import { BenchmarkType, ComparisonResult, CurrencyCode, FxCurrentData, FxHistoryData } from '../types';
import { SecondaryTrendChart } from './SecondaryTrendChart';
import { CheckCircle2, AlertCircle, DollarSign, HelpCircle, RotateCcw, ChevronDown } from 'lucide-react';
import { formatNumberWithCommas, formatRate } from '../utils/calculations';
import { getCurrencyInfo } from '../data/currencies';

interface DecisionResultProps {
  haveCurrency: CurrencyCode;
  wantCurrency: CurrencyCode;
  benchmark: BenchmarkType;
  result: ComparisonResult;
  current: FxCurrentData;
  history: FxHistoryData;
  onAmountChange: (amount: number | null) => void;
  onCheckAnother: () => void;
}

const PRESET_AMOUNTS = [500, 1000, 3000, 5000];

/**
 * The single-page answer: decision first, then the optional amount calculator,
 * the historical trend, and collapsed calculation details.
 * Everything is derived from already-loaded data; nothing here fetches.
 */
export const DecisionResult: React.FC<DecisionResultProps> = ({
  haveCurrency,
  wantCurrency,
  benchmark,
  result,
  current,
  history,
  onAmountChange,
  onCheckAnother,
}) => {
  const isMoreFavorable = result.isMoreFavorable;
  const isUnchanged = result.isUnchanged;
  const isBuyingBase = result.directionCode === 'BUY_BASE';
  const base = getCurrencyInfo(result.baseCurrency);
  const quote = getCurrencyInfo(result.quoteCurrency);
  const benchmarkDetail = history.benchmarks[benchmark];

  // Signed difference of today's rate versus the benchmark, in quote currency per base unit
  const signedDifference = result.todayRate - result.benchmarkRate;
  const differenceText = `${signedDifference > 0 ? '+' : signedDifference < 0 ? '−' : ''}${formatRate(Math.abs(signedDifference))} ${quote.code} per ${base.code}`;

  const handleAmountInput = (valStr: string) => {
    const cleaned = valStr.replace(/[^0-9]/g, '');
    onAmountChange(cleaned === '' ? null : parseInt(cleaned, 10));
  };

  const hasAmount = result.amount !== null && result.amount > 0;

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

      {/* Optional amount calculator (secondary) */}
      <div id="amount-calculator" className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-slate-800">
          <DollarSign className="w-4 h-4 text-slate-500 shrink-0" />
          <h3 className="text-sm font-semibold">What does this mean for my amount?</h3>
          <span className="text-[11px] text-slate-400 font-normal ml-auto">Optional</span>
        </div>

        <div className="relative">
          <label htmlFor="amount-input" className="sr-only">
            Amount in {base.plural} ({base.code})
          </label>
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
            {base.symbol}
          </div>
          <input
            id="amount-input"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 3,000"
            value={result.amount !== null ? formatNumberWithCommas(result.amount) : ''}
            onChange={(e) => handleAmountInput(e.target.value)}
            className="w-full pl-11 pr-14 py-3 min-h-[48px] rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-slate-900 text-base font-semibold placeholder:text-slate-400"
          />
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400 text-xs font-semibold">
            {base.code}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-[11px] text-slate-500 mr-0.5">Quick amounts:</span>
          {PRESET_AMOUNTS.map((val) => (
            <button
              key={val}
              id={`preset-btn-${val}`}
              type="button"
              onClick={() => onAmountChange(result.amount === val ? null : val)}
              className={`text-xs px-3 py-2 min-h-[38px] rounded-lg border font-semibold transition-all cursor-pointer active:scale-95 ${
                result.amount === val
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {formatNumberWithCommas(val)}
            </button>
          ))}
          {result.amount !== null && (
            <button
              id="clear-amount-btn"
              type="button"
              onClick={() => onAmountChange(null)}
              className="text-xs text-slate-500 hover:text-slate-800 underline ml-auto py-2 px-1 cursor-pointer min-h-[38px] flex items-center"
            >
              Clear
            </button>
          )}
        </div>

        {hasAmount ? (
          <div
            id="money-difference-highlight"
            className={`p-3.5 sm:p-4 rounded-xl border space-y-3 ${
              isUnchanged
                ? 'bg-slate-100/90 border-slate-200 text-slate-900'
                : isMoreFavorable
                  ? 'bg-emerald-500/10 border-emerald-200 text-emerald-950'
                  : 'bg-amber-500/10 border-amber-200 text-amber-950'
            }`}
          >
            <div>
              <span id="amount-context-title" className="text-xs font-medium text-slate-600 block mb-0.5">
                {isBuyingBase
                  ? `If you buy ${result.amountFormatted} today:`
                  : `If you exchange ${result.amountFormatted} today:`}
              </span>
              <span id="prominent-money-text" className="text-lg sm:text-xl font-bold font-display tracking-tight block">
                {result.moneyDifferenceText}
              </span>
              <span className="text-xs text-slate-600">Approx. {result.differenceFormatted}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div id="amount-today-total" className="p-3 rounded-lg bg-white/80 border border-slate-200/70">
                <span className="text-[11px] text-slate-500 block mb-0.5">
                  {isBuyingBase ? 'Today’s estimated cost' : 'Today’s estimated payout'}
                </span>
                <div className="text-sm font-bold text-slate-900 break-all">{result.todayTotalFormatted}</div>
              </div>
              <div id="amount-benchmark-total" className="p-3 rounded-lg bg-white/80 border border-slate-200/70">
                <span className="text-[11px] text-slate-500 block mb-0.5">At the {result.benchmarkName}</span>
                <div className="text-sm font-bold text-slate-900 break-all">{result.benchmarkTotalFormatted}</div>
              </div>
            </div>
          </div>
        ) : (
          <p id="amount-helper-text" className="text-[11px] text-slate-500 leading-normal">
            {isBuyingBase
              ? `Enter how many ${base.plural} you want to purchase to estimate the ${quote.code} cost difference.`
              : `Enter how many ${base.plural} you want to convert to estimate the ${quote.code} payout difference.`}
          </p>
        )}
      </div>

      {/* Historical trend (supporting evidence) */}
      <SecondaryTrendChart
        benchmark={benchmark}
        benchmarkRate={result.benchmarkRate}
        benchmarkLabel={result.benchmarkName}
        isMoreFavorable={isMoreFavorable}
        directionCode={result.directionCode}
        baseCurrency={result.baseCurrency}
        quoteCurrency={result.quoteCurrency}
        haveCurrency={haveCurrency}
        wantCurrency={wantCurrency}
        todayRate={result.todayRate}
        dailyPoints={history.daily || []}
        historyDerivation={history.derivation}
        historyProvider={history.provider}
        currentLastRefreshed={current.lastRefreshed}
        historyLastRefreshed={history.lastRefreshed}
      />

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
          <p id="plain-language-explanation" className="leading-relaxed">{result.explanation}</p>
          <div id="educational-note" className="p-3 rounded-lg bg-slate-50 border border-slate-200/70 space-y-1">
            <p className="font-medium text-slate-700">How BetterRate works</p>
            <p className="leading-relaxed">
              BetterRate calculates whether today’s exchange rate is mathematically more favorable for your specific direction.
              Benchmarks average the daily rates before today.
            </p>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              <li><strong>Converting {quote.code} to {base.code}</strong>: A lower rate is more favorable because each {base.name} costs fewer {quote.plural}.</li>
              <li><strong>Converting {base.code} to {quote.code}</strong>: A higher rate is more favorable because you receive more {quote.plural} for each {base.name}.</li>
            </ul>
          </div>
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
