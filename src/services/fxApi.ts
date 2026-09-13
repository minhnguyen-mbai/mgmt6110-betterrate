import { FxCurrentData, FxHistoryData } from '../types';

export class FxApiError extends Error {
  code: 'EMPTY_DATA' | 'PROVIDER_ERROR' | 'PROVIDER_UNREACHABLE' | 'KEY_MISSING' | 'GENERIC';
  userMessage: string;

  constructor(
    code: 'EMPTY_DATA' | 'PROVIDER_ERROR' | 'PROVIDER_UNREACHABLE' | 'KEY_MISSING' | 'GENERIC',
    userMessage: string
  ) {
    super(userMessage);
    this.name = 'FxApiError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

/**
 * Parses HTTP or network error into standardized user-facing failure message.
 */
function normalizeError(err: unknown, status?: number, payload?: any): FxApiError {
  if (payload && payload.code === 'KEY_MISSING') {
    return new FxApiError(
      'KEY_MISSING',
      'ALPHAVANTAGE_API_KEY is not configured on the server. Please provide an API key to enable live exchange rates.'
    );
  }

  if (payload && payload.code === 'EMPTY_DATA') {
    return new FxApiError(
      'EMPTY_DATA',
      'We could not find enough exchange-rate data for this comparison.'
    );
  }

  if (payload && (payload.code === 'PROVIDER_UNREACHABLE' || status === 504)) {
    return new FxApiError(
      'PROVIDER_UNREACHABLE',
      'We cannot reach the exchange-rate service right now. Please try again later.'
    );
  }

  if (payload && (payload.code === 'PROVIDER_ERROR' || payload.code === 'PROVIDER_RATE_LIMITED' || payload.code === 'PROVIDER_DAILY_LIMIT' || status === 502 || status === 429)) {
    return new FxApiError(
      'PROVIDER_ERROR',
      payload.error || 'The exchange-rate provider could not complete this request.'
    );
  }

  if (err instanceof TypeError && err.message.includes('fetch')) {
    return new FxApiError(
      'PROVIDER_UNREACHABLE',
      'We cannot reach the exchange-rate service right now. Please try again later.'
    );
  }

  return new FxApiError(
    'PROVIDER_ERROR',
    'The exchange-rate provider could not complete this request.'
  );
}

/**
 * Fetches real-time SGD -> VND exchange rate.
 */
export async function fetchCurrentFx(): Promise<FxCurrentData> {
  let res: Response;
  try {
    res = await fetch('/api/fx-current');
  } catch (netErr) {
    throw normalizeError(netErr);
  }

  let payload: any = null;
  try {
    payload = await res.json();
  } catch (parseErr) {
    throw normalizeError(parseErr, res.status);
  }

  if (!res.ok) {
    throw normalizeError(null, res.status, payload);
  }

  if (!payload || typeof payload.rate !== 'number' || isNaN(payload.rate) || payload.rate <= 0) {
    throw new FxApiError(
      'EMPTY_DATA',
      'We could not find enough exchange-rate data for this comparison.'
    );
  }

  return payload as FxCurrentData;
}

/**
 * Fetches daily historical exchange rates and calculated benchmarks.
 */
export async function fetchHistoryFx(): Promise<FxHistoryData> {
  let res: Response;
  try {
    res = await fetch('/api/fx-history');
  } catch (netErr) {
    throw normalizeError(netErr);
  }

  let payload: any = null;
  try {
    payload = await res.json();
  } catch (parseErr) {
    throw normalizeError(parseErr, res.status);
  }

  if (!res.ok) {
    throw normalizeError(null, res.status, payload);
  }

  if (
    !payload ||
    !payload.benchmarks ||
    !payload.benchmarks['7d'] ||
    typeof payload.benchmarks['7d'].average !== 'number' ||
    !payload.benchmarks['30d'] ||
    typeof payload.benchmarks['30d'].average !== 'number'
  ) {
    throw new FxApiError(
      'EMPTY_DATA',
      'We could not find enough exchange-rate data for this comparison.'
    );
  }

  return payload as FxHistoryData;
}
