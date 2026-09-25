import { CurrencyCode, FxCurrentData, FxHistoryData } from '../types';

export type FxErrorCode =
  | 'KEY_MISSING'
  | 'PROVIDER_UNREACHABLE'
  | 'PROVIDER_RATE_LIMIT'
  | 'PROVIDER_ERROR'
  | 'EMPTY_DATA'
  | 'INVALID_RATE'
  | 'INVALID_PAIR'
  | 'UNSUPPORTED_CURRENCY'
  | 'GENERIC';

const RECOGNIZED_CODES: ReadonlySet<string> = new Set<FxErrorCode>([
  'KEY_MISSING',
  'PROVIDER_UNREACHABLE',
  'PROVIDER_RATE_LIMIT',
  'PROVIDER_ERROR',
  'EMPTY_DATA',
  'INVALID_RATE',
  'INVALID_PAIR',
  'UNSUPPORTED_CURRENCY',
  'GENERIC',
]);

const DEFAULT_ERROR_MESSAGES: Record<FxErrorCode, string> = {
  KEY_MISSING: 'Live exchange rates are not available right now because the server is not fully configured.',
  PROVIDER_UNREACHABLE: 'We cannot reach the exchange-rate service right now. Please try again later.',
  PROVIDER_RATE_LIMIT: 'The exchange-rate provider has reached its request limit for now. Please try again later.',
  PROVIDER_ERROR: 'The exchange-rate provider could not complete this request.',
  EMPTY_DATA: 'We could not find enough exchange-rate data for this comparison.',
  INVALID_RATE: 'The exchange-rate provider returned an invalid exchange-rate value.',
  INVALID_PAIR: 'This currency pair is not supported. Please choose two different currencies from the list.',
  UNSUPPORTED_CURRENCY: 'This currency is not supported yet. Please choose a currency from the list.',
  GENERIC: 'An unexpected error occurred while loading exchange-rate data.',
};

export class FxApiError extends Error {
  code: FxErrorCode;
  userMessage: string;

  constructor(code: FxErrorCode, userMessage: string) {
    super(userMessage);
    this.name = 'FxApiError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

/**
 * Parses HTTP, backend JSON error payloads, or network failures into standardized user-facing errors.
 * Trusts backend sanitized error codes as primary classification.
 */
function normalizeError(err: unknown, status?: number, payload?: any): FxApiError {
  // 1. Primary classification: trust recognized backend error code
  if (payload && typeof payload.code === 'string' && RECOGNIZED_CODES.has(payload.code)) {
    const code = payload.code as FxErrorCode;
    const message =
      typeof payload.error === 'string' && payload.error.trim() !== ''
        ? payload.error.trim()
        : DEFAULT_ERROR_MESSAGES[code];
    return new FxApiError(code, message);
  }

  // 2. Fallback classification: HTTP status code when payload code is missing
  if (status !== undefined) {
    let fallbackCode: FxErrorCode = 'PROVIDER_ERROR';

    if (status === 504) {
      fallbackCode = 'PROVIDER_UNREACHABLE';
    } else if (status === 503 || status === 429) {
      fallbackCode = 'PROVIDER_RATE_LIMIT';
    } else if (status === 400) {
      fallbackCode = 'INVALID_PAIR';
    } else if (status === 502) {
      fallbackCode = 'PROVIDER_ERROR';
    }

    const message =
      payload && typeof payload.error === 'string' && payload.error.trim() !== ''
        ? payload.error.trim()
        : DEFAULT_ERROR_MESSAGES[fallbackCode];
    return new FxApiError(fallbackCode, message);
  }

  // 3. Network fetch failure (browser offline, DNS failure, aborted connection)
  if (err instanceof TypeError || (err instanceof Error && err.name === 'AbortError')) {
    return new FxApiError(
      'PROVIDER_UNREACHABLE',
      DEFAULT_ERROR_MESSAGES.PROVIDER_UNREACHABLE
    );
  }

  return new FxApiError(
    'PROVIDER_ERROR',
    DEFAULT_ERROR_MESSAGES.PROVIDER_ERROR
  );
}

function pairQuery(from: CurrencyCode, to: CurrencyCode): string {
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Fetches the real-time FROM -> TO exchange rate.
 * Aborted requests reject with the original AbortError so callers can ignore them.
 */
export async function fetchCurrentFx(
  from: CurrencyCode,
  to: CurrencyCode,
  signal?: AbortSignal
): Promise<FxCurrentData> {
  let res: Response;
  try {
    res = await fetch(`/api/fx-current?${pairQuery(from, to)}`, { signal });
  } catch (netErr) {
    if (isAbortError(netErr)) throw netErr;
    throw normalizeError(netErr);
  }

  let payload: any = null;
  try {
    payload = await res.json();
  } catch (parseErr) {
    if (isAbortError(parseErr)) throw parseErr;
    throw normalizeError(parseErr, res.status);
  }

  if (!res.ok) {
    throw normalizeError(null, res.status, payload);
  }

  if (
    !payload ||
    payload.from !== from ||
    payload.to !== to ||
    typeof payload.rate !== 'number' ||
    isNaN(payload.rate) ||
    payload.rate <= 0
  ) {
    throw new FxApiError(
      'INVALID_RATE',
      DEFAULT_ERROR_MESSAGES.INVALID_RATE
    );
  }

  return payload as FxCurrentData;
}

/**
 * Fetches FROM -> TO daily historical exchange rates and calculated benchmarks.
 * Aborted requests reject with the original AbortError so callers can ignore them.
 */
export async function fetchHistoryFx(
  from: CurrencyCode,
  to: CurrencyCode,
  signal?: AbortSignal
): Promise<FxHistoryData> {
  let res: Response;
  try {
    res = await fetch(`/api/fx-history?${pairQuery(from, to)}`, { signal });
  } catch (netErr) {
    if (isAbortError(netErr)) throw netErr;
    throw normalizeError(netErr);
  }

  let payload: any = null;
  try {
    payload = await res.json();
  } catch (parseErr) {
    if (isAbortError(parseErr)) throw parseErr;
    throw normalizeError(parseErr, res.status);
  }

  if (!res.ok) {
    throw normalizeError(null, res.status, payload);
  }

  if (
    !payload ||
    payload.from !== from ||
    payload.to !== to ||
    !payload.benchmarks ||
    !payload.benchmarks['7d'] ||
    typeof payload.benchmarks['7d'].average !== 'number' ||
    !payload.benchmarks['30d'] ||
    typeof payload.benchmarks['30d'].average !== 'number'
  ) {
    throw new FxApiError(
      'EMPTY_DATA',
      DEFAULT_ERROR_MESSAGES.EMPTY_DATA
    );
  }

  return payload as FxHistoryData;
}
