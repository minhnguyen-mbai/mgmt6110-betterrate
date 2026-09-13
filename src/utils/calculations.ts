import { ComparisonInput, ComparisonResult } from '../types';

/**
 * Formats integer or whole amounts with thousand separators.
 */
export function formatNumberWithCommas(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US').format(Math.round(num));
}

/**
 * Formats exchange rates to 2 decimal places (or integers if whole).
 */
export function formatRate(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formats VND amounts into human-friendly compact strings (e.g. "59K VND", "1.25M VND").
 */
export function formatCompactVND(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val) || val === 0) return '0 VND';
  const absVal = Math.abs(val);
  if (absVal >= 1_000_000) {
    const millions = absVal / 1_000_000;
    const formatted = Number(millions.toFixed(2));
    return `${formatted}M VND`;
  }
  if (absVal >= 1_000) {
    const thousands = absVal / 1_000;
    const formatted = Number(thousands.toFixed(0));
    return `${formatted}K VND`;
  }
  return `${formatNumberWithCommas(absVal)} VND`;
}

/**
 * Calculates deterministic rate comparison and monetary impact based on real FX rates.
 */
export function calculateComparison(
  input: ComparisonInput,
  todayRate: number,
  benchmarkRate: number,
  benchmarkName: string
): ComparisonResult {
  // Determine direction purely from currency inputs
  const isVndToSgd = input.haveCurrency === 'VND' && input.wantCurrency === 'SGD';
  const directionCode = isVndToSgd ? 'VND_TO_SGD' : 'SGD_TO_VND';
  const directionLabel = isVndToSgd ? 'Converting VND to SGD' : 'Converting SGD to VND';

  // Benchmark difference calculation:
  // For VND → SGD:
  // percentageDifference = (benchmarkRate - currentRate) / benchmarkRate * 100
  // If currentRate < benchmarkRate: "more favorable" (lower rate means less VND spent per SGD)
  // If currentRate > benchmarkRate: "less favorable"
  //
  // For SGD → VND:
  // percentageDifference = (currentRate - benchmarkRate) / benchmarkRate * 100
  // If currentRate > benchmarkRate: "more favorable" (higher rate means more VND received per SGD)
  // If currentRate < benchmarkRate: "less favorable"

  const rawPercentDiff = benchmarkRate > 0
    ? (isVndToSgd
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

  // Wording: strictly direction-aware, objective, no forbidden promotional words ("good rate", "best time", etc.)
  let statusText = '';
  let headlineComparison = '';
  let explanation = '';

  if (isUnchanged) {
    statusText = isVndToSgd
      ? 'Approximately unchanged for converting VND to SGD'
      : 'Approximately unchanged for converting SGD to VND';
    headlineComparison = 'Approximately unchanged today';
    explanation = `Today’s rate (1 SGD = ${formatRate(todayRate)} VND) is virtually identical to the ${benchmarkName} (${formatRate(benchmarkRate)} VND). There is almost no rate difference compared with recent rates.`;
  } else if (isVndToSgd) {
    if (isMoreFavorable) {
      statusText = 'Better for converting VND to SGD';
      headlineComparison = `${percentFormatted}% more favorable today`;
      explanation = `Today’s rate (1 SGD = ${formatRate(todayRate)} VND) is lower than the ${benchmarkName} (${formatRate(benchmarkRate)} VND). When converting VND to SGD, a lower rate means each Singapore Dollar costs you less Vietnamese Dong.`;
    } else {
      statusText = 'Less favorable for converting VND to SGD';
      headlineComparison = `${percentFormatted}% less favorable today`;
      explanation = `Today’s rate (1 SGD = ${formatRate(todayRate)} VND) is higher than the ${benchmarkName} (${formatRate(benchmarkRate)} VND). When converting VND to SGD, a higher rate means each Singapore Dollar costs you more Vietnamese Dong.`;
    }
  } else {
    // SGD → VND
    if (isMoreFavorable) {
      statusText = 'Better for converting SGD to VND';
      headlineComparison = `${percentFormatted}% more favorable today`;
      explanation = `Today’s rate (1 SGD = ${formatRate(todayRate)} VND) is higher than the ${benchmarkName} (${formatRate(benchmarkRate)} VND). When converting SGD to VND, a higher rate means you receive more Vietnamese Dong for each Singapore Dollar.`;
    } else {
      statusText = 'Less favorable for converting SGD to VND';
      headlineComparison = `${percentFormatted}% less favorable today`;
      explanation = `Today’s rate (1 SGD = ${formatRate(todayRate)} VND) is lower than the ${benchmarkName} (${formatRate(benchmarkRate)} VND). When converting SGD to VND, a lower rate means you receive less Vietnamese Dong for each Singapore Dollar.`;
    }
  }

  // Optional monetary calculations if amount in SGD is provided
  let amountFormatted: string | null = null;
  let todayTotalVND: number | null = null;
  let todayTotalVNDFormatted: string | null = null;
  let todayTotalVNDCompact: string | null = null;

  let benchmarkTotalVND: number | null = null;
  let benchmarkTotalVNDFormatted: string | null = null;
  let benchmarkTotalVNDCompact: string | null = null;

  let differenceVND: number | null = null;
  let differenceVNDFormatted: string | null = null;
  let differenceVNDCompact: string | null = null;
  let moneyDifferenceText: string | null = null;

  if (input.amount !== null && input.amount > 0) {
    const qty = input.amount;
    amountFormatted = `S$${formatNumberWithCommas(qty)}`;

    todayTotalVND = qty * todayRate;
    todayTotalVNDFormatted = `${formatNumberWithCommas(todayTotalVND)} VND`;
    todayTotalVNDCompact = formatCompactVND(todayTotalVND);

    benchmarkTotalVND = qty * benchmarkRate;
    benchmarkTotalVNDFormatted = `${formatNumberWithCommas(benchmarkTotalVND)} VND`;
    benchmarkTotalVNDCompact = formatCompactVND(benchmarkTotalVND);

    // moneyDifferenceVND = absolute value of (benchmarkRate - currentRate) * amountSGD
    differenceVND = Math.abs(benchmarkRate - todayRate) * qty;
    differenceVNDFormatted = `${formatNumberWithCommas(differenceVND)} VND`;
    differenceVNDCompact = formatCompactVND(differenceVND);

    if (isUnchanged) {
      moneyDifferenceText = 'Approximately no difference today';
    } else if (isVndToSgd) {
      if (isMoreFavorable) {
        moneyDifferenceText = `About ${differenceVNDCompact} less today`;
      } else {
        moneyDifferenceText = `About ${differenceVNDCompact} more today`;
      }
    } else {
      if (isMoreFavorable) {
        moneyDifferenceText = `About ${differenceVNDCompact} more received today`;
      } else {
        moneyDifferenceText = `About ${differenceVNDCompact} less received today`;
      }
    }
  }

  return {
    directionLabel,
    directionCode,
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
    amount: input.amount,
    amountFormatted,
    todayTotalVND,
    todayTotalVNDFormatted,
    todayTotalVNDCompact,
    benchmarkTotalVND,
    benchmarkTotalVNDFormatted,
    benchmarkTotalVNDCompact,
    differenceVND,
    differenceVNDFormatted,
    differenceVNDCompact,
    moneyDifferenceText,
  };
}
