/**
 * api/fx-history.js
 *
 * Fetches Alpha Vantage FX_DAILY for SGD -> VND.
 * Calculates exact calendar-window 7-day and 30-day averages using daily close prices.
 * Returns normalized benchmarks and daily points for trend visualization.
 */

function getCalendarStartDate(endStr, dayCount) {
  const [year, month, day] = endStr.split('-').map(Number);
  const endUtc = new Date(Date.UTC(year, month - 1, day));
  const startUtc = new Date(endUtc.getTime() - (dayCount - 1) * 86400000);
  return startUtc.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  // Only permit GET / HEAD requests
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({
      error: 'Method Not Allowed',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  // 1. Verify ALPHAVANTAGE_API_KEY is configured
  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({
      error: 'ALPHAVANTAGE_API_KEY is missing on the server.',
      code: 'KEY_MISSING',
    });
  }

  const cleanKey = apiKey.trim();

  // 2. Fetch daily historical rates from Alpha Vantage
  const upstreamUrl = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=SGD&to_symbol=VND&outputsize=compact&apikey=${encodeURIComponent(
    cleanKey
  )}`;

  let upstreamRes;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    upstreamRes = await fetch(upstreamUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BetterRate/1.0',
        Accept: 'application/json',
      },
    });
    clearTimeout(timeoutId);
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: 'We cannot reach the exchange-rate service right now. Please try again later.',
      code: 'PROVIDER_UNREACHABLE',
    });
  }

  // 3. Validate HTTP status
  if (!upstreamRes.ok) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: 'The exchange-rate provider could not complete this request.',
      code: 'PROVIDER_ERROR',
    });
  }

  // 4. Parse JSON body
  let data;
  try {
    data = await upstreamRes.json();
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: 'The exchange-rate provider returned an unreadable response.',
      code: 'PROVIDER_ERROR',
    });
  }

  // 5. Detect provider-specific limitation and refusal messages
  if (data['Error Message']) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: 'The exchange-rate provider could not complete this request.',
      code: 'PROVIDER_ERROR',
    });
  }

  if (data['Note']) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(429).json({
      error: 'The exchange-rate provider could not complete this request.',
      code: 'PROVIDER_RATE_LIMIT',
    });
  }

  if (data['Information']) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(429).json({
      error: 'The exchange-rate provider could not complete this request.',
      code: 'PROVIDER_RATE_LIMIT',
    });
  }

  // 6. Verify Time Series FX (Daily) exists
  const timeSeries = data['Time Series FX (Daily)'];
  if (!timeSeries || typeof timeSeries !== 'object') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: 'We could not find enough exchange-rate data for this comparison.',
      code: 'EMPTY_DATA',
    });
  }

  // Extract all valid date keys and sort chronologically (oldest -> newest)
  const allDates = Object.keys(timeSeries)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

  if (allDates.length === 0) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: 'We could not find enough exchange-rate data for this comparison.',
      code: 'EMPTY_DATA',
    });
  }

  // 7. Extract Provider Metadata
  const meta = data['Meta Data'] || {};
  const metaRefreshed =
    meta['5. Last Refreshed'] && String(meta['5. Last Refreshed']).trim() !== ''
      ? String(meta['5. Last Refreshed']).trim()
      : null;
  const timeZone =
    meta['6. Time Zone'] && String(meta['6. Time Zone']).trim() !== ''
      ? String(meta['6. Time Zone']).trim()
      : null;

  // Determine latest historical refresh date (YYYY-MM-DD)
  let latestDateStr = allDates[allDates.length - 1];
  if (metaRefreshed) {
    const match = metaRefreshed.match(/^\d{4}-\d{2}-\d{2}/);
    if (match && timeSeries[match[0]]) {
      latestDateStr = match[0];
    }
  }

  // 8. Calculate Calendar Windows
  // 7 calendar days ending on provider's latest historical refresh date (endDate - 6 days)
  const startDate7d = getCalendarStartDate(latestDateStr, 7);
  // 30 calendar days ending on provider's latest historical refresh date (endDate - 29 days)
  const startDate30d = getCalendarStartDate(latestDateStr, 30);

  // Filter valid close observations within the windows
  // ONLY use daily close values ("4. close"). Do NOT use open, high, or low.
  const obs7d = [];
  const obs30d = [];

  for (const dateStr of allDates) {
    const rawEntry = timeSeries[dateStr];
    if (!rawEntry || typeof rawEntry !== 'object') continue;

    const closeNum = parseFloat(rawEntry['4. close']);
    if (isNaN(closeNum) || closeNum <= 0 || !isFinite(closeNum)) continue;

    if (dateStr >= startDate7d && dateStr <= latestDateStr) {
      obs7d.push({ date: dateStr, close: closeNum });
    }
    if (dateStr >= startDate30d && dateStr <= latestDateStr) {
      obs30d.push({ date: dateStr, close: closeNum });
    }
  }

  // Must have at least one observation in each window
  if (obs7d.length === 0 || obs30d.length === 0) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: 'We could not find enough exchange-rate data for this comparison.',
      code: 'EMPTY_DATA',
    });
  }

  // 9. Benchmark averages
  // Do NOT divide automatically by 7 or 30. Divide ONLY by the number of valid observations actually available.
  const sum7d = obs7d.reduce((acc, cur) => acc + cur.close, 0);
  const avg7d = sum7d / obs7d.length;

  const sum30d = obs30d.reduce((acc, cur) => acc + cur.close, 0);
  const avg30d = sum30d / obs30d.length;

  // 10. Cache-Control Header:
  // 1 hour (3600s) because daily historical close data changes only once a day after market close.
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200');

  // Return normalized data only
  return res.status(200).json({
    from: 'SGD',
    to: 'VND',
    lastRefreshed: latestDateStr,
    timeZone,
    benchmarks: {
      '7d': {
        average: avg7d,
        observationCount: obs7d.length,
        startDate: startDate7d,
        endDate: latestDateStr,
      },
      '30d': {
        average: avg30d,
        observationCount: obs30d.length,
        startDate: startDate30d,
        endDate: latestDateStr,
      },
    },
    daily: obs30d, // Chronologically sorted points for the 30-day window
  });
}
