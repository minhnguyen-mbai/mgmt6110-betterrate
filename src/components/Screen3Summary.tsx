import React from 'react';
import { ComparisonInput, ComparisonResult } from '../types';
import { CheckCircle2, AlertCircle, RotateCcw, ArrowLeft, ArrowRight, HelpCircle } from 'lucide-react';
import { formatNumberWithCommas } from '../utils/calculations';

interface Screen3Props {
  input: ComparisonInput;
  result: ComparisonResult;
  onReset: () => void;
  onBackToComparison: () => void;
}

export const Screen3Summary: React.FC<Screen3Props> = ({
  input,
  result,
  onReset,
  onBackToComparison,
}) => {
  const isMoreFavorable = result.isMoreFavorable;
  const isUnchanged = result.isUnchanged;
  const isVndToSgd = result.directionCode === 'VND_TO_SGD';

  return (
    <div id="screen-3-summary" className="w-full max-w-xl mx-auto space-y-5">
      {/* Top back button */}
      <div className="flex items-center justify-between">
        <button
          id="back-to-screen-2-btn"
          type="button"
          onClick={onBackToComparison}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-2 min-h-[40px] rounded-lg transition-colors cursor-pointer shadow-2xs active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to rate comparison</span>
        </button>

        <span className="text-xs text-slate-400 font-medium">
          Screen 3 of 3 • Summary
        </span>
      </div>

      {/* Main Takeaway Card */}
      <div
        id="summary-hero-card"
        className={`rounded-2xl p-4 sm:p-6 border ${
          isUnchanged
            ? 'bg-slate-50/90 border-slate-300 text-slate-800'
            : isMoreFavorable
              ? 'bg-emerald-50/70 border-emerald-200/90 text-emerald-950'
              : 'bg-amber-50/70 border-amber-200/90 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          {isUnchanged ? (
            <HelpCircle className="w-5 h-5 text-slate-600 shrink-0" />
          ) : isMoreFavorable ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          )}
          <span className="text-xs font-bold uppercase tracking-wider">
            Final Takeaway
          </span>
        </div>

        <h1
          id="summary-headline"
          className="text-xl sm:text-3xl font-bold tracking-tight text-slate-900 font-display break-words"
        >
          {result.statusText}
        </h1>

        <p id="summary-subtext" className="mt-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
          {isUnchanged
            ? `Based on your selected ${result.benchmarkName}, today’s rate is ${result.headlineComparison.toLowerCase()} for converting ${input.haveCurrency} to ${input.wantCurrency}.`
            : `Based on your selected ${result.benchmarkName}, today’s rate is ${result.headlineComparison} for converting ${input.haveCurrency} to ${input.wantCurrency}.`}
        </p>
      </div>

      {/* Focused Scannable Key Takeaways */}
      <div id="summary-details-card" className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-3 sm:space-y-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Decision Summary
        </h2>

        <div className="divide-y divide-slate-100">
          {/* 1. Currency direction */}
          <div id="summary-row-direction" className="py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-1">
            <span className="text-slate-500 text-xs sm:text-sm">Currency direction</span>
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 flex-wrap">
              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">{input.haveCurrency}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">{input.wantCurrency}</span>
              <span className="text-slate-500 font-normal text-xs ml-0.5">
                ({isVndToSgd ? 'VND to SGD' : 'SGD to VND'})
              </span>
            </div>
          </div>

          {/* 2. Selected benchmark */}
          <div id="summary-row-benchmark" className="py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-1">
            <span className="text-slate-500 text-xs sm:text-sm">Selected benchmark</span>
            <span className="font-semibold text-slate-900 text-xs sm:text-sm">
              {result.benchmarkName} ({formatNumberWithCommas(result.benchmarkRate)} VND)
            </span>
          </div>

          {/* 3. Percentage difference */}
          <div id="summary-row-percentage" className="py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-1">
            <span className="text-slate-500 text-xs sm:text-sm">Percentage difference</span>
            <span className={`font-bold text-sm sm:text-base ${isUnchanged ? 'text-slate-800' : isMoreFavorable ? 'text-emerald-700' : 'text-amber-700'}`}>
              {result.headlineComparison}
            </span>
          </div>

          {/* 4. Monetary difference (if amount was entered) */}
          {result.amount !== null && result.amount > 0 ? (
            <div id="summary-row-amount" className="py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-1.5">
              <div>
                <span className="text-slate-500 text-xs sm:text-sm block">Monetary difference</span>
                <span className="text-xs text-slate-400">For {result.amountFormatted}</span>
              </div>
              <div className="sm:text-right">
                <span className="font-bold text-slate-900 block text-base sm:text-lg">
                  {result.moneyDifferenceText}
                </span>
                <span className="text-xs text-slate-500">
                  Approx. {result.differenceVNDFormatted}
                </span>
              </div>
            </div>
          ) : (
            <div id="summary-row-no-amount" className="py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-1">
              <span className="text-slate-500 text-xs sm:text-sm">Monetary difference</span>
              <span className="text-xs text-slate-400 italic">
                No amount specified (optional)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Primary Action: Check Another Rate */}
      <div className="pt-2 space-y-2.5 sm:space-y-3">
        <button
          id="check-another-rate-btn"
          type="button"
          onClick={onReset}
          className="w-full py-4 px-6 min-h-[52px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-base shadow-sm active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 group"
        >
          <RotateCcw className="w-4 h-4 transition-transform group-hover:-rotate-45" />
          <span>Check another rate</span>
        </button>

        <button
          id="review-full-comparison-btn"
          type="button"
          onClick={onBackToComparison}
          className="w-full py-3 px-4 min-h-[44px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer text-center active:scale-[0.99]"
        >
          Review calculation details & trend chart
        </button>
      </div>

      {/* Product Positioning & Non-Advice Disclaimer */}
      <div id="disclaimer-note" className="p-4 rounded-xl bg-slate-100/60 border border-slate-200/70 text-[11px] text-slate-500 space-y-1 leading-relaxed">
        <p className="font-semibold text-slate-700">BetterRate Decision-Support Disclaimer</p>
        <p>
          BetterRate is an exchange-rate comparison tool using transparent deterministic formulas and simulated mock data. It is not financial advice, a forex trading platform, a currency exchange service, or an investment forecast.
        </p>
      </div>
    </div>
  );
};
