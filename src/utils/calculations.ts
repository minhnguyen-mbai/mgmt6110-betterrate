import { ComparisonInput, ComparisonResult } from '../types';
import { getCurrencyInfo, getQuotePair } from '../data/currencies';

/**
 * Formats exchange rates to 2 decimal places (or integers if whole).
 * Small rates (below 10, e.g. 1 EUR = 1.49 SGD) use 4 decimal places so that
 * day-to-day differences remain visible.
 * Very small values (below 0.01, e.g. 1 VND = 0.00005097 SGD) use 4 significant digits
 * so they never round to zero.
 */
export function formatRate(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0';
  if (num !== 0 && Math.abs(num) < 0.01) {
    return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 }).format(num);
  }
  const maxDigits = Math.abs(num) < 10 ? 4 : 2;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: maxDigits,
  }).format(num);
}

/**
 * Calculates deterministic rate comparison based on real FX rates.
 *
 * marketTodayRate and marketBenchmarkRate are the fetched market quote "1 base = X quote"
 * (see getQuotePair), e.g. 1 SGD = X VND for both VND -> SGD and SGD -> VND.
 * The result is quoted in the user's direction, "1 have = X want" (e.g. 1 VND = X SGD),
 * by inverting both rates when the user converts into the market base currency.
 */
export function calculateComparison(
  input: ComparisonInput,
  marketTodayRate: number,
  marketBenchmarkRate: number,
  benchmarkName: string
): ComparisonResult {
  const { base: marketBase } = getQuotePair(input.haveCurrency, input.wantCurrency);
  const base = getCurrencyInfo(input.haveCurrency);
  const quote = getCurrencyInfo(input.wantCurrency);

  // Determine direction purely from currency inputs
  const isBuyingBase = input.wantCurrency === marketBase;
  const directionCode = isBuyingBase ? 'BUY_BASE' : 'SELL_BASE';
  const conversion = `converting ${input.haveCurrency} to ${input.wantCurrency}`;
  const directionLabel = `Converting ${input.haveCurrency} to ${input.wantCurrency}`;

  // Quote both rates as "1 have = X want". Inverting both (1 / average for the benchmark)
  // never changes which rate is higher, so the decision is the same in either quote.
  const todayRate = isBuyingBase ? 1 / marketTodayRate : marketTodayRate;
  const benchmarkRate = isBuyingBase ? 1 / marketBenchmarkRate : marketBenchmarkRate;

  // Benchmark difference calculation, in the user's direction (1 have = X want):
  // percentageDifference = (currentRate - benchmarkRate) / benchmarkRate * 100
  // If currentRate > benchmarkRate: "more favorable" (you receive more of the wanted currency per unit)
  // If currentRate < benchmarkRate: "less favorable"
  const rawPercentDiff = Number.isFinite(benchmarkRate) && benchmarkRate > 0
    ? ((todayRate - benchmarkRate) / benchmarkRate) * 100
    : 0;

  const absPercent = Math.abs(rawPercentDiff);
  const percentFormatted = Number(absPercent.toFixed(2));

  // Absolute threshold applies to the market quote, whose scale it was chosen for
  const isUnchanged = percentFormatted === 0 || Math.abs(marketBenchmarkRate - marketTodayRate) < 0.0001;

  let isMoreFavorable = false;
  if (!isUnchanged) {
    isMoreFavorable = rawPercentDiff > 0;
  }

  const rateDifference = benchmarkRate - todayRate;

  const todayQuote = `1 ${base.code} = ${formatRate(todayRate)} ${quote.code}`;
  const benchmarkQuote = `${formatRate(benchmarkRate)} ${quote.code}`;

  // Wording: strictly direction-aware, objective, no forbidden promotional words ("good rate", "best time", etc.)
  let statusText = '';
  let headlineComparison = '';
  let explanation = '';

  if (isUnchanged) {
    statusText = `Approximately unchanged for ${conversion}`;
    headlineComparison = 'Approximately unchanged today';
    explanation = `Today’s rate (${todayQuote}) is virtually identical to the ${benchmarkName} (${benchmarkQuote}). There is almost no rate difference compared with recent rates.`;
  } else if (isMoreFavorable) {
    statusText = `Better for ${conversion}`;
    headlineComparison = `${percentFormatted}% more favorable today`;
    explanation = `Today’s rate (${todayQuote}) is higher than the ${benchmarkName} (${benchmarkQuote}). When ${conversion}, a higher rate means you receive more ${quote.plural} for each ${base.name}.`;
  } else {
    statusText = `Less favorable for ${conversion}`;
    headlineComparison = `${percentFormatted}% less favorable today`;
    explanation = `Today’s rate (${todayQuote}) is lower than the ${benchmarkName} (${benchmarkQuote}). When ${conversion}, a lower rate means you receive less ${quote.plural} for each ${base.name}.`;
  }

  return {
    directionLabel,
    directionCode,
    baseCurrency: input.haveCurrency,
    quoteCurrency: input.wantCurrency,
    benchmarkName,
    todayRate,
    benchmarkRate,
    rateDifference,
    percentDifference: percentFormatted,
    isMoreFavorable,
    isUnchanged,
    statusText,
    headlineComparison,
    explanation,
  };
}
