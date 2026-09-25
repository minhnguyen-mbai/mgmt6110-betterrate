import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import fxHistoryHandler from '../api/fx-history.js';
import fxCurrentHandler from '../api/fx-current.js';
import { _resetUsdSeriesCache, UPSTREAM_SPACING_MS } from '../api/_lib/usdSeries.js';

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.end = () => res;
  return res;
}

/** 30 consecutive daily closes ending today (UTC), so benchmarks always have prior data. */
function dailyPayload(to, base) {
  const series = {};
  const now = Date.now();
  for (let d = 1; d <= 30; d++) {
    const date = new Date(now - (30 - d) * 86400000).toISOString().slice(0, 10);
    series[date] = { '4. close': String(base + d * base * 0.001) };
  }
  return {
    'Meta Data': { '2. From Symbol': 'USD', '3. To Symbol': to, '6. Time Zone': 'UTC' },
    'Time Series FX (Daily)': series,
  };
}

const USD_BASES = { SGD: 1.28, VND: 26000 };

let calls;
let originalFetch;

function installFetch(respond) {
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    calls.push({ fn: u.searchParams.get('function'), from: u.searchParams.get('from_symbol'), to: u.searchParams.get('to_symbol'), at: Date.now() });
    const body = respond(u);
    return { ok: true, status: 200, json: async () => body };
  };
}

beforeEach(() => {
  calls = [];
  originalFetch = globalThis.fetch;
  process.env.ALPHAVANTAGE_API_KEY = 'test-key';
  _resetUsdSeriesCache();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('invalid pairs and unsupported currencies return 400 without contacting any provider', async () => {
  installFetch(() => { throw new Error('should not be called'); });
  const cases = [
    [{ from: 'SGD', to: 'XYZ' }, 'UNSUPPORTED_CURRENCY'],
    [{ from: 'CNY', to: 'VND' }, 'UNSUPPORTED_CURRENCY'],
    [{ from: 'SGD', to: 'SGD' }, 'INVALID_PAIR'],
    [{ from: 'SGD' }, 'INVALID_PAIR'],
  ];
  for (const [query, code] of cases) {
    for (const handler of [fxHistoryHandler, fxCurrentHandler]) {
      const res = mockRes();
      await handler({ method: 'GET', query }, res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.code, code);
      assert.equal(res.headers['cache-control'], 'no-store');
    }
  }
  assert.equal(calls.length, 0);
});

test('Alpha Vantage: only missing USD series are fetched', async () => {
  installFetch((u) => dailyPayload(u.searchParams.get('to_symbol'), USD_BASES[u.searchParams.get('to_symbol')]));

  const usdVnd = mockRes();
  await fxHistoryHandler({ method: 'GET', query: { from: 'USD', to: 'VND' } }, usdVnd);
  assert.equal(usdVnd.statusCode, 200);
  assert.equal(usdVnd.body.provider, 'Alpha Vantage');
  assert.equal(usdVnd.body.derivation, 'direct');
  assert.equal(usdVnd.body.method, 'usd-series');
  assert.deepEqual(calls.map((c) => c.to), ['VND']);

  const sgdVnd = mockRes();
  await fxHistoryHandler({ method: 'GET', query: { from: 'SGD', to: 'VND' } }, sgdVnd);
  assert.equal(sgdVnd.statusCode, 200);
  assert.deepEqual(calls.map((c) => c.to), ['VND', 'SGD'], 'only USD -> SGD fetched');
});

test('cross pair fetches two USD series sequentially, spaced, then reuses the cache', async () => {
  installFetch((u) => dailyPayload(u.searchParams.get('to_symbol'), USD_BASES[u.searchParams.get('to_symbol')]));

  const res = mockRes();
  await fxHistoryHandler({ method: 'GET', query: { from: 'SGD', to: 'VND' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.from, 'SGD');
  assert.equal(res.body.to, 'VND');
  assert.equal(res.body.derivation, 'cross');
  assert.equal(res.body.provider, 'Alpha Vantage');
  assert.equal(res.body.method, 'cross-rate-via-usd');
  assert.equal(res.body.methodology, 'Derived cross-rate via USD from Alpha Vantage FX_DAILY');
  assert.match(res.headers['cache-control'], /s-maxage=43200/);
  assert.deepEqual(calls.map((c) => [c.fn, c.from, c.to]), [['FX_DAILY', 'USD', 'SGD'], ['FX_DAILY', 'USD', 'VND']]);
  assert.ok(calls[1].at - calls[0].at >= UPSTREAM_SPACING_MS - 20, 'second call waits ~1.1s');
  assert.ok(res.body.daily.every((p) => p.close > 0 && isFinite(p.close)));
  const today = new Date().toISOString().slice(0, 10);
  assert.ok(res.body.daily.every((p) => p.date < today), "today's observation excluded (Alpha Vantage)");
  assert.equal(res.body.benchmarks['7d'].observationCount, 7);
  assert.equal(res.body.benchmarks['30d'].observationCount, 29);

  // Reverse direction and other pairs reuse cached USD series
  const reverse = mockRes();
  await fxHistoryHandler({ method: 'GET', query: { from: 'VND', to: 'SGD' } }, reverse);
  assert.equal(reverse.statusCode, 200);
  assert.equal(calls.length, 2, 'no new upstream calls for VND -> SGD');
  const lastForward = res.body.daily.at(-1).close;
  const lastReverse = reverse.body.daily.at(-1).close;
  assert.ok(Math.abs(lastForward * lastReverse - 1) < 1e-9);

  for (const [from, to, derivation] of [['USD', 'VND', 'direct'], ['VND', 'USD', 'inverse']]) {
    const r = mockRes();
    await fxHistoryHandler({ method: 'GET', query: { from, to } }, r);
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.derivation, derivation);
    assert.ok(r.body.benchmarks['7d'].average > 0 && r.body.benchmarks['30d'].average > 0);
  }
  assert.equal(calls.length, 2, 'all VND pairs served from the two cached USD series');
});

test('rate-limit notice is classified, not retried, not cached, and stops the second fetch', async () => {
  installFetch(() => ({ Information: 'We have detected your API key ... standard API rate limit is 25 requests per day.' }));

  const res = mockRes();
  await fxHistoryHandler({ method: 'GET', query: { from: 'SGD', to: 'VND' } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'PROVIDER_RATE_LIMIT');
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(calls.length, 1, 'no retry, second series not requested');
  assert.ok(!JSON.stringify(res.body).includes('25 requests'), 'raw provider text is not exposed');

  // Failure was not cached: the next request contacts the provider again
  installFetch((u) => dailyPayload(u.searchParams.get('to_symbol'), USD_BASES[u.searchParams.get('to_symbol')]));
  const retry = mockRes();
  await fxHistoryHandler({ method: 'GET', query: { from: 'SGD', to: 'VND' } }, retry);
  assert.equal(retry.statusCode, 200);
});

test('series of zero values yields EMPTY_DATA', async () => {
  installFetch(() => ({ 'Time Series FX (Daily)': { '2026-09-24': { '4. close': '0.00000' } } }));
  const res = mockRes();
  await fxHistoryHandler({ method: 'GET', query: { from: 'USD', to: 'VND' } }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.code, 'EMPTY_DATA');
});

test('Error Message is PROVIDER_ERROR', async () => {
  installFetch(() => ({ 'Error Message': 'Invalid API call.' }));
  const res = mockRes();
  await fxHistoryHandler({ method: 'GET', query: { from: 'USD', to: 'VND' } }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.code, 'PROVIDER_ERROR');
});

test('fx-current (Alpha Vantage) passes the pair through and returns provider metadata', async () => {
  installFetch((u) => ({
    'Realtime Currency Exchange Rate': {
      '1. From_Currency Code': u.searchParams.get('from_currency'),
      '5. Exchange Rate': '25990.5',
      '6. Last Refreshed': '2026-09-25 09:00:00',
      '7. Time Zone': 'UTC',
    },
  }));
  const res = mockRes();
  await fxCurrentHandler({ method: 'GET', query: { from: 'USD', to: 'VND' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    from: 'USD',
    to: 'VND',
    rate: 25990.5,
    lastRefreshed: '2026-09-25 09:00:00',
    timeZone: 'UTC',
    source: 'Alpha Vantage',
    provider: 'Alpha Vantage',
    method: 'market-quote',
  });

  // No parameters keeps the legacy SGD -> VND default
  const legacy = mockRes();
  await fxCurrentHandler({ method: 'GET', query: {} }, legacy);
  assert.equal(legacy.body.from, 'SGD');
  assert.equal(legacy.body.to, 'VND');
});

// Real Alpha Vantage wording of the burst notice
const BURST_NOTICE = {
  Information:
    'Thank you for using Alpha Vantage! Please consider spreading out your free API requests more sparingly (1 request per second). You may subscribe to any of the premium plans at https://www.alphavantage.co/premium/ to lift the free key rate limit (25 requests per day), raise the per-second burst limit, and instantly unlock all premium endpoints',
};

test('per-second burst notice is retried exactly once after a pause', async () => {
  let n = 0;
  installFetch((u) => {
    n += 1;
    return n === 1
      ? BURST_NOTICE
      : dailyPayload('VND', USD_BASES.VND);
  });
  const res = mockRes();
  await fxHistoryHandler({ method: 'GET', query: { from: 'USD', to: 'VND' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].at - calls[0].at >= 1000);

  // A second burst notice is not retried again
  _resetUsdSeriesCache();
  calls = [];
  installFetch(() => (BURST_NOTICE));
  const limited = mockRes();
  await fxHistoryHandler({ method: 'GET', query: { from: 'USD', to: 'VND' } }, limited);
  assert.equal(limited.body.code, 'PROVIDER_RATE_LIMIT');
  assert.equal(calls.length, 2);
});

test('fx-current requests the market direction upstream and inverts for the reverse pair', async () => {
  const upstream = [];
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    upstream.push(`${u.searchParams.get('from_currency')}->${u.searchParams.get('to_currency')}`);
    return {
      ok: true,
      status: 200,
      json: async () => ({ 'Realtime Currency Exchange Rate': { '5. Exchange Rate': '20000', '7. Time Zone': 'UTC' } }),
    };
  };
  const res = mockRes();
  await fxCurrentHandler({ method: 'GET', query: { from: 'VND', to: 'SGD' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(upstream, ['SGD->VND']);
  assert.equal(res.body.from, 'VND');
  assert.equal(res.body.to, 'SGD');
  assert.equal(res.body.rate, 1 / 20000);
  assert.equal(res.body.method, 'inverted-market-quote');
});

test('Alpha Vantage pairs still require the API key; KEY_MISSING is reported', async () => {
  delete process.env.ALPHAVANTAGE_API_KEY;
  installFetch(() => { throw new Error('should not be called'); });
  for (const handler of [fxHistoryHandler, fxCurrentHandler]) {
    const res = mockRes();
    await handler({ method: 'GET', query: { from: 'SGD', to: 'VND' } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'KEY_MISSING');
  }
  assert.equal(calls.length, 0);
});
