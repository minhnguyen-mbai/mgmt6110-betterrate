/**
 * scripts/verify-live.mjs
 *
 * Live check of the real API handlers (/api/fx-current, /api/fx-history) against
 * Alpha Vantage. Uses ALPHAVANTAGE_API_KEY and consumes provider quota.
 *
 * Usage: ALPHAVANTAGE_API_KEY=... node scripts/verify-live.mjs [CODE | FROM:TO ...]
 *   CODE     checks CODE -> USD and USD -> CODE
 *   FROM:TO  checks FROM -> TO and TO -> FROM
 * Only currencies in SUPPORTED_CURRENCIES are accepted by the handlers, so a pending
 * currency must be moved there (at least temporarily) before it can be verified.
 *
 * Quota discipline:
 * - all upstream calls are sequential and spaced >= 1.3 s apart
 * - an identical upstream request within one run is answered from the first real
 *   response (e.g. EUR -> SGD and SGD -> EUR share one CURRENCY_EXCHANGE_RATE call);
 *   USD series are reused through the handlers' own in-memory cache
 * - the run stops at the first provider rate-limit notice (no retries of the daily quota)
 */
import fxCurrent from '../api/fx-current.js';
import fxHistory from '../api/fx-history.js';

const SPACING_MS = 1300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const realFetch = globalThis.fetch;
const responses = new Map();
let upstreamCalls = 0;
let lastCallAt = 0;
globalThis.fetch = async (url, init) => {
  const key = String(url);
  if (!responses.has(key)) {
    const wait = lastCallAt + SPACING_MS - Date.now();
    if (wait > 0) await sleep(wait);
    upstreamCalls += 1;
    const res = await realFetch(url, init);
    lastCallAt = Date.now();
    responses.set(key, { ok: res.ok, status: res.status, body: await res.json().catch(() => null) });
  }
  const r = responses.get(key);
  return { ok: r.ok, status: r.status, json: async () => r.body };
};

function mockRes() {
  const r = { statusCode: 200, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r;
  return r;
}

async function check(from, to) {
  const c = mockRes();
  await fxCurrent({ method: 'GET', query: { from, to } }, c);
  const h = mockRes();
  await fxHistory({ method: 'GET', query: { from, to } }, h);
  const rate = c.body?.rate;
  const daily = h.body?.daily || [];
  const last = daily.at(-1)?.close;
  const b7 = h.body?.benchmarks?.['7d'];
  const b30 = h.body?.benchmarks?.['30d'];
  const ok =
    c.statusCode === 200 && rate > 0 && isFinite(rate) &&
    h.statusCode === 200 && daily.length > 0 && daily.every((p) => p.close > 0 && isFinite(p.close)) &&
    b7?.average > 0 && b30?.average > 0 &&
    Math.abs(rate / last - 1) < 0.03;
  return {
    pair: `${from}->${to}`,
    ok,
    current: c.statusCode === 200 ? rate : c.body?.code,
    history: h.statusCode === 200 ? h.body.derivation : h.body?.code,
    points: daily.length,
    latest: h.body?.lastRefreshed,
    latestClose: last,
    avg7d: b7 ? `${b7.average} (${b7.observationCount})` : null,
    avg30d: b30 ? `${b30.average} (${b30.observationCount})` : null,
    currentVsLatestPct: rate && last ? +((rate / last - 1) * 100).toFixed(3) : null,
    rateLimited: [c.body?.code, h.body?.code].includes('PROVIDER_RATE_LIMIT'),
  };
}

const pairs = process.argv.slice(2).flatMap((arg) => {
  const [a, b] = arg.toUpperCase().split(':');
  return b ? [[a, b], [b, a]] : [[a, 'USD'], ['USD', a]];
});

let failed = false;
const results = {};
for (const [from, to] of pairs) {
  const r = await check(from, to);
  results[r.pair] = r;
  failed ||= !r.ok;
  const reverse = results[`${to}->${from}`];
  if (reverse && r.ok && reverse.ok) {
    r.reverseProduct = +(r.current * reverse.current).toFixed(9);
  }
  console.log(JSON.stringify(r));
  if (r.rateLimited) {
    console.log('Stopping: provider rate limit reached (not retrying).');
    break;
  }
}
console.log(`Upstream provider requests: ${upstreamCalls}`);
process.exitCode = failed ? 1 : 0;
