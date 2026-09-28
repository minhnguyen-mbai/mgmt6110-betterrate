import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ComparisonPage } from '../src/components/ComparisonPage';
import {
  comparisonReducer,
  initialComparisonState,
  selectComparison,
  getPairKey,
  ComparisonState,
} from '../src/state/comparisonState';
import { CurrencyCode } from '../src/types';

/**
 * PS4 Bug #7: one interaction model. "Compare today's rate" fetches the first result for a pair;
 * after that, benchmark changes and swaps update the shown result from the loaded data, so the
 * button is replaced by a note saying so. A different pair clears the result and brings the
 * button back, so no result is ever shown for a selection it does not match.
 */

const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const NOTE = 'The result below updates when you change the benchmark or swap currencies.';

function render(state: ComparisonState) {
  const html = renderToStaticMarkup(
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
  // From the card's opening tag to the trend disclosure's opening tag, so only whole tags are stripped
  const start = html.lastIndexOf('<', html.indexOf('id="primary-interpretation-card"'));
  const primary = html.slice(start, html.lastIndexOf('<', html.indexOf('id="trend-details"')));
  return {
    html,
    t: text(html),
    hasCta: html.includes('id="check-rate-btn"'),
    hasNote: html.includes('id="live-update-note"'),
    hasResult: html.includes('id="decision-result"'),
    card: text(primary),
  };
}

/** A successful "Compare today's rate" for the current selection (market-quote data, as fetched). */
function compared(state: ComparisonState, rate = 19620, avg7 = 19850, avg30 = 19500): ComparisonState {
  const started = comparisonReducer(state, { type: 'REQUEST_START' });
  const pairKey = getPairKey(started.haveCurrency, started.wantCurrency);
  const [base, quote] = pairKey.split('/');
  return comparisonReducer(started, {
    type: 'REQUEST_SUCCESS',
    requestId: started.requestId,
    pairKey,
    current: { from: base, to: quote, rate, lastRefreshed: '2026-09-27 09:36:45', timeZone: 'UTC', provider: 'Alpha Vantage' },
    history: {
      from: base,
      to: quote,
      lastRefreshed: '2026-09-25',
      timeZone: 'UTC',
      benchmarks: {
        '7d': { average: avg7, observationCount: 5, startDate: '2026-09-19', endDate: '2026-09-25' },
        '30d': { average: avg30, observationCount: 21, startDate: '2026-08-27', endDate: '2026-09-25' },
      },
      daily: [{ date: '2026-09-25', close: avg7 }],
    },
  });
}

const vndSgd: ComparisonState = { ...initialComparisonState, haveCurrency: 'VND', wantCurrency: 'SGD', benchmark: '7d' };

test('Case A: before any result the button is the way to compare; while loading it is busy', () => {
  const idle = render(vndSgd);
  assert.ok(idle.hasCta && idle.t.includes('Compare today’s rate'));
  assert.ok(!idle.hasNote && !idle.hasResult);

  const loading = render(comparisonReducer(vndSgd, { type: 'REQUEST_START' }));
  assert.match(loading.html, /id="check-rate-btn"[^>]*disabled=""/);
  assert.ok(loading.t.includes('Comparing today’s rate…'));
  assert.ok(!loading.hasResult && !loading.hasNote);

  const done = render(compared(vndSgd));
  assert.ok(done.hasResult, 'pressing it produces a result');
  assert.ok(!done.hasCta, 'no "Compare today’s rate" beside a result that updates by itself');
  assert.ok(done.hasNote && done.t.includes(NOTE));
});

test('Case B/C: 7-day <-> 30-day updates the shown result without a request, and the button stays away', () => {
  const done = compared(vndSgd);
  const month = comparisonReducer(done, { type: 'SET_BENCHMARK', benchmark: '30d' });
  assert.equal(month.requestId, done.requestId, 'no new request');
  assert.equal(month.status, 'success');

  const m = render(month);
  assert.ok(m.hasResult && m.hasNote && !m.hasCta);
  assert.match(m.html, /id="benchmark-30d-btn"[^>]*aria-pressed="true"/);
  assert.match(m.card, /^Converting VND to SGD .*[\d.]+% below the 30-day average/);
  assert.ok(m.card.includes('30-day average 1 VND ='), 'benchmark row');
  assert.ok(m.card.includes('Today’s rate gives less SGD per VND than the 30-day average.'));
  assert.ok(m.card.includes('21 daily closes · Aug 27 – Sep 25, 2026'));
  assert.ok(!m.card.includes('7-day') && !m.card.includes('5 daily closes'), 'nothing left from 7-day');

  const w = render(comparisonReducer(month, { type: 'SET_BENCHMARK', benchmark: '7d' }));
  assert.ok(w.hasResult && w.hasNote && !w.hasCta);
  assert.match(w.html, /id="benchmark-7d-btn"[^>]*aria-pressed="true"/);
  assert.match(w.card, /[\d.]+% above the 7-day average/);
  assert.ok(w.card.includes('5 daily closes · Sep 19–25, 2026'));
  assert.ok(!w.card.includes('30-day') && !w.card.includes('21 daily closes'), 'nothing left from 30-day');
});

test('Case D: a swap updates the shown result to the reversed direction from the same data', () => {
  const done = compared(vndSgd);
  const swapped = comparisonReducer(done, { type: 'SWAP' });
  assert.deepEqual([swapped.haveCurrency, swapped.wantCurrency], ['SGD', 'VND']);
  assert.equal(swapped.requestId, done.requestId, 'same market quote: no new request');

  const s = render(swapped);
  assert.ok(s.hasResult && s.hasNote && !s.hasCta);
  assert.ok(s.card.startsWith('Converting SGD to VND'));
  assert.ok(s.card.includes('Today’s rate 1 SGD = 19,620.00 VND'));
  assert.ok(!s.card.includes('1 VND ='), 'no leftover VND -> SGD quote');
});

test('Case E: a different pair clears the old result and brings the button back', () => {
  const done = compared(vndSgd);
  const aud = comparisonReducer(done, { type: 'SET_CURRENCY', side: 'want', code: 'AUD' });
  assert.equal(aud.status, 'idle');
  assert.equal(aud.data, null);
  assert.ok(aud.requestId > done.requestId, 'any in-flight VND -> SGD response is ignored');

  const a = render(aud);
  assert.ok(!a.hasResult, 'no VND -> SGD result shown for VND -> AUD');
  assert.ok(!a.t.includes('1 VND = 0.0000'), 'no stale rate');
  assert.ok(a.hasCta && a.t.includes('Compare today’s rate') && !a.hasNote);

  const loading = render(comparisonReducer(aud, { type: 'REQUEST_START' }));
  assert.ok(loading.t.includes('Getting the latest VND → AUD exchange-rate data'));
  assert.ok(!loading.hasResult && !loading.hasNote);

  const audDone = render(compared(aud, 18350, 18354, 18554));
  assert.ok(audDone.hasResult && audDone.hasNote && !audDone.hasCta);
  assert.ok(audDone.card.startsWith('Converting VND to AUD'));
});

test('Case F: a failure for a new pair never shows the previous result as current', () => {
  const done = compared(vndSgd);
  let s = comparisonReducer(done, { type: 'SET_CURRENCY', side: 'want', code: 'THB' });
  s = comparisonReducer(s, { type: 'REQUEST_START' });
  const transient = render(
    comparisonReducer(s, { type: 'REQUEST_FAILURE', requestId: s.requestId, code: 'PROVIDER_ERROR', message: 'Rate data is temporarily unavailable. Please try again shortly.' })
  );
  assert.ok(!transient.hasResult && !transient.hasNote);
  assert.ok(transient.t.includes('Rate data is temporarily unavailable. Please try again shortly.'));
  assert.ok(transient.t.includes('Retry'), 'Bug #2: transient failures keep Retry');
  assert.ok(transient.hasCta, 'the compare button is available again');

  const unavailable = render(
    comparisonReducer(s, { type: 'REQUEST_FAILURE', requestId: s.requestId, code: 'PAIR_UNAVAILABLE', message: 'This currency pair is not currently supported. Please choose a different currency pair.' })
  );
  assert.ok(!unavailable.hasResult && !unavailable.t.includes('Retry'), 'Bug #2: no Retry for an unavailable pair');

  // A late response for the old pair cannot bring its result back
  const late = comparisonReducer(s, {
    type: 'REQUEST_SUCCESS',
    requestId: done.requestId,
    pairKey: 'SGD/VND',
    current: done.data!.current,
    history: done.data!.history,
  });
  assert.equal(late, s);
});

test('Case G: Bugs #1-#6 are intact in the live-updating result', () => {
  const c = render(compared(vndSgd)).card;
  assert.match(c, /Today’s rate 1 VND = 0\.0000\d+ SGD/); // #1
  assert.match(c, /Rate as of Sep 2[78], 2026/); // #3
  assert.match(c, /[\d.]+% above the 7-day average/); // #4, #6
  assert.ok(c.includes('5 daily closes · Sep 19–25, 2026')); // #5
  for (const word of ['better', 'worse', 'favorable']) assert.ok(!c.toLowerCase().includes(word), word); // #6
});
