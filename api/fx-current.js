/**
 * api/fx-current.js
 *
 * Fetches the real-time SGD -> VND exchange rate from Alpha Vantage.
 * Normalizes the response and enforces strict security, method handling, and caching.
 */

import {
  handleRequestMethod,
  fetchAlphaVantageJson,
  classifyProviderResponse,
  logDiagnostic,
  ERROR_MESSAGES,
} from './_lib/alphavantage.js';

const CURRENT_CACHE_SECONDS = 7200;   // 2 hours
const CURRENT_STALE_SECONDS = 14400;  // 4 additional hours while revalidating

/**
 * Caching decision (human):
 * BetterRate is a decision-support product comparing the current FX rate
 * with daily historical averages, not a trading terminal.
 *
 * A 2-hour shared CDN cache substantially reduces unnecessary upstream
 * requests while remaining appropriate for this use case.
 *
 * The provider's lastRefreshed timestamp remains in the API response so
 * data freshness stays visible rather than being hidden.
 */
export default async function handler(req, res) {
  // 1. Method handling: HEAD returns 200 immediately without contacting provider; non-GET/HEAD returns 405
  if (!handleRequestMethod(req, res)) {
    return;
  }

  // 2. Verify ALPHAVANTAGE_API_KEY is configured
  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    logDiagnostic('KEY_MISSING');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({
      error: ERROR_MESSAGES.KEY_MISSING,
      code: 'KEY_MISSING',
    });
  }

  const cleanKey = apiKey.trim();

  // 3. Fetch current SGD -> VND rate from Alpha Vantage
  const upstreamUrl = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=SGD&to_currency=VND&apikey=${encodeURIComponent(
    cleanKey
  )}`;

  const fetchResult = await fetchAlphaVantageJson(upstreamUrl, 8000);

  // 4. Handle network unreachable / timeout
  if (fetchResult.httpStatus === null) {
    logDiagnostic('PROVIDER_UNREACHABLE');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: ERROR_MESSAGES.PROVIDER_UNREACHABLE,
      code: 'PROVIDER_UNREACHABLE',
    });
  }

  // 5. Validate HTTP status
  if (!fetchResult.ok) {
    logDiagnostic('PROVIDER_ERROR', fetchResult.httpStatus);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: ERROR_MESSAGES.PROVIDER_ERROR,
      code: 'PROVIDER_ERROR',
    });
  }

  if (fetchResult.code === 'PROVIDER_ERROR' && fetchResult.providerCheck === 'unexpected_response') {
    logDiagnostic('PROVIDER_ERROR', fetchResult.httpStatus);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: ERROR_MESSAGES.PROVIDER_ERROR,
      code: 'PROVIDER_ERROR',
    });
  }

  // 6. Detect provider-specific limitation and refusal messages
  const classification = classifyProviderResponse(fetchResult.data);
  if (classification) {
    logDiagnostic(classification.code, fetchResult.httpStatus);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(classification.status).json({
      error: classification.message,
      code: classification.code,
    });
  }

  // 7. Verify expected response object exists
  const rawRateObj = fetchResult.data?.['Realtime Currency Exchange Rate'];
  if (!rawRateObj || typeof rawRateObj !== 'object') {
    logDiagnostic('EMPTY_DATA', fetchResult.httpStatus);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: ERROR_MESSAGES.EMPTY_DATA,
      code: 'EMPTY_DATA',
    });
  }

  // 8. Extract and validate rate number
  const rawRateStr = rawRateObj['5. Exchange Rate'];
  const numericRate = parseFloat(rawRateStr);

  if (isNaN(numericRate) || numericRate <= 0 || !isFinite(numericRate)) {
    logDiagnostic('INVALID_RATE', fetchResult.httpStatus);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: ERROR_MESSAGES.INVALID_RATE,
      code: 'INVALID_RATE',
    });
  }

  // 9. Extract metadata without inventing timestamps
  const lastRefreshed =
    rawRateObj['6. Last Refreshed'] && String(rawRateObj['6. Last Refreshed']).trim() !== ''
      ? String(rawRateObj['6. Last Refreshed']).trim()
      : null;

  const timeZone =
    rawRateObj['7. Time Zone'] && String(rawRateObj['7. Time Zone']).trim() !== ''
      ? String(rawRateObj['7. Time Zone']).trim()
      : null;

  // 10. Caching: 2-hour shared CDN cache for decision-support comparison
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Cache-Control',
    `public, max-age=0, s-maxage=${CURRENT_CACHE_SECONDS}, stale-while-revalidate=${CURRENT_STALE_SECONDS}`
  );

  return res.status(200).json({
    from: 'SGD',
    to: 'VND',
    rate: numericRate,
    lastRefreshed,
    timeZone,
  });
}
