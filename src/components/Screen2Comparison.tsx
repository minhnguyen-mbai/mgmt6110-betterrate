import React, { useState } from 'react';
import { ComparisonInput, ComparisonResult } from '../types';
import { SecondaryTrendChart } from './SecondaryTrendChart';
import { CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, DollarSign, HelpCircle } from 'lucide-react';
import { formatNumberWithCommas } from '../utils/calculations';

interface Screen2Props {
  input: ComparisonInput;
  result: ComparisonResult;
  onBack: () => void;
  onNext: () => void;
  onUpdateAmount: (amount: number | null) => void;
}

export const Screen2Comparison: React.FC<Screen2Props> = ({
  input,
  result,
  onBack,
  onNext,
  onUpdateAmount,
}) => {
  const [tempAmountInput, setTempAmountInput] = useState<string>('');

  const handleApplyAmount = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tempAmountInput.replace(/[^0-9]/g, '');
    if (cleaned) {
      onUpdateAmount(parseInt(cleaned, 10));
      setTempAmountInput('');
    }
  };

  const isMoreFavorable = result.isMoreFavorable;
  const isUnchanged = result.isUnchanged;

  return (
    <div id="screen-2-rate-comparison" className="w-full max-w-xl mx-auto space-y-5">
      {/* Top back button */}
      <div className="flex items-center justify-between">
        <button
          id="back-to-screen-1-btn"
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-2 min-h-[40px] rounded-lg transition-colors cursor-pointer shadow-2xs active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Edit inputs</span>
        </button>

        <span className="text-xs text-slate-400 font-medium">
          Screen 2 of 3 • Rate Comparison
        </span>
      </div>

      {/* Hero Interpretation Card (Strongest Result) */}
      <div
        id="primary-interpretation-card"
        className={`rounded-2xl p-6 border transition-all ${
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

          <div className="flex-1">
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

            <p id="plain-language-explanation" className="mt-2 text-sm text-slate-700 leading-relaxed">
              {result.explanation}
            </p>
          </div>
        </div>
      </div>

      {/* Side-by-side Rate Numbers Comparison: Stacked on mobile for readability, 2-col on desktop */}
      <div id="rate-metrics-card" className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 sm:pb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Exchange Rate Comparison
          </span>
          <span className="text-[11px] sm:text-xs text-slate-400">Deterministic comparison</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
          {/* Today's Rate */}
          <div id="today-rate-box" className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs font-medium text-slate-500 block mb-0.5 sm:mb-1">Today’s rate</span>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 font-display flex items-baseline gap-1.5 flex-wrap">
              <span>{formatNumberWithCommas(result.todayRate)}</span>
              <span className="text-xs font-sans text-slate-500 font-normal">VND</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 sm:mt-1 block">per 1 SGD</span>
          </div>

          {/* Benchmark Rate */}
          <div id="benchmark-rate-box" className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs font-medium text-slate-500 block mb-0.5 sm:mb-1">{result.benchmarkName}</span>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 font-display flex items-baseline gap-1.5 flex-wrap">
              <span>{formatNumberWithCommas(result.benchmarkRate)}</span>
              <span className="text-xs font-sans text-slate-500 font-normal">VND</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 sm:mt-1 block">per 1 SGD</span>
          </div>
        </div>

        {/* Rate difference clarification pill (Stacked gracefully on mobile) */}
        <div id="rate-difference-pill" className="p-3 rounded-xl bg-slate-100/80 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-slate-600">Rate difference:</span>
          <span className="font-bold text-slate-900">
            {formatNumberWithCommas(Math.abs(result.rateDifference))} VND {result.rateDifference > 0 ? 'lower' : 'higher'} per SGD
          </span>
        </div>
      </div>

      {/* Prominent Monetary Impact (If amount entered) */}
      {result.amount !== null && result.amount > 0 ? (
        <div
          id="monetary-impact-card"
          className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-3 sm:space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 sm:pb-3 gap-2">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Actual Money Difference
              </span>
              <h3 id="amount-context-title" className="text-base sm:text-lg font-bold text-slate-900 font-display mt-0.5">
                What this means for {result.amountFormatted}
              </h3>
            </div>
            <button
              id="change-amount-inline-btn"
              type="button"
              onClick={onBack}
              className="text-xs text-slate-500 hover:text-slate-900 underline cursor-pointer shrink-0 py-1"
            >
              Change amount
            </button>
          </div>

          {/* Highlighted Callout (Responsive vertical stacking on mobile) */}
          <div
            id="money-difference-highlight"
            className={`p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              isUnchanged
                ? 'bg-slate-100/90 border-slate-200 text-slate-900'
                : isMoreFavorable
                  ? 'bg-emerald-500/10 border-emerald-200 text-emerald-950'
                  : 'bg-amber-500/10 border-amber-200 text-amber-950'
            }`}
          >
            <div>
              <span className="text-xs font-medium text-slate-600 block mb-0.5">Estimated Difference</span>
              <span id="prominent-money-text" className="text-xl sm:text-2xl font-bold font-display tracking-tight block">
                {result.moneyDifferenceText}
              </span>
            </div>
            <div className="text-xs font-semibold text-slate-600 bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200/70 inline-flex self-start sm:self-auto sm:text-right">
              Approx. {result.differenceVNDFormatted}
            </div>
          </div>

          {/* Side-by-side cost breakdown: Stacked on mobile to avoid number overflow */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-1">
            <div id="amount-today-total" className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-xs text-slate-500 block mb-1">
                {result.directionCode === 'VND_TO_SGD' ? "Today’s estimated cost" : "Today’s estimated payout"}
              </span>
              <div className="text-lg font-bold text-slate-900 font-display">
                {result.todayTotalVNDCompact}
              </div>
              <span className="text-[11px] text-slate-500 block break-all">
                {result.todayTotalVNDFormatted}
              </span>
            </div>

            <div id="amount-benchmark-total" className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-xs text-slate-500 block mb-1">
                At the {result.benchmarkName}
              </span>
              <div className="text-lg font-bold text-slate-900 font-display">
                {result.benchmarkTotalVNDCompact}
              </div>
              <span className="text-[11px] text-slate-500 block break-all">
                {result.benchmarkTotalVNDFormatted}
              </span>
            </div>
          </div>

          <p id="amount-plain-summary" className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-150">
            {isUnchanged
              ? `If you convert ${result.amountFormatted} today, the total cost or payout is virtually the same as exchanging at the ${result.benchmarkName}.`
              : result.directionCode === 'VND_TO_SGD'
                ? (isMoreFavorable
                    ? `If you convert to ${result.amountFormatted} today, you will spend approximately ${result.differenceVNDCompact} less than if you exchanged at the ${result.benchmarkName}.`
                    : `If you convert to ${result.amountFormatted} today, you will spend approximately ${result.differenceVNDCompact} more than if you exchanged at the ${result.benchmarkName}.`)
                : (isMoreFavorable
                    ? `If you convert ${result.amountFormatted} today, you will receive approximately ${result.differenceVNDCompact} more than if you exchanged at the ${result.benchmarkName}.`
                    : `If you convert ${result.amountFormatted} today, you will receive approximately ${result.differenceVNDCompact} less than if you exchanged at the ${result.benchmarkName}.`)}
          </p>
        </div>
      ) : (
        /* Prompt to optionally enter amount right on Screen 2 */
        <div id="enter-amount-prompt-card" className="bg-white rounded-2xl p-4 sm:p-5 border border-dashed border-slate-300 space-y-3">
          <div className="flex items-center gap-2 text-slate-800">
            <DollarSign className="w-4 h-4 text-slate-500 shrink-0" />
            <h3 className="text-sm font-semibold">Want to see the actual money difference?</h3>
          </div>
          <p className="text-xs text-slate-500">
            Enter the amount in SGD (e.g. S$3,000 for travel, tuition, or shopping) to see the exact Vietnamese Dong savings.
          </p>

          <form onSubmit={handleApplyAmount} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-semibold text-slate-400">
                S$
              </span>
              <input
                id="inline-amount-input"
                type="text"
                placeholder="e.g. 3,000"
                value={tempAmountInput}
                onChange={(e) => setTempAmountInput(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 min-h-[44px] text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 font-semibold"
              />
            </div>
            <div className="flex gap-2">
              <button
                id="apply-amount-btn"
                type="submit"
                disabled={!tempAmountInput}
                className="flex-1 sm:flex-initial px-4 py-2.5 min-h-[44px] bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer active:scale-95"
              >
                Calculate
              </button>
              <button
                id="preset-3000-quick-btn"
                type="button"
                onClick={() => onUpdateAmount(3000)}
                className="flex-1 sm:flex-initial px-3 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer active:scale-95"
              >
                Try S$3,000
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Secondary Information: Simple Trend Visualizer */}
      <SecondaryTrendChart
        benchmark={input.benchmark}
        isMoreFavorable={isMoreFavorable}
        directionCode={result.directionCode}
      />

      {/* Navigation Actions (Stacked on mobile for full comfortable tap target, side-by-side on desktop) */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2.5 sm:gap-3 pt-2">
        <button
          id="back-btn-screen2"
          type="button"
          onClick={onBack}
          className="w-full sm:flex-1 py-3 px-4 min-h-[46px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors cursor-pointer text-center active:scale-[0.99]"
        >
          Change inputs
        </button>

        <button
          id="view-summary-btn"
          type="button"
          onClick={onNext}
          className="w-full sm:flex-2 py-3.5 px-5 min-h-[48px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 group active:scale-[0.99]"
        >
          <span>View summary</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
};
