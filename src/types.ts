export type CurrencyCode = 'VND' | 'SGD';

export type BenchmarkType = '7d' | '30d';

export interface ComparisonInput {
  haveCurrency: CurrencyCode;
  wantCurrency: CurrencyCode;
  benchmark: BenchmarkType;
  amount: number | null; // e.g. 3000 (SGD)
}

export interface ComparisonResult {
  directionLabel: string; // e.g. "Converting VND to SGD" or "Converting SGD to VND"
  directionCode: 'VND_TO_SGD' | 'SGD_TO_VND';
  benchmarkName: string; // "7-day average" or "30-day average"
  todayRate: number; // 19,620
  benchmarkRate: number; // 19,850 or 19,700
  rateDifference: number; // rate difference in VND
  percentDifference: number; // e.g. 1.16
  isMoreFavorable: boolean;
  isUnchanged: boolean;
  statusText: string; // "Better for converting VND to SGD" or "Less favorable for converting SGD to VND"
  headlineComparison: string; // "1.16% more favorable today" or "1.16% less favorable today"
  explanation: string; // plain language rationale
  
  // Monetary difference (if amount is provided)
  amount: number | null;
  amountFormatted: string | null;
  todayTotalVND: number | null;
  todayTotalVNDFormatted: string | null;
  todayTotalVNDCompact: string | null;
  benchmarkTotalVND: number | null;
  benchmarkTotalVNDFormatted: string | null;
  benchmarkTotalVNDCompact: string | null;
  differenceVND: number | null;
  differenceVNDFormatted: string | null;
  differenceVNDCompact: string | null;
  moneyDifferenceText: string | null; // e.g. "About 690K VND less today"
}

export interface DailyRatePoint {
  dayIndex: number;
  dateStr: string;
  rate: number;
  isToday?: boolean;
}
