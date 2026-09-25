import React, { useReducer, useEffect, useRef, useCallback } from 'react';
import { BenchmarkType, CurrencyCode } from './types';
import { fetchCurrentFx, fetchHistoryFx, FxApiError } from './services/fxApi';
import { getQuotePair } from './data/currencies';
import {
  comparisonReducer,
  initialComparisonState,
  getPairKey,
  selectComparison,
} from './state/comparisonState';
import { Header } from './components/Header';
import { ComparisonPage } from './components/ComparisonPage';
import { DisqusComments } from './components/DisqusComments';

export default function App() {
  const [state, dispatch] = useReducer(comparisonReducer, initialComparisonState);
  const loadController = useRef<AbortController | null>(null);
  const haveSelectRef = useRef<HTMLSelectElement>(null);

  // requestId the next REQUEST_START will assign; responses carrying an older id are ignored
  const requestIdRef = useRef(state.requestId);
  requestIdRef.current = state.requestId;

  const abortInFlight = () => {
    loadController.current?.abort();
    loadController.current = null;
  };

  // Fetch only on "Check today's rate": never for amount or benchmark changes
  const handleCheck = useCallback(async () => {
    if (state.status === 'loading') return;
    abortInFlight();
    const controller = new AbortController();
    loadController.current = controller;

    const requestId = requestIdRef.current + 1;
    const pairKey = getPairKey(state.haveCurrency, state.wantCurrency);
    // Both directions of a pair share one market quote (e.g. 1 SGD = X VND)
    const { base, quote } = getQuotePair(state.haveCurrency, state.wantCurrency);
    dispatch({ type: 'REQUEST_START' });

    try {
      // 1. Current real-time rate first, then 2. historical benchmarks
      const current = await fetchCurrentFx(base, quote, controller.signal);
      const history = await fetchHistoryFx(base, quote, controller.signal);
      if (controller.signal.aborted) return;
      dispatch({ type: 'REQUEST_SUCCESS', requestId, pairKey, current, history });
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      if (err instanceof FxApiError) {
        dispatch({ type: 'REQUEST_FAILURE', requestId, code: err.code, message: err.userMessage });
      } else {
        dispatch({
          type: 'REQUEST_FAILURE',
          requestId,
          code: null,
          message: 'The exchange-rate provider could not complete this request.',
        });
      }
    }
  }, [state.status, state.haveCurrency, state.wantCurrency]);

  // A pair with a different market quote invalidates the in-flight request
  const pairKey = getPairKey(state.haveCurrency, state.wantCurrency);
  useEffect(() => abortInFlight, [pairKey]);

  const handleChangeCurrency = (side: 'have' | 'want', code: CurrencyCode) =>
    dispatch({ type: 'SET_CURRENCY', side, code });
  const handleSwap = () => dispatch({ type: 'SWAP' });
  const handleBenchmarkChange = (benchmark: BenchmarkType) => dispatch({ type: 'SET_BENCHMARK', benchmark });
  const handleAmountChange = (amount: number | null) => dispatch({ type: 'SET_AMOUNT', amount });

  const handleCheckAnother = () => {
    abortInFlight();
    dispatch({ type: 'RESET' });
    const select = haveSelectRef.current;
    select?.closest('section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    select?.focus({ preventScroll: true });
  };

  const comparisonResult = selectComparison(state);

  return (
    <div id="better-rate-app" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      <Header />

      <main className="flex-1 w-full max-w-4xl mx-auto px-3.5 sm:px-6 py-4 sm:py-8 flex flex-col items-center">
        <ComparisonPage
          state={state}
          result={comparisonResult}
          onChangeCurrency={handleChangeCurrency}
          onSwap={handleSwap}
          onBenchmarkChange={handleBenchmarkChange}
          onAmountChange={handleAmountChange}
          onCheck={handleCheck}
          onCheckAnother={handleCheckAnother}
          haveSelectRef={haveSelectRef}
        />
      </main>

      {/* Single site-wide discussion thread */}
      <DisqusComments />

      {/* Subtle, Calm Footer */}
      <footer id="app-footer" className="w-full border-t border-slate-200/80 bg-white/70 py-4 px-4 text-center text-xs text-slate-400">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>BetterRate • Exchange-rate data from Alpha Vantage and Frankfurter</span>
          <span>Designed for non-trader consumers</span>
        </div>
        <p id="privacy-notice" className="max-w-4xl mx-auto mt-3 leading-relaxed">
          This page uses Microsoft Clarity and Disqus, which use cookies to record how visitors use the site and to host comments. By using this page you agree that we and Microsoft may collect and use this data.{' '}
          <a href="https://www.microsoft.com/privacy/privacystatement" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Microsoft Privacy Statement</a>
          {' · '}
          <a href="https://disqus.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Disqus Privacy Policy</a>
          {' · '}
          <a href="https://disqus.com/data-sharing-settings/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Disqus Data Sharing Settings</a>
        </p>
      </footer>
    </div>
  );
}
