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
import { BenchmarkType, CurrencyCode } from '../src/types';

/**
 * PS4 Bug #4: the primary card says what the percentage is measured against:
 * above / below / in line with the selected benchmark, which it names.
 * Since Bug #6 the percentage and its basis are the headline, and the context line says what that
 * means for the displayed quote, so the comparison is not stated twice.
 */

const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** A loaded page with market-quote rates (as fetched) and the given benchmark selected. */
function loaded(have: CurrencyCode, want: CurrencyCode, rate: number, avg7: number, avg30: number, benchmark: BenchmarkType = '7d') {
  const [base, quote] = getPairKey(have, want).split('/');
  let s: ComparisonState = { ...initialComparisonState, haveCurrency: have, wantCurrency: want, benchmark };
  s = comparisonReducer(s, { type: 'REQUEST_START' });
  return comparisonReducer(s, {
    type: 'REQUEST_SUCCESS',
    requestId: s.requestId,
    pairKey: getPairKey(have, want),
    current: { from: base, to: quote, rate, lastRefreshed: '2026-09-28 09:36:45', timeZone: 'UTC', provider: 'Alpha Vantage' },
    history: {
      from: base,
      to: quote,
      lastRefreshed: '2026-09-25',
      timeZone: 'UTC',
      benchmarks: {
        '7d': { average: avg7, observationCount: 5, startDate: '2026-09-19', endDate: '2026-09-25' },
        '30d': { average: avg30, observationCount: 19, startDate: '2026-08-27', endDate: '2026-09-25' },
      },
      daily: [{ date: '2026-09-25', close: avg7 }],
    },
  });
}

/** The primary card only (no expanding needed), with its context line. */
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
  return {
    text: text(primary),
    headline: text(primary.match(/<h2 id="primary-interpretation-headline"[^>]*>(.*?)<\/h2>/)?.[1] ?? ''),
    context: text(primary.match(/<p id="benchmark-context"[^>]*>(.*?)<\/p>/)?.[1] ?? ''),
  };
}

const UNSUPPORTED = ['small', 'large', 'good', 'bad', 'normal', 'unusual', 'typical', 'significant', 'opportunity'];

test('Case A: today above the benchmark says "above" and names the benchmark', () => {
  // USD -> SGD is quoted as fetched (1 USD = X SGD)
  const c = card(loaded('USD', 'SGD', 1.0022, 1.0, 1.0));
  assert.equal(c.headline, '0.22% above the 7-day average');
  assert.equal(c.context, 'Today’s rate gives more SGD per USD than the 7-day average.');
  for (const word of UNSUPPORTED) assert.ok(!c.text.toLowerCase().includes(word), word);
});

test('Case B: today below the benchmark says "below"', () => {
  const c = card(loaded('USD', 'SGD', 0.9937, 1.0, 1.0));
  assert.equal(c.headline, '0.63% below the 7-day average');
  assert.equal(c.context, 'Today’s rate gives less SGD per USD than the 7-day average.');
});

test('Cases C/D: the context names the selected benchmark and follows a benchmark switch', () => {
  // Above the 7-day average but below the 30-day average
  let s = loaded('USD', 'SGD', 1.0022, 1.0, 1.01);
  assert.equal(card(s).headline, '0.22% above the 7-day average');

  s = comparisonReducer(s, { type: 'SET_BENCHMARK', benchmark: '30d' });
  const c30 = card(s);
  assert.equal(c30.headline, '0.77% below the 30-day average');
  assert.equal(c30.context, 'Today’s rate gives less SGD per USD than the 30-day average.');
  assert.ok(!c30.text.includes('7-day'), 'no stale 7-day reference in the primary card');

  s = comparisonReducer(s, { type: 'SET_BENCHMARK', benchmark: '7d' });
  assert.ok(!card(s).text.includes('30-day'));
});

test('Case E: an approximately unchanged result never says "0.00% above/below"', () => {
  for (const rate of [1.0, 1.00001, 0.99999]) {
    const c = card(loaded('USD', 'SGD', rate, 1.0, 1.0));
    assert.equal(c.headline, 'Approximately in line with the 7-day average', String(rate));
    assert.equal(c.context, 'Today’s rate gives about the same SGD per USD as the 7-day average.', String(rate));
    assert.ok(!/0(\.0+)?% (above|below)/.test(c.text), String(rate));
  }
  // Unchanged by the existing absolute threshold even when the percentage rounds to 0.01%
  const threshold = card(loaded('USD', 'SGD', 1.00009, 1.0, 1.0));
  assert.equal(threshold.headline, 'Approximately in line with the 7-day average');
  assert.ok(!threshold.text.includes('0.01%'));
});

test('the context percentage and sign match the displayed rates', () => {
  const s = loaded('VND', 'SGD', 19620, 19850, 19700);
  const r = selectComparison(s)!;
  const expected = ((r.todayRate - r.benchmarkRate) / r.benchmarkRate) * 100;
  assert.equal(card(s).headline, `${Math.abs(expected).toFixed(2)}% above the 7-day average`);
  assert.ok(expected > 0, '1 VND buys more SGD today');
});

test('Case F: VND -> SGD keeps the Bug #1 direction', () => {
  const c = card(loaded('VND', 'SGD', 19620, 19850, 19700));
  assert.match(c.text, /Today’s rate 1 VND = 0\.0000\d+ SGD/);
  assert.ok(!c.text.includes('1 SGD ='));
});

test('Case G: the Bug #3 freshness cue is still in the primary card', () => {
  const c = card(loaded('VND', 'SGD', 19620, 19850, 19700));
  assert.match(c.text, /Rate as of Sep 2[89], 2026, \d{1,2}:\d{2} [AP]M/);
});
