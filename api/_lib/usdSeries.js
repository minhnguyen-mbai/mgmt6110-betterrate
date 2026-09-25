/**
 * api/_lib/usdSeries.js
 *
 * Fetches and caches canonical USD -> currency FX_DAILY series.
 *
 * Caching decision:
 * The reusable unit is the underlying USD -> currency series, not the final pair.
 * One cached USD -> SGD series serves SGD -> VND, SGD -> EUR, EUR -> SGD, etc.
 * The cache lives in module memory, so it is shared by every request handled by a
 * warm serverless instance (best effort; a cold start begins empty). Final pair
 * responses are additionally cached by the CDN (see api/fx-history.js).
 *
 * Only successfully parsed market data is cached. Provider failures are never cached.
 *
 * Request discipline:
 * Upstream calls from this module are serialized and spaced at least
 * UPSTREAM_SPACING_MS apart (Alpha Vantage free tier: 1 request per second).
 * Concurrent requests for the same series share a single in-flight fetch.
 * The only retry is a single delayed one for the per-second burst notice (other
 * functions, e.g. /api/fx-current, may have called the provider a moment earlier).
 * Daily-quota and other provider notices are never retried.
 */

import {
  fetchAlphaVantageJsonWithBurstRetry,
  classifyProviderResponse,
  logDiagnostic,
  ERROR_MESSAGES,
} from './alphavantage.js';
import { parseDailyCloses } from './crossrate.js';

export const USD_SERIES_CACHE_MS = 43200 * 1000; // 12 hours, matches the history CDN cache
export const UPSTREAM_SPACING_MS = 1100;
const UPSTREAM_TIMEOUT_MS = 6000;

/** @type {Map<string, { closes: Record<string, number>, timeZone: string | null, fetchedAt: number }>} */
const seriesCache = new Map();
/** @type {Map<string, Promise<any>>} */
const inFlight = new Map();

let upstreamQueue = Promise.resolve();
let lastUpstreamAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs fn after all previously queued upstream calls, spaced UPSTREAM_SPACING_MS apart. */
function enqueueUpstream(fn) {
  const run = upstreamQueue.then(async () => {
    const waitMs = lastUpstreamAt + UPSTREAM_SPACING_MS - Date.now();
    if (waitMs > 0) await sleep(waitMs);
    try {
      return await fn();
    } finally {
      lastUpstreamAt = Date.now();
    }
  });
  upstreamQueue = run.catch(() => {});
  return run;
}

function failure(code, httpStatus, status = 502, message = ERROR_MESSAGES[code]) {
  logDiagnostic(code, httpStatus);
  return { ok: false, code, status, message };
}

async function fetchUsdSeries(code, apiKey) {
  const upstreamUrl = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=USD&to_symbol=${encodeURIComponent(
    code
  )}&outputsize=compact&apikey=${encodeURIComponent(apiKey)}`;

  const fetchResult = await enqueueUpstream(() =>
    fetchAlphaVantageJsonWithBurstRetry(upstreamUrl, UPSTREAM_TIMEOUT_MS)
  );

  if (fetchResult.httpStatus === null) {
    return failure('PROVIDER_UNREACHABLE', null);
  }
  if (!fetchResult.ok || fetchResult.providerCheck === 'unexpected_response') {
    return failure('PROVIDER_ERROR', fetchResult.httpStatus);
  }

  const classification = classifyProviderResponse(fetchResult.data);
  if (classification) {
    return failure(classification.code, fetchResult.httpStatus, classification.status, classification.message);
  }

  const parsed = parseDailyCloses(fetchResult.data);
  if (!parsed) {
    return failure('EMPTY_DATA', fetchResult.httpStatus);
  }

  const entry = { ...parsed, fetchedAt: Date.now() };
  seriesCache.set(code, entry);
  return { ok: true, ...entry, fromCache: false };
}

/**
 * Returns the USD -> code daily closes, from cache when fresh.
 *
 * @returns {Promise<
 *   | { ok: true, closes: Record<string, number>, timeZone: string | null, fetchedAt: number, fromCache: boolean }
 *   | { ok: false, code: string, status: number, message: string }
 * >}
 */
export async function getUsdSeries(code, apiKey) {
  const cached = seriesCache.get(code);
  if (cached && Date.now() - cached.fetchedAt < USD_SERIES_CACHE_MS) {
    return { ok: true, ...cached, fromCache: true };
  }

  if (inFlight.has(code)) {
    return inFlight.get(code);
  }

  const pending = fetchUsdSeries(code, apiKey).finally(() => inFlight.delete(code));
  inFlight.set(code, pending);
  return pending;
}

/** Test helper: clears module state. */
export function _resetUsdSeriesCache() {
  seriesCache.clear();
  inFlight.clear();
  lastUpstreamAt = 0;
}
