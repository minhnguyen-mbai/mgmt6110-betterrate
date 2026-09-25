import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import App from '../src/App';
import { ComparisonPage } from '../src/components/ComparisonPage';
import {
  comparisonReducer,
  initialComparisonState,
  selectComparison,
  getPairKey,
  ComparisonState,
} from '../src/state/comparisonState';
import { CurrencyCode, BenchmarkType } from '../src/types';

const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

function page(state: ComparisonState) {
  return renderToStaticMarkup(
    <ComparisonPage
      state={state}
      result={selectComparison(state)}
      onChangeCurrency={noop}
      onSwap={noop}
      onBenchmarkChange={noop}
      onAmountChange={noop}
      onCheck={noop}
      onCheckAnother={noop}
    />
  );
}

function loadedState(have: CurrencyCode, want: CurrencyCode, rate: number, avg7: number, avg30: number, benchmark: BenchmarkType = '7d', amount: number | null = null) {
  let s: ComparisonState = { ...initialComparisonState, haveCurrency: have, wantCurrency: want, benchmark, amount };
  s = comparisonReducer(s, { type: 'REQUEST_START' });
  const pairKey = getPairKey(have, want);
  const [base, quote] = pairKey.split('/');
  return comparisonReducer(s, {
    type: 'REQUEST_SUCCESS',
    requestId: s.requestId,
    pairKey,
    current: { from: base, to: quote, rate, lastRefreshed: '2026-09-25', timeZone: null, provider: 'Frankfurter' },
    history: {
      from: base,
      to: quote,
      lastRefreshed: '2026-09-24',
      timeZone: null,
      provider: 'Frankfurter',
      method: 'direct-pair',
      derivation: 'direct',
      methodology: 'Frankfurter daily reference rates',
      benchmarks: {
        '7d': { average: avg7, observationCount: 5, startDate: '2026-09-18', endDate: '2026-09-24' },
        '30d': { average: avg30, observationCount: 21, startDate: '2026-08-26', endDate: '2026-09-24' },
      },
      daily: [
        { date: '2026-09-23', close: avg7 },
        { date: '2026-09-24', close: avg7 },
      ],
    },
  });
}

test('13/14/15/16. full app: one page, no stepper, no summary screen, Disqus and privacy notice present', () => {
  const html = renderToStaticMarkup(<App />);
  const t = text(html);
  assert.ok(html.includes('id="comparison-page"'));
  for (const gone of ['Screen 1 of 3', 'Screen 2 of 3', 'Screen 3 of 3', 'View summary', 'Back to rate comparison', 'Rate Comparison', 'Final Takeaway', 'Decision Summary']) {
    assert.ok(!t.includes(gone), `should not contain "${gone}"`);
  }
  assert.ok(!html.includes('screen-indicator') && !html.includes('screen-3-summary'));
  assert.ok(html.includes('id="app-comments"') && html.includes('id="disqus_thread"'), 'Disqus renders');
  assert.ok(html.includes('id="privacy-notice"'), 'privacy notice renders');
  assert.ok(t.includes('This page uses Microsoft Clarity and Disqus'), 'privacy text intact');
  assert.ok(t.includes('Simulated Data'), 'header label left as is');
  assert.ok(html.includes('id="disclaimer-note"'), 'disclaimer on the page');
});

test('1/2/17. initial input: pair selectors with all currencies, benchmark choice, no amount field, no result yet', () => {
  const html = page(initialComparisonState);
  for (const id of ['i-have-select', 'i-want-select']) {
    const select = html.match(new RegExp(`<select id="${id}"[^>]*>(.*?)</select>`))?.[1] ?? '';
    const options = [...select.matchAll(/<option value="(\w+)"/g)].map((m) => m[1]);
    assert.deepEqual(options, ['SGD', 'EUR', 'GBP', 'JPY', 'AUD', 'MYR', 'THB', 'USD', 'VND']);
  }
  assert.ok(html.includes('id="currency-swap-button"'));
  assert.ok(html.includes('id="benchmark-7d-btn"') && html.includes('id="benchmark-30d-btn"'));
  assert.match(html, /id="benchmark-7d-btn"[^>]*aria-pressed="true"/);
  assert.match(html, /id="benchmark-30d-btn"[^>]*aria-pressed="false"/);
  assert.ok(html.includes('id="check-rate-btn"'));
  assert.ok(!html.includes('disabled=""'), 'check button enabled without an amount');
  assert.ok(!html.includes('id="amount-input"'), 'amount is not part of the decision setup');
  assert.ok(!html.includes('id="decision-result"'), 'no result before checking');
});

test('loading keeps the input visible and prevents repeated submission', () => {
  const s = comparisonReducer({ ...initialComparisonState, haveCurrency: 'SGD', wantCurrency: 'EUR' }, { type: 'REQUEST_START' });
  const html = page(s);
  assert.ok(html.includes('id="input-form-card"'));
  assert.match(html, /id="check-rate-btn"[^>]*disabled=""/);
  assert.ok(text(html).includes('Getting the latest SGD → EUR exchange-rate data'));
});

test('errors are shown on the same page', () => {
  let s = comparisonReducer(initialComparisonState, { type: 'REQUEST_START' });
  s = comparisonReducer(s, { type: 'REQUEST_FAILURE', requestId: s.requestId, code: 'PROVIDER_RATE_LIMIT', message: 'limit' });
  const html = page(s);
  assert.ok(html.includes('id="input-form-card"') && html.includes('id="fx-failure-state"'));
  assert.ok(text(html).includes('reached its request limit'));
  assert.ok(!html.includes('id="decision-result"'));
});

test('4/5/6/12. result on the same page: decision, compact comparison, details collapsed', () => {
  const html = page(loadedState('USD', 'SGD', 1.2798, 1.2769, 1.28));
  const t = text(html);
  assert.ok(html.includes('id="input-form-card"') && html.includes('id="decision-result"'), 'input and result on one page');
  assert.ok(t.includes('Better for converting USD to SGD'));
  assert.ok(t.includes('0.23% more favorable today'));
  assert.ok(t.includes('Today’s rate 1 USD = 1.2798 SGD'));
  assert.ok(t.includes('7-day average 1 USD = 1.2769 SGD'));
  assert.ok(t.includes('Difference +0.0029 SGD per USD'));
  assert.equal((t.match(/Better for converting USD to SGD/g) || []).length, 1, 'conclusion shown once');

  assert.match(html, /<details id="calculation-details"(?![^>]*\bopen\b)[^>]*>/, 'details collapsed by default');
  assert.ok(t.includes('Show calculation details'));
  assert.ok(t.includes('Percentage difference 0.23%'));
  assert.ok(t.includes('Observations 5 daily rates (2026-09-18 to 2026-09-24)'));
  assert.ok(t.includes('Frankfurter · Frankfurter daily reference rates'));

  assert.ok(html.includes('id="amount-calculator"') && html.includes('id="amount-input"'), 'optional amount after result');
  assert.ok(html.indexOf('id="primary-interpretation-card"') < html.indexOf('id="amount-calculator"'));
  assert.ok(html.indexOf('id="amount-calculator"') < html.indexOf('id="secondary-trend-container"'));
  assert.ok(html.indexOf('id="secondary-trend-container"') < html.indexOf('id="calculation-details"'));
  assert.ok(html.includes('id="check-another-rate-btn"'));

  const worse = text(page(loadedState('USD', 'SGD', 1.27, 1.2769, 1.28)));
  assert.ok(worse.includes('Less favorable for converting USD to SGD'));
  assert.ok(worse.includes('Difference −0.0069 SGD per USD'));
});

test('7. amount calculator shows the money impact from loaded data', () => {
  const t = text(page(loadedState('USD', 'SGD', 1.2798, 1.2769, 1.28, '7d', 3000)));
  assert.ok(t.includes('If you exchange US$3,000 today:'));
  assert.ok(t.includes('About 8.70 SGD more received today'));
  assert.ok(t.includes('Clear'));

  const buy = text(page(loadedState('SGD', 'EUR', 1.458, 1.4634, 1.4716, '30d', 1000)));
  assert.ok(buy.includes('If you buy €1,000 today:'));
  assert.ok(buy.includes('30-day average 1 EUR = 1.4716 SGD'));
});

test('9/17. multi-currency and swapped direction render the right labels', () => {
  const t = text(page(loadedState('EUR', 'SGD', 1.458, 1.4634, 1.4716)));
  assert.ok(t.includes('Selected pair: EUR ↔ SGD'));
  assert.ok(t.includes('Exchanging Euros to receive Singapore Dollars'));
  assert.ok(t.includes('Less favorable for converting EUR to SGD'));

  const vnd = text(page(loadedState('VND', 'SGD', 20295.77, 20366.36, 20450.25)));
  assert.ok(vnd.includes('Paying Vietnamese Dong to receive Singapore Dollars'));
  assert.ok(vnd.includes('Today’s rate 1 SGD = 20,295.77 VND'));
});
