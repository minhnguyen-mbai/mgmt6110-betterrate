import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import fxCurrentHandler from '../api/fx-current.js';
import { _resetUsdSeriesCache } from '../api/_lib/usdSeries.js';
import { ComparisonPage } from '../src/components/ComparisonPage';
import {
  comparisonReducer,
  initialComparisonState,
  selectComparison,
  getPairKey,
  ComparisonState,
} from '../src/state/comparisonState';
import { formatRateFreshness, FRESHNESS_UNAVAILABLE } from '../src/utils/freshness';
import { CurrencyCode, FxCurrentData } from '../src/types';

/**
 * PS4 Bug #3: the primary "Today's rate" row shows when the provider last updated the rate,
 * at the granularity the provider actually supplies, without expanding anything.
 */

const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function loaded(have: CurrencyCode, want: CurrencyCode, current: Partial<FxCurrentData>): ComparisonState {
  const [base, quote] = getPairKey(have, want).split('/');
  let s: ComparisonState = { ...initialComparisonState, haveCurrency: have, wantCurrency: want };
  s = comparisonReducer(s, { type: 'REQUEST_START' });
  return comparisonReducer(s, {
    type: 'REQUEST_SUCCESS',
    requestId: s.requestId,
    pairKey: getPairKey(have, want),
    current: { from: base, to: quote, rate: 20000, lastRefreshed: null, timeZone: null, provider: 'Alpha Vantage', ...current },
    history: {
      from: base,
      to: quote,
      lastRefreshed: '2026-09-25',
      timeZone: 'UTC',
      benchmarks: {
        '7d': { average: 20100, observationCount: 5, startDate: '2026-09-19', endDate: '2026-09-25' },
        '30d': { average: 20200, observationCount: 19, startDate: '2026-08-27', endDate: '2026-09-25' },
      },
      daily: [{ date: '2026-09-25', close: 20100 }],
    },
  });
}

/** The primary card's today row, split into the rate and its freshness cue. */
function todayRow(state: ComparisonState) {
  const html = renderToStaticMarkup(
    <ComparisonPage
      state={state}
      result={selectComparison(state)}
      onChangeCurrency={noop}
      onSwap={noop}
      onBenchmarkChange={noop}
      onCheck={noop}
      onCheckAnother={noop}
    />
  );
  const card = html.slice(html.indexOf('id="primary-interpretation-card"'), html.indexOf('id="trend-details"'));
  const row = card.match(/<div id="today-rate-row"[^>]*>(.*?)<\/div>/)?.[1] ?? '';
  return {
    row: text(row),
    freshness: text(row.match(/<dd id="today-rate-freshness"[^>]*>(.*?)<\/dd>/)?.[1] ?? ''),
    cardText: text(card),
  };
}

test('formatter: provider UTC time is shown in the chosen zone, with the zone named', () => {
  assert.equal(formatRateFreshness('2026-09-28 09:36:45', 'UTC', 'UTC'), 'Rate as of Sep 28, 2026, 9:36 AM UTC');
  assert.equal(formatRateFreshness('2026-09-28 09:36:45', 'UTC', 'Asia/Singapore'), 'Rate as of Sep 28, 2026, 5:36 PM GMT+8');
  // Crossing midnight in the viewer's zone moves the date too
  assert.equal(formatRateFreshness('2026-09-28 20:05:00', 'UTC', 'Asia/Singapore'), 'Rate as of Sep 29, 2026, 4:05 AM GMT+8');
});

test('formatter: date-only, zone-less, missing and malformed timestamps never get an invented time', () => {
  assert.equal(formatRateFreshness('2026-09-25', null), 'Rate as of Sep 25, 2026');
  assert.equal(formatRateFreshness('2026-09-28 09:36:45', null), 'Rate as of Sep 28, 2026', 'no zone: date only');
  assert.equal(formatRateFreshness('2026-09-28 09:36:45', 'US/Eastern'), 'Rate as of Sep 28, 2026', 'unhandled zone: date only');
  for (const bad of [null, undefined, '', '   ', 'yesterday', '2026-02-30', '2026-13-01 10:00:00', '28/09/2026']) {
    assert.equal(formatRateFreshness(bad as any, 'UTC'), FRESHNESS_UNAVAILABLE, String(bad));
  }
});

test('Case A: a full provider timestamp is visible in the primary card, beside today’s rate', () => {
  const { row, freshness, cardText } = todayRow(loaded('VND', 'SGD', { lastRefreshed: '2026-09-28 09:36:45', timeZone: 'UTC' }));
  assert.equal(freshness, formatRateFreshness('2026-09-28 09:36:45', 'UTC'));
  assert.match(freshness, /^Rate as of Sep 2[89], 2026, \d{1,2}:\d{2} [AP]M \S+$/);
  assert.ok(row.startsWith('Today’s rate 1 VND ='), 'freshness belongs to the today row');
  for (const claim of ['Live', 'Real-time', 'real-time', 'Market open', 'market closed', 'Last close']) {
    assert.ok(!cardText.includes(claim), `no "${claim}" claim`);
  }
});

let originalFetch: typeof fetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
  process.env.ALPHAVANTAGE_API_KEY = 'test-key';
  _resetUsdSeriesCache();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('Case B: a USD cross-rate shows the older of its two quote times', async () => {
  const quotes: Record<string, any> = {
    'AUD->VND': { 'Error Message': 'Invalid API call.' },
    'USD->AUD': { rate: 1.52, at: '2026-09-28 09:40:00' },
    'USD->VND': { rate: 26000, at: '2026-09-28 08:15:00' },
  };
  globalThis.fetch = (async (url: string) => {
    const u = new URL(url);
    const q = quotes[`${u.searchParams.get('from_currency')}->${u.searchParams.get('to_currency')}`];
    const body = q.rate
      ? { 'Realtime Currency Exchange Rate': { '5. Exchange Rate': String(q.rate), '6. Last Refreshed': q.at, '7. Time Zone': 'UTC' } }
      : q;
    return { ok: true, status: 200, json: async () => body };
  }) as typeof fetch;

  const res: any = { headers: {}, setHeader() {}, status(c: number) { res.statusCode = c; return res; }, json(b: any) { res.body = b; return res; } };
  await fxCurrentHandler({ method: 'GET', query: { from: 'AUD', to: 'VND' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.method, 'cross-rate-via-usd');
  assert.equal(res.body.lastRefreshed, '2026-09-28 08:15:00');

  const { freshness } = todayRow(loaded('VND', 'AUD', res.body));
  assert.equal(freshness, formatRateFreshness('2026-09-28 08:15:00', 'UTC'), 'oldest input time');
  assert.notEqual(freshness, formatRateFreshness('2026-09-28 09:40:00', 'UTC'), 'never the newer leg');
});

test('Case C: a date-only provider (Frankfurter) shows the date without a clock time', () => {
  const { freshness } = todayRow(loaded('GBP', 'MYR', { rate: 5.6812, lastRefreshed: '2026-09-25', timeZone: null, provider: 'Frankfurter' }));
  assert.equal(freshness, 'Rate as of Sep 25, 2026');
  assert.ok(!/\d:\d{2}/.test(freshness), 'no invented time');
});

test('Case D: a valid rate without a usable timestamp still renders, with a truthful fallback', () => {
  for (const lastRefreshed of [null, 'not a date']) {
    const state = loaded('VND', 'SGD', { lastRefreshed, timeZone: 'UTC' });
    assert.ok(selectComparison(state), 'still a result, not an error');
    const { row, freshness, cardText } = todayRow(state);
    assert.equal(freshness, 'Update time unavailable');
    assert.ok(row.startsWith('Today’s rate 1 VND = 0.00005 SGD'));
    assert.ok(!cardText.includes('Invalid Date'));
  }
});

test('Case E: VND -> SGD keeps the Bug #1 quote direction next to the freshness cue', () => {
  const { row } = todayRow(loaded('VND', 'SGD', { lastRefreshed: '2026-09-28 09:36:45', timeZone: 'UTC' }));
  assert.match(row, /^Today’s rate 1 VND = 0\.00005 SGD Rate as of /);
  assert.ok(!row.includes('1 SGD ='));
});
