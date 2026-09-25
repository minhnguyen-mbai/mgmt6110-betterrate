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
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

function page(state: ComparisonState) {
  return renderToStaticMarkup(
    <ComparisonPage
      state={state}
      result={selectComparison(state)}
      onChangeCurrency={noop}
      onSwap={noop}
      onBenchmarkChange={noop}
      onCheck={noop}
      onCheckAnother={noop}
    />
  );
}

function loadedState(have: CurrencyCode, want: CurrencyCode, rate: number, avg7: number, avg30: number, benchmark: BenchmarkType = '7d') {
  let s: ComparisonState = { ...initialComparisonState, haveCurrency: have, wantCurrency: want, benchmark };
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

test('1/2/15/16/17. full app: simplified header, one page, no disclaimer card; Disqus and privacy notice remain', () => {
  const html = renderToStaticMarkup(<App />);
  const t = text(html);
  assert.ok(html.includes('id="brand-title"') && t.includes('BetterRate'));
  assert.ok(!t.includes('Simulated Data'), '"Simulated Data" removed');
  assert.ok(!t.includes('Know if today’s rate is better for you'), 'header subtitle removed');
  for (const gone of ['Screen 1 of 3', 'Screen 2 of 3', 'Screen 3 of 3', 'View summary', 'Final Takeaway', 'Decision Summary', 'Decision-Support Disclaimer']) {
    assert.ok(!t.includes(gone), `should not contain "${gone}"`);
  }
  assert.ok(!html.includes('id="disclaimer-note"'), 'large disclaimer card removed');
  assert.ok(t.includes('BetterRate provides exchange-rate comparison information only and is not financial advice.'));
  assert.ok(html.includes('id="app-comments"') && html.includes('id="disqus_thread"'), 'Disqus renders');
  assert.ok(html.includes('id="privacy-notice"'), 'privacy notice renders');
  assert.ok(t.includes('This page uses Microsoft Clarity and Disqus'), 'privacy text intact');
});

test('hero: heading plus one short sentence', () => {
  const t = text(page(initialComparisonState));
  assert.ok(t.includes('Is today’s rate better for you?'));
  assert.ok(t.includes('Compare today’s exchange rate with recent averages before you decide.'));
  assert.ok(!t.includes('Quick Decision Check'));
  assert.ok(!t.includes('so you can clearly see'));
});

test('3/4/5/7/8/18. inputs: simplified headings, selectors with all currencies, benchmark choice, new CTA', () => {
  const html = page(initialComparisonState);
  const t = text(html);
  assert.ok(t.includes('Choose currencies'));
  assert.ok(t.includes('Compare against'));
  for (const gone of ['Selected pair', '1. What currencies', '2. Compare today with', 'Historical benchmark', 'Converting VND → SGD', 'Paying Vietnamese Dong to receive']) {
    assert.ok(!t.includes(gone), `should not contain "${gone}"`);
  }
  assert.ok(!html.includes('id="currency-direction-pill"'));

  for (const id of ['i-have-select', 'i-want-select']) {
    const select = html.match(new RegExp(`<select id="${id}"[^>]*>(.*?)</select>`))?.[1] ?? '';
    const options = [...select.matchAll(/<option value="(\w+)"/g)].map((m) => m[1]);
    assert.deepEqual(options, ['SGD', 'EUR', 'GBP', 'JPY', 'AUD', 'MYR', 'THB', 'USD', 'VND']);
  }
  assert.ok(html.includes('id="currency-swap-button"'));
  assert.match(html, /id="benchmark-7d-btn"[^>]*aria-pressed="true"/);
  assert.match(html, /id="benchmark-30d-btn"[^>]*aria-pressed="false"/);

  assert.ok(t.includes('Compare today’s rate'));
  assert.ok(!t.includes('Check today’s rate'));
  assert.ok(!html.includes('id="decision-result"'), 'no result before comparing');
});

test('loading keeps the input visible and prevents repeated submission', () => {
  const s = comparisonReducer({ ...initialComparisonState, haveCurrency: 'SGD', wantCurrency: 'EUR' }, { type: 'REQUEST_START' });
  const html = page(s);
  assert.ok(html.includes('id="input-form-card"'));
  assert.match(html, /id="check-rate-btn"[^>]*disabled=""/);
  assert.ok(text(html).includes('Comparing today’s rate…'));
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

test('9/14. one decision card: decision, today, benchmark, difference; conclusion not repeated', () => {
  const html = page(loadedState('USD', 'SGD', 1.2797, 1.2769, 1.28));
  const t = text(html);
  assert.ok(html.includes('id="input-form-card"') && html.includes('id="decision-result"'));
  assert.ok(t.includes('Better for converting USD to SGD'));
  assert.ok(t.includes('0.22% more favorable today'));
  assert.ok(t.includes('Today’s rate 1 USD = 1.2797 SGD'));
  assert.ok(t.includes('7-day average 1 USD = 1.2769 SGD'));
  assert.ok(t.includes('Difference +0.0028 SGD per USD'));

  assert.equal(count(t, 'Better for converting USD to SGD'), 1, 'decision statement shown once');
  assert.equal(count(t, 'more favorable today'), 1, 'headline shown once');
  assert.ok(!html.includes('id="chart-plain-explainer"'), 'chart no longer restates the decision');
  assert.ok(!t.includes('Favorable vs. benchmark'));
  assert.ok(!html.includes('id="plain-language-explanation"'), 'details no longer restate the decision');
  assert.ok(!t.includes('How BetterRate works'));

  const worse = text(page(loadedState('USD', 'SGD', 1.27, 1.2769, 1.28)));
  assert.ok(worse.includes('Less favorable for converting USD to SGD'));
  assert.ok(worse.includes('Difference −0.0069 SGD per USD'));
});

test('10. amount section no longer exists', () => {
  const html = page(loadedState('USD', 'SGD', 1.2797, 1.2769, 1.28));
  const t = text(html);
  for (const id of ['amount-calculator', 'amount-input', 'preset-btn-500', 'clear-amount-btn', 'money-difference-highlight']) {
    assert.ok(!html.includes(`id="${id}"`), id);
  }
  assert.ok(!t.includes('What does this mean for my amount?'));
  assert.ok(!t.includes('Quick amounts'));
});

test('11/12/13. trend and calculation details are collapsed disclosures, in order', () => {
  const html = page(loadedState('USD', 'SGD', 1.2797, 1.2769, 1.2767, '30d'));
  const t = text(html);

  // Native <details>: collapsed by default (no "open"), toggled by its <summary>
  assert.match(html, /<details id="trend-details"(?![^>]*\bopen\b)[^>]*><summary/);
  assert.match(html, /<details id="calculation-details"(?![^>]*\bopen\b)[^>]*><summary/);
  assert.ok(t.includes('View 30-day trend') && t.includes('Hide 30-day trend'), 'expand / collapse labels');
  assert.ok(t.includes('Show calculation details') && t.includes('Hide calculation details'));

  // The chart lives inside the collapsed trend disclosure
  const trend = html.slice(html.indexOf('id="trend-details"'), html.indexOf('id="calculation-details"'));
  assert.ok(trend.includes('id="secondary-trend-container"') && trend.includes('id="trend-svg"'));
  assert.ok(trend.includes('30-day rate trend'));
  assert.ok(!t.includes('Secondary Reference'));
  assert.ok(trend.includes('id="current-rate-card"') && trend.includes('id="latest-close-card"'));
  assert.ok(trend.includes('id="benchmark-reference-line"'));

  // Details keep only calculation information
  const details = text(html.slice(html.indexOf('id="calculation-details"'), html.indexOf('id="check-another-rate-btn"')));
  assert.ok(details.includes('Percentage difference 0.23%'));
  assert.ok(details.includes('Observations 21 daily rates (2026-08-26 to 2026-09-24)'));
  assert.ok(details.includes('Frankfurter · Frankfurter daily reference rates'));
  assert.ok(!details.includes('favorable'), 'no decision statement in details');

  // Order: decision card -> trend -> details -> check another rate
  const order = ['primary-interpretation-card', 'trend-details', 'calculation-details', 'check-another-rate-btn'].map((id) => html.indexOf(`id="${id}"`));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(order.every((i) => i > 0));
});

test('6/18. multi-currency and swapped direction render the right decision', () => {
  const eurSgd = text(page(loadedState('EUR', 'SGD', 1.458, 1.4634, 1.4716)));
  assert.ok(eurSgd.includes('Less favorable for converting EUR to SGD'));
  assert.ok(eurSgd.includes('Today’s rate 1 EUR = 1.458 SGD'));

  const sgdEur = text(page(loadedState('SGD', 'EUR', 1.458, 1.4634, 1.4716)));
  assert.ok(sgdEur.includes('Better for converting SGD to EUR'));

  const vnd = text(page(loadedState('VND', 'SGD', 20295.77, 20366.36, 20450.25)));
  assert.ok(vnd.includes('Better for converting VND to SGD'));
  assert.ok(vnd.includes('Today’s rate 1 SGD = 20,295.77 VND'));
});
