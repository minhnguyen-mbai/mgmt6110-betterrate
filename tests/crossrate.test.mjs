import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveDailyCloses,
  parseDailyCloses,
  computeBenchmarks,
  requiredUsdSeries,
  getDerivation,
} from '../api/_lib/crossrate.js';
import { validatePair } from '../api/_lib/currencies.js';

const close = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));

const usd = {
  SGD: { '2026-09-22': 1.28, '2026-09-23': 1.3, '2026-09-24': 1.25 },
  VND: { '2026-09-22': 26000, '2026-09-23': 26100, '2026-09-24': 25990 },
};

test('A. cross rate: USD->VND / USD->SGD = SGD->VND', () => {
  const points = deriveDailyCloses('SGD', 'VND', usd);
  assert.equal(points.length, 3);
  assert.ok(close(points[0].close, 26000 / 1.28));
  assert.ok(close(points[2].close, 25990 / 1.25));
  assert.deepEqual(points.map((p) => p.date), ['2026-09-22', '2026-09-23', '2026-09-24']);
  assert.equal(getDerivation('SGD', 'VND'), 'cross');
  assert.deepEqual(requiredUsdSeries('SGD', 'VND'), ['SGD', 'VND']);
});

test('B. reverse direction: 1 / SGD->VND = VND->SGD', () => {
  const forward = deriveDailyCloses('SGD', 'VND', usd);
  const reverse = deriveDailyCloses('VND', 'SGD', usd);
  assert.equal(forward.length, reverse.length);
  forward.forEach((p, i) => {
    assert.equal(reverse[i].date, p.date);
    assert.ok(close(reverse[i].close, 1 / p.close));
    assert.ok(reverse[i].close > 0);
  });
});

test('C. FROM = USD uses the USD -> TO series directly', () => {
  const points = deriveDailyCloses('USD', 'VND', usd);
  assert.deepEqual(points, [
    { date: '2026-09-22', close: 26000 },
    { date: '2026-09-23', close: 26100 },
    { date: '2026-09-24', close: 25990 },
  ]);
  assert.equal(getDerivation('USD', 'VND'), 'direct');
  assert.deepEqual(requiredUsdSeries('USD', 'VND'), ['VND']);
});

test('D. TO = USD is 1 / (USD -> FROM)', () => {
  const points = deriveDailyCloses('SGD', 'USD', usd);
  assert.equal(points.length, 3);
  assert.ok(close(points[0].close, 1 / 1.28));
  assert.equal(getDerivation('SGD', 'USD'), 'inverse');
  assert.deepEqual(requiredUsdSeries('SGD', 'USD'), ['SGD']);
});

test('E. mismatched historical dates: only common dates are combined', () => {
  const points = deriveDailyCloses('SGD', 'VND', {
    SGD: { '2026-09-21': 1.27, '2026-09-22': 1.28, '2026-09-24': 1.25 },
    VND: { '2026-09-22': 26000, '2026-09-23': 26100, '2026-09-24': 25990 },
  });
  assert.deepEqual(points.map((p) => p.date), ['2026-09-22', '2026-09-24']);
  assert.deepEqual(deriveDailyCloses('SGD', 'VND', { SGD: { '2026-09-21': 1.27 }, VND: { '2026-09-22': 26000 } }), []);
  assert.deepEqual(deriveDailyCloses('SGD', 'VND', { VND: usd.VND }), [], 'missing series yields no points');
});

test('F. unsupported currency / invalid pair is rejected', () => {
  assert.equal(validatePair('SGD', 'XYZ').ok, false);
  assert.equal(validatePair('CNY', 'SGD').ok, false);
  assert.equal(validatePair('CHF', 'SGD').ok, false, 'currencies outside SUPPORTED_CURRENCIES are not accepted');
  assert.equal(validatePair('SGD', 'SGD').ok, false);
  assert.equal(validatePair(undefined, 'SGD').ok, false);
  assert.equal(validatePair(['SGD', 'EUR'], 'VND').ok, false);
  assert.deepEqual(validatePair(' sgd ', 'vnd'), { ok: true, from: 'SGD', to: 'VND' });
});

test('G. zero or invalid provider values are dropped', () => {
  const parsed = parseDailyCloses({
    'Meta Data': { '6. Time Zone': 'UTC' },
    'Time Series FX (Daily)': {
      '2026-09-20': { '4. close': '0.00000' },
      '2026-09-21': { '4. close': 'abc' },
      '2026-09-22': { '4. close': '-1.2' },
      '2026-09-23': { '4. close': '1.30000' },
      'not-a-date': { '4. close': '1.1' },
      '2026-09-24': null,
    },
  });
  assert.deepEqual(parsed, { closes: { '2026-09-23': 1.3 }, timeZone: 'UTC' });

  assert.equal(parseDailyCloses({ 'Time Series FX (Daily)': { '2026-09-20': { '4. close': '0.00000' } } }), null);
  assert.equal(parseDailyCloses({ Information: 'rate limit' }), null);

  // Zero or non-finite values in an underlying series never produce a derived point
  const points = deriveDailyCloses('SGD', 'VND', {
    SGD: { '2026-09-22': 0, '2026-09-23': 1.3 },
    VND: { '2026-09-22': 26000, '2026-09-23': Infinity },
  });
  assert.deepEqual(points, []);
});

test('benchmarks: calendar windows and minimum observations', () => {
  const points = [];
  for (let d = 1; d <= 30; d++) {
    const date = `2026-09-${String(d).padStart(2, '0')}`;
    points.push({ date, close: d });
  }
  const result = computeBenchmarks(points, '2026-10-01');
  assert.equal(result.lastRefreshed, '2026-09-30');
  assert.equal(result.benchmarks['7d'].startDate, '2026-09-24');
  assert.equal(result.benchmarks['7d'].observationCount, 7);
  assert.ok(close(result.benchmarks['7d'].average, (24 + 25 + 26 + 27 + 28 + 29 + 30) / 7));
  assert.equal(result.benchmarks['30d'].startDate, '2026-09-01');
  assert.equal(result.benchmarks['30d'].observationCount, 30);
  assert.ok(close(result.benchmarks['30d'].average, 15.5));
  assert.equal(result.daily.length, 30);

  assert.equal(computeBenchmarks(points.slice(0, 10), '2026-10-01'), null, 'fewer than 15 observations in 30d window');
  assert.equal(computeBenchmarks([], '2026-10-01'), null);
});

test("benchmarks exclude today's observation: 7d and 30d use prior observations only", () => {
  const points = [];
  for (let d = 1; d <= 30; d++) {
    points.push({ date: `2026-09-${String(d).padStart(2, '0')}`, close: d });
  }
  points[29] = { date: '2026-09-30', close: 1000 }; // today's (current) observation

  const result = computeBenchmarks(points, '2026-09-30');
  assert.equal(result.lastRefreshed, '2026-09-29');
  assert.equal(result.benchmarks['7d'].startDate, '2026-09-23');
  assert.equal(result.benchmarks['7d'].endDate, '2026-09-29');
  assert.equal(result.benchmarks['7d'].observationCount, 7);
  assert.equal(result.benchmarks['7d'].average, (23 + 24 + 25 + 26 + 27 + 28 + 29) / 7);
  assert.equal(result.benchmarks['30d'].startDate, '2026-08-31');
  assert.equal(result.benchmarks['30d'].observationCount, 29);
  assert.equal(result.benchmarks['30d'].average, 15);
  assert.ok(result.daily.every((p) => p.date < '2026-09-30' && p.close !== 1000));

  // Observations dated after "today" are never used either
  assert.equal(computeBenchmarks(points, '2026-09-20').lastRefreshed, '2026-09-19');
  // Only today's observation available -> not enough prior data
  assert.equal(computeBenchmarks([{ date: '2026-09-30', close: 1 }], '2026-09-30'), null);
});

test('benchmarks with business-day data: today (Monday) excluded, weekend not filled in', () => {
  const businessDays = [];
  for (let d = 1; d <= 28; d++) {
    const date = `2026-09-${String(d).padStart(2, '0')}`;
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (day !== 0 && day !== 6) businessDays.push({ date, close: d });
  }
  businessDays.at(-1).close = 1000; // Monday 2026-09-28 = today

  const result = computeBenchmarks(businessDays, '2026-09-28');
  assert.equal(result.lastRefreshed, '2026-09-25', 'most recent prior business day (Friday)');
  assert.equal(result.benchmarks['7d'].startDate, '2026-09-19');
  assert.deepEqual(result.daily.slice(-5).map((p) => p.date), ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']);
  assert.equal(result.benchmarks['7d'].observationCount, 5, 'Mon-Fri only; no weekend values');
  assert.equal(result.benchmarks['7d'].average, (21 + 22 + 23 + 24 + 25) / 5);
  assert.equal(result.benchmarks['30d'].observationCount, 19);
  assert.ok(result.daily.every((p) => ![0, 6].includes(new Date(`${p.date}T00:00:00Z`).getUTCDay())));
});

test('reverse pairs: benchmarks use the same prior dates and averages of the reversed rates', () => {
  const usd = { SGD: {}, VND: {} };
  for (let d = 1; d <= 30; d++) {
    const date = `2026-09-${String(d).padStart(2, '0')}`;
    usd.SGD[date] = 1.27 + d * 0.001;
    usd.VND[date] = 26000 + d * 3;
  }
  const forward = computeBenchmarks(deriveDailyCloses('SGD', 'VND', usd), '2026-09-30');
  const reverse = computeBenchmarks(deriveDailyCloses('VND', 'SGD', usd), '2026-09-30');
  for (const w of ['7d', '30d']) {
    assert.equal(reverse.benchmarks[w].startDate, forward.benchmarks[w].startDate);
    assert.equal(reverse.benchmarks[w].endDate, '2026-09-29');
    assert.equal(reverse.benchmarks[w].observationCount, forward.benchmarks[w].observationCount);
  }
  const expected7 = forward.daily.slice(-7).reduce((a, p) => a + 1 / p.close, 0) / 7;
  assert.ok(Math.abs(reverse.benchmarks['7d'].average - expected7) < 1e-15);
  forward.daily.forEach((p, i) => assert.ok(Math.abs(p.close * reverse.daily[i].close - 1) < 1e-12));
});
