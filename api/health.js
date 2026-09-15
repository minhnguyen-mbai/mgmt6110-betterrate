/**
 * api/health.js
 *
 * System health and upstream connectivity status.
 * Performs end-to-end API validation when key is present,
 * or host reachability check when key is missing.
 * Never leaks the API key, key prefix, key length, or credential fragments.
 */

import {
  handleRequestMethod,
  fetchAlphaVantageJson,
  classifyProviderResponse,
  logDiagnostic,
} from './_lib/alphavantage.js';

const HEALTH_CACHE_SECONDS = 21600; // 6 hours

export default async function handler(req, res) {
  // Method handling: HEAD returns 200 immediately without contacting provider; non-GET/HEAD returns 405
  if (!handleRequestMethod(req, res)) {
    return;
  }

  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  const keyConfigured = Boolean(apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0);

  let upstreamReachable = false;
  let upstreamStatus = null;
  /** @type {"ok" | "rejected" | "rate_limited" | "refused" | "http_error" | "unexpected_response" | "unreachable" | "skipped_no_key"} */
  let providerCheck = 'unreachable';
  let ok = false;

  if (keyConfigured) {
    const cleanKey = apiKey.trim();
    const upstreamUrl = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=SGD&to_currency=VND&apikey=${encodeURIComponent(
      cleanKey
    )}`;

    const fetchResult = await fetchAlphaVantageJson(upstreamUrl, 8000);

    if (fetchResult.httpStatus === null) {
      // Network error or timeout contacting upstream
      upstreamReachable = false;
      upstreamStatus = null;
      providerCheck = 'unreachable';
      ok = false;
      logDiagnostic('PROVIDER_UNREACHABLE');
    } else {
      upstreamReachable = true;
      upstreamStatus = fetchResult.httpStatus;

      if (fetchResult.providerCheck === 'unexpected_response') {
        providerCheck = 'unexpected_response';
        ok = false;
        logDiagnostic('UNEXPECTED_RESPONSE', upstreamStatus);
      } else if (!fetchResult.ok) {
        providerCheck = 'http_error';
        ok = false;
        logDiagnostic('PROVIDER_HTTP_ERROR', upstreamStatus);
      } else {
        // Inspect provider message indicators
        const classification = classifyProviderResponse(fetchResult.data);

        if (classification) {
          providerCheck = /** @type {any} */ (classification.providerCheck);
          ok = false;
          logDiagnostic(classification.code, upstreamStatus);
        } else {
          // Verify actual exchange rate data object and positive numeric rate
          const rawRateObj = fetchResult.data?.['Realtime Currency Exchange Rate'];
          const rawRateStr = rawRateObj?.['5. Exchange Rate'];
          const numericRate = parseFloat(rawRateStr);

          if (
            !rawRateObj ||
            typeof rawRateObj !== 'object' ||
            isNaN(numericRate) ||
            numericRate <= 0 ||
            !isFinite(numericRate)
          ) {
            providerCheck = 'unexpected_response';
            ok = false;
            logDiagnostic('UNEXPECTED_RESPONSE', upstreamStatus);
          } else {
            providerCheck = 'ok';
            ok = true;
          }
        }
      }
    }
  } else {
    // API key does not exist on the server
    keyConfiguredValueCheck: {
      providerCheck = 'skipped_no_key';
      ok = false;

      // Note: This is HOST reachability only and does NOT validate API access or key validity.
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const hostPing = await fetch('https://www.alphavantage.co/', {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': 'BetterRate-HealthCheck/1.0',
          },
        });
        clearTimeout(timeoutId);
        upstreamReachable = true;
        upstreamStatus = hostPing.status;
      } catch (err) {
        upstreamReachable = false;
        upstreamStatus = null;
      }
    }
  }

  res.setHeader('Content-Type', 'application/json');

  if (ok) {
    // Cache successful health diagnostics at the CDN for 6 hours (no stale-while-revalidate for diagnostics)
    res.setHeader(
      'Cache-Control',
      `public, max-age=0, s-maxage=${HEALTH_CACHE_SECONDS}`
    );
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }

  return res.status(200).json({
    service: 'BetterRate',
    keyConfigured,
    upstreamReachable,
    upstreamStatus,
    providerCheck,
    ok,
    checkedAt: new Date().toISOString(),
  });
}
