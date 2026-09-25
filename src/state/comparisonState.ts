import {
  BenchmarkType,
  ComparisonResult,
  CurrencyCode,
  FxCurrentData,
  FxDataStatus,
  FxHistoryData,
} from '../types';
import { getQuotePair } from '../data/currencies';
import { calculateComparison } from '../utils/calculations';
import { FxErrorCode } from '../services/fxApi';

/**
 * One-page state: the selection, the optional amount, and the data loaded for one
 * market quote (e.g. SGD/VND serves both SGD -> VND and VND -> SGD).
 *
 * - Data is fetched only when the user checks the rate (never for amount or benchmark
 *   changes: the history already contains both the 7-day and 30-day benchmarks).
 * - Choosing a pair with a different market quote clears the loaded data.
 * - Every fetch carries a requestId; responses for an older request are ignored.
 */
export interface LoadedFxData {
  pairKey: string;
  current: FxCurrentData;
  history: FxHistoryData;
}

export interface ComparisonState {
  haveCurrency: CurrencyCode;
  wantCurrency: CurrencyCode;
  benchmark: BenchmarkType;
  amount: number | null;
  status: 'idle' | FxDataStatus;
  errorMessage: string | null;
  data: LoadedFxData | null;
  requestId: number;
}

export type ComparisonAction =
  | { type: 'SET_CURRENCY'; side: 'have' | 'want'; code: CurrencyCode }
  | { type: 'SWAP' }
  | { type: 'SET_BENCHMARK'; benchmark: BenchmarkType }
  | { type: 'SET_AMOUNT'; amount: number | null }
  | { type: 'REQUEST_START' }
  | { type: 'REQUEST_SUCCESS'; requestId: number; pairKey: string; current: FxCurrentData; history: FxHistoryData }
  | { type: 'REQUEST_FAILURE'; requestId: number; code: FxErrorCode | null; message: string }
  | { type: 'RESET' };

export const initialComparisonState: ComparisonState = {
  haveCurrency: 'VND',
  wantCurrency: 'SGD',
  benchmark: '7d',
  amount: null,
  status: 'idle',
  errorMessage: null,
  data: null,
  requestId: 0,
};

export function getPairKey(have: CurrencyCode, want: CurrencyCode): string {
  const { base, quote } = getQuotePair(have, want);
  return `${base}/${quote}`;
}

export function statusFromErrorCode(code: FxErrorCode | null): FxDataStatus {
  switch (code) {
    case 'EMPTY_DATA':
      return 'empty_data';
    case 'PROVIDER_UNREACHABLE':
      return 'provider_unreachable';
    case 'PROVIDER_RATE_LIMIT':
      return 'provider_rate_limit';
    case 'INVALID_PAIR':
    case 'UNSUPPORTED_CURRENCY':
      return 'invalid_pair';
    default:
      return 'provider_error';
  }
}

/** Applies a new selection; loaded data survives only if the market quote is unchanged. */
function withSelection(state: ComparisonState, haveCurrency: CurrencyCode, wantCurrency: CurrencyCode): ComparisonState {
  const next = { ...state, haveCurrency, wantCurrency };
  if (state.data && state.data.pairKey === getPairKey(haveCurrency, wantCurrency)) {
    return next;
  }
  // Different market quote: drop stale data and invalidate any in-flight request
  return { ...next, status: 'idle', errorMessage: null, data: null, requestId: state.requestId + 1 };
}

export function comparisonReducer(state: ComparisonState, action: ComparisonAction): ComparisonState {
  switch (action.type) {
    case 'SET_CURRENCY': {
      const current = action.side === 'have' ? state.haveCurrency : state.wantCurrency;
      const other = action.side === 'have' ? state.wantCurrency : state.haveCurrency;
      if (action.code === current) return state;
      // Choosing the currency already on the other side swaps the pair instead of creating an invalid one
      if (action.code === other) return withSelection(state, state.wantCurrency, state.haveCurrency);
      return action.side === 'have'
        ? withSelection(state, action.code, state.wantCurrency)
        : withSelection(state, state.haveCurrency, action.code);
    }
    case 'SWAP':
      return withSelection(state, state.wantCurrency, state.haveCurrency);
    case 'SET_BENCHMARK':
      return { ...state, benchmark: action.benchmark };
    case 'SET_AMOUNT':
      return { ...state, amount: action.amount };
    case 'REQUEST_START':
      return { ...state, status: 'loading', errorMessage: null, data: null, requestId: state.requestId + 1 };
    case 'REQUEST_SUCCESS':
      if (action.requestId !== state.requestId) return state;
      if (action.pairKey !== getPairKey(state.haveCurrency, state.wantCurrency)) return state;
      return {
        ...state,
        status: 'success',
        errorMessage: null,
        data: { pairKey: action.pairKey, current: action.current, history: action.history },
      };
    case 'REQUEST_FAILURE':
      if (action.requestId !== state.requestId) return state;
      return { ...state, status: statusFromErrorCode(action.code), errorMessage: action.message, data: null };
    case 'RESET':
      return { ...state, amount: null, status: 'idle', errorMessage: null, data: null, requestId: state.requestId + 1 };
    default:
      return state;
  }
}

/** The decision for the current selection, or null when no matching data is loaded. */
export function selectComparison(state: ComparisonState): ComparisonResult | null {
  const { data } = state;
  if (state.status !== 'success' || !data) return null;
  if (data.pairKey !== getPairKey(state.haveCurrency, state.wantCurrency)) return null;

  const benchmark = data.history.benchmarks?.[state.benchmark];
  if (!benchmark || typeof benchmark.average !== 'number') return null;

  const benchmarkName = state.benchmark === '7d' ? '7-day average' : '30-day average';
  return calculateComparison(
    {
      haveCurrency: state.haveCurrency,
      wantCurrency: state.wantCurrency,
      benchmark: state.benchmark,
      amount: state.amount,
    },
    data.current.rate,
    benchmark.average,
    benchmarkName
  );
}
