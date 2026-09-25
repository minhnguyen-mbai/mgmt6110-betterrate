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
  amount: number | null; // e.g. 3000, in units of the pair's base currency
}

export interface ComparisonResult {
  directionLabel: string; // e.g. "Converting VND to SGD" or "Converting SGD to VND"
  // Rates are quoted as "1 base = X quote" (e.g. 1 SGD = X VND).
  // BUY_BASE: paying quote to receive base (e.g. VND -> SGD), a lower rate is more favorable.
  // SELL_BASE: paying base to receive quote (e.g. SGD -> VND), a higher rate is more favorable.
  directionCode: 'BUY_BASE' | 'SELL_BASE';
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode;
  benchmarkName: string; // "7-day average" or "30-day average"
  todayRate: number; // 19,620
  benchmarkRate: number; // 19,850 or 19,700
  rateDifference: number; // rate difference in quote currency
  percentDifference: number; // e.g. 1.16
  isMoreFavorable: boolean;
  isUnchanged: boolean;
  statusText: string; // "Better for converting VND to SGD" or "Less favorable for converting SGD to VND"
  headlineComparison: string; // "1.16% more favorable today" or "1.16% less favorable today"
  explanation: string; // plain language rationale
  
  // Monetary difference (if amount is provided): amount in base currency, totals in quote currency
  amount: number | null;
  amountFormatted: string | null;
  todayTotal: number | null;
  todayTotalFormatted: string | null;
  todayTotalCompact: string | null;
  benchmarkTotal: number | null;
  benchmarkTotalFormatted: string | null;
  benchmarkTotalCompact: string | null;
  difference: number | null;
  differenceFormatted: string | null;
  differenceCompact: string | null;
  moneyDifferenceText: string | null; // e.g. "About 690K VND less today"
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
  | 'invalid_pair';
