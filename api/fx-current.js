/**
 * api/fx-current.js
 *
 * GET /api/fx-current?from=SGD&to=VND
 *
 * Returns the current FROM -> TO exchange rate from the provider selected for the pair
 * (api/_lib/providers: Alpha Vantage for VND pairs, Frankfurter otherwise).
 * Normalizes the response and enforces strict security, method handling, and caching.
 */

import { handleRequestMethod, logDiagnostic } from './_lib/alphavantage.js';
import { validatePair } from './_lib/currencies.js';
import { getCurrentRate } from './_lib/providers/index.js';

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

  // 3. Fetch from the provider selected for this pair (errors are already normalized)
  const result = await getCurrentRate(from, to);
  if (!result.ok) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(result.status).json({ error: result.message, code: result.code });
  }

  // 4. Caching: 2-hour shared CDN cache for decision-support comparison
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Cache-Control',
    `public, max-age=0, s-maxage=${CURRENT_CACHE_SECONDS}, stale-while-revalidate=${CURRENT_STALE_SECONDS}`
  );

  return res.status(200).json({
    from,
    to,
    rate: result.rate,
    lastRefreshed: result.lastRefreshed,
    timeZone: result.timeZone,
    source: result.provider,
    provider: result.provider,
    method: result.method,
  });
}
