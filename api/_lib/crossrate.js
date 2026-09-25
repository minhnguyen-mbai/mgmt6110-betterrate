/**
 * api/_lib/crossrate.js
 *
 * Pure helpers (no I/O) for building historical FROM -> TO daily closes
 * from canonical USD -> currency series, and for the 7-day / 30-day benchmarks.
 *
 * Cross-rate formula (USD bridge):
 *   rate(FROM -> TO) = rate(USD -> TO) / rate(USD -> FROM)
 *   FROM = USD: rate(USD -> TO) directly
 *   TO = USD:   1 / rate(USD -> FROM)
 * Only dates present in both underlying series are combined.
 */

import { BRIDGE_CURRENCY } from './currencies.js';

export const MIN_OBSERVATIONS = Object.freeze({
  '7d': 3,
  '30d': 15,
});

export const DERIVATION_METHODOLOGY = Object.freeze({
  direct: 'Alpha Vantage FX_DAILY',
  inverse: 'Derived cross-rate via USD from Alpha Vantage FX_DAILY',
  cross: 'Derived cross-rate via USD from Alpha Vantage FX_DAILY',
});

function isValidRate(value) {
  return typeof value === 'number' && isFinite(value) && value > 0;
}

/**
 * Extracts valid daily closes from an Alpha Vantage FX_DAILY payload.
 * Drops malformed dates and zero / negative / non-numeric closes
 * (e.g. values rounded to "0.00000").
 *
 * @returns {{ closes: Record<string, number>, timeZone: string | null } | null}
 */
export function parseDailyCloses(data) {
  const timeSeries = data?.['Time Series FX (Daily)'];
  if (!timeSeries || typeof timeSeries !== 'object') {
    return null;
  }

  const closes = {};
  for (const [dateStr, entry] of Object.entries(timeSeries)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    if (!entry || typeof entry !== 'object') continue;
    const closeNum = parseFloat(entry['4. close']);
    if (!isValidRate(closeNum)) continue;
    closes[dateStr] = closeNum;
  }

  if (Object.keys(closes).length === 0) {
    return null;
  }

  const meta = data?.['Meta Data'] || {};
  const timeZone =
    meta['6. Time Zone'] && String(meta['6. Time Zone']).trim() !== ''
      ? String(meta['6. Time Zone']).trim()
      : null;

  return { closes, timeZone };
}

/**
 * Which USD -> currency series are needed for a FROM -> TO pair.
 * @returns {string[]} currency codes (never USD itself)
 */
export function requiredUsdSeries(from, to) {
  return [from, to].filter((code) => code !== BRIDGE_CURRENCY);
}

/**
 * @returns {'direct' | 'inverse' | 'cross'}
 */
export function getDerivation(from, to) {
  if (from === BRIDGE_CURRENCY) return 'direct';
  if (to === BRIDGE_CURRENCY) return 'inverse';
  return 'cross';
}

/**
 * Derives chronologically sorted FROM -> TO daily closes.
 *
 * @param {string} from
 * @param {string} to
 * @param {Record<string, Record<string, number>>} usdCloses map of code -> { date: USD->code close }
 * @returns {Array<{ date: string, close: number }>}
 */
export function deriveDailyCloses(from, to, usdCloses) {
  const derivation = getDerivation(from, to);
  const fromSeries = from === BRIDGE_CURRENCY ? null : usdCloses[from];
  const toSeries = to === BRIDGE_CURRENCY ? null : usdCloses[to];

  let dates;
  if (derivation === 'direct') {
    if (!toSeries) return [];
    dates = Object.keys(toSeries);
  } else if (derivation === 'inverse') {
    if (!fromSeries) return [];
    dates = Object.keys(fromSeries);
  } else {
    if (!fromSeries || !toSeries) return [];
    dates = Object.keys(toSeries).filter((d) => Object.prototype.hasOwnProperty.call(fromSeries, d));
  }

  const points = [];
  for (const date of dates.sort()) {
    const usdToFrom = fromSeries ? fromSeries[date] : 1;
    const usdToTo = toSeries ? toSeries[date] : 1;
    if (!isValidRate(usdToFrom) || !isValidRate(usdToTo)) continue;

    const close = usdToTo / usdToFrom;
    if (!isValidRate(close)) continue;
    points.push({ date, close });
  }
  return points;
}

export function getCalendarStartDate(endStr, dayCount) {
  const [year, month, day] = endStr.split('-').map(Number);
  const endUtc = new Date(Date.UTC(year, month - 1, day));
  const startUtc = new Date(endUtc.getTime() - (dayCount - 1) * 86400000);
  return startUtc.toISOString().slice(0, 10);
}

/**
 * Today's date in UTC (YYYY-MM-DD), the time zone both providers use for daily dates.
 */
export function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/**
 * Exact calendar-window 7-day and 30-day averages of daily closes, ending on the
 * latest observation BEFORE today. Today's observation is excluded for every provider,
 * so the benchmarks compare the current rate with prior days only (a provider such as
 * Frankfurter publishes today's rate in its history, which would otherwise be averaged
 * against itself). Only real observations are used; nothing is filled in.
 * Divides only by the actual valid observation count.
 *
 * @param {Array<{ date: string, close: number }>} points chronologically sorted
 * @param {string} [today] YYYY-MM-DD; observations on or after this date are excluded
 * @returns {null | {
 *   lastRefreshed: string,
 *   benchmarks: Record<'7d' | '30d', { average: number, observationCount: number, startDate: string, endDate: string }>,
 *   daily: Array<{ date: string, close: number }>
 * }} null when there are not enough observations
 */
export function computeBenchmarks(points, today = todayUtc()) {
  const prior = (points || []).filter((p) => p.date < today);
  if (prior.length === 0) return null;

  const latestDateStr = prior[prior.length - 1].date;
  const startDate7d = getCalendarStartDate(latestDateStr, 7);
  const startDate30d = getCalendarStartDate(latestDateStr, 30);

  const obs7d = prior.filter((p) => p.date >= startDate7d && p.date <= latestDateStr);
  const obs30d = prior.filter((p) => p.date >= startDate30d && p.date <= latestDateStr);

  if (obs7d.length < MIN_OBSERVATIONS['7d'] || obs30d.length < MIN_OBSERVATIONS['30d']) {
    return null;
  }

  const avg = (arr) => arr.reduce((acc, cur) => acc + cur.close, 0) / arr.length;

  return {
    lastRefreshed: latestDateStr,
    benchmarks: {
      '7d': {
        average: avg(obs7d),
        observationCount: obs7d.length,
        startDate: startDate7d,
        endDate: latestDateStr,
      },
      '30d': {
        average: avg(obs30d),
        observationCount: obs30d.length,
        startDate: startDate30d,
        endDate: latestDateStr,
      },
    },
    daily: obs30d,
  };
}
