/**
 * api/_lib/alphavantage.js
 *
 * Centralized Alpha Vantage backend helpers for BetterRate.
 * Strictly sanitizes errors, prevents leaking credentials or raw provider messages,
 * handles request methods, and provides robust AbortController timeouts.
 */

export const ERROR_MESSAGES = Object.freeze({
  KEY_MISSING: 'Live exchange rates are not available right now because the server is not fully configured.',
  PROVIDER_UNREACHABLE: 'We cannot reach the exchange-rate service right now. Please try again later.',
  PROVIDER_RATE_LIMIT: 'The exchange-rate provider could not complete this request.',
  PROVIDER_ERROR: 'The exchange-rate provider could not complete this request.',
  EMPTY_DATA: 'We could not find enough exchange-rate data for this comparison.',
  INVALID_RATE: 'The exchange-rate provider returned an invalid exchange-rate value.',
});

/**
 * Validates the HTTP request method.
 * - GET: returns true (continue normally)
 * - HEAD: returns HTTP 200 with an empty body immediately (does not contact provider)
 * - Other: returns HTTP 405 with Allow: GET, HEAD
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {boolean} true if execution should continue (GET), false if response was ended
 */
export function handleRequestMethod(req, res) {
  if (req.method === 'HEAD') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).end();
    return false;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, HEAD');
    res.setHeader('Cache-Control', 'no-store');
    res.status(405).json({
      error: 'Method Not Allowed',
      code: 'METHOD_NOT_ALLOWED',
    });
    return false;
  }

  return true;
}

/**
 * Classifies Alpha Vantage JSON responses for known failure indicators.
 * Inspects provider text strictly for classification without returning raw provider text to the client.
 *
 * @param {any} data Parsed JSON response object from Alpha Vantage
 * @returns {{ code: string, status: number, providerCheck: string, message: string } | null}
 */
export function classifyProviderResponse(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  // 1. Error Message -> PROVIDER_ERROR / 502 / rejected
  if (data['Error Message']) {
    return {
      code: 'PROVIDER_ERROR',
      status: 502,
      providerCheck: 'rejected',
      message: ERROR_MESSAGES.PROVIDER_ERROR,
    };
  }

  // 2. Note or Information -> rate limit or refusal
  const rawNotice = data['Note'] || data['Information'];
  if (rawNotice) {
    const text = typeof rawNotice === 'string' ? rawNotice.toLowerCase() : '';
    const isRateLimit =
      text.includes('rate limit') ||
      text.includes('requests per day') ||
      text.includes('requests per minute') ||
      text.includes('call frequency');

    if (isRateLimit) {
      return {
        code: 'PROVIDER_RATE_LIMIT',
        status: 503,
        providerCheck: 'rate_limited',
        message: ERROR_MESSAGES.PROVIDER_RATE_LIMIT,
      };
    }

    return {
      code: 'PROVIDER_ERROR',
      status: 502,
      providerCheck: 'refused',
      message: ERROR_MESSAGES.PROVIDER_ERROR,
    };
  }

  return null;
}

/**
 * Fetches JSON from Alpha Vantage using an AbortController.
 * The timeout remains active until BOTH fetch() and response.json() have completed or failed.
 *
 * @param {string} url Upstream URL (must only be used internally)
 * @param {number} timeoutMs Milliseconds before aborting
 * @returns {Promise<{
 *   ok: boolean,
 *   httpStatus: number | null,
 *   data: any | null,
 *   code?: string,
 *   providerCheck?: string,
 *   message?: string
 * }>}
 */
export async function fetchAlphaVantageJson(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BetterRate/1.0',
        Accept: 'application/json',
      },
    });

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      return {
        ok: false,
        httpStatus: response.status,
        data: null,
        code: 'PROVIDER_ERROR',
        providerCheck: 'unexpected_response',
        message: ERROR_MESSAGES.PROVIDER_ERROR,
      };
    }

    return {
      ok: response.ok,
      httpStatus: response.status,
      data,
    };
  } catch (netErr) {
    return {
      ok: false,
      httpStatus: null,
      data: null,
      code: 'PROVIDER_UNREACHABLE',
      providerCheck: 'unreachable',
      message: ERROR_MESSAGES.PROVIDER_UNREACHABLE,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Logs diagnostic error information safely.
 * Never logs API keys, API key fragments, upstream URLs, or raw provider messages.
 *
 * @param {string} code Internal error code
 * @param {number | null} [httpStatus=null] Upstream or response status
 */
export function logDiagnostic(code, httpStatus = null) {
  if (httpStatus !== null) {
    console.error(`[BetterRate Backend] Error: ${code} (upstream status: ${httpStatus})`);
  } else {
    console.error(`[BetterRate Backend] Error: ${code}`);
  }
}
