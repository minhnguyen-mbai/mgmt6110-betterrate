import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ComparisonPage } from '../src/components/ComparisonPage';
import {
  comparisonReducer,
  initialComparisonState,
  selectComparison,
  getPairKey,
  ComparisonState,
} from '../src/state/comparisonState';
import { formatBenchmarkWindow, BENCHMARK_WINDOW_UNAVAILABLE } from '../src/utils/benchmarkWindow';
import { BenchmarkDetail, BenchmarkType } from '../src/types';

/**
 * PS4 Bug #5: the primary card shows which observations the selected benchmark used:
 * the real observation count and the exact calendar window, next to the benchmark rate.
 */

const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const WEEK: BenchmarkDetail = { average: 19850, observationCount: 5, startDate: '2026-09-19', endDate: '2026-09-25' };
const MONTH: BenchmarkDetail = { average: 19700, observationCount: 21, startDate: '2026-08-27', endDate: '2026-09-25' };

function loaded(benchmark: BenchmarkType, week: Partial<BenchmarkDetail> = WEEK, month: Partial<BenchmarkDetail> = MONTH) {
  const [base, quote] = getPairKey('VND', 'SGD').split('/');
  let s: ComparisonState = { ...initialComparisonState, haveCurrency: 'VND', wantCurrency: 'SGD', benchmark };
  s = comparisonReducer(s, { type: 'REQUEST_START' });
  return comparisonReducer(s, {
    type: 'REQUEST_SUCCESS',
    requestId: s.requestId,
    pairKey: getPairKey('VND', 'SGD'),
    current: { from: base, to: quote, rate: 19620, lastRefreshed: '2026-09-27 09:36:45', timeZone: 'UTC', provider: 'Alpha Vantage' },
    history: {
      from: base,
      to: quote,
      lastRefreshed: '2026-09-25',
      timeZone: 'UTC',
      benchmarks: { '7d': week as BenchmarkDetail, '30d': month as BenchmarkDetail },
      daily: [{ date: '2026-09-25', close: 19850 }],
    },
  });
}

/** The primary card only (nothing expanded). */
function card(state: ComparisonState) {
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
  const primary = html.slice(html.indexOf('id="primary-interpretation-card"'), html.indexOf('id="trend-details"'));
  const row = primary.match(/<div id="benchmark-rate-row"[^>]*>(.*?)<\/div>/)?.[1] ?? '';
  return {
    text: text(primary),
    row: text(row),
    window: text(row.match(/<dd id="benchmark-window"[^>]*>(.*?)<\/dd>/)?.[1] ?? ''),
  };
}

test('formatter: count and exact window, across months and years, never inventing values', () => {
  assert.equal(formatBenchmarkWindow(WEEK), '5 daily closes · Sep 19–25, 2026');
  assert.equal(formatBenchmarkWindow(MONTH), '21 daily closes · Aug 27 – Sep 25, 2026');
  assert.equal(
    formatBenchmarkWindow({ observationCount: 4, startDate: '2025-12-28', endDate: '2026-01-03' }),
    '4 daily closes · Dec 28, 2025 – Jan 3, 2026'
  );
  assert.equal(formatBenchmarkWindow({ observationCount: 1, startDate: '2026-09-25', endDate: '2026-09-25' }), '1 daily close · Sep 25, 2026');
});

test('Case A: a 7-day window with 5 observations says 5, with its exact dates, in the primary card', () => {
  const c = card(loaded('7d'));
  assert.equal(c.row, '7-day average 1 VND = 0.00005038 SGD 5 daily closes · Sep 19–25, 2026');
  assert.equal(c.window, '5 daily closes · Sep 19–25, 2026');
  for (const claim of ['7 daily', '7 observations', '7 closes', 'trading day', 'market day', 'complete day', 'includes today']) {
    assert.ok(!c.text.includes(claim), `no "${claim}"`);
  }
});

test('Case B: the 30-day benchmark shows its own count and window', () => {
  const c = card(loaded('30d'));
  assert.equal(c.window, '21 daily closes · Aug 27 – Sep 25, 2026');
  assert.ok(c.row.startsWith('30-day average 1 VND ='));
});

test('Case C: switching 7-day -> 30-day -> 7-day leaves no stale count or window', () => {
  let s = loaded('7d');
  assert.equal(card(s).window, '5 daily closes · Sep 19–25, 2026');

  s = comparisonReducer(s, { type: 'SET_BENCHMARK', benchmark: '30d' });
  const month = card(s);
  assert.equal(month.window, '21 daily closes · Aug 27 – Sep 25, 2026');
  assert.ok(!month.text.includes('5 daily closes') && !month.text.includes('Sep 19'), 'no 7-day metadata');

  s = comparisonReducer(s, { type: 'SET_BENCHMARK', benchmark: '7d' });
  const week = card(s);
  assert.equal(week.window, '5 daily closes · Sep 19–25, 2026');
  assert.ok(!week.text.includes('21 daily closes') && !week.text.includes('Aug 27'), 'no 30-day metadata');
});

test('Case D: missing or malformed metadata keeps the result and shows a truthful fallback', () => {
  const broken: Array<Partial<BenchmarkDetail>> = [
    { average: 19850 },
    { average: 19850, observationCount: 5, startDate: '2026-09-19' },
    { average: 19850, observationCount: 5, endDate: '2026-09-25' },
    { average: 19850, startDate: '2026-09-19', endDate: '2026-09-25' },
    { average: 19850, observationCount: 0, startDate: '2026-09-19', endDate: '2026-09-25' },
    { average: 19850, observationCount: 5, startDate: '2026-02-30', endDate: '2026-09-25' },
    { average: 19850, observationCount: 5, startDate: '2026-09-26', endDate: '2026-09-25' },
  ];
  for (const week of broken) {
    const state = loaded('7d', week);
    assert.ok(selectComparison(state), 'still a comparison, not an error');
    const c = card(state);
    assert.equal(c.window, BENCHMARK_WINDOW_UNAVAILABLE, JSON.stringify(week));
    for (const bad of ['undefined', 'NaN', 'Invalid Date', 'null']) assert.ok(!c.text.includes(bad), `${bad} in ${JSON.stringify(week)}`);
  }
});

test('the benchmark value and decision are unchanged by the window line', () => {
  const r = selectComparison(loaded('7d'))!;
  assert.equal(r.benchmarkRate, 1 / 19850);
  assert.equal(r.isMoreFavorable, true);
});

test('Cases E/F/G: Bug #1 direction, Bug #3 freshness and Bug #4 context are intact', () => {
  const week = card(loaded('7d'));
  assert.match(week.text, /Today’s rate 1 VND = 0\.0000\d+ SGD/);
  assert.ok(!week.text.includes('1 SGD ='));
  assert.match(week.text, /Rate as of Sep 2[78], 2026, \d{1,2}:\d{2} [AP]M/);
  assert.match(week.text, /[\d.]+% above the 7-day average/);

  const month = card(comparisonReducer(loaded('7d'), { type: 'SET_BENCHMARK', benchmark: '30d' }));
  assert.match(month.text, /[\d.]+% above the 30-day average/);
});
