import { BenchmarkType, ComparisonInput, ComparisonResult } from '../types';
import { AVERAGE_30D, AVERAGE_7D, TODAY_RATE } from '../data/mockRates';

export function formatNumberWithCommas(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US').format(Math.round(num));
}

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

export function calculateComparison(input: ComparisonInput): ComparisonResult {
  const todayRate = TODAY_RATE;
  const benchmarkRate = input.benchmark === '7d' ? AVERAGE_7D : AVERAGE_30D;
  const benchmarkName = input.benchmark === '7d' ? '7-day average' : '30-day average';

  // Determine direction purely from the currency inputs
  const isVndToSgd = input.haveCurrency === 'VND' && input.wantCurrency === 'SGD';
  const directionCode = isVndToSgd ? 'VND_TO_SGD' : 'SGD_TO_VND';
  const directionLabel = isVndToSgd ? 'Converting VND to SGD' : 'Converting SGD to VND';

  // For VND → SGD (user has VND, wants SGD):
  // A lower SGD/VND rate is more favorable (costs less VND per SGD).
  // For SGD → VND (user has SGD, wants VND):
  // A higher SGD/VND rate is more favorable (receives more VND per SGD).
  const rateDifference = benchmarkRate - todayRate; // e.g. 19,850 - 19,620 = 230 VND
  const rawPercentDiff = benchmarkRate > 0 ? (Math.abs(rateDifference) / benchmarkRate) * 100 : 0;
  const percentFormatted = Number(rawPercentDiff.toFixed(2));

  const isUnchanged = Math.abs(rateDifference) < 1 || percentFormatted === 0;

  let isMoreFavorable = false;
  if (!isUnchanged) {
    if (isVndToSgd) {
      isMoreFavorable = todayRate < benchmarkRate;
    } else {
      isMoreFavorable = todayRate > benchmarkRate;
    }
  }

  // Interpretation headlines & plain language explanation
  let statusText = '';
  let headlineComparison = '';
  let explanation = '';

  if (isUnchanged) {
    statusText = isVndToSgd
      ? 'Approximately unchanged for converting VND to SGD'
      : 'Approximately unchanged for converting SGD to VND';
    headlineComparison = 'Approximately unchanged today';
    explanation = `Today’s rate (1 SGD = ${formatNumberWithCommas(todayRate)} VND) is virtually identical to the ${benchmarkName} (${formatNumberWithCommas(benchmarkRate)} VND). There is almost no rate difference compared with recent rates.`;
  } else if (isVndToSgd) {
    if (isMoreFavorable) {
      statusText = 'Better for converting VND to SGD';
      headlineComparison = `${percentFormatted}% more favorable today`;
      explanation = `Today’s rate (1 SGD = ${formatNumberWithCommas(todayRate)} VND) is lower than the ${benchmarkName} (${formatNumberWithCommas(benchmarkRate)} VND). When converting VND to SGD, a lower rate means each Singapore Dollar costs you less Vietnamese Dong.`;
    } else {
      statusText = 'Less favorable for converting VND to SGD';
      headlineComparison = `${percentFormatted}% less favorable today`;
      explanation = `Today’s rate (1 SGD = ${formatNumberWithCommas(todayRate)} VND) is higher than the ${benchmarkName} (${formatNumberWithCommas(benchmarkRate)} VND). When converting VND to SGD, a higher rate means each Singapore Dollar costs you more Vietnamese Dong.`;
    }
  } else {
    // SGD → VND
    if (isMoreFavorable) {
      statusText = 'Better for converting SGD to VND';
      headlineComparison = `${percentFormatted}% more favorable today`;
      explanation = `Today’s rate (1 SGD = ${formatNumberWithCommas(todayRate)} VND) is higher than the ${benchmarkName} (${formatNumberWithCommas(benchmarkRate)} VND). When converting SGD to VND, a higher rate means you receive more Vietnamese Dong for each Singapore Dollar.`;
    } else {
      statusText = 'Less favorable for converting SGD to VND';
      headlineComparison = `${percentFormatted}% less favorable today`;
      explanation = `Today’s rate (1 SGD = ${formatNumberWithCommas(todayRate)} VND) is lower than the ${benchmarkName} (${formatNumberWithCommas(benchmarkRate)} VND). When converting SGD to VND, a lower rate means you receive less Vietnamese Dong for each Singapore Dollar.`;
    }
  }

  // Monetary calculations if amount is provided
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

    differenceVND = Math.abs(todayTotalVND - benchmarkTotalVND);
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

