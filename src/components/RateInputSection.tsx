import React from 'react';
import { BenchmarkType, CurrencyCode, FxDataStatus } from '../types';
import { ArrowRightLeft, Calendar, ChevronDown, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { SUPPORTED_CURRENCIES, getCurrencyInfo, getQuotePair } from '../data/currencies';

interface RateInputSectionProps {
  haveCurrency: CurrencyCode;
  wantCurrency: CurrencyCode;
  benchmark: BenchmarkType;
  status: 'idle' | FxDataStatus;
  errorMessage: string | null;
  onChangeCurrency: (side: 'have' | 'want', code: CurrencyCode) => void;
  onSwap: () => void;
  onBenchmarkChange: (benchmark: BenchmarkType) => void;
  onCheck: () => void;
  haveSelectRef?: React.Ref<HTMLSelectElement>;
}

/**
 * Decision inputs: currency pair and benchmark window only. The amount is optional and
 * lives in the result area, so the core answer never requires it.
 */
export const RateInputSection: React.FC<RateInputSectionProps> = ({
  haveCurrency,
  wantCurrency,
  benchmark,
  status,
  errorMessage,
  onChangeCurrency,
  onSwap,
  onBenchmarkChange,
  onCheck,
  haveSelectRef,
}) => {
  const have = getCurrencyInfo(haveCurrency);
  const want = getCurrencyInfo(wantCurrency);
  const { base: baseCode } = getQuotePair(haveCurrency, wantCurrency);
  // Buying the base currency (e.g. VND -> SGD): a lower "1 base = X quote" rate is more favorable
  const isBuyingBase = wantCurrency === baseCode;
  const isLoading = status === 'loading';

  return (
    <section id="rate-input-section" className="w-full max-w-xl mx-auto">
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

      {/* Main Form Card */}
      <div id="input-form-card" className="bg-white rounded-2xl p-4 sm:p-7 shadow-xs border border-slate-200/90 space-y-5 sm:space-y-6">
        
        {/* 1: Currency Direction Selection */}
        <div id="currency-pair-section" className="space-y-2.5 sm:space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
              1. What currencies are you exchanging?
            </label>
            <span className="text-[11px] sm:text-xs text-slate-400">Selected pair: {haveCurrency} ↔ {wantCurrency}</span>
          </div>

          {/* Currency Boxes: Stacked cleanly on mobile, side-by-side on desktop */}
          <div className="flex flex-col sm:grid sm:grid-cols-11 sm:items-center gap-2">
            {/* I have */}
            <div
              id="i-have-box"
              className="relative sm:col-span-5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl p-3 sm:p-3.5 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-slate-900"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">I have</span>
                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                  <span className="sm:hidden">Tap to change</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
                  {have.code}
                </span>
                <span className="text-xs text-slate-600 font-medium">
                  {have.name}
                </span>
              </div>
              {/* Native select covers the card: keeps the card design while staying keyboard and screen-reader accessible */}
              <select
                id="i-have-select"
                aria-label="I have"
                value={have.code}
                onChange={(e) => onChangeCurrency('have', e.target.value as CurrencyCode)}
                ref={haveSelectRef}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <div className="sm:col-span-1 flex justify-center py-0.5 sm:py-0">
              <button
                id="currency-swap-button"
                type="button"
                onClick={onSwap}
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
              className="relative sm:col-span-5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl p-3 sm:p-3.5 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-slate-900"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">I want</span>
                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                  <span className="sm:hidden">Tap to change</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
                  {want.code}
                </span>
                <span className="text-xs text-slate-600 font-medium">
                  {want.name}
                </span>
              </div>
              {/* Native select covers the card: keeps the card design while staying keyboard and screen-reader accessible */}
              <select
                id="i-want-select"
                aria-label="I want"
                value={want.code}
                onChange={(e) => onChangeCurrency('want', e.target.value as CurrencyCode)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
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
                {haveCurrency}
              </span>
              <span className="text-slate-400">→</span>
              <span className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono font-bold text-slate-900 text-xs">
                {wantCurrency}
              </span>
            </div>
            <span className="hidden sm:inline text-slate-300">•</span>
            <p className="text-slate-600 leading-normal">
              {isBuyingBase
                ? `Paying ${have.plural} to receive ${want.plural}`
                : `Exchanging ${have.plural} to receive ${want.plural}`}
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
              onClick={() => onBenchmarkChange('7d')}
              aria-pressed={benchmark === '7d'}
              className={`text-left p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer min-h-[60px] ${
                benchmark === '7d'
                  ? 'border-slate-900 bg-slate-50/90 ring-1 ring-slate-900 shadow-2xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-semibold text-sm text-slate-900">7-day average</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Average of daily close rates over the last 7 calendar days.
              </p>
            </button>

            <button
              id="benchmark-30d-btn"
              type="button"
              onClick={() => onBenchmarkChange('30d')}
              aria-pressed={benchmark === '30d'}
              className={`text-left p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer min-h-[60px] ${
                benchmark === '30d'
                  ? 'border-slate-900 bg-slate-50/90 ring-1 ring-slate-900 shadow-2xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-semibold text-sm text-slate-900">30-day average</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Average of daily close rates over the last 30 calendar days.
              </p>
            </button>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="pt-2">
          <button
            id="check-rate-btn"
            type="button"
            onClick={onCheck}
            disabled={isLoading}
            aria-busy={isLoading}
            className={`w-full py-4 px-6 min-h-[52px] rounded-xl font-semibold text-base shadow-sm transition-all flex items-center justify-center gap-2 group ${
              !isLoading
                ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer active:scale-[0.99]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>{isLoading ? 'Checking today’s rate…' : 'Check today’s rate'}</span>
            {!isLoading && <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>}
          </button>
        </div>
      </div>

      {/* Provider Status / Failure Alert (same page, input stays visible) */}
      {status === 'loading' && (
        <div
          id="fx-loading-state"
          className="mt-4 p-4 rounded-xl bg-slate-100/90 border border-slate-200 text-slate-700 flex items-center gap-3"
        >
          <RefreshCw className="w-4 h-4 text-slate-600 animate-spin shrink-0" />
          <span className="text-xs sm:text-sm font-medium">
            Getting the latest {haveCurrency} → {wantCurrency} exchange-rate data...
          </span>
        </div>
      )}

      {status !== 'idle' && status !== 'loading' && status !== 'success' && (
        <div
          id="fx-failure-state"
          className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs sm:text-sm font-semibold">
                {status === 'empty_data' && 'We could not find enough exchange-rate data for this comparison.'}
                {status === 'provider_unreachable' && 'We cannot reach the exchange-rate service right now. Please try again later.'}
                {status === 'provider_error' && (errorMessage || 'The exchange-rate provider could not complete this request.')}
                {status === 'provider_rate_limit' && 'The exchange-rate provider has reached its request limit for now. Please try again later.'}
                {status === 'invalid_pair' && (errorMessage || 'This currency pair is not supported. Please choose two different currencies from the list.')}
              </p>
              {errorMessage && status !== 'provider_error' && status !== 'invalid_pair' && status !== 'provider_rate_limit' && (
                <p className="text-[11px] text-amber-800/90 mt-0.5">{errorMessage}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCheck}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-900 text-white hover:bg-amber-800 transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

    </section>
  );
};
