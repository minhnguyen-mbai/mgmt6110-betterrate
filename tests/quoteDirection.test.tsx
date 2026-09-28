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
import { calculateComparison, formatRate } from '../src/utils/calculations';
import { CurrencyCode } from '../src/types';

/**
 * PS4 Bug #1: the result must be quoted in the selected I HAVE -> I WANT direction
 * ("1 FROM = X TO"), with benchmark and difference in the same direction and unit,
 * even though rates are fetched as the market quote (e.g. 1 SGD = X VND).
 */

const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b));

/** A loaded page for have -> want, given market-quote rates (as the API returns them). */
function loaded(have: CurrencyCode, want: CurrencyCode, marketRate: number, marketAvg7: number): ComparisonState {
  let s: ComparisonState = { ...initialComparisonState, haveCurrency: have, wantCurrency: want, benchmark: '7d' };
  s = comparisonReducer(s, { type: 'REQUEST_START' });
  const pairKey = getPairKey(have, want);
  const [base, quote] = pairKey.split('/');
  return comparisonReducer(s, {
    type: 'REQUEST_SUCCESS',
    requestId: s.requestId,
    pairKey,
    current: { from: base, to: quote, rate: marketRate, lastRefreshed: '2026-09-25', timeZone: null, provider: 'Alpha Vantage' },
    history: {
      from: base,
      to: quote,
      lastRefreshed: '2026-09-24',
      timeZone: null,
      provider: 'Alpha Vantage',
      benchmarks: {
        '7d': { average: marketAvg7, observationCount: 5, startDate: '2026-09-18', endDate: '2026-09-24' },
        '30d': { average: marketAvg7, observationCount: 21, startDate: '2026-08-26', endDate: '2026-09-24' },
      },
      daily: [
        { date: '2026-09-23', close: marketAvg7 },
        { date: '2026-09-24', close: marketRate },
      ],
    },
  });
}

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
  const row = (id: string) => text(html.match(new RegExp(`<div id="${id}"[^>]*>(.*?)</div>`))?.[1] ?? '').trim();
  return {
    html,
    today: row('today-rate-row'),
    benchmark: row('benchmark-rate-row'),
    difference: row('rate-difference-row'),
    trend: text(html.slice(html.indexOf('id="trend-details"'), html.indexOf('id="calculation-details"'))),
  };
}

test('Case A: VND -> SGD is quoted as 1 VND = X SGD (current above benchmark)', () => {
  // Market quote: 1 SGD = 19,620 VND today vs 19,850 VND average
  const s = loaded('VND', 'SGD', 19620, 19850);
  const r = selectComparison(s)!;
  assert.equal(r.baseCurrency, 'VND');
  assert.equal(r.quoteCurrency, 'SGD');
  assert.ok(near(r.todayRate, 1 / 19620));
  assert.ok(near(r.benchmarkRate, 1 / 19850));
  assert.ok(r.todayRate > r.benchmarkRate, '1 VND buys more SGD today');
  assert.equal(r.isMoreFavorable, true, 'decision unchanged by the reciprocal quote');

  const c = card(s);
  assert.equal(c.today, 'Today’s rate 1 VND = 0.00005097 SGD');
  assert.equal(c.benchmark, '7-day average 1 VND = 0.00005038 SGD');
  assert.equal(c.difference, 'Difference +0.0000005906 SGD per VND');
  assert.ok(!c.html.includes('1 SGD ='), 'no SGD -> VND quote anywhere');
  assert.ok(!c.html.includes('VND per SGD'));
  // The trend chart uses the same direction and unit
  assert.ok(c.trend.includes('Current Rate 0.00005097 SGD'));
  assert.ok(c.trend.includes('7-day average: 0.00005038 SGD'));
  assert.ok(!c.trend.includes('VND'));
});

test('Case A: VND -> SGD with current below benchmark gives a negative difference', () => {
  const c = card(loaded('VND', 'SGD', 20450, 20366.36));
  assert.equal(c.today, 'Today’s rate 1 VND = 0.0000489 SGD');
  assert.equal(c.benchmark, '7-day average 1 VND = 0.0000491 SGD');
  assert.equal(c.difference, 'Difference −0.0000002008 SGD per VND');
  assert.ok(text(c.html).includes('Less favorable for converting VND to SGD'));
});

test('Case B: SGD -> VND is quoted as 1 SGD = X VND', () => {
  const s = loaded('SGD', 'VND', 19620, 19850);
  const r = selectComparison(s)!;
  assert.equal(r.baseCurrency, 'SGD');
  assert.equal(r.quoteCurrency, 'VND');
  assert.equal(r.todayRate, 19620);
  assert.equal(r.benchmarkRate, 19850);

  const c = card(s);
  assert.equal(c.today, 'Today’s rate 1 SGD = 19,620 VND');
  assert.equal(c.benchmark, '7-day average 1 SGD = 19,850 VND');
  assert.equal(c.difference, 'Difference −230 VND per SGD');
  assert.ok(!c.html.includes('1 VND ='));
  assert.ok(text(c.html).includes('Less favorable for converting SGD to VND'));
});

test('Case C: GBP -> MYR and MYR -> GBP follow the same 1 FROM = X TO rule', () => {
  // Market quote: 1 GBP = X MYR
  const gbpMyr = card(loaded('GBP', 'MYR', 5.6812, 5.659));
  assert.equal(gbpMyr.today, 'Today’s rate 1 GBP = 5.6812 MYR');
  assert.equal(gbpMyr.benchmark, '7-day average 1 GBP = 5.659 MYR');
  assert.equal(gbpMyr.difference, 'Difference +0.0222 MYR per GBP');

  const myrGbp = card(loaded('MYR', 'GBP', 5.6812, 5.659));
  assert.equal(myrGbp.today, `Today’s rate 1 MYR = ${formatRate(1 / 5.6812)} GBP`);
  assert.equal(myrGbp.benchmark, `7-day average 1 MYR = ${formatRate(1 / 5.659)} GBP`);
  assert.match(myrGbp.difference, /^Difference −[\d.]+ GBP per MYR$/);
});

test('Case D: swapping the pair shows the reciprocal quote with swapped labels and units', () => {
  let s = loaded('VND', 'SGD', 20295.77, 20366.36);
  const before = selectComparison(s)!;

  s = comparisonReducer(s, { type: 'SWAP' });
  assert.equal(s.status, 'success', 'same market quote: no refetch needed');
  const after = selectComparison(s)!;

  assert.deepEqual([before.baseCurrency, before.quoteCurrency], ['VND', 'SGD']);
  assert.deepEqual([after.baseCurrency, after.quoteCurrency], ['SGD', 'VND']);
  assert.ok(near(before.todayRate * after.todayRate, 1), 'today rates are reciprocal');
  assert.ok(near(before.benchmarkRate * after.benchmarkRate, 1), 'benchmarks are reciprocal');
  assert.notEqual(before.isMoreFavorable, after.isMoreFavorable, 'what is better one way is worse the other');

  const c = card(s);
  assert.equal(c.today, 'Today’s rate 1 SGD = 20,295.77 VND');
  assert.equal(c.benchmark, '7-day average 1 SGD = 20,366.36 VND');
  assert.equal(c.difference, 'Difference −70.59 VND per SGD');
});

test('difference sign always equals current minus benchmark in the displayed direction', () => {
  const pairs: Array<[CurrencyCode, CurrencyCode]> = [['VND', 'SGD'], ['SGD', 'VND'], ['GBP', 'MYR'], ['MYR', 'GBP'], ['JPY', 'THB'], ['USD', 'EUR']];
  for (const [have, want] of pairs) {
    for (const [today, bench] of [[1.3, 1.2], [1.2, 1.3]]) {
      const r = calculateComparison({ haveCurrency: have, wantCurrency: want, benchmark: '7d' }, today, bench, '7-day average');
      const signed = r.todayRate - r.benchmarkRate;
      assert.equal(r.rateDifference, -signed);
      assert.equal(r.isMoreFavorable, signed > 0, `${have} -> ${want}: higher displayed rate is more favorable`);
      assert.equal(r.percentDifference, Number((Math.abs(signed / r.benchmarkRate) * 100).toFixed(2)));
    }
  }
});

test('very small reciprocal rates never display as zero', () => {
  assert.equal(formatRate(1 / 26000), '0.00003846');
  assert.equal(formatRate(1 / 19620 - 1 / 19850), '0.0000005906');
  assert.equal(formatRate(-0.0000002008), '-0.0000002008');
  // Rates of 0.01 and above keep the existing formatting
  assert.equal(formatRate(0.0052), '0.0052');
  assert.equal(formatRate(1.4932), '1.4932');
  assert.equal(formatRate(20295.779), '20,295.78');
});
