import { BenchmarkDetail } from '../types';

/**
 * Which observations a benchmark average used, e.g. "5 daily closes · Sep 19–25, 2026".
 * Uses the observation count and calendar window the history API reports (api/_lib/crossrate.js):
 * only real daily observations inside the window are counted, so a 7-day window can hold fewer
 * than 7. Incomplete or malformed metadata is never filled in.
 */

export const BENCHMARK_WINDOW_UNAVAILABLE = 'Observation details unavailable';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

const fmt = (date: Date, options: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });

/** "Sep 19–25, 2026", "Aug 27 – Sep 25, 2026" or "Dec 28, 2025 – Jan 3, 2026". */
function formatRange(start: Date, end: Date): string {
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  if (sameYear && start.getUTCMonth() === end.getUTCMonth()) {
    if (start.getUTCDate() === end.getUTCDate()) return fmt(end, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fmt(start, { month: 'short', day: 'numeric' })}–${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  const startText = fmt(start, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startText} – ${fmt(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function formatBenchmarkWindow(detail: Partial<BenchmarkDetail> | null | undefined): string {
  const count = detail?.observationCount;
  const start = parseDate(detail?.startDate);
  const end = parseDate(detail?.endDate);
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || !start || !end || start > end) {
    return BENCHMARK_WINDOW_UNAVAILABLE;
  }
  return `${count} daily ${count === 1 ? 'close' : 'closes'} · ${formatRange(start, end)}`;
}
