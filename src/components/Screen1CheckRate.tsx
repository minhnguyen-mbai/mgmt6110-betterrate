import React from 'react';
import { ComparisonInput, BenchmarkType, FxDataStatus } from '../types';
import { ArrowRightLeft, Calendar, HelpCircle, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { formatNumberWithCommas, formatRate } from '../utils/calculations';

interface Screen1Props {
  input: ComparisonInput;
  onChangeInput: (updater: (prev: ComparisonInput) => ComparisonInput) => void;
  onSubmit: () => void;
  status: FxDataStatus;
  errorMessage: string | null;
  todayRate: number | null;
  benchmark7d: number | null;
  benchmark30d: number | null;
  lastRefreshed: string | null;
  timeZone: string | null;
  onRetry: () => void;
}

export const Screen1CheckRate: React.FC<Screen1Props> = ({
  input,
  onChangeInput,
  onSubmit,
  status,
  errorMessage,
  todayRate,
  benchmark7d,
  benchmark30d,
  lastRefreshed,
  timeZone,
  onRetry,
}) => {
  const isVndToSgd = input.haveCurrency === 'VND' && input.wantCurrency === 'SGD';
  const isReady = status === 'success' && todayRate !== null && benchmark7d !== null && benchmark30d !== null;

  const handleToggleDirection = () => {
    onChangeInput((prev) => ({
      ...prev,
      haveCurrency: prev.wantCurrency,
      wantCurrency: prev.haveCurrency,
    }));
  };

  const handleBenchmarkChange = (benchmark: BenchmarkType) => {
    onChangeInput((prev) => ({ ...prev, benchmark }));
  };

  const handleAmountChange = (valStr: string) => {
    const cleaned = valStr.replace(/[^0-9]/g, '');
    const num = cleaned === '' ? null : parseInt(cleaned, 10);
    onChangeInput((prev) => ({ ...prev, amount: num }));
  };

  const handlePresetAmount = (preset: number) => {
    onChangeInput((prev) => ({
      ...prev,
      amount: prev.amount === preset ? null : preset,
    }));
  };

  return (
    <div id="screen-1-check-rate" className="w-full max-w-xl mx-auto">
      {/* Main Heading & Beginner-Friendly Help Text */}
      <div className="mb-5 sm:mb-6 text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium mb-2.5 sm:mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Quick Decision Check</span>
        </div>
        <h1 id="main-heading" className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight font-display">
          Is today’s rate better for you?
        </h1>
        <p id="help-intro-text" className="mt-2 text-xs sm:text-base text-slate-600 leading-relaxed max-w-lg">
          BetterRate compares today’s exchange rate with recent averages, so you can clearly see whether today is more favorable for your currency exchange before you decide.
        </p>
      </div>

      {/* Provider Status / Failure Alert */}
      {status === 'loading' && (
        <div
          id="fx-loading-state"
          className="mb-4 p-4 rounded-xl bg-slate-100/90 border border-slate-200 text-slate-700 flex items-center gap-3"
        >
          <RefreshCw className="w-4 h-4 text-slate-600 animate-spin shrink-0" />
          <span className="text-xs sm:text-sm font-medium">Getting the latest exchange-rate data...</span>
        </div>
      )}

      {status !== 'loading' && status !== 'success' && (
        <div
          id="fx-failure-state"
          className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs sm:text-sm font-semibold">
                {status === 'empty_data' && 'We could not find enough exchange-rate data for this comparison.'}
                {status === 'provider_unreachable' && 'We cannot reach the exchange-rate service right now. Please try again later.'}
                {status === 'provider_error' && (errorMessage || 'The exchange-rate provider could not complete this request.')}
              </p>
              {errorMessage && status !== 'provider_error' && (
                <p className="text-[11px] text-amber-800/90 mt-0.5">{errorMessage}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-900 text-white hover:bg-amber-800 transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Main Form Card */}
      <div id="input-form-card" className="bg-white rounded-2xl p-4 sm:p-7 shadow-xs border border-slate-200/90 space-y-5 sm:space-y-6">
        
        {/* 1: Currency Direction Selection */}
        <div id="currency-pair-section" className="space-y-2.5 sm:space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
              1. What currencies are you exchanging?
            </label>
            <span className="text-[11px] sm:text-xs text-slate-400">Supported pair: VND ↔ SGD</span>
          </div>

          {/* Currency Boxes: Stacked cleanly on mobile, side-by-side on desktop */}
          <div className="flex flex-col sm:grid sm:grid-cols-11 sm:items-center gap-2">
            {/* I have */}
            <div
              id="i-have-box"
              onClick={handleToggleDirection}
              className="sm:col-span-5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl p-3 sm:p-3.5 cursor-pointer transition-colors active:scale-[0.99]"
              title="Tap to switch currency direction"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">I have</span>
                <span className="text-[10px] text-slate-400 sm:hidden">Tap to switch</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
                  {input.haveCurrency}
                </span>
                <span className="text-xs text-slate-600 font-medium">
                  {input.haveCurrency === 'VND' ? 'Vietnamese Dong' : 'Singapore Dollar'}
                </span>
              </div>
            </div>

            {/* Swap Button */}
            <div className="sm:col-span-1 flex justify-center py-0.5 sm:py-0">
              <button
                id="currency-swap-button"
                type="button"
                onClick={handleToggleDirection}
                aria-label="Switch currency exchange direction"
                className="w-full sm:w-10 h-11 sm:h-10 rounded-xl sm:rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 sm:bg-white sm:hover:bg-slate-50 text-slate-700 flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer active:scale-95"
              >
                <ArrowRightLeft className="w-4 h-4 text-slate-600 shrink-0" />
                <span className="sm:hidden text-xs font-semibold text-slate-700">Switch currency direction</span>
              </button>
            </div>

            {/* I want */}
            <div
              id="i-want-box"
              onClick={handleToggleDirection}
              className="sm:col-span-5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl p-3 sm:p-3.5 cursor-pointer transition-colors active:scale-[0.99]"
              title="Tap to switch currency direction"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">I want</span>
                <span className="text-[10px] text-slate-400 sm:hidden">Tap to switch</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
                  {input.wantCurrency}
                </span>
                <span className="text-xs text-slate-600 font-medium">
                  {input.wantCurrency === 'SGD' ? 'Singapore Dollar' : 'Vietnamese Dong'}
                </span>
              </div>
            </div>
          </div>

          {/* Direction Statement */}
          <div
            id="currency-direction-pill"
            className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-1.5 sm:space-y-0 sm:flex sm:items-center sm:gap-2"
          >
            <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
              <span>Converting</span>
              <span className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono font-bold text-slate-900 text-xs">
                {input.haveCurrency}
              </span>
              <span className="text-slate-400">→</span>
              <span className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono font-bold text-slate-900 text-xs">
                {input.wantCurrency}
              </span>
            </div>
            <span className="hidden sm:inline text-slate-300">•</span>
            <p className="text-slate-600 leading-normal">
              {isVndToSgd
                ? 'Paying Vietnamese Dong to receive Singapore Dollars'
                : 'Exchanging Singapore Dollars to receive Vietnamese Dong'}
            </p>
          </div>
        </div>

        {/* 2: Neutral Historical Benchmark Selection */}
        <div id="benchmark-selection-section" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
              2. Compare today with:
            </label>
            <span className="text-[11px] text-slate-400">Historical benchmark</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <button
              id="benchmark-7d-btn"
              type="button"
              onClick={() => handleBenchmarkChange('7d')}
              className={`text-left p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer min-h-[60px] ${
                input.benchmark === '7d'
                  ? 'border-slate-900 bg-slate-50/90 ring-1 ring-slate-900 shadow-2xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-semibold text-sm text-slate-900">7-day average</span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                  {benchmark7d !== null ? `${formatRate(benchmark7d)} ₫` : '...'}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Average of daily close rates over the last 7 calendar days.
              </p>
            </button>

            <button
              id="benchmark-30d-btn"
              type="button"
              onClick={() => handleBenchmarkChange('30d')}
              className={`text-left p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer min-h-[60px] ${
                input.benchmark === '30d'
                  ? 'border-slate-900 bg-slate-50/90 ring-1 ring-slate-900 shadow-2xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-semibold text-sm text-slate-900">30-day average</span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                  {benchmark30d !== null ? `${formatRate(benchmark30d)} ₫` : '...'}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Average of daily close rates over the last 30 calendar days.
              </p>
            </button>
          </div>
        </div>

        {/* 3: Optional Amount */}
        <div id="amount-input-section" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="amount-input" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              3. Amount <span className="text-slate-400 font-normal normal-case">(Optional)</span>
            </label>
            <span className="text-[11px] text-slate-400">Singapore Dollars (SGD)</span>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
              S$
            </div>
            <input
              id="amount-input"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 3,000"
              value={input.amount !== null ? formatNumberWithCommas(input.amount) : ''}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="w-full pl-11 pr-4 py-3 min-h-[48px] rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-slate-900 text-base font-semibold placeholder:text-slate-400"
            />
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5 sm:gap-2 pt-1 flex-wrap">
            <span className="text-[11px] text-slate-500 mr-0.5">Quick amounts:</span>
            {[500, 1000, 3000, 5000].map((val) => (
              <button
                key={val}
                id={`preset-btn-${val}`}
                type="button"
                onClick={() => handlePresetAmount(val)}
                className={`text-xs px-3 py-2 min-h-[38px] rounded-lg border font-semibold transition-all cursor-pointer active:scale-95 ${
                  input.amount === val
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                S${formatNumberWithCommas(val)}
              </button>
            ))}
            {input.amount !== null && (
              <button
                id="clear-amount-btn"
                type="button"
                onClick={() => onChangeInput((prev) => ({ ...prev, amount: null }))}
                className="text-xs text-slate-500 hover:text-slate-800 underline ml-auto py-2 px-1 cursor-pointer min-h-[38px] flex items-center"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 leading-normal">
            {isVndToSgd
              ? 'Enter how many Singapore Dollars you want to purchase to estimate the VND cost difference.'
              : 'Enter how many Singapore Dollars you want to convert to estimate the VND payout difference.'}
          </p>
        </div>

        {/* Primary CTA */}
        <div className="pt-2">
          <button
            id="check-rate-btn"
            type="button"
            onClick={onSubmit}
            disabled={!isReady}
            className={`w-full py-4 px-6 min-h-[52px] rounded-xl font-semibold text-base shadow-sm transition-all flex items-center justify-center gap-2 group ${
              isReady
                ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer active:scale-[0.99]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>Check today’s rate</span>
            <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
          </button>
          
          <div className="mt-2.5 text-center">
            <span className="text-[11px] sm:text-xs text-slate-500">
              {todayRate !== null ? (
                <>
                  Today’s rate: 1 SGD = <strong>{formatRate(todayRate)} VND</strong>
                  {lastRefreshed && (
                    <span className="text-slate-400 block sm:inline sm:ml-1">
                      (Refreshed {lastRefreshed} {timeZone || 'UTC'})
                    </span>
                  )}
                </>
              ) : status === 'loading' ? (
                'Loading live exchange rate...'
              ) : (
                'Exchange-rate data unavailable'
              )}
            </span>
          </div>
        </div>

      </div>

      {/* Trust & Educational Clarification Note */}
      <div id="educational-note" className="mt-6 p-4 rounded-xl bg-slate-100/70 border border-slate-200/70 text-xs text-slate-600 flex items-start gap-2.5">
        <HelpCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-slate-700">How BetterRate works</p>
          <p className="leading-relaxed">
            BetterRate calculates whether today’s exchange rate is mathematically more favorable for your specific direction:
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
            <li><strong>Converting VND to SGD</strong>: A lower rate is more favorable because each Singapore Dollar costs fewer Vietnamese Dong.</li>
            <li><strong>Converting SGD to VND</strong>: A higher rate is more favorable because you receive more Vietnamese Dong for each Singapore Dollar.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
