/**
 * api/health.js
 *
 * System health and upstream connectivity status.
 * Never leaks the API key, key prefix, key length, or credential fragments.
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

  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  const isConfigured = Boolean(apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0);

  let isReachable = false;
  let upstreamStatus = null;

  if (isConfigured) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // Lightweight ping to Alpha Vantage root endpoint
      const pingRes = await fetch('https://www.alphavantage.co/', {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'BetterRate-HealthCheck/1.0',
        },
      });
      clearTimeout(timeoutId);

      upstreamStatus = pingRes.status;
      isReachable = pingRes.ok || pingRes.status < 500;
    } catch (err) {
      isReachable = false;
      upstreamStatus = null;
    }
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  return res.status(200).json({
    service: 'BetterRate',
    configured: isConfigured,
    reachable: isReachable,
    upstreamStatus,
    checkedAt: new Date().toISOString(),
  });
}
