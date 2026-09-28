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

  // Wording: descriptive only. The comparison says where today's rate sits relative to the selected
  // average; it does not judge whether converting now is better or worse for the user.
  const position = isUnchanged ? 'in line with' : rawPercentDiff > 0 ? 'above' : 'below';

  // The direction being converted (the pill above the headline)
  const statusText = directionLabel;

  // Headline: the percentage with its basis (above / below / in line with the selected benchmark)
  const headlineComparison = isUnchanged
    ? `Approximately in line with the ${benchmarkName}`
    : `${percentFormatted}% ${position} the ${benchmarkName}`;

  // What that means in plain terms for the displayed quote (1 have = X want)
  const amount = isUnchanged ? 'about the same' : rawPercentDiff > 0 ? 'more' : 'less';
  const benchmarkContext = isUnchanged
    ? `Today’s rate gives about the same ${quote.code} per ${base.code} as the ${benchmarkName}.`
    : `Today’s rate gives ${amount} ${quote.code} per ${base.code} than the ${benchmarkName}.`;

  const explanation = isUnchanged
    ? `Today’s rate (${todayQuote}) is virtually identical to the ${benchmarkName} (${benchmarkQuote}).`
    : `Today’s rate (${todayQuote}) is ${percentFormatted}% ${position} the ${benchmarkName} (${benchmarkQuote}). At this rate, each ${base.name} converts to ${amount} ${quote.plural} than at the ${benchmarkName}.`;

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
    benchmarkContext,
    explanation,
  };
}
