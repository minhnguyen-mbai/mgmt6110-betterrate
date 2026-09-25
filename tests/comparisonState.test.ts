import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  comparisonReducer,
  initialComparisonState,
  selectComparison,
  getPairKey,
  ComparisonState,
  ComparisonAction,
} from '../src/state/comparisonState';
import { FxCurrentData, FxHistoryData } from '../src/types';

const current = (from: string, to: string, rate: number): FxCurrentData => ({
  from,
  to,
  rate,
  lastRefreshed: '2026-09-25',
  timeZone: null,
  provider: 'Frankfurter',
});

const history = (from: string, to: string, avg7: number, avg30: number): FxHistoryData => ({
  from,
  to,
  lastRefreshed: '2026-09-24',
  timeZone: null,
  provider: 'Frankfurter',
  benchmarks: {
    '7d': { average: avg7, observationCount: 5, startDate: '2026-09-18', endDate: '2026-09-24' },
    '30d': { average: avg30, observationCount: 21, startDate: '2026-08-26', endDate: '2026-09-24' },
  },
  daily: [{ date: '2026-09-24', close: avg7 }],
});

const run = (actions: ComparisonAction[], from: ComparisonState = initialComparisonState) =>
  actions.reduce(comparisonReducer, from);

/** Simulates a completed "Check today's rate" for the current selection. */
function checked(state: ComparisonState, rate: number, avg7: number, avg30: number): ComparisonState {
  const started = comparisonReducer(state, { type: 'REQUEST_START' });
  const [base, quote] = getPairKey(state.haveCurrency, state.wantCurrency).split('/');
  return comparisonReducer(started, {
    type: 'REQUEST_SUCCESS',
    requestId: started.requestId,
    pairKey: getPairKey(state.haveCurrency, state.wantCurrency),
    current: current(base, quote, rate),
    history: history(base, quote, avg7, avg30),
  });
}

test('1/17. user can select any supported currency pair; choosing the other side swaps', () => {
  let s = run([
    { type: 'SET_CURRENCY', side: 'have', code: 'USD' },
    { type: 'SET_CURRENCY', side: 'want', code: 'EUR' },
  ]);
  assert.equal(s.haveCurrency, 'USD');
  assert.equal(s.wantCurrency, 'EUR');
  s = comparisonReducer(s, { type: 'SET_CURRENCY', side: 'have', code: 'EUR' });
  assert.deepEqual([s.haveCurrency, s.wantCurrency], ['EUR', 'USD'], 'never an invalid EUR -> EUR pair');
  assert.equal(getPairKey('JPY', 'THB'), 'THB/JPY');
});

test('2. user can select the 7-day or 30-day benchmark; the result updates without refetching', () => {
  let s = checked(run([{ type: 'SET_CURRENCY', side: 'have', code: 'USD' }, { type: 'SET_CURRENCY', side: 'want', code: 'SGD' }]), 1.2798, 1.2769, 1.2719);
  assert.equal(selectComparison(s)?.benchmarkRate, 1.2769);
  const requestId = s.requestId;
  s = comparisonReducer(s, { type: 'SET_BENCHMARK', benchmark: '30d' });
  assert.equal(s.benchmark, '30d');
  assert.equal(s.status, 'success');
  assert.equal(s.requestId, requestId, 'no new request');
  assert.equal(selectComparison(s)?.benchmarkRate, 1.2719);
  assert.equal(selectComparison(s)?.benchmarkName, '30-day average');
});

test('3/5/6. decision works without an amount; favorable and less favorable wording', () => {
  const usdSgd = run([{ type: 'SET_CURRENCY', side: 'have', code: 'USD' }, { type: 'SET_CURRENCY', side: 'want', code: 'SGD' }]);
  const better = selectComparison(checked(usdSgd, 1.2798, 1.2769, 1.28));
  assert.ok(better);
  assert.equal(better.amount, null);
  assert.equal(better.statusText, 'Better for converting USD to SGD');
  assert.equal(better.headlineComparison, '0.23% more favorable today');
  assert.equal(better.todayRate, 1.2798);
  assert.equal(better.benchmarkRate, 1.2769);

  const worse = selectComparison(checked(usdSgd, 1.27, 1.2769, 1.28));
  assert.equal(worse?.statusText, 'Less favorable for converting USD to SGD');
  assert.match(worse?.headlineComparison ?? '', /less favorable today$/);

  assert.equal(selectComparison(usdSgd), null, 'no result before the rate is checked');
});

test('7/8. amount calculator uses loaded data; amount changes never start a request', () => {
  let s = checked(run([{ type: 'SET_CURRENCY', side: 'have', code: 'USD' }, { type: 'SET_CURRENCY', side: 'want', code: 'SGD' }]), 1.2798, 1.2769, 1.28);
  const before = { requestId: s.requestId, status: s.status, data: s.data };
  s = comparisonReducer(s, { type: 'SET_AMOUNT', amount: 3000 });
  assert.equal(s.requestId, before.requestId);
  assert.equal(s.status, before.status);
  assert.equal(s.data, before.data, 'same loaded data object is reused');
  const r = selectComparison(s);
  assert.equal(r?.amountFormatted, 'US$3,000');
  assert.equal(r?.differenceFormatted, '8.70 SGD');
  assert.equal(r?.moneyDifferenceText, 'About 8.70 SGD more received today');

  s = comparisonReducer(s, { type: 'SET_AMOUNT', amount: null });
  assert.equal(selectComparison(s)?.moneyDifferenceText, null, 'clear amount works');
});

test('9. swap keeps the same market quote data and flips the decision direction', () => {
  let s = checked(run([{ type: 'SET_CURRENCY', side: 'have', code: 'SGD' }, { type: 'SET_CURRENCY', side: 'want', code: 'EUR' }]), 1.458, 1.4634, 1.4716);
  assert.equal(selectComparison(s)?.statusText, 'Better for converting SGD to EUR');
  s = comparisonReducer(s, { type: 'SWAP' });
  assert.deepEqual([s.haveCurrency, s.wantCurrency], ['EUR', 'SGD']);
  assert.equal(s.status, 'success');
  assert.equal(selectComparison(s)?.statusText, 'Less favorable for converting EUR to SGD');
});

test('10. changing to a different pair clears the stale result', () => {
  let s = checked(run([{ type: 'SET_CURRENCY', side: 'have', code: 'SGD' }, { type: 'SET_CURRENCY', side: 'want', code: 'EUR' }]), 1.458, 1.4634, 1.4716);
  s = comparisonReducer(s, { type: 'SET_CURRENCY', side: 'want', code: 'GBP' });
  assert.equal(s.data, null);
  assert.equal(s.status, 'idle');
  assert.equal(selectComparison(s), null);
});

test('11. stale responses cannot overwrite the current selection', () => {
  // User checks SGD -> EUR, then switches to SGD -> GBP and checks again
  let s = run([{ type: 'SET_CURRENCY', side: 'have', code: 'SGD' }, { type: 'SET_CURRENCY', side: 'want', code: 'EUR' }, { type: 'REQUEST_START' }]);
  const eurRequest = s.requestId;
  s = run([{ type: 'SET_CURRENCY', side: 'want', code: 'GBP' }, { type: 'REQUEST_START' }], s);
  const gbpRequest = s.requestId;

  // Slow EUR response arrives late: ignored
  const afterEur = comparisonReducer(s, {
    type: 'REQUEST_SUCCESS',
    requestId: eurRequest,
    pairKey: 'EUR/SGD',
    current: current('EUR', 'SGD', 1.458),
    history: history('EUR', 'SGD', 1.46, 1.47),
  });
  assert.equal(afterEur, s, 'state unchanged');
  assert.equal(afterEur.status, 'loading');

  // A late failure for the old request is ignored too
  assert.equal(comparisonReducer(s, { type: 'REQUEST_FAILURE', requestId: eurRequest, code: 'PROVIDER_ERROR', message: 'x' }), s);

  // A response whose pair does not match the selection is ignored even with the current id
  assert.equal(
    comparisonReducer(s, { type: 'REQUEST_SUCCESS', requestId: gbpRequest, pairKey: 'EUR/SGD', current: current('EUR', 'SGD', 1.458), history: history('EUR', 'SGD', 1.46, 1.47) }),
    s
  );

  const done = comparisonReducer(s, {
    type: 'REQUEST_SUCCESS',
    requestId: gbpRequest,
    pairKey: 'GBP/SGD',
    current: current('GBP', 'SGD', 1.6963),
    history: history('GBP', 'SGD', 1.7023, 1.7141),
  });
  assert.equal(selectComparison(done)?.statusText, 'Better for converting SGD to GBP');
});

test('normalized errors map to page states; loading keeps the selection', () => {
  const cases: Array<[ComparisonAction & { type: 'REQUEST_FAILURE' }, string]> = [
    [{ type: 'REQUEST_FAILURE', requestId: 1, code: 'INVALID_PAIR', message: 'm' }, 'invalid_pair'],
    [{ type: 'REQUEST_FAILURE', requestId: 1, code: 'UNSUPPORTED_CURRENCY', message: 'm' }, 'invalid_pair'],
    [{ type: 'REQUEST_FAILURE', requestId: 1, code: 'PROVIDER_UNREACHABLE', message: 'm' }, 'provider_unreachable'],
    [{ type: 'REQUEST_FAILURE', requestId: 1, code: 'PROVIDER_RATE_LIMIT', message: 'm' }, 'provider_rate_limit'],
    [{ type: 'REQUEST_FAILURE', requestId: 1, code: 'EMPTY_DATA', message: 'm' }, 'empty_data'],
    [{ type: 'REQUEST_FAILURE', requestId: 1, code: 'INVALID_RATE', message: 'm' }, 'provider_error'],
    [{ type: 'REQUEST_FAILURE', requestId: 1, code: 'PROVIDER_ERROR', message: 'm' }, 'provider_error'],
  ];
  for (const [action, status] of cases) {
    const loading = comparisonReducer(initialComparisonState, { type: 'REQUEST_START' });
    assert.equal(loading.status, 'loading');
    assert.equal(loading.haveCurrency, initialComparisonState.haveCurrency);
    const failed = comparisonReducer(loading, action);
    assert.equal(failed.status, status, String(action.code));
    assert.equal(failed.errorMessage, 'm');
  }
});

test('"Check another rate" clears the result and amount, keeps the selection', () => {
  let s = checked(run([{ type: 'SET_CURRENCY', side: 'have', code: 'USD' }, { type: 'SET_CURRENCY', side: 'want', code: 'SGD' }, { type: 'SET_BENCHMARK', benchmark: '30d' }]), 1.2798, 1.2769, 1.28);
  s = comparisonReducer(s, { type: 'SET_AMOUNT', amount: 500 });
  const reset = comparisonReducer(s, { type: 'RESET' });
  assert.equal(reset.data, null);
  assert.equal(reset.status, 'idle');
  assert.equal(reset.amount, null);
  assert.deepEqual([reset.haveCurrency, reset.wantCurrency, reset.benchmark], ['USD', 'SGD', '30d']);
  assert.ok(reset.requestId > s.requestId, 'any in-flight response is invalidated');
});
