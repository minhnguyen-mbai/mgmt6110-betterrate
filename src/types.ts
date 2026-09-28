// Currencies offered to users (keep in sync with SUPPORTED_CURRENCIES in api/_lib/currencies.js)
export type CurrencyCode = 'SGD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'MYR' | 'THB' | 'USD' | 'VND';

export interface CurrencyInfo {
  code: CurrencyCode;
  name: string;
  plural: string;
  symbol: string;
  minorUnits: number;
  displayRank: number;
}

export type BenchmarkType = '7d' | '30d';

export interface ComparisonInput {
  haveCurrency: CurrencyCode;
  wantCurrency: CurrencyCode;
  benchmark: BenchmarkType;
}

export interface ComparisonResult {
  directionLabel: string; // e.g. "Converting VND to SGD" or "Converting SGD to VND"
  // Rates are quoted in the user's direction, "1 base = X quote" with base = have and
  // quote = want (e.g. VND -> SGD: 1 VND = X SGD); a higher rate is more favorable.
  // directionCode is relative to the fetched market quote (e.g. 1 SGD = X VND):
  // BUY_BASE: receiving the market base (e.g. VND -> SGD), so the market rates were inverted.
  // SELL_BASE: paying the market base (e.g. SGD -> VND), so the market rates are shown as-is.
  directionCode: 'BUY_BASE' | 'SELL_BASE';
  baseCurrency: CurrencyCode; // the currency you have
  quoteCurrency: CurrencyCode; // the currency you want
  benchmarkName: string; // "7-day average" or "30-day average"
  todayRate: number; // e.g. 1 VND = 0.00005097 SGD
  benchmarkRate: number; // same direction as todayRate
  rateDifference: number; // benchmarkRate - todayRate, in quote currency per base unit
  percentDifference: number; // e.g. 1.16
  isMoreFavorable: boolean; // today's displayed rate is above the benchmark (and not unchanged); drives the card's styling only
  isUnchanged: boolean;
  statusText: string; // the direction being converted, e.g. "Converting VND to SGD"
  headlineComparison: string; // "1.16% above the 7-day average", "… below …" or "Approximately in line with the 7-day average"
  benchmarkContext: string; // "Today’s rate gives more SGD per VND than the 7-day average." (or "less", or "about the same … as")
  explanation: string; // plain language rationale
}

export interface DailyRatePoint {
  dayIndex: number;
  dateStr: string;
  rate: number;
  isToday?: boolean;
}

export interface FxCurrentData {
  from: string;
  to: string;
  rate: number;
  lastRefreshed: string | null;
  timeZone: string | null;
  source?: string;
  provider?: string;
  method?: string;
}

export interface BenchmarkDetail {
  average: number;
  observationCount: number;
  startDate: string;
  endDate: string;
}

export interface FxHistoryData {
  from: string;
  to: string;
  lastRefreshed: string;
  timeZone: string | null;
  source?: string;
  provider?: string;
  method?: string;
  derivation?: 'direct' | 'inverse' | 'cross';
  methodology?: string;
  benchmarks: {
    '7d': BenchmarkDetail;
    '30d': BenchmarkDetail;
  };
  daily: Array<{
    date: string;
    close: number;
  }>;
}

export type FxDataStatus =
  | 'loading'
  | 'success'
  | 'empty_data'
  | 'provider_error'
  | 'provider_unreachable'
  | 'provider_rate_limit'
  | 'invalid_pair'
  | 'pair_unavailable';
