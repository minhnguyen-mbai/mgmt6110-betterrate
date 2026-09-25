import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { fetchCurrentFx, fetchHistoryFx, FxApiError } from '../src/services/fxApi';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function respondWith(body: unknown, status = 200) {
  globalThis.fetch = (async () => ({ ok: status < 400, status, json: async () => body })) as unknown as typeof fetch;
}

const history = (from: string, to: string) => ({
  from,
  to,
  lastRefreshed: '2026-09-25',
  timeZone: null,
  benchmarks: {
    '7d': { average: 1.46, observationCount: 5, startDate: '2026-09-19', endDate: '2026-09-25' },
    '30d': { average: 1.47, observationCount: 22, startDate: '2026-08-27', endDate: '2026-09-25' },
  },
  daily: [{ date: '2026-09-25', close: 1.458 }],
});

test('10. stale-response protection: a response for another pair is rejected', async () => {
  respondWith({ from: 'EUR', to: 'SGD', rate: 1.458, lastRefreshed: null, timeZone: null });
  await assert.rejects(fetchCurrentFx('GBP', 'SGD'), FxApiError);

  respondWith(history('EUR', 'SGD'));
  await assert.rejects(fetchHistoryFx('GBP', 'SGD'), FxApiError);

  respondWith(history('GBP', 'SGD'));
  const ok = await fetchHistoryFx('GBP', 'SGD');
  assert.equal(ok.from, 'GBP');
});

test('10. stale-response protection: aborted requests surface as AbortError, not as a provider error', async () => {
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    throw new Error('expected an aborted signal');
  }) as unknown as typeof fetch;
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchCurrentFx('SGD', 'EUR', controller.signal), (err: unknown) => {
    return err instanceof DOMException && err.name === 'AbortError';
  });
});

test('backend error codes are preserved for the UI', async () => {
  respondWith({ error: 'This currency is not supported yet.', code: 'UNSUPPORTED_CURRENCY' }, 400);
  await assert.rejects(fetchCurrentFx('SGD', 'EUR'), (err: unknown) => err instanceof FxApiError && err.code === 'UNSUPPORTED_CURRENCY');

  respondWith({ error: 'limit', code: 'PROVIDER_RATE_LIMIT' }, 503);
  await assert.rejects(fetchHistoryFx('SGD', 'VND'), (err: unknown) => err instanceof FxApiError && err.code === 'PROVIDER_RATE_LIMIT');
});
