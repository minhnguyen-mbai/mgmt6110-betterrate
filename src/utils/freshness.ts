/**
 * Freshness cue for the current rate, from the provider's own timestamp (never the fetch time):
 * - Alpha Vantage: "YYYY-MM-DD HH:MM:SS" with timeZone "UTC" (the quote's last refresh,
 *   for a USD cross-rate the older of its two quotes), shown as a date and time in the
 *   viewer's time zone, with that zone named.
 * - Frankfurter: "YYYY-MM-DD" (the reference-rate date), shown as a date only.
 * Anything else (missing, malformed, or a clock time without a known zone) never gets an
 * invented time: a known date is shown on its own, otherwise the time is reported unavailable.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/;

export const FRESHNESS_UNAVAILABLE = 'Update time unavailable';

function formatDate(isoDate: string): string | null {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== isoDate) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * @param displayTimeZone the zone to show a clock time in; defaults to the viewer's own
 */
export function formatRateFreshness(
  lastRefreshed: string | null | undefined,
  timeZone: string | null | undefined,
  displayTimeZone?: string
): string {
  const raw = typeof lastRefreshed === 'string' ? lastRefreshed.trim() : '';

  if (DATE_ONLY.test(raw)) {
    const date = formatDate(raw);
    return date ? `Rate as of ${date}` : FRESHNESS_UNAVAILABLE;
  }

  const match = raw.match(DATE_TIME);
  if (!match) return FRESHNESS_UNAVAILABLE;

  if (timeZone !== 'UTC') {
    // A clock time without a known zone cannot be placed honestly; keep only its date
    const date = formatDate(match[1]);
    return date ? `Rate as of ${date}` : FRESHNESS_UNAVAILABLE;
  }

  const instant = new Date(`${match[1]}T${match[2]}Z`);
  if (isNaN(instant.getTime())) return FRESHNESS_UNAVAILABLE;
  const formatted = instant.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    ...(displayTimeZone ? { timeZone: displayTimeZone } : {}),
  });
  return `Rate as of ${formatted}`;
}
