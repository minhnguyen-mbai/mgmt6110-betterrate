import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculateComparison, formatRate } from '../src/utils/calculations';
import { getQuotePair } from '../src/data/currencies';

test('quote pair is shared by both directions (1 SGD = X VND)', () => {
  assert.deepEqual(getQuotePair('VND', 'SGD'), { base: 'SGD', quote: 'VND' });
  assert.deepEqual(getQuotePair('SGD', 'VND'), { base: 'SGD', quote: 'VND' });
  assert.deepEqual(getQuotePair('SGD', 'USD'), { base: 'USD', quote: 'SGD' });
  assert.deepEqual(getQuotePair('USD', 'SGD'), { base: 'USD', quote: 'SGD' });
  assert.deepEqual(getQuotePair('VND', 'USD'), { base: 'USD', quote: 'VND' });
});

test('VND -> SGD keeps the original methodology and wording', () => {
  const r = calculateComparison(
    { haveCurrency: 'VND', wantCurrency: 'SGD', benchmark: '7d', amount: 3000 },
    19620,
    19850,
    '7-day average'
  );
  assert.equal(r.directionCode, 'BUY_BASE');
  assert.equal(r.isMoreFavorable, true);
  assert.equal(r.percentDifference, 1.16);
  assert.equal(r.statusText, 'Better for converting VND to SGD');
  assert.equal(
    r.explanation,
    'Today’s rate (1 SGD = 19,620 VND) is lower than the 7-day average (19,850 VND). When converting VND to SGD, a lower rate means each Singapore Dollar costs you less Vietnamese Dong.'
  );
  assert.equal(r.amountFormatted, 'S$3,000');
  assert.equal(r.differenceFormatted, '690,000 VND');
  assert.equal(r.moneyDifferenceText, 'About 690K VND less today');
});

test('SGD -> VND: higher rate is more favorable', () => {
  const r = calculateComparison(
    { haveCurrency: 'SGD', wantCurrency: 'VND', benchmark: '30d', amount: null },
    19620,
    19700,
    '30-day average'
  );
  assert.equal(r.directionCode, 'SELL_BASE');
  assert.equal(r.isMoreFavorable, false);
  assert.equal(r.statusText, 'Less favorable for converting SGD to VND');
});

test('USD -> SGD uses USD as base and SGD minor units', () => {
  const r = calculateComparison(
    { haveCurrency: 'USD', wantCurrency: 'SGD', benchmark: '7d', amount: 1000 },
    1.5,
    1.48,
    '7-day average'
  );
  assert.equal(r.baseCurrency, 'USD');
  assert.equal(r.quoteCurrency, 'SGD');
  assert.equal(r.directionCode, 'SELL_BASE');
  assert.equal(r.isMoreFavorable, true);
  assert.equal(r.amountFormatted, 'US$1,000');
  assert.equal(r.differenceFormatted, '20.00 SGD');
  assert.equal(r.todayTotalCompact, '1.5K SGD');
  assert.equal(formatRate(1.49321), '1.4932');
  assert.equal(formatRate(20295.779), '20,295.78');
});

test('EUR -> SGD and SGD -> JPY use the market quote and currency minor units', () => {
  assert.deepEqual(getQuotePair('SGD', 'EUR'), { base: 'EUR', quote: 'SGD' });
  assert.deepEqual(getQuotePair('JPY', 'SGD'), { base: 'SGD', quote: 'JPY' });
  assert.deepEqual(getQuotePair('THB', 'GBP'), { base: 'GBP', quote: 'THB' });

  const eur = calculateComparison(
    { haveCurrency: 'SGD', wantCurrency: 'EUR', benchmark: '7d', amount: 1000 },
    1.458,
    1.4632,
    '7-day average'
  );
  assert.equal(eur.directionCode, 'BUY_BASE');
  assert.equal(eur.isMoreFavorable, true, 'lower SGD cost per EUR is better when buying EUR');
  assert.equal(eur.amountFormatted, '€1,000');
  assert.equal(eur.differenceFormatted, '5.20 SGD');

  const jpy = calculateComparison(
    { haveCurrency: 'SGD', wantCurrency: 'JPY', benchmark: '30d', amount: 500 },
    123.83,
    123.3153,
    '30-day average'
  );
  assert.equal(jpy.directionCode, 'SELL_BASE');
  assert.equal(jpy.isMoreFavorable, true);
  assert.equal(jpy.differenceFormatted, '257 JPY', 'JPY has no minor units');
  assert.equal(jpy.statusText, 'Better for converting SGD to JPY');
});
