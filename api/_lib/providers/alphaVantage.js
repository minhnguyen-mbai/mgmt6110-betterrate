/**
 * api/_lib/providers/alphaVantage.js
 *
 * Alpha Vantage provider (used for VND pairs, see providers/index.js).
 *
 * Current rate: CURRENCY_EXCHANGE_RATE, requested in the pair's market direction
 * (higher-value currency first, e.g. SGD -> VND) and inverted for the reverse request,
 * because Alpha Vantage returns inaccurate quotes for some small-unit bases (e.g. VND -> SGD).
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
} from '../alphavantage.js';
import { getMarketQuote } from '../currencies.js';
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
  const upstreamUrl = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${base}&to_currency=${quote}&apikey=${encodeURIComponent(
    apiKey
  )}`;

  const fetchResult = await fetchAlphaVantageJsonWithBurstRetry(upstreamUrl, 8000);

  // Network unreachable / timeout
  if (fetchResult.httpStatus === null) {
    return failure('PROVIDER_UNREACHABLE');
  }

  // HTTP status and unparseable responses
  if (!fetchResult.ok || fetchResult.providerCheck === 'unexpected_response') {
    return failure('PROVIDER_ERROR', fetchResult.httpStatus);
  }

  // Provider-specific limitation and refusal messages
  const classification = classifyProviderResponse(fetchResult.data);
  if (classification) {
    return failure(classification.code, fetchResult.httpStatus, classification.status, classification.message);
  }

  const rawRateObj = fetchResult.data?.['Realtime Currency Exchange Rate'];
  if (!rawRateObj || typeof rawRateObj !== 'object') {
    return failure('EMPTY_DATA', fetchResult.httpStatus);
  }

  const marketRate = parseFloat(rawRateObj['5. Exchange Rate']);
  const rate = isInverted ? 1 / marketRate : marketRate;
  if (isNaN(marketRate) || marketRate <= 0 || !isFinite(marketRate) || !isFinite(rate)) {
    return failure('INVALID_RATE', fetchResult.httpStatus);
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

  return {
    ok: true,
    rate,
    lastRefreshed,
    timeZone,
    provider: PROVIDER_NAME,
    method: isInverted ? 'inverted-market-quote' : 'market-quote',
  };
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
