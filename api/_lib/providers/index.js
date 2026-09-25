/**
 * api/_lib/providers/index.js
 *
 * Server-side provider routing. The frontend only ever calls /api/fx-current and
 * /api/fx-history; which upstream serves a pair is decided here:
 *
 *   VND on either side -> Alpha Vantage (keeps the verified VND path: USD cross-rates)
 *   anything else      -> Frankfurter (direct pair, no API key or daily quota)
 */

import * as alphaVantage from './alphaVantage.js';
import * as frankfurter from './frankfurter.js';

export function selectProvider(from, to) {
  return from === 'VND' || to === 'VND' ? alphaVantage : frankfurter;
}

export function getCurrentRate(from, to) {
  return selectProvider(from, to).getCurrentRate(from, to);
}

export function getHistoricalSeries(from, to) {
  return selectProvider(from, to).getHistoricalSeries(from, to);
}
