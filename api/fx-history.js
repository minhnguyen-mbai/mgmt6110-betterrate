/**
 * api/fx-history.js
 *
 * GET /api/fx-history?from=SGD&to=VND
 *
 * Returns FROM -> TO daily observations from the provider selected for the pair
 * (api/_lib/providers: Alpha Vantage USD cross-rates for VND pairs, Frankfurter otherwise),
 * with exact calendar-window 7-day and 30-day averages of the daily rates.
 */

import { handleRequestMethod, logDiagnostic, ERROR_MESSAGES } from './_lib/alphavantage.js';
import { validatePair } from './_lib/currencies.js';
import { computeBenchmarks } from './_lib/crossrate.js';
import { getHistoricalSeries } from './_lib/providers/index.js';

const HISTORY_CACHE_SECONDS = 43200;  // 12 hours
const HISTORY_STALE_SECONDS = 86400;  // 24 additional hours while revalidating

/**
 * Caching decision (human):
 * BetterRate's historical source contains daily closing observations.
 * Historical daily data changes much less frequently than the current-rate
 * endpoint, so a 12-hour shared CDN cache is appropriate and substantially
 * reduces unnecessary upstream requests.
 *
 * Providers additionally cache their successful upstream responses in memory
 * (Alpha Vantage: reusable USD -> currency series).
 *
 * Source dates and metadata remain visible so the application does not
 * pretend the history is newer than it actually is.
 */
export default async function handler(req, res) {
  // 1. Method handling: HEAD returns 200 immediately without contacting provider; non-GET/HEAD returns 405
  if (!handleRequestMethod(req, res)) {
    return;
  }

  // 2. Validate the requested pair before touching any provider.
  //    No parameters at all keeps the original SGD -> VND behavior.
  const query = req.query || {};
  const noPairGiven = query.from === undefined && query.to === undefined;
  const pair = noPairGiven ? validatePair('SGD', 'VND') : validatePair(query.from, query.to);
  if (!pair.ok) {
    logDiagnostic(pair.code);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ error: pair.message, code: pair.code });
  }
  const { from, to } = pair;

  // 3. Fetch normalized daily observations from the provider selected for this pair
  const series = await getHistoricalSeries(from, to);
  if (!series.ok) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(series.status).json({ error: series.message, code: series.code });
  }

  // 4. Calculate benchmarks (same methodology for every provider)
  const result = computeBenchmarks(series.points);
  if (!result) {
    logDiagnostic('EMPTY_DATA');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: ERROR_MESSAGES.EMPTY_DATA,
      code: 'EMPTY_DATA',
    });
  }

  // 5. Caching: 12-hour shared CDN cache for daily historical observations
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Cache-Control',
    `public, max-age=0, s-maxage=${HISTORY_CACHE_SECONDS}, stale-while-revalidate=${HISTORY_STALE_SECONDS}`
  );

  // Return normalized data only
  return res.status(200).json({
    from,
    to,
    lastRefreshed: result.lastRefreshed,
    timeZone: series.timeZone,
    source: series.provider,
    provider: series.provider,
    method: series.method,
    derivation: series.derivation,
    methodology: series.methodology,
    benchmarks: result.benchmarks,
    daily: result.daily, // Chronologically sorted points for the 30-day window
  });
}
