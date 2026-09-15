/**
 * api/fx-history.js
 *
 * Fetches Alpha Vantage FX_DAILY for SGD -> VND.
 * Calculates exact calendar-window 7-day and 30-day averages using daily close prices.
 * Returns normalized benchmarks and daily points for trend visualization.
 */

import {
  handleRequestMethod,
  fetchAlphaVantageJson,
  classifyProviderResponse,
  logDiagnostic,
  ERROR_MESSAGES,
} from './_lib/alphavantage.js';

const HISTORY_CACHE_SECONDS = 43200;  // 12 hours
const HISTORY_STALE_SECONDS = 86400;  // 24 additional hours while revalidating

/**
 * Caching decision (human):
 * BetterRate's historical source contains daily closing observations.
 * Historical daily data changes much less frequently than the current-rate
 * endpoint, so a 12-hour shared CDN cache is appropriate and substantially
 * reduces unnecessary upstream requests.
 *
 * Source dates and metadata remain visible so the application does not
 * pretend the history is newer than it actually is.
 */
const MIN_OBSERVATIONS = Object.freeze({
  '7d': 3,
  '30d': 15,
});

function getCalendarStartDate(endStr, dayCount) {
  const [year, month, day] = endStr.split('-').map(Number);
  const endUtc = new Date(Date.UTC(year, month - 1, day));
  const startUtc = new Date(endUtc.getTime() - (dayCount - 1) * 86400000);
  return startUtc.toISOString().slice(0, 10);
}

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

  // 3. Fetch daily historical rates from Alpha Vantage
  const upstreamUrl = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=SGD&to_symbol=VND&outputsize=compact&apikey=${encodeURIComponent(
    cleanKey
  )}`;

  const fetchResult = await fetchAlphaVantageJson(upstreamUrl, 9000);

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

  // 7. Verify Time Series FX (Daily) exists
  const timeSeries = fetchResult.data?.['Time Series FX (Daily)'];
  if (!timeSeries || typeof timeSeries !== 'object') {
    logDiagnostic('EMPTY_DATA', fetchResult.httpStatus);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: ERROR_MESSAGES.EMPTY_DATA,
      code: 'EMPTY_DATA',
    });
  }

  // Extract all valid date keys and sort chronologically (oldest -> newest)
  const allDates = Object.keys(timeSeries)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

  if (allDates.length === 0) {
    logDiagnostic('EMPTY_DATA', fetchResult.httpStatus);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: ERROR_MESSAGES.EMPTY_DATA,
      code: 'EMPTY_DATA',
    });
  }

  // 8. Extract Provider Metadata
  const meta = fetchResult.data?.['Meta Data'] || {};
  const metaRefreshed =
    meta['5. Last Refreshed'] && String(meta['5. Last Refreshed']).trim() !== ''
      ? String(meta['5. Last Refreshed']).trim()
      : null;
  const timeZone =
    meta['6. Time Zone'] && String(meta['6. Time Zone']).trim() !== ''
      ? String(meta['6. Time Zone']).trim()
      : null;

  // Determine latest historical refresh date (YYYY-MM-DD)
  let latestDateStr = allDates[allDates.length - 1];
  if (metaRefreshed) {
    const match = metaRefreshed.match(/^\d{4}-\d{2}-\d{2}/);
    if (match && timeSeries[match[0]]) {
      latestDateStr = match[0];
    }
  }

  // 9. Calculate Calendar Windows
  // 7 calendar days ending on provider's latest historical refresh date (endDate - 6 days)
  const startDate7d = getCalendarStartDate(latestDateStr, 7);
  // 30 calendar days ending on provider's latest historical refresh date (endDate - 29 days)
  const startDate30d = getCalendarStartDate(latestDateStr, 30);

  // Filter valid close observations within the windows
  // ONLY use daily close values ("4. close"). Do NOT use open, high, or low.
  const obs7d = [];
  const obs30d = [];

  for (const dateStr of allDates) {
    const rawEntry = timeSeries[dateStr];
    if (!rawEntry || typeof rawEntry !== 'object') continue;

    const closeNum = parseFloat(rawEntry['4. close']);
    if (isNaN(closeNum) || closeNum <= 0 || !isFinite(closeNum)) continue;

    if (dateStr >= startDate7d && dateStr <= latestDateStr) {
      obs7d.push({ date: dateStr, close: closeNum });
    }
    if (dateStr >= startDate30d && dateStr <= latestDateStr) {
      obs30d.push({ date: dateStr, close: closeNum });
    }
  }

  // Enforce minimum observations quality threshold
  if (obs7d.length < MIN_OBSERVATIONS['7d'] || obs30d.length < MIN_OBSERVATIONS['30d']) {
    logDiagnostic('EMPTY_DATA', fetchResult.httpStatus);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: ERROR_MESSAGES.EMPTY_DATA,
      code: 'EMPTY_DATA',
    });
  }

  // 10. Benchmark averages: divide ONLY by actual valid observation count
  const sum7d = obs7d.reduce((acc, cur) => acc + cur.close, 0);
  const avg7d = sum7d / obs7d.length;

  const sum30d = obs30d.reduce((acc, cur) => acc + cur.close, 0);
  const avg30d = sum30d / obs30d.length;

  // 11. Caching: 12-hour shared CDN cache for daily historical close observations
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Cache-Control',
    `public, max-age=0, s-maxage=${HISTORY_CACHE_SECONDS}, stale-while-revalidate=${HISTORY_STALE_SECONDS}`
  );

  // Return normalized data only
  return res.status(200).json({
    from: 'SGD',
    to: 'VND',
    lastRefreshed: latestDateStr,
    timeZone,
    benchmarks: {
      '7d': {
        average: avg7d,
        observationCount: obs7d.length,
        startDate: startDate7d,
        endDate: latestDateStr,
      },
      '30d': {
        average: avg30d,
        observationCount: obs30d.length,
        startDate: startDate30d,
        endDate: latestDateStr,
      },
    },
    daily: obs30d, // Chronologically sorted points for the 30-day window
  });
}
