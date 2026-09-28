/**
 * api/_lib/providers/alphaVantage.js
 *
 * Alpha Vantage provider (used for VND pairs, see providers/index.js).
 *
 * Current rate: CURRENCY_EXCHANGE_RATE, requested in the pair's market direction
 * (higher-value currency first, e.g. SGD -> VND) and inverted for the reverse request,
 * because Alpha Vantage returns inaccurate quotes for some small-unit bases (e.g. VND -> SGD).
 * When the market quote is answered without a usable rate (e.g. AUD -> VND), the rate is
 * derived from the USD -> currency quotes instead (see getCurrentRate).
 *
 * History: USD cross-rates from canonical FX_DAILY USD -> currency series
 * (direct FX_DAILY is unavailable for pairs such as SGD -> VND, and tiny direct
 * values such as VND -> SGD are rounded to 0.00000). Series are cached, fetched
 * sequentially and spaced by api/_lib/usdSeries.js.
 *
 * Both functions return normalized results; failures carry a BetterRate error code.
 */

import {
  fetchAlphaVantageJsonWithBurstRetry,
  classifyProviderResponse,
  logDiagnostic,
  ERROR_MESSAGES,
  BURST_RETRY_DELAY_MS,
} from '../alphavantage.js';
import { getMarketQuote, BRIDGE_CURRENCY } from '../currencies.js';
import { requiredUsdSeries, getDerivation, deriveDailyCloses, DERIVATION_METHODOLOGY } from '../crossrate.js';
import { getUsdSeries } from '../usdSeries.js';

export const PROVIDER_NAME = 'Alpha Vantage';

const HISTORY_METHOD = Object.freeze({
  direct: 'usd-series',
  inverse: 'inverse-usd-series',
  cross: 'cross-rate-via-usd',
});

function failure(code, httpStatus = null, status = 502, message = ERROR_MESSAGES[code]) {
  logDiagnostic(code, httpStatus);
  return { ok: false, code, status, message };
}

function getApiKey() {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    return null;
  }
  return apiKey.trim();
}

/**
 * Fetches one CURRENCY_EXCHANGE_RATE quote (1 base = X quote).
 * A failure is marked `answered` when the provider replied normally but gave no usable
 * rate for the pair (an "Error Message", a non-limit notice, no rate, or an invalid rate),
 * as opposed to a transient problem (unreachable, HTTP error, rate limit).
 *
 * @returns {Promise<
 *   | { ok: true, rate: number, lastRefreshed: string | null, timeZone: string | null }
 *   | { ok: false, code: string, status: number, message: string, answered: boolean }
 * >}
 */
async function fetchRealtimeQuote(base, quote, apiKey) {
  const upstreamUrl = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${base}&to_currency=${quote}&apikey=${encodeURIComponent(
    apiKey
  )}`;

  const fetchResult = await fetchAlphaVantageJsonWithBurstRetry(upstreamUrl, 8000);

  // Network unreachable / timeout
  if (fetchResult.httpStatus === null) {
    return { ...failure('PROVIDER_UNREACHABLE'), answered: false };
  }

  // HTTP status and unparseable responses
  if (!fetchResult.ok || fetchResult.providerCheck === 'unexpected_response') {
    return { ...failure('PROVIDER_ERROR', fetchResult.httpStatus), answered: false };
  }

  // Provider-specific limitation and refusal messages
  const classification = classifyProviderResponse(fetchResult.data);
  if (classification) {
    return {
      ...failure(classification.code, fetchResult.httpStatus, classification.status, classification.message),
      answered: classification.code !== 'PROVIDER_RATE_LIMIT',
    };
  }

  const rawRateObj = fetchResult.data?.['Realtime Currency Exchange Rate'];
  if (!rawRateObj || typeof rawRateObj !== 'object') {
    return { ...failure('EMPTY_DATA', fetchResult.httpStatus), answered: true };
  }

  const rate = parseFloat(rawRateObj['5. Exchange Rate']);
  if (isNaN(rate) || rate <= 0 || !isFinite(rate)) {
    return { ...failure('INVALID_RATE', fetchResult.httpStatus), answered: true };
  }

  // Metadata without inventing timestamps
  const lastRefreshed =
    rawRateObj['6. Last Refreshed'] && String(rawRateObj['6. Last Refreshed']).trim() !== ''
      ? String(rawRateObj['6. Last Refreshed']).trim()
      : null;
  const timeZone =
    rawRateObj['7. Time Zone'] && String(rawRateObj['7. Time Zone']).trim() !== ''
      ? String(rawRateObj['7. Time Zone']).trim()
      : null;

  return { ok: true, rate, lastRefreshed, timeZone };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Current FROM -> TO rate via the USD bridge, the same formula as the history
 * (api/_lib/crossrate.js): rate(FROM -> TO) = rate(USD -> TO) / rate(USD -> FROM).
 * The legs are fetched one at a time, spaced for the free tier's 1 request per second.
 * lastRefreshed is the older of the two legs, so the result is never presented as newer
 * than its oldest input.
 */
async function getCurrentRateViaUsd(from, to, apiKey) {
  const legs = {};
  for (const code of requiredUsdSeries(from, to)) {
    await sleep(BURST_RETRY_DELAY_MS);
    const leg = await fetchRealtimeQuote(BRIDGE_CURRENCY, code, apiKey);
    if (!leg.ok) return leg;
    legs[code] = leg;
  }

  const usdToFrom = from === BRIDGE_CURRENCY ? 1 : legs[from].rate;
  const usdToTo = to === BRIDGE_CURRENCY ? 1 : legs[to].rate;
  const rate = usdToTo / usdToFrom;
  if (!isFinite(rate) || rate <= 0) {
    return { ...failure('INVALID_RATE'), answered: true };
  }

  const values = Object.values(legs);
  const stamps = values.map((l) => l.lastRefreshed);
  const zones = new Set(values.map((l) => l.timeZone));
  return {
    ok: true,
    rate,
    lastRefreshed: stamps.includes(null) ? null : [...stamps].sort()[0] ?? null,
    timeZone: zones.size === 1 ? values[0]?.timeZone ?? null : null,
  };
}

/**
 * Current rate: the pair's market quote first (unchanged, e.g. SGD -> VND). Alpha Vantage
 * answers some VND market quotes (e.g. AUD -> VND, THB -> VND) without a usable rate; only
 * then is the rate derived via USD. Transient failures (unreachable, rate limit, HTTP errors)
 * are returned as-is, without further upstream calls. If the bridge is also answered without
 * a usable rate, the pair is reported as unavailable (PAIR_UNAVAILABLE).
 *
 * @returns {Promise<
 *   | { ok: true, rate: number, lastRefreshed: string | null, timeZone: string | null, provider: string, method: string }
 *   | { ok: false, code: string, status: number, message: string }
 * >}
 */
export async function getCurrentRate(from, to) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return failure('KEY_MISSING', null, 503);
  }

  const { base, quote } = getMarketQuote(from, to);
  const isInverted = base !== from;

  const direct = await fetchRealtimeQuote(base, quote, apiKey);
  if (direct.ok) {
    const rate = isInverted ? 1 / direct.rate : direct.rate;
    if (!isFinite(rate)) {
      return failure('INVALID_RATE');
    }
    return {
      ok: true,
      rate,
      lastRefreshed: direct.lastRefreshed,
      timeZone: direct.timeZone,
      provider: PROVIDER_NAME,
      method: isInverted ? 'inverted-market-quote' : 'market-quote',
    };
  }
  if (!direct.answered) {
    return withoutAnswered(direct);
  }
  if (base === BRIDGE_CURRENCY || quote === BRIDGE_CURRENCY) {
    // Already a USD quote: there is no other route to this rate
    return failure('PAIR_UNAVAILABLE');
  }

  const bridged = await getCurrentRateViaUsd(from, to, apiKey);
  if (bridged.ok) {
    return { ...bridged, provider: PROVIDER_NAME, method: 'cross-rate-via-usd' };
  }
  return bridged.answered ? failure('PAIR_UNAVAILABLE') : withoutAnswered(bridged);
}

function withoutAnswered({ answered, ...rest }) {
  return rest;
}

/**
 * @returns {Promise<
 *   | { ok: true, points: Array<{ date: string, close: number }>, timeZone: string | null, provider: string, method: string, derivation: string, methodology: string }
 *   | { ok: false, code: string, status: number, message: string }
 * >}
 */
export async function getHistoricalSeries(from, to) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return failure('KEY_MISSING', null, 503);
  }

  // Load the required USD -> currency series one at a time (never in parallel).
  // Stop at the first failure; only the per-second burst notice is retried (once).
  const usdCloses = {};
  let timeZone = null;
  for (const code of requiredUsdSeries(from, to)) {
    const series = await getUsdSeries(code, apiKey);
    if (!series.ok) {
      return series;
    }
    usdCloses[code] = series.closes;
    timeZone = timeZone || series.timeZone;
  }

  const derivation = getDerivation(from, to);
  return {
    ok: true,
    points: deriveDailyCloses(from, to, usdCloses),
    timeZone,
    provider: PROVIDER_NAME,
    method: HISTORY_METHOD[derivation],
    derivation,
    methodology: DERIVATION_METHODOLOGY[derivation],
  };
}
