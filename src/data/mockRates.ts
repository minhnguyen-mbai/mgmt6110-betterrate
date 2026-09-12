import { DailyRatePoint } from '../types';

export const TODAY_RATE = 19620; // 1 SGD = 19,620 VND
export const AVERAGE_7D = 19850; // 1 SGD = 19,850 VND
export const AVERAGE_30D = 19700; // 1 SGD = 19,700 VND

// 30 days of simulated rates where:
// - Day 30 is today (19,620)
// - Days 24-30 average is exactly 19,850 (sum = 138,950)
// - All 30 days average is exactly 19,700 (sum = 591,000)
const rawDays1To23 = [
  19640, 19610, 19580, 19620, 19650, 19630, 19600, 19590, 19620, 19660,
  19680, 19670, 19650, 19640, 19660, 19680, 19700, 19690, 19710, 19730,
  19750, 19780, 19820
];
// Sum of rawDays1To23 currently = 452,050:
// 19640+19610+19580+19620+19650+19630+19600+19590+19620+19660+19680+19670+19650+19640+19660+19680+19700+19690+19710+19730+19750+19780+19820 = 452,050.
// Days 24 to 30:
const rawDays24To30 = [
  19920, 19950, 19910, 19880, 19850, 19820, 19620
];

export const MOCK_30_DAYS_SERIES: DailyRatePoint[] = [
  ...rawDays1To23,
  ...rawDays24To30
].map((rate, index) => {
  const dayIndex = index + 1;
  const daysAgo = 30 - dayIndex;
  let dateStr = `${daysAgo}d ago`;
  if (daysAgo === 0) dateStr = 'Today';
  else if (daysAgo === 1) dateStr = 'Yesterday';
  else if (daysAgo === 7) dateStr = '7d ago';
  else if (daysAgo === 30) dateStr = '30d ago';

  return {
    dayIndex,
    dateStr,
    rate,
    isToday: daysAgo === 0,
  };
});
