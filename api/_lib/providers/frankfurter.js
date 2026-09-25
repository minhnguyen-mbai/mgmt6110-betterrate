/**
 * api/_lib/providers/frankfurter.js
 *
 * Frankfurter v2 provider (used for non-VND pairs, see providers/index.js). No API key.
 *   Current: GET https://api.frankfurter.dev/v2/rate/{base}/{quote}
 *            -> { date, base, quote, rate }
 *   History: GET https://api.frankfurter.dev/v2/rates?base=&quotes=&from=YYYY-MM-DD
 *            -> [{ date, base, quote, rate }, ...]
 *   Errors:  HTTP 4xx/5xx with { status, message } (e.g. 422 "invalid currency: XYZ")
 *
 * Rates are published with 5 decimal places, so small-unit directions lose precision
 * (JPY -> SGD = 0.00808). The direct pair is therefore requested in its market
 * direction (e.g. SGD -> JPY = 123.83) and inverted for the reverse request.
 *
 * Only business-day observations are used; no dates are filled in. Frankfurter also returns
 * Saturday/Sunday rows, but those are blends in which most sources still carry Friday's
 * observation (checked with expand=providers), so keeping them would over-weight Friday.
 * Weekdays only also matches Alpha Vantage FX_DAILY.
 * Successful responses are cached in module memory (per warm instance); failures are not.
 */

import { fetchAlphaVantageJson as fetchJsonWithTimeout, logDiagnostic, ERROR_MESSAGES } from '../alphavantage.js';
import { getMarketQuote } from '../currencies.js';

export const PROVIDER_NAME = 'Frankfurter';
export const FRANKFURTER_BASE_URL = 'https://api.frankfurter.dev/v2';

const CURRENT_CACHE_MS = 60 * 60 * 1000; // 1 hour (rates are daily reference rates)
const HISTORY_CACHE_MS = 12 * 60 * 60 * 1000; // 12 hours, matches the history CDN cache
const HISTORY_LOOKBACK_DAYS = 45; // comfortably covers the 30-calendar-day window
const TIMEOUT_MS = 8000;

/** @type {Map<string, { data: any, fetchedAt: number }>} */
const responseCache = new Map();

function isValidRate(value) {
  return typeof value === 'number' && isFinite(value) && value > 0;
}

function failure(code, httpStatus = null, status = 502) {
  logDiagnostic(code, httpStatus);
  return { ok: false, code, status, message: ERROR_MESSAGES[code] };
}

/**
 * Maps a Frankfurter HTTP failure to a BetterRate error. Never returns provider text.
 */
export function classifyFrankfurterFailure(httpStatus, body) {
  if (httpStatus === 429) return { code: 'PROVIDER_RATE_LIMIT', status: 503 };
  const message = body && typeof body.message === 'string' ? body.message.toLowerCase() : '';
  if ((httpStatus === 404 || httpStatus === 422) && message.includes('currency')) {
    return { code: 'UNSUPPORTED_CURRENCY', status: 400 };
  }
  return { code: 'PROVIDER_ERROR', status: 502 };
}

/**
 * Fetches and normalizes a Frankfurter resource. Only a successfully normalized result is
 * cached; HTTP failures and unusable payloads (normalize returns null) never are.
 */
async function fetchFrankfurter(path, cacheMs, normalize, invalidCode) {
  const url = `${FRANKFURTER_BASE_URL}${path}`;
  const cached = responseCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < cacheMs) {
    return { ok: true, value: cached.data };
  }

  const result = await fetchJsonWithTimeout(url, TIMEOUT_MS);
  if (result.httpStatus === null) {
    return failure('PROVIDER_UNREACHABLE');
  }
  if (!result.ok || result.providerCheck === 'unexpected_response') {
    const { code, status } = classifyFrankfurterFailure(result.httpStatus, result.data);
    return failure(code, result.httpStatus, status);
  }

  const value = normalize(result.data);
  if (!value) {
    return failure(invalidCode, result.httpStatus);
  }

  responseCache.set(url, { data: value, fetchedAt: Date.now() });
  return { ok: true, value };
}

/**
 * Normalizes a /v2/rate response for the requested direction.
 * @returns {{ rate: number, date: string | null } | null}
 */
export function normalizeCurrentRate(data, base, quote, isInverted) {
  if (!data || typeof data !== 'object' || data.base !== base || data.quote !== quote) return null;
  if (!isValidRate(data.rate)) return null;
  const rate = isInverted ? 1 / data.rate : data.rate;
  if (!isValidRate(rate)) return null;
  const date = typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : null;
  return { rate, date };
}

function isWeekend(dateStr) {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Normalizes a /v2/rates array into chronologically sorted business-day { date, close }
 * points for the requested direction, dropping weekends and malformed, zero and
 * non-finite rates.
 */
export function normalizeHistoricalSeries(data, base, quote, isInverted) {
  if (!Array.isArray(data)) return [];
  const byDate = new Map();
  for (const row of data) {
    if (!row || row.base !== base || row.quote !== quote) continue;
    if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
    if (isWeekend(row.date)) continue;
    if (!isValidRate(row.rate)) continue;
    const close = isInverted ? 1 / row.rate : row.rate;
    if (!isValidRate(close)) continue;
    byDate.set(row.date, close);
  }
  return [...byDate.keys()].sort().map((date) => ({ date, close: byDate.get(date) }));
}

function isoDateDaysAgo(days, now = new Date()) {
  return new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
}

export async function getCurrentRate(from, to) {
  const { base, quote } = getMarketQuote(from, to);
  const isInverted = base !== from;
  const result = await fetchFrankfurter(
    `/rate/${base}/${quote}`,
    CURRENT_CACHE_MS,
    (data) => normalizeCurrentRate(data, base, quote, false),
    'INVALID_RATE'
  );
  if (!result.ok) return result;

  // The cache holds the market-direction quote; both directions share it
  const rate = isInverted ? 1 / result.value.rate : result.value.rate;
  return {
    ok: true,
    rate,
    lastRefreshed: result.value.date,
    timeZone: null,
    provider: PROVIDER_NAME,
    method: isInverted ? 'inverted-market-quote' : 'market-quote',
  };
}

export async function getHistoricalSeries(from, to) {
  const { base, quote } = getMarketQuote(from, to);
  const isInverted = base !== from;
  const start = isoDateDaysAgo(HISTORY_LOOKBACK_DAYS);
  const result = await fetchFrankfurter(
    `/rates?base=${base}&quotes=${quote}&from=${start}`,
    HISTORY_CACHE_MS,
    (data) => {
      const points = normalizeHistoricalSeries(data, base, quote, false);
      return points.length > 0 ? points : null;
    },
    'EMPTY_DATA'
  );
  if (!result.ok) return result;

  // The cache holds market-direction points; both directions share them
  const points = isInverted
    ? result.value.map((p) => ({ date: p.date, close: 1 / p.close }))
    : result.value;
  return {
    ok: true,
    points,
    timeZone: null,
    provider: PROVIDER_NAME,
    method: isInverted ? 'inverted-direct-pair' : 'direct-pair',
    derivation: 'direct',
    methodology: 'Frankfurter daily reference rates',
  };
}

/** Test helper: clears module state. */
export function _resetFrankfurterCache() {
  responseCache.clear();
}
