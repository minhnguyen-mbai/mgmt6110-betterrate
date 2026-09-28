import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import fxCurrentHandler from '../api/fx-current.js';
import fxHistoryHandler from '../api/fx-history.js';
import { _resetUsdSeriesCache } from '../api/_lib/usdSeries.js';
import { _resetFrankfurterCache } from '../api/_lib/providers/frankfurter.js';
import { ComparisonPage } from '../src/components/ComparisonPage';
import {
  comparisonReducer,
  initialComparisonState,
  selectComparison,
  getPairKey,
  ComparisonState,
} from '../src/state/comparisonState';
import { FxErrorCode } from '../src/services/fxApi';
import { CurrencyCode } from '../src/types';

/**
 * PS4 Bug #2: VND pairs such as VND -> AUD and VND -> THB failed with a generic provider
 * error because Alpha Vantage answers their market quote (AUD -> VND, THB -> VND) without a
 * usable rate. The current rate is now derived via USD (as the history already is), and
 * failures that remain are reported by class with a recovery path.
 */

const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

function mockRes() {
  const res: any = { statusCode: 200, headers: {}, body: undefined };
  res.setHeader = (k: string, v: string) => { res.headers[k.toLowerCase()] = v; };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: any) => { res.body = body; return res; };
  res.end = () => res;
  return res;
}

const USD_RATES: Record<string, number> = { SGD: 1.28, VND: 26000, AUD: 1.52, THB: 33.5 };
const REJECTED = { 'Error Message': 'Invalid API call. Please retry or visit the documentation for CURRENCY_EXCHANGE_RATE.' };
const DAILY_LIMIT = {
  Information: 'We have detected your API key as XXXX and our standard API rate limit is 25 requests per day.',
};

function realtime(rate: number, lastRefreshed: string) {
  return { 'Realtime Currency Exchange Rate': { '5. Exchange Rate': String(rate), '6. Last Refreshed': lastRefreshed, '7. Time Zone': 'UTC' } };
}

/** 30 USD -> code daily closes ending yesterday (UTC); only VND drifts, so VND cross rates move. */
function daily(code: string) {
  const series: Record<string, { '4. close': string }> = {};
  for (let d = 1; d <= 30; d++) {
    const date = new Date(Date.now() - (31 - d) * 86400000).toISOString().slice(0, 10);
    series[date] = { '4. close': String(USD_RATES[code] * (code === 'VND' ? 1 + (d - 30) * 0.001 : 1)) };
  }
  return { 'Meta Data': { '6. Time Zone': 'UTC' }, 'Time Series FX (Daily)': series };
}

type Upstream = { key: string; at: number };
let calls: Upstream[];
let originalFetch: typeof fetch;

/** respond(key) gets "FUNCTION FROM->TO" (Alpha Vantage) or the Frankfurter path. */
function installFetch(respond: (key: string) => { status?: number; body?: any; throws?: boolean }) {
  globalThis.fetch = (async (url: string) => {
    const u = new URL(url);
    const key = u.hostname.includes('alphavantage')
      ? `${u.searchParams.get('function')} ${u.searchParams.get('from_currency') ?? u.searchParams.get('from_symbol')}->${u.searchParams.get('to_currency') ?? u.searchParams.get('to_symbol')}`
      : u.pathname;
    calls.push({ key, at: Date.now() });
    const { status = 200, body, throws } = respond(key);
    if (throws) throw new TypeError('fetch failed');
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }) as typeof fetch;
}

/** Healthy Alpha Vantage, except that the listed market quotes are answered without a rate. */
function alphaVantage(rejectedQuotes: Record<string, any>) {
  return (key: string) => {
    const [fn, pair] = key.split(' ');
    const [from, to] = pair.split('->');
    if (fn === 'FX_DAILY') return { body: daily(to) };
    if (pair in rejectedQuotes) return { body: rejectedQuotes[pair] };
    if (from === 'USD') return { body: realtime(USD_RATES[to], `2026-09-28 09:0${to.length}:00`) };
    return { body: realtime(USD_RATES[to] / USD_RATES[from], '2026-09-28 09:30:00') };
  };
}

beforeEach(() => {
  calls = [];
  originalFetch = globalThis.fetch;
  process.env.ALPHAVANTAGE_API_KEY = 'test-key';
  _resetUsdSeriesCache();
  _resetFrankfurterCache();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** Runs the same requests the app makes for have -> want (market quote, current then history). */
async function compare(have: CurrencyCode, want: CurrencyCode) {
  const [base, quote] = getPairKey(have, want).split('/');
  const current = mockRes();
  await fxCurrentHandler({ method: 'GET', query: { from: base, to: quote } }, current);
  const history = mockRes();
  if (current.statusCode === 200) {
    await fxHistoryHandler({ method: 'GET', query: { from: base, to: quote } }, history);
  }
  return { current, history };
}

function render(state: ComparisonState) {
  return text(
    renderToStaticMarkup(
      <ComparisonPage
        state={state}
        result={selectComparison(state)}
        onChangeCurrency={noop}
        onSwap={noop}
        onBenchmarkChange={noop}
        onCheck={noop}
        onCheckAnother={noop}
      />
    )
  );
}

function succeeded(have: CurrencyCode, want: CurrencyCode, current: any, history: any, benchmark: '7d' | '30d' = '7d') {
  let s: ComparisonState = { ...initialComparisonState, haveCurrency: have, wantCurrency: want, benchmark };
  s = comparisonReducer(s, { type: 'REQUEST_START' });
  return comparisonReducer(s, { type: 'REQUEST_SUCCESS', requestId: s.requestId, pairKey: getPairKey(have, want), current, history });
}

function failed(have: CurrencyCode, want: CurrencyCode, body: { code: FxErrorCode; error: string }) {
  let s: ComparisonState = { ...initialComparisonState, haveCurrency: have, wantCurrency: want };
  s = comparisonReducer(s, { type: 'REQUEST_START' });
  return comparisonReducer(s, { type: 'REQUEST_FAILURE', requestId: s.requestId, code: body.code, message: body.error });
}

test('Case A: VND -> AUD succeeds via USD when the AUD -> VND quote is rejected', async () => {
  installFetch(alphaVantage({ 'AUD->VND': REJECTED }));
  const { current, history } = await compare('VND', 'AUD');

  assert.equal(current.statusCode, 200);
  assert.equal(current.body.from, 'AUD');
  assert.equal(current.body.to, 'VND');
  // rate(AUD -> VND) = rate(USD -> VND) / rate(USD -> AUD)
  assert.equal(current.body.rate, 26000 / 1.52);
  assert.equal(current.body.method, 'cross-rate-via-usd');
  assert.equal(current.body.lastRefreshed, '2026-09-28 09:03:00', 'older of the two USD legs');
  assert.equal(history.statusCode, 200);
  assert.equal(history.body.derivation, 'cross');

  const realtimeCalls = calls.filter((c) => c.key.startsWith('CURRENCY_EXCHANGE_RATE'));
  assert.deepEqual(realtimeCalls.map((c) => c.key.split(' ')[1]), ['AUD->VND', 'USD->AUD', 'USD->VND']);
  for (let i = 1; i < realtimeCalls.length; i++) {
    assert.ok(realtimeCalls[i].at - realtimeCalls[i - 1].at >= 1000, 'bridge calls are spaced');
  }

  for (const benchmark of ['7d', '30d'] as const) {
    const t = render(succeeded('VND', 'AUD', current.body, history.body, benchmark));
    assert.match(t, /Today’s rate 1 VND = 0\.0000\d+ AUD/);
    assert.ok(t.includes(`${benchmark === '7d' ? '7-day' : '30-day'} average 1 VND =`));
    assert.match(t, /Difference [+−][\d.]+ AUD per VND/);
    assert.ok(!t.includes('fx-failure-state') && !t.includes('temporarily unavailable'));
  }
});

test('Case B: VND -> THB succeeds via USD when the THB -> VND quote has no rate', async () => {
  installFetch(alphaVantage({ 'THB->VND': {} }));
  const { current, history } = await compare('VND', 'THB');

  assert.equal(current.statusCode, 200);
  assert.equal(current.body.rate, 26000 / 33.5);
  assert.equal(current.body.method, 'cross-rate-via-usd');
  assert.equal(history.statusCode, 200);

  const t = render(succeeded('VND', 'THB', current.body, history.body));
  assert.match(t, /Today’s rate 1 VND = [\d.]+ THB/);
  assert.match(t, /Difference [+−][\d.]+ THB per VND/);
});

test('Case C: VND -> SGD control keeps the single direct quote and the Bug #1 direction', async () => {
  installFetch(alphaVantage({}));
  const { current, history } = await compare('VND', 'SGD');

  assert.equal(current.statusCode, 200);
  assert.equal(current.body.method, 'market-quote');
  assert.equal(current.body.rate, 26000 / 1.28);
  assert.deepEqual(
    calls.filter((c) => c.key.startsWith('CURRENCY_EXCHANGE_RATE')).map((c) => c.key.split(' ')[1]),
    ['SGD->VND'],
    'no bridge calls when the direct quote works'
  );

  const t = render(succeeded('VND', 'SGD', current.body, history.body));
  assert.match(t, /Today’s rate 1 VND = 0\.0000\d+ SGD/);
  assert.ok(!t.includes('1 SGD ='), 'Bug #1: never quoted as 1 SGD = X VND');
  assert.match(t, /Difference [+−][\d.]+ SGD per VND/);
});

test('Case D: GBP -> MYR control stays on Frankfurter without Alpha Vantage', async () => {
  delete process.env.ALPHAVANTAGE_API_KEY;
  installFetch(() => ({ body: { date: '2026-09-25', base: 'GBP', quote: 'MYR', rate: 5.6812 } }));
  const current = mockRes();
  await fxCurrentHandler({ method: 'GET', query: { from: 'GBP', to: 'MYR' } }, current);
  assert.equal(current.statusCode, 200);
  assert.equal(current.body.provider, 'Frankfurter');
  assert.equal(current.body.rate, 5.6812);
  assert.deepEqual(calls.map((c) => c.key), ['/v2/rate/GBP/MYR']);
});

test('Case E: transient failures are classified, not bridged, and shown with recovery guidance', async () => {
  const cases: Array<[string, (key: string) => any, FxErrorCode, number, string]> = [
    ['HTTP 500', () => ({ status: 500, body: {} }), 'PROVIDER_ERROR', 502, 'Rate data is temporarily unavailable. Please try again shortly.'],
    ['unreachable', () => ({ throws: true }), 'PROVIDER_UNREACHABLE', 502, 'Rate data is temporarily unavailable. Please try again shortly.'],
    ['daily limit', () => ({ body: DAILY_LIMIT }), 'PROVIDER_RATE_LIMIT', 503, 'Rate data is temporarily unavailable due to provider limits. Please try again later.'],
  ];
  for (const [name, respond, code, status, message] of cases) {
    calls = [];
    installFetch(respond);
    const { current } = await compare('VND', 'AUD');
    assert.equal(current.statusCode, status, name);
    assert.deepEqual(current.body, { error: message, code }, name);
    assert.equal(current.headers['cache-control'], 'no-store');
    assert.equal(calls.length, 1, `${name}: one upstream call, no bridge attempt`);

    const t = render(failed('VND', 'AUD', current.body));
    assert.ok(t.includes(message), name);
    assert.ok(t.includes('Retry'), `${name}: retry is offered`);
    for (const leak of ['Alpha Vantage', 'Invalid API call', 'API key', 'could not complete this request']) {
      assert.ok(!t.includes(leak) && !JSON.stringify(current.body).includes(leak), `${name}: no "${leak}"`);
    }
  }
});

test('Case F: a pair with no usable quote directly or via USD is reported as not supported', async () => {
  installFetch(alphaVantage({ 'AUD->VND': REJECTED, 'USD->AUD': REJECTED }));
  const { current } = await compare('VND', 'AUD');
  assert.equal(current.statusCode, 502);
  assert.deepEqual(current.body, {
    error: 'This currency pair is not currently supported. Please choose a different currency pair.',
    code: 'PAIR_UNAVAILABLE',
  });
  assert.equal(calls.length, 2, 'stops at the first failed leg');

  const t = render(failed('VND', 'AUD', current.body));
  assert.ok(t.includes('This currency pair is not currently supported. Please choose a different currency pair.'));
  assert.ok(!t.includes('Invalid API call'));
});

test('Retry is offered for transient failures but not for PAIR_UNAVAILABLE', () => {
  const unavailable = render(failed('VND', 'AUD', { code: 'PAIR_UNAVAILABLE', error: 'This currency pair is not currently supported. Please choose a different currency pair.' }));
  assert.ok(unavailable.includes('This currency pair is not currently supported. Please choose a different currency pair.'));
  assert.ok(!unavailable.includes('Retry'), 'no Retry for an unavailable pair');

  for (const code of ['PROVIDER_UNREACHABLE', 'PROVIDER_ERROR', 'PROVIDER_RATE_LIMIT'] as const) {
    const t = render(failed('VND', 'AUD', { code, error: 'Rate data is temporarily unavailable. Please try again shortly.' }));
    assert.ok(t.includes('Rate data is temporarily unavailable'), code);
    assert.ok(t.includes('Retry'), `${code}: Retry offered`);
  }
});

test('Case F: a transient failure on a USD leg is not misreported as an unsupported pair', async () => {
  installFetch(alphaVantage({ 'AUD->VND': REJECTED, 'USD->AUD': DAILY_LIMIT }));
  const { current } = await compare('VND', 'AUD');
  assert.equal(current.statusCode, 503);
  assert.equal(current.body.code, 'PROVIDER_RATE_LIMIT');
});

test('Case F: insufficient history keeps its specific message', async () => {
  installFetch((key) => (key.startsWith('FX_DAILY') ? { body: { 'Time Series FX (Daily)': {} } } : alphaVantage({})(key)));
  const history = mockRes();
  await fxHistoryHandler({ method: 'GET', query: { from: 'SGD', to: 'VND' } }, history);
  assert.equal(history.body.code, 'EMPTY_DATA');

  const t = render(failed('VND', 'SGD', history.body));
  assert.ok(t.includes('We could not find enough exchange-rate data for this comparison.'));
  assert.ok(!t.includes('temporarily unavailable'));
});
