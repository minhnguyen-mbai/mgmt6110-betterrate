import React, { useReducer, useEffect, useRef, useCallback } from 'react';
import { BenchmarkType, CurrencyCode } from './types';
import { fetchCurrentFx, fetchHistoryFx, FxApiError } from './services/fxApi';
import { getQuotePair } from './data/currencies';
import {
  comparisonReducer,
  createInitialState,
  getPairKey,
  selectComparison,
} from './state/comparisonState';
import { parseSelection, canonicalizeLocation, recordShownComparison } from './state/urlState';
import { Header } from './components/Header';
import { ComparisonPage } from './components/ComparisonPage';
import { DisqusComments } from './components/DisqusComments';

export default function App() {
  // A comparison URL (?have=VND&want=SGD&benchmark=7d) opens that comparison and loads it
  const [state, dispatch] = useReducer(comparisonReducer, null, () =>
    createInitialState(typeof window === 'undefined' ? null : parseSelection(window.location.search))
  );
  const loadController = useRef<AbortController | null>(null);
  const haveSelectRef = useRef<HTMLSelectElement>(null);

  // requestId the next REQUEST_START will assign; responses carrying an older id are ignored
  const requestIdRef = useRef(state.requestId);
  requestIdRef.current = state.requestId;

  const abortInFlight = () => {
    loadController.current?.abort();
    loadController.current = null;
  };

  // Fetch only on "Compare today's rate": never for benchmark changes or swaps within the same quote
  const handleCheck = useCallback(async () => {
    if (state.status === 'loading') return;
    abortInFlight();
    const controller = new AbortController();
    loadController.current = controller;

    // Advance the ref too, so a second call before the next render (e.g. StrictMode) gets its own id
    const requestId = ++requestIdRef.current;
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
          message: 'Rate data is temporarily unavailable. Please try again shortly.',
        });
      }
    }
  }, [state.status, state.haveCurrency, state.wantCurrency]);

  // A pair with a different market quote invalidates the in-flight request
  const pairKey = getPairKey(state.haveCurrency, state.wantCurrency);
  useEffect(() => abortInFlight, [pairKey]);

  // URL state. Opening a page: canonicalize its comparison parameters in place (no new entry).
  // Back/Forward: restore the entry's comparison (or the blank form) and load it if needed.
  useEffect(() => {
    canonicalizeLocation(window.location, window.history);
    const onPopState = () => dispatch({ type: 'RESTORE', selection: parseSelection(window.location.search) });
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // A comparison that came from a URL loads without pressing "Compare today's rate"
  useEffect(() => {
    if (state.autoLoad && state.status === 'idle' && !state.data) handleCheck();
  }, [state.autoLoad, state.status, state.data, handleCheck]);

  const handleChangeCurrency = (side: 'have' | 'want', code: CurrencyCode) =>
    dispatch({ type: 'SET_CURRENCY', side, code });
  const handleSwap = () => dispatch({ type: 'SWAP' });
  const handleBenchmarkChange = (benchmark: BenchmarkType) => dispatch({ type: 'SET_BENCHMARK', benchmark });

  const handleCheckAnother = () => {
    abortInFlight();
    dispatch({ type: 'RESET' });
    const select = haveSelectRef.current;
    select?.closest('section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    select?.focus({ preventScroll: true });
  };

  const comparisonResult = selectComparison(state);

  // Each comparison actually shown (first result, benchmark switch, swap) gets a history entry with
  // its URL; an unsubmitted new pair shows no result, so the URL stays at the last shown comparison
  const hasResult = comparisonResult !== null;
  useEffect(() => {
    if (!hasResult) return;
    recordShownComparison(window.location, window.history, {
      haveCurrency: state.haveCurrency,
      wantCurrency: state.wantCurrency,
      benchmark: state.benchmark,
    });
  }, [hasResult, state.haveCurrency, state.wantCurrency, state.benchmark]);

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
        <p id="advice-note" className="max-w-4xl mx-auto mt-3 leading-relaxed">
          BetterRate provides exchange-rate comparison information only and is not financial advice.
        </p>
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
