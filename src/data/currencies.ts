import { CurrencyCode, CurrencyInfo } from '../types';
// Shared with the API so the frontend never offers a currency the backend rejects.
import { SUPPORTED_CURRENCIES as SHARED_CURRENCIES, getMarketQuote } from '../../api/_lib/currencies.js';

export const SUPPORTED_CURRENCIES = SHARED_CURRENCIES as ReadonlyArray<CurrencyInfo>;

const BY_CODE = new Map<CurrencyCode, CurrencyInfo>(SUPPORTED_CURRENCIES.map((c) => [c.code, c]));

export function getCurrencyInfo(code: CurrencyCode): CurrencyInfo {
  const info = BY_CODE.get(code);
  if (!info) {
    throw new Error(`Unsupported currency: ${code}`);
  }
  return info;
}

/**
 * The market quote used for a pair: "1 base = X quote", with base being the currency
 * of higher unit value by display convention (e.g. SGD/VND -> 1 SGD = X VND).
 * Both directions of a pair share the same quote.
 */
export function getQuotePair(a: CurrencyCode, b: CurrencyCode): { base: CurrencyCode; quote: CurrencyCode } {
  return getMarketQuote(a, b) as { base: CurrencyCode; quote: CurrencyCode };
}
