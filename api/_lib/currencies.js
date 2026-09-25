/**
 * api/_lib/currencies.js
 *
 * Single source of truth for the currencies BetterRate supports.
 * Shared by the serverless API (validation) and the frontend (selectors, labels).
 *
 * displayRank is an ordering convention (not market data), roughly by unit value:
 * a pair is always quoted as "1 <lower rank> = X <higher rank>" so that rates read as
 * numbers >= 1, matching the original "1 SGD = X VND" presentation. Providers also
 * request that direction upstream and invert for the reverse pair: Alpha Vantage returns
 * inaccurate quotes for some small-unit bases (e.g. VND -> SGD) and Frankfurter rounds to
 * 5 decimal places (JPY -> SGD = 0.00808 vs SGD -> JPY = 123.83).
 *
 * Only list a currency here once its provider (see api/_lib/providers) has been verified
 * to return usable current and historical data: Alpha Vantage for VND pairs, Frankfurter
 * for all other pairs. Array order is the dropdown order.
 */

export const BRIDGE_CURRENCY = 'USD';

export const SUPPORTED_CURRENCIES = Object.freeze([
  { code: 'SGD', name: 'Singapore Dollar', plural: 'Singapore Dollars', symbol: 'S$', minorUnits: 2, displayRank: 4 },
  { code: 'EUR', name: 'Euro', plural: 'Euros', symbol: '€', minorUnits: 2, displayRank: 2 },
  { code: 'GBP', name: 'British Pound', plural: 'British Pounds', symbol: '£', minorUnits: 2, displayRank: 1 },
  { code: 'JPY', name: 'Japanese Yen', plural: 'Japanese Yen', symbol: '¥', minorUnits: 0, displayRank: 8 },
  { code: 'AUD', name: 'Australian Dollar', plural: 'Australian Dollars', symbol: 'A$', minorUnits: 2, displayRank: 5 },
  { code: 'MYR', name: 'Malaysian Ringgit', plural: 'Malaysian Ringgit', symbol: 'RM', minorUnits: 2, displayRank: 6 },
  { code: 'THB', name: 'Thai Baht', plural: 'Thai Baht', symbol: '฿', minorUnits: 2, displayRank: 7 },
  { code: 'USD', name: 'US Dollar', plural: 'US Dollars', symbol: 'US$', minorUnits: 2, displayRank: 3 },
  { code: 'VND', name: 'Vietnamese Dong', plural: 'Vietnamese Dong', symbol: '₫', minorUnits: 0, displayRank: 9 },
]);

/**
 * Implemented but not offered to users until verified (see above). Move entries into
 * SUPPORTED_CURRENCIES only after scripts/verify-live.mjs passes for them.
 */
export const PENDING_VERIFICATION_CURRENCIES = Object.freeze([]);

const BY_CODE = new Map(SUPPORTED_CURRENCIES.map((c) => [c.code, c]));

export function getCurrency(code) {
  return BY_CODE.get(code) || null;
}

export function isSupportedCurrency(code) {
  return typeof code === 'string' && BY_CODE.has(code);
}

/**
 * The market quote for a pair: "1 base = X quote", base being the currency with the
 * lower displayRank (higher unit value), e.g. SGD/VND -> 1 SGD = X VND.
 * Both directions of a pair share the same quote.
 */
export function getMarketQuote(a, b) {
  return getCurrency(a).displayRank <= getCurrency(b).displayRank
    ? { base: a, quote: b }
    : { base: b, quote: a };
}

/**
 * Validates a raw from/to pair (e.g. from query parameters).
 * Accepts only single string values; normalizes case and whitespace.
 *
 * @returns {{ ok: true, from: string, to: string } | { ok: false, code: 'INVALID_PAIR' | 'UNSUPPORTED_CURRENCY', message: string }}
 */
export function validatePair(rawFrom, rawTo) {
  if (typeof rawFrom !== 'string' || typeof rawTo !== 'string') {
    return { ok: false, code: 'INVALID_PAIR', message: 'Please choose both a currency you have and a currency you want.' };
  }

  const from = rawFrom.trim().toUpperCase();
  const to = rawTo.trim().toUpperCase();

  if (!isSupportedCurrency(from) || !isSupportedCurrency(to)) {
    return { ok: false, code: 'UNSUPPORTED_CURRENCY', message: 'This currency is not supported yet. Please choose a currency from the list.' };
  }

  if (from === to) {
    return { ok: false, code: 'INVALID_PAIR', message: 'Please choose two different currencies.' };
  }

  return { ok: true, from, to };
}
