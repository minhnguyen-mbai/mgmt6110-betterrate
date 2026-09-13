/**
 * api/fx-current.js
 *
 * Fetches the real-time SGD -> VND exchange rate from Alpha Vantage.
 * Normalizes the response and enforces strict security and caching.
 */

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

  // 2. Fetch current SGD -> VND rate from Alpha Vantage
  const upstreamUrl = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=SGD&to_currency=VND&apikey=${encodeURIComponent(
    cleanKey
  )}`;

  let upstreamRes;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

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

  // 6. Verify expected response object exists
  const rawRateObj = data['Realtime Currency Exchange Rate'];
  if (!rawRateObj || typeof rawRateObj !== 'object') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: 'We could not find enough exchange-rate data for this comparison.',
      code: 'EMPTY_DATA',
    });
  }

  // 7. Extract and validate rate number
  const rawRateStr = rawRateObj['5. Exchange Rate'];
  const numericRate = parseFloat(rawRateStr);

  if (isNaN(numericRate) || numericRate <= 0 || !isFinite(numericRate)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: 'The exchange-rate provider returned an invalid exchange-rate value.',
      code: 'INVALID_RATE',
    });
  }

  // 8. Extract metadata without inventing timestamps
  const lastRefreshed =
    rawRateObj['6. Last Refreshed'] && String(rawRateObj['6. Last Refreshed']).trim() !== ''
      ? String(rawRateObj['6. Last Refreshed']).trim()
      : null;

  const timeZone =
    rawRateObj['7. Time Zone'] && String(rawRateObj['7. Time Zone']).trim() !== ''
      ? String(rawRateObj['7. Time Zone']).trim()
      : null;

  // 9. Caching: 60s max-age protects against Alpha Vantage's 5 calls/min limit while preserving real-time accuracy
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');

  return res.status(200).json({
    from: 'SGD',
    to: 'VND',
    rate: numericRate,
    lastRefreshed,
    timeZone,
  });
}
