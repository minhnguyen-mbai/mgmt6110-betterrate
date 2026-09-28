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
import { pairDecimals, formatPairRate, formatRateDifference } from '../src/utils/calculations';
import { CurrencyCode } from '../src/types';

/**
 * PS4 Bug #10: every rate of one displayed pair uses one precision, chosen from its benchmark rate
 * (2 decimals from 100, 4 decimals from 1, otherwise 4 significant digits), trailing zeros kept.
 * The difference uses that precision, or more to show at least 2 significant digits.
 */

const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const decimals = (s: string) => s.match(/\.(\d+)/)?.[1].length ?? 0;

function loaded(have: CurrencyCode, want: CurrencyCode, rate: number, avg7: number): ComparisonState {
  const [base, quote] = getPairKey(have, want).split('/');
  let s: ComparisonState = { ...initialComparisonState, haveCurrency: have, wantCurrency: want };
  s = comparisonReducer(s, { type: 'REQUEST_START' });
  return comparisonReducer(s, {
    type: 'REQUEST_SUCCESS',
    requestId: s.requestId,
    pairKey: getPairKey(have, want),
    current: { from: base, to: quote, rate, lastRefreshed: '2026-09-27 09:36:45', timeZone: 'UTC', provider: 'Frankfurter' },
    history: {
      from: base,
      to: quote,
      lastRefreshed: '2026-09-25',
      timeZone: 'UTC',
      benchmarks: {
        '7d': { average: avg7, observationCount: 5, startDate: '2026-09-19', endDate: '2026-09-25' },
        '30d': { average: avg7, observationCount: 21, startDate: '2026-08-27', endDate: '2026-09-25' },
      },
      daily: [
        { date: '2026-09-24', close: avg7 },
        { date: '2026-09-25', close: rate },
      ],
    },
  });
}

/** The three primary rows' numbers, plus the details and chart text. */
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
  const dd = (id: string) => text(html.match(new RegExp(`<div id="${id}"[^>]*>.*?<dd[^>]*>(.*?)</dd>`))?.[1] ?? '');
  const num = (s: string) => s.match(/[+−-]?[\d,]+(?:\.\d+)?/)?.[0] ?? '';
  const today = dd('today-rate-row');
  const benchmark = dd('benchmark-rate-row');
  const difference = dd('rate-difference-row');
  return {
    today,
    benchmark,
    difference,
    todayNum: num(today.split('=')[1] ?? ''),
    benchmarkNum: num(benchmark.split('=')[1] ?? ''),
    differenceNum: num(difference),
    details: text(html.slice(html.indexOf('id="calculation-details"'))),
    trend: text(html.slice(html.indexOf('id="trend-details"'), html.indexOf('id="calculation-details"'))),
  };
}

test('rule: precision comes from the benchmark rate, not from each value', () => {
  assert.equal(pairDecimals(19850), 2);
  assert.equal(pairDecimals(5.659), 4);
  assert.equal(pairDecimals(1 / 5.659), 4); // 0.1767
  assert.equal(pairDecimals(1 / 19850), 8); // 0.00005038
  assert.equal(formatPairRate(5.659, 5.659), '5.6590', 'trailing zeros kept');
  assert.equal(formatPairRate(19620, 19850), '19,620.00', 'whole numbers keep their decimals');
});

test('Case A: GBP -> MYR shows today and the benchmark at the same precision', () => {
  const c = card(loaded('GBP', 'MYR', 5.6812, 5.659));
  assert.equal(c.today, '1 GBP = 5.6812 MYR');
  assert.equal(c.benchmark, '1 GBP = 5.6590 MYR', 'was 5.659');
  assert.equal(c.difference, '+0.0222 MYR per GBP');
  assert.equal(decimals(c.todayNum), decimals(c.benchmarkNum));
  assert.equal(decimals(c.differenceNum), decimals(c.todayNum));
});

test('Case B: MYR -> GBP keeps a readable, non-zero reciprocal at the same precision', () => {
  const c = card(loaded('MYR', 'GBP', 5.6812, 5.659));
  assert.equal(c.today, '1 MYR = 0.1760 GBP', 'was 0.176');
  assert.equal(c.benchmark, '1 MYR = 0.1767 GBP');
  assert.equal(c.difference, '−0.00069 GBP per MYR', '2 significant digits, not −0.0007');
  assert.equal(decimals(c.todayNum), decimals(c.benchmarkNum));
});

test('Case C: VND -> SGD keeps small reciprocal rates non-zero, both at 8 decimals', () => {
  for (const [rate, avg] of [[19620, 19850], [20450, 20366.36], [20295.77, 20366.36]]) {
    const c = card(loaded('VND', 'SGD', rate, avg));
    assert.match(c.today, /^1 VND = 0\.0000\d{4} SGD$/);
    assert.match(c.benchmark, /^1 VND = 0\.0000\d{4} SGD$/);
    assert.equal(decimals(c.todayNum), 8);
    assert.equal(decimals(c.benchmarkNum), 8);
    assert.notEqual(Number(c.todayNum), 0);
    assert.notEqual(Number(c.benchmarkNum), 0);
  }
  // Previously 0.0000489 vs 0.0000491 (7 decimals, trailing zero dropped)
  const c = card(loaded('VND', 'SGD', 20450, 20366.36));
  assert.equal(c.today, '1 VND = 0.00004890 SGD');
  assert.equal(c.benchmark, '1 VND = 0.00004910 SGD');
});

test('Case D: SGD -> VND keeps thousands separators and 2 decimals on both rates', () => {
  const c = card(loaded('SGD', 'VND', 19620, 19850));
  assert.equal(c.today, '1 SGD = 19,620.00 VND', 'was 19,620');
  assert.equal(c.benchmark, '1 SGD = 19,850.00 VND');
  assert.equal(c.difference, '−230.00 VND per SGD');
});

test('Case E: the difference keeps its sign and TO-per-FROM unit, and small differences are never zero', () => {
  assert.equal(card(loaded('VND', 'SGD', 19620, 19850)).difference, '+0.00000059 SGD per VND');
  assert.equal(card(loaded('VND', 'SGD', 20450, 20366.36)).difference, '−0.00000020 SGD per VND');
  // A difference far below the pair's precision gets 2 significant digits instead of 0.0000
  assert.equal(formatRateDifference(5.65901 - 5.659, 5.659), '0.000010');
  assert.equal(formatRateDifference(1e-9, 1 / 19850), '0.0000000010');
  assert.equal(formatRateDifference(0, 5.659), '0.0000');
  // Calculation details use the same precision
  const details = card(loaded('GBP', 'MYR', 5.6812, 5.659)).details;
  assert.ok(details.includes('Today’s rate 1 GBP = 5.6812 MYR'));
  assert.ok(details.includes('7-day average 1 GBP = 5.6590 MYR'));
  assert.ok(details.includes('Absolute difference 0.0222 MYR higher per GBP'));
});

test('the collapsed chart uses the same precision as the card', () => {
  const trend = card(loaded('GBP', 'MYR', 5.6812, 5.659)).trend;
  assert.ok(trend.includes('Current Rate 5.6812 MYR'));
  assert.ok(trend.includes('7-day average: 5.6590 MYR'));
  assert.ok(trend.includes('Latest Close (Sep 25): 5.6812 MYR'));
});

test('the numbers themselves are unchanged (display only)', () => {
  const r = selectComparison(loaded('VND', 'SGD', 19620, 19850))!;
  assert.equal(r.todayRate, 1 / 19620);
  assert.equal(r.benchmarkRate, 1 / 19850);
  assert.equal(r.percentDifference, 1.17);
});

test('Cases F/G: Bug #1 direction and the Bug #3-#7 card content are intact', () => {
  const s = loaded('VND', 'SGD', 19620, 19850);
  const html = renderToStaticMarkup(
    <ComparisonPage state={s} result={selectComparison(s)} onChangeCurrency={noop} onSwap={noop} onBenchmarkChange={noop} onCheck={noop} onCheckAnother={noop} />
  );
  const t = text(html);
  assert.ok(t.includes('Today’s rate 1 VND = 0.00005097 SGD') && !t.includes('1 SGD =')); // #1
  assert.match(t, /Rate as of Sep 2[78], 2026/); // #3
  assert.ok(t.includes('1.17% above the 7-day average')); // #4, #6
  assert.ok(t.includes('Today’s rate gives more SGD per VND than the 7-day average.')); // #6
  assert.ok(t.includes('5 daily closes · Sep 19–25, 2026')); // #5
  assert.ok(html.includes('id="live-update-note"') && !html.includes('id="check-rate-btn"')); // #7
});
