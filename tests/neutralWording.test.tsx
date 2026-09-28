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
 * PS4 Bug #6: the result describes where today's rate sits relative to the selected average
 * (above / below / in line with) without judging it as better, worse or favorable.
 */

const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

const ADVISORY = [
  'better', 'worse', 'favorable', 'favourable', 'unfavorable', 'unfavourable',
  'good time', 'bad time', 'opportunity', 'should', 'recommend', 'attractive', 'advantage',
];

function loaded(have: CurrencyCode, want: CurrencyCode, rate: number, avg7: number, avg30: number, benchmark: BenchmarkType = '7d') {
  const [base, quote] = getPairKey(have, want).split('/');
  let s: ComparisonState = { ...initialComparisonState, haveCurrency: have, wantCurrency: want, benchmark };
  s = comparisonReducer(s, { type: 'REQUEST_START' });
  return comparisonReducer(s, {
    type: 'REQUEST_SUCCESS',
    requestId: s.requestId,
    pairKey: getPairKey(have, want),
    current: { from: base, to: quote, rate, lastRefreshed: '2026-09-27 09:36:45', timeZone: 'UTC', provider: 'Alpha Vantage' },
    history: {
      from: base,
      to: quote,
      lastRefreshed: '2026-09-25',
      timeZone: 'UTC',
      benchmarks: {
        '7d': { average: avg7, observationCount: 5, startDate: '2026-09-19', endDate: '2026-09-25' },
        '30d': { average: avg30, observationCount: 21, startDate: '2026-08-27', endDate: '2026-09-25' },
      },
      daily: [{ date: '2026-09-25', close: avg7 }],
    },
  });
}

/** The primary card, split into pill, headline and context line. */
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
  const pick = (re: RegExp) => text(primary.match(re)?.[1] ?? '');
  return {
    text: text(primary),
    pill: pick(/<span id="interpretation-pill"[^>]*>(.*?)<\/span>/),
    headline: pick(/<h2 id="primary-interpretation-headline"[^>]*>(.*?)<\/h2>/),
    context: pick(/<p id="benchmark-context"[^>]*>(.*?)<\/p>/),
  };
}

function assertNeutral(cardText: string) {
  for (const word of ADVISORY) assert.ok(!cardText.toLowerCase().includes(word), `no "${word}" in: ${cardText}`);
}

test('Case A: above the benchmark is described, not judged', () => {
  // 1 VND buys more SGD today than at the 7-day average
  const c = card(loaded('VND', 'SGD', 19620, 19850, 19700));
  assert.equal(c.pill, 'Converting VND to SGD');
  assert.equal(c.headline, '1.17% above the 7-day average');
  assert.equal(c.context, 'Today’s rate gives more SGD per VND than the 7-day average.');
  assertNeutral(c.text);
});

test('Case B: below the benchmark is described, not judged (the reverse direction)', () => {
  const c = card(loaded('SGD', 'VND', 19620, 19850, 19700));
  assert.equal(c.pill, 'Converting SGD to VND');
  assert.equal(c.headline, '1.16% below the 7-day average');
  assert.equal(c.context, 'Today’s rate gives less VND per SGD than the 7-day average.');
  assertNeutral(c.text);
});

test('Case C: approximately unchanged is "in line with", with no judgement', () => {
  const c = card(loaded('USD', 'SGD', 1.00001, 1.0, 1.0));
  assert.equal(c.headline, 'Approximately in line with the 7-day average');
  assert.equal(c.context, 'Today’s rate gives about the same SGD per USD as the 7-day average.');
  assert.ok(!/0(\.0+)?% (above|below)/.test(c.text));
  assertNeutral(c.text);
});

test('Cases D/E: the wording names the selected benchmark and follows a switch', () => {
  let s = loaded('VND', 'SGD', 19620, 19850, 19500);
  assert.match(card(s).headline, / above the 7-day average$/);

  s = comparisonReducer(s, { type: 'SET_BENCHMARK', benchmark: '30d' });
  const month = card(s);
  assert.equal(month.headline, '0.61% below the 30-day average');
  assert.equal(month.context, 'Today’s rate gives less SGD per VND than the 30-day average.');
  assert.ok(!month.text.includes('7-day'));
  assertNeutral(month.text);
});

test('Case F: the comparison is stated once, not repeated', () => {
  for (const state of [loaded('VND', 'SGD', 19620, 19850, 19700), loaded('SGD', 'VND', 19620, 19850, 19700)]) {
    const c = card(state);
    const pct = c.headline.match(/^[\d.]+%/)![0];
    assert.equal(count(c.text, pct), 1, `${pct} appears once`);
    assert.equal(count(c.text, 'the 7-day average'), 2, 'headline + context line');
    assert.equal(count(c.text, 'above the') + count(c.text, 'below the'), 1, 'above/below stated once');
    assert.notEqual(c.context, c.headline);
  }
});

test('the numbers and internal state are unchanged by the wording', () => {
  const r = selectComparison(loaded('VND', 'SGD', 19620, 19850, 19700))!;
  assert.equal(r.todayRate, 1 / 19620);
  assert.equal(r.benchmarkRate, 1 / 19850);
  assert.equal(r.percentDifference, 1.17);
  assert.equal(r.isMoreFavorable, true);
  assert.equal(r.isUnchanged, false);
});

test('Cases G/H/I/J: Bug #1 direction, Bug #3 freshness, Bug #4 basis and Bug #5 window are intact', () => {
  const c = card(loaded('VND', 'SGD', 19620, 19850, 19700));
  assert.match(c.text, /Today’s rate 1 VND = 0\.0000\d+ SGD/);
  assert.ok(!c.text.includes('1 SGD ='));
  assert.match(c.text, /Rate as of Sep 2[78], 2026, \d{1,2}:\d{2} [AP]M/);
  assert.match(c.headline, /^[\d.]+% above the 7-day average$/);
  assert.ok(c.text.includes('5 daily closes · Sep 19–25, 2026'));
});
