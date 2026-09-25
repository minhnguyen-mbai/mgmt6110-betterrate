import { ComparisonInput, ComparisonResult } from '../types';
import { getCurrencyInfo, getQuotePair } from '../data/currencies';

/**
 * Formats exchange rates to 2 decimal places (or integers if whole).
 * Small rates (below 10, e.g. 1 EUR = 1.49 SGD) use 4 decimal places so that
 * day-to-day differences remain visible.
 */
export function formatRate(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const maxDigits = Math.abs(num) < 10 ? 4 : 2;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: maxDigits,
  }).format(num);
}

/**
 * Calculates deterministic rate comparison based on real FX rates.
 *
 * todayRate and benchmarkRate are quoted as "1 base = X quote" for the pair's
 * market quote (see getQuotePair), e.g. 1 SGD = X VND for both VND -> SGD and SGD -> VND.
 */
export function calculateComparison(
  input: ComparisonInput,
  todayRate: number,
  benchmarkRate: number,
  benchmarkName: string
): ComparisonResult {
  const { base: baseCurrency, quote: quoteCurrency } = getQuotePair(input.haveCurrency, input.wantCurrency);
  const base = getCurrencyInfo(baseCurrency);
  const quote = getCurrencyInfo(quoteCurrency);

  // Determine direction purely from currency inputs
  const isBuyingBase = input.wantCurrency === baseCurrency;
  const directionCode = isBuyingBase ? 'BUY_BASE' : 'SELL_BASE';
  const conversion = `converting ${input.haveCurrency} to ${input.wantCurrency}`;
  const directionLabel = `Converting ${input.haveCurrency} to ${input.wantCurrency}`;

  // Benchmark difference calculation:
  // Buying the base currency (e.g. VND → SGD, paying quote currency):
  // percentageDifference = (benchmarkRate - currentRate) / benchmarkRate * 100
  // If currentRate < benchmarkRate: "more favorable" (lower rate means less quote currency spent per base unit)
  // If currentRate > benchmarkRate: "less favorable"
  //
  // Selling the base currency (e.g. SGD → VND, receiving quote currency):
  // percentageDifference = (currentRate - benchmarkRate) / benchmarkRate * 100
  // If currentRate > benchmarkRate: "more favorable" (higher rate means more quote currency received per base unit)
  // If currentRate < benchmarkRate: "less favorable"

  const rawPercentDiff = benchmarkRate > 0
    ? (isBuyingBase
        ? ((benchmarkRate - todayRate) / benchmarkRate) * 100
        : ((todayRate - benchmarkRate) / benchmarkRate) * 100)
    : 0;

  const absPercent = Math.abs(rawPercentDiff);
  const percentFormatted = Number(absPercent.toFixed(2));

  const isUnchanged = percentFormatted === 0 || Math.abs(benchmarkRate - todayRate) < 0.0001;

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
  } else if (isBuyingBase) {
    if (isMoreFavorable) {
      statusText = `Better for ${conversion}`;
      headlineComparison = `${percentFormatted}% more favorable today`;
      explanation = `Today’s rate (${todayQuote}) is lower than the ${benchmarkName} (${benchmarkQuote}). When ${conversion}, a lower rate means each ${base.name} costs you less ${quote.plural}.`;
    } else {
      statusText = `Less favorable for ${conversion}`;
      headlineComparison = `${percentFormatted}% less favorable today`;
      explanation = `Today’s rate (${todayQuote}) is higher than the ${benchmarkName} (${benchmarkQuote}). When ${conversion}, a higher rate means each ${base.name} costs you more ${quote.plural}.`;
    }
  } else {
    // Selling the base currency
    if (isMoreFavorable) {
      statusText = `Better for ${conversion}`;
      headlineComparison = `${percentFormatted}% more favorable today`;
      explanation = `Today’s rate (${todayQuote}) is higher than the ${benchmarkName} (${benchmarkQuote}). When ${conversion}, a higher rate means you receive more ${quote.plural} for each ${base.name}.`;
    } else {
      statusText = `Less favorable for ${conversion}`;
      headlineComparison = `${percentFormatted}% less favorable today`;
      explanation = `Today’s rate (${todayQuote}) is lower than the ${benchmarkName} (${benchmarkQuote}). When ${conversion}, a lower rate means you receive less ${quote.plural} for each ${base.name}.`;
    }
  }

  return {
    directionLabel,
    directionCode,
    baseCurrency,
    quoteCurrency,
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
