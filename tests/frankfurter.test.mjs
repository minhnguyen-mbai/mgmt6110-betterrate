import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import fxHistoryHandler from '../api/fx-history.js';
import fxCurrentHandler from '../api/fx-current.js';
import { selectProvider } from '../api/_lib/providers/index.js';
import * as alphaVantage from '../api/_lib/providers/alphaVantage.js';
import * as frankfurter from '../api/_lib/providers/frankfurter.js';
import {
  normalizeCurrentRate,
  normalizeHistoricalSeries,
  classifyFrankfurterFailure,
  _resetFrankfurterCache,
} from '../api/_lib/providers/frankfurter.js';

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.end = () => res;
  return res;
}

/** Business days in September 2026 plus the weekends Frankfurter also returns. */
function ratesPayload(base, quote, start) {
  const rows = [];
  for (let d = 1; d <= 30; d++) {
    rows.push({ date: `2026-09-${String(d).padStart(2, '0')}`, base, quote, rate: +(start + d * 0.001).toFixed(5) });
  }
  return rows;
}

let calls;
let originalFetch;

function installFetch(respond) {
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    calls.push(u);
    const { status = 200, body } = respond(u);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
}

beforeEach(() => {
  calls = [];
  originalFetch = globalThis.fetch;
  delete process.env.ALPHAVANTAGE_API_KEY; // Frankfurter pairs must not need it
  _resetFrankfurterCache();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('1. provider routing: VND pairs -> Alpha Vantage, all others -> Frankfurter', () => {
  for (const [from, to] of [['SGD', 'VND'], ['VND', 'SGD'], ['USD', 'VND'], ['VND', 'EUR']]) {
    assert.equal(selectProvider(from, to), alphaVantage, `${from}->${to}`);
  }
  for (const [from, to] of [['SGD', 'EUR'], ['EUR', 'SGD'], ['USD', 'SGD'], ['JPY', 'THB'], ['GBP', 'AUD']]) {
    assert.equal(selectProvider(from, to), frankfurter, `${from}->${to}`);
  }
});

test('2. Frankfurter current-rate normalization', () => {
  const data = { date: '2026-09-25', base: 'SGD', quote: 'JPY', rate: 123.83 };
  assert.deepEqual(normalizeCurrentRate(data, 'SGD', 'JPY', false), { rate: 123.83, date: '2026-09-25' });
  assert.deepEqual(normalizeCurrentRate(data, 'SGD', 'JPY', true), { rate: 1 / 123.83, date: '2026-09-25' });
  assert.equal(normalizeCurrentRate({ ...data, quote: 'EUR' }, 'SGD', 'JPY', false), null, 'wrong pair');
  assert.equal(normalizeCurrentRate({ ...data, rate: 0 }, 'SGD', 'JPY', false), null);
  assert.equal(normalizeCurrentRate({ ...data, rate: 'x' }, 'SGD', 'JPY', false), null);
  assert.equal(normalizeCurrentRate(null, 'SGD', 'JPY', false), null);
});

test('2/8. Frankfurter history normalization: weekends, zero and invalid rates dropped, sorted, inverted', () => {
  const rows = [
    { date: '2026-09-22', base: 'EUR', quote: 'SGD', rate: 1.46 }, // Tue
    { date: '2026-09-18', base: 'EUR', quote: 'SGD', rate: 1.47 }, // Fri
    { date: '2026-09-19', base: 'EUR', quote: 'SGD', rate: 1.47 }, // Sat (carried forward)
    { date: '2026-09-20', base: 'EUR', quote: 'SGD', rate: 1.47 }, // Sun (carried forward)
    { date: '2026-09-21', base: 'EUR', quote: 'SGD', rate: 0 },
    { date: '2026-09-23', base: 'EUR', quote: 'SGD', rate: -1 },
    { date: '2026-09-24', base: 'EUR', quote: 'SGD', rate: Infinity },
    { date: '2026-09-25', base: 'EUR', quote: 'USD', rate: 1.17 }, // other pair
    { date: 'bad', base: 'EUR', quote: 'SGD', rate: 1.4 },
  ];
  assert.deepEqual(normalizeHistoricalSeries(rows, 'EUR', 'SGD', false), [
    { date: '2026-09-18', close: 1.47 },
    { date: '2026-09-22', close: 1.46 },
  ]);
  const inverted = normalizeHistoricalSeries(rows, 'EUR', 'SGD', true);
  assert.deepEqual(inverted.map((p) => p.date), ['2026-09-18', '2026-09-22']);
  assert.ok(Math.abs(inverted[0].close - 1 / 1.47) < 1e-12);
  assert.deepEqual(normalizeHistoricalSeries({ status: 422 }, 'EUR', 'SGD', false), []);
});

test('Frankfurter error classification never exposes provider text', () => {
  assert.deepEqual(classifyFrankfurterFailure(422, { status: 422, message: 'invalid currency: XYZ' }), { code: 'UNSUPPORTED_CURRENCY', status: 400 });
  assert.deepEqual(classifyFrankfurterFailure(422, { status: 422, message: 'invalid date' }), { code: 'PROVIDER_ERROR', status: 502 });
  assert.deepEqual(classifyFrankfurterFailure(429, null), { code: 'PROVIDER_RATE_LIMIT', status: 503 });
  assert.deepEqual(classifyFrankfurterFailure(503, null), { code: 'PROVIDER_ERROR', status: 502 });
});

test('fx-current (Frankfurter): direct pair in market direction, inverted for the reverse, cached, no API key', async () => {
  installFetch((u) => ({ body: { date: '2026-09-25', base: 'EUR', quote: 'SGD', rate: 1.458 } }));

  const res = mockRes();
  await fxCurrentHandler({ method: 'GET', query: { from: 'EUR', to: 'SGD' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    from: 'EUR',
    to: 'SGD',
    rate: 1.458,
    lastRefreshed: '2026-09-25',
    timeZone: null,
    source: 'Frankfurter',
    provider: 'Frankfurter',
    method: 'market-quote',
  });
  assert.equal(calls[0].origin + calls[0].pathname, 'https://api.frankfurter.dev/v2/rate/EUR/SGD');

  const reverse = mockRes();
  await fxCurrentHandler({ method: 'GET', query: { from: 'SGD', to: 'EUR' } }, reverse);
  assert.equal(reverse.statusCode, 200);
  assert.equal(reverse.body.rate, 1 / 1.458);
  assert.equal(reverse.body.method, 'inverted-market-quote');
  assert.equal(calls.length, 1, 'reverse direction reuses the cached upstream response');
});

test("fx-history (Frankfurter): business days only, today's observation excluded, reverse direction", async (t) => {
  // "Today" is Wednesday 2026-09-30; Frankfurter's history includes today's rate
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-30T12:00:00Z') });
  t.after(() => mock.timers.reset());
  installFetch((u) => ({ body: ratesPayload(u.searchParams.get('base'), u.searchParams.get('quotes'), 123) }));

  const res = mockRes();
  await fxHistoryHandler({ method: 'GET', query: { from: 'SGD', to: 'JPY' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.provider, 'Frankfurter');
  assert.equal(res.body.method, 'direct-pair');
  assert.match(res.headers['cache-control'], /s-maxage=43200/);
  assert.equal(calls[0].pathname, '/v2/rates');
  assert.equal(calls[0].searchParams.get('base'), 'SGD');
  assert.equal(calls[0].searchParams.get('quotes'), 'JPY');

  assert.equal(calls[0].searchParams.get('from'), '2026-08-16', '45-day lookback from today');

  // Today (the 30th) is excluded: benchmarks end on the most recent prior business day
  assert.equal(res.body.lastRefreshed, '2026-09-29');
  assert.equal(res.body.daily.length, 21, 'Sept 1-29 business days');
  assert.ok(res.body.daily.every((p) => p.date < '2026-09-30'));
  assert.ok(res.body.daily.every((p) => ![0, 6].includes(new Date(`${p.date}T00:00:00Z`).getUTCDay())));
  const b7 = res.body.benchmarks['7d'];
  assert.equal(b7.startDate, '2026-09-23');
  assert.equal(b7.endDate, '2026-09-29');
  assert.equal(b7.observationCount, 5); // 23, 24, 25, 28, 29 (weekend 26-27 not used)
  const expected7 = [23, 24, 25, 28, 29].map((d) => +(123 + d * 0.001).toFixed(5));
  assert.ok(Math.abs(b7.average - expected7.reduce((a, b) => a + b) / 5) < 1e-9);
  const b30 = res.body.benchmarks['30d'];
  assert.equal(b30.startDate, '2026-08-31');
  assert.equal(b30.observationCount, 21);

  const reverse = mockRes();
  await fxHistoryHandler({ method: 'GET', query: { from: 'JPY', to: 'SGD' } }, reverse);
  assert.equal(reverse.statusCode, 200);
  assert.equal(reverse.body.method, 'inverted-direct-pair');
  assert.equal(calls.length, 1, 'reverse direction reuses the cached upstream response');
  assert.ok(Math.abs(reverse.body.daily.at(-1).close * res.body.daily.at(-1).close - 1) < 1e-12);
});

test('Frankfurter failures are normalized, not cached, and hide provider text', async () => {
  installFetch(() => ({ status: 422, body: { status: 422, message: 'invalid currency: MYR' } }));
  const res = mockRes();
  await fxCurrentHandler({ method: 'GET', query: { from: 'MYR', to: 'SGD' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'UNSUPPORTED_CURRENCY');
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.ok(!JSON.stringify(res.body).includes('invalid currency'));

  installFetch(() => ({ status: 500, body: null }));
  const res500 = mockRes();
  await fxHistoryHandler({ method: 'GET', query: { from: 'MYR', to: 'SGD' } }, res500);
  assert.equal(res500.body.code, 'PROVIDER_ERROR');

  installFetch(() => ({ body: [] }));
  const empty = mockRes();
  await fxHistoryHandler({ method: 'GET', query: { from: 'MYR', to: 'SGD' } }, empty);
  assert.equal(empty.body.code, 'EMPTY_DATA');

  installFetch(() => ({ body: { date: '2026-09-25', base: 'SGD', quote: 'MYR', rate: 0 } }));
  const zero = mockRes();
  await fxCurrentHandler({ method: 'GET', query: { from: 'MYR', to: 'SGD' } }, zero);
  assert.equal(zero.body.code, 'INVALID_RATE');

  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  const down = mockRes();
  await fxCurrentHandler({ method: 'GET', query: { from: 'MYR', to: 'SGD' } }, down);
  assert.equal(down.body.code, 'PROVIDER_UNREACHABLE');

  // None of the failures were cached: a healthy response now succeeds
  installFetch(() => ({ body: { date: '2026-09-25', base: 'SGD', quote: 'MYR', rate: 3.1896 } }));
  const ok = mockRes();
  await fxCurrentHandler({ method: 'GET', query: { from: 'MYR', to: 'SGD' } }, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.rate, 1 / 3.1896);
});
