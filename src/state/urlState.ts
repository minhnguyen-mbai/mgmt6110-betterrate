import { BenchmarkType, CurrencyCode } from '../types';
import { SUPPORTED_CURRENCIES } from '../data/currencies';

/**
 * URL contract for a comparison: ?have=VND&want=SGD&benchmark=7d
 *
 * Only the comparison intent is stored; rates, benchmarks, timestamps and errors always come
 * from the API when the comparison loads. A comparison is accepted only as a whole: both
 * currencies supported and different, and a known benchmark (codes are case-insensitive).
 * Otherwise the three parameters are ignored together. Other query parameters are kept.
 */

export interface ComparisonSelection {
  haveCurrency: CurrencyCode;
  wantCurrency: CurrencyCode;
  benchmark: BenchmarkType;
}

const KEYS = ['have', 'want', 'benchmark'] as const;
const BENCHMARKS: ReadonlyArray<string> = ['7d', '30d'] satisfies BenchmarkType[];
const CODES: ReadonlySet<string> = new Set(SUPPORTED_CURRENCIES.map((c) => c.code));

export function parseSelection(search: string): ComparisonSelection | null {
  const params = new URLSearchParams(search);
  const have = params.get('have')?.trim().toUpperCase();
  const want = params.get('want')?.trim().toUpperCase();
  const benchmark = params.get('benchmark')?.trim().toLowerCase();
  if (!have || !want || !benchmark) return null;
  if (!CODES.has(have) || !CODES.has(want) || have === want || !BENCHMARKS.includes(benchmark)) return null;
  return { haveCurrency: have as CurrencyCode, wantCurrency: want as CurrencyCode, benchmark: benchmark as BenchmarkType };
}

export function hasSelectionParams(search: string): boolean {
  const params = new URLSearchParams(search);
  return KEYS.some((key) => params.has(key));
}

/** The query string with the canonical comparison parameters first (or none), other parameters kept. */
export function searchWithSelection(search: string, selection: ComparisonSelection | null): string {
  const params = new URLSearchParams(search);
  KEYS.forEach((key) => params.delete(key));
  const ours = selection
    ? `have=${selection.haveCurrency}&want=${selection.wantCurrency}&benchmark=${selection.benchmark}`
    : '';
  const query = [ours, params.toString()].filter(Boolean).join('&');
  return query ? `?${query}` : '';
}

export interface LocationLike {
  pathname: string;
  search: string;
  hash: string;
}

export interface HistoryLike {
  pushState(data: unknown, unused: string, url: string): void;
  replaceState(data: unknown, unused: string, url: string): void;
}

/**
 * On page load: rewrites the current entry (never adds one) so that it holds the canonical form
 * of a valid comparison, or no comparison parameters if they were invalid.
 */
export function canonicalizeLocation(location: LocationLike, history: HistoryLike): ComparisonSelection | null {
  const selection = parseSelection(location.search);
  if (!hasSelectionParams(location.search)) return null;
  const search = searchWithSelection(location.search, selection);
  if (search !== location.search) {
    history.replaceState(null, '', `${location.pathname}${search}${location.hash}`);
  }
  return selection;
}

/**
 * A result shown for `selection` gets its own history entry, unless the current entry already is
 * that comparison (e.g. after loading a shared link, going Back/Forward, or comparing again).
 * @returns whether an entry was added
 */
export function recordShownComparison(location: LocationLike, history: HistoryLike, selection: ComparisonSelection): boolean {
  const search = searchWithSelection(location.search, selection);
  if (search === location.search) return false;
  history.pushState(null, '', `${location.pathname}${search}${location.hash}`);
  return true;
}
