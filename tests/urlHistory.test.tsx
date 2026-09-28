import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import App from '../src/App';
import { ComparisonPage } from '../src/components/ComparisonPage';
import {
  comparisonReducer,
  createInitialState,
  selectComparison,
  getPairKey,
  ComparisonState,
  ComparisonAction,
} from '../src/state/comparisonState';
import {
  parseSelection,
  searchWithSelection,
  canonicalizeLocation,
  recordShownComparison,
  LocationLike,
  HistoryLike,
} from '../src/state/urlState';
import { FxCurrentData, FxHistoryData } from '../src/types';

/**
 * PS4 Bug #8: a shown comparison has a canonical URL (?have=&want=&benchmark=), Back/Forward move
 * between shown comparisons, and opening such a URL loads that comparison from the API.
 */

// --- A minimal browser: a history stack whose Back/Forward fire popstate -------------------------
class FakeBrowser implements HistoryLike {
  entries: string[];
  index = 0;
  pushes = 0;
  replaces = 0;
  onPopState: (() => void) | null = null;
  constructor(search = '') {
    this.entries = [search];
  }
  get location(): LocationLike {
    return { pathname: '/', search: this.entries[this.index], hash: '' };
  }
  pushState(_: unknown, __: string, url: string) {
    this.entries = [...this.entries.slice(0, this.index + 1), url.slice(1)];
    this.index += 1;
    this.pushes += 1;
  }
  replaceState(_: unknown, __: string, url: string) {
    this.entries[this.index] = url.slice(1);
    this.replaces += 1;
  }
  back() {
    this.index -= 1;
    this.onPopState?.();
  }
  forward() {
    this.index += 1;
    this.onPopState?.();
  }
}

// --- Fixture data, as the API returns it (market quote) ------------------------------------------
const MARKET: Record<string, { rate: number; avg7: number; avg30: number }> = {
  'SGD/VND': { rate: 19620, avg7: 19850, avg30: 19500 },
  'AUD/VND': { rate: 18350, avg7: 18354, avg30: 18554 },
};

function payload(pairKey: string): { current: FxCurrentData; history: FxHistoryData } {
  const [from, to] = pairKey.split('/');
  const m = MARKET[pairKey];
  return {
    current: { from, to, rate: m.rate, lastRefreshed: '2026-09-27 09:36:45', timeZone: 'UTC', provider: 'Alpha Vantage' },
    history: {
      from,
      to,
      lastRefreshed: '2026-09-25',
      timeZone: 'UTC',
      benchmarks: {
        '7d': { average: m.avg7, observationCount: 5, startDate: '2026-09-19', endDate: '2026-09-25' },
        '30d': { average: m.avg30, observationCount: 21, startDate: '2026-08-27', endDate: '2026-09-25' },
      },
      daily: [{ date: '2026-09-25', close: m.avg7 }],
    },
  };
}

/**
 * The page's URL wiring from App.tsx, driven synchronously: initial state from the URL, canonicalize
 * on load, popstate -> RESTORE, auto-load for URL comparisons, and a history entry per shown result.
 */
class Page {
  state: ComparisonState;
  fetches: string[] = [];
  failWith: { code: 'PROVIDER_ERROR' | 'PAIR_UNAVAILABLE'; message: string } | null = null;
  constructor(public browser: FakeBrowser, options: { failWith?: Page['failWith'] } = {}) {
    this.failWith = options.failWith ?? null;
    this.state = createInitialState(parseSelection(browser.location.search));
    canonicalizeLocation(browser.location, browser);
    browser.onPopState = () => this.dispatch({ type: 'RESTORE', selection: parseSelection(browser.location.search) });
    this.settle();
  }
  dispatch(action: ComparisonAction) {
    this.state = comparisonReducer(this.state, action);
    this.settle();
  }
  /** "Compare today's rate" */
  compare() {
    const s = comparisonReducer(this.state, { type: 'REQUEST_START' });
    this.state = s;
    const pairKey = getPairKey(s.haveCurrency, s.wantCurrency);
    this.fetches.push(pairKey);
    if (this.failWith) {
      this.dispatch({ type: 'REQUEST_FAILURE', requestId: s.requestId, code: this.failWith.code, message: this.failWith.message });
    } else {
      this.dispatch({ type: 'REQUEST_SUCCESS', requestId: s.requestId, pairKey, ...payload(pairKey) });
    }
  }
  private settle() {
    const s = this.state;
    if (s.autoLoad && s.status === 'idle' && !s.data) return this.compare();
    if (selectComparison(s)) {
      recordShownComparison(this.browser.location, this.browser, {
        haveCurrency: s.haveCurrency,
        wantCurrency: s.wantCurrency,
        benchmark: s.benchmark,
      });
    }
  }
  get url() {
    return this.browser.location.search;
  }
  /** Rendered page text and the parts the tests check */
  view() {
    const html = renderToStaticMarkup(
      <ComparisonPage
        state={this.state}
        result={selectComparison(this.state)}
        onChangeCurrency={() => {}}
        onSwap={() => {}}
        onBenchmarkChange={() => {}}
        onCheck={() => {}}
        onCheckAnother={() => {}}
      />
    );
    const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    return { html, t, hasResult: html.includes('id="decision-result"'), hasCta: html.includes('id="check-rate-btn"') };
  }
}

// --- Cases ----------------------------------------------------------------------------------------

test('Case A: a selection serializes to the canonical query; other parameters are kept', () => {
  const sel = { haveCurrency: 'VND', wantCurrency: 'SGD', benchmark: '7d' } as const;
  assert.equal(searchWithSelection('', sel), '?have=VND&want=SGD&benchmark=7d');
  assert.equal(searchWithSelection('?utm=mail&have=X', sel), '?have=VND&want=SGD&benchmark=7d&utm=mail');
  assert.equal(searchWithSelection('?have=VND&want=SGD&benchmark=7d&utm=mail', null), '?utm=mail');
});

test('Case B: a valid query parses (case-insensitive) to the comparison it names', () => {
  assert.deepEqual(parseSelection('?have=VND&want=SGD&benchmark=30d'), { haveCurrency: 'VND', wantCurrency: 'SGD', benchmark: '30d' });
  assert.deepEqual(parseSelection('?benchmark=7D&want=sgd&have=%20vnd%20&x=1'), { haveCurrency: 'VND', wantCurrency: 'SGD', benchmark: '7d' });
});

test('Case C: invalid queries are rejected whole, never fetched, and removed from the URL in place', () => {
  const invalid = [
    '?have=ABC&want=SGD&benchmark=7d',
    '?have=SGD&want=SGD&benchmark=7d',
    '?have=VND&want=SGD&benchmark=99d',
    '?have=VND&want=SGD',
    '?have=&want=&benchmark=',
    '?have=VND&want=SGD&benchmark=',
  ];
  for (const search of invalid) {
    assert.equal(parseSelection(search), null, search);
    const browser = new FakeBrowser(`${search}&keep=1`);
    const page = new Page(browser);
    assert.equal(page.fetches.length, 0, `${search}: no API call`);
    assert.equal(page.state.status, 'idle');
    assert.deepEqual([page.state.haveCurrency, page.state.wantCurrency, page.state.benchmark], ['VND', 'SGD', '7d'], 'safe default form');
    assert.equal(page.url, '?keep=1', `${search}: comparison parameters removed`);
    assert.equal(browser.pushes, 0);
    assert.equal(browser.entries.length, 1, 'rewritten in place, no new entry');
    const { t } = page.view();
    assert.ok(!t.includes('undefined') && !t.includes('NaN'));
  }
});

test('Case D: a shared URL restores the comparison and loads it from the API, without adding history', () => {
  const browser = new FakeBrowser('?have=vnd&want=sgd&benchmark=30d');
  const page = new Page(browser);
  assert.equal(page.url, '?have=VND&want=SGD&benchmark=30d', 'canonicalized in place');
  assert.deepEqual(page.fetches, ['SGD/VND'], 'loaded once, without a button press');
  assert.equal(browser.pushes, 0, 'hydration adds no entry');
  assert.equal(browser.entries.length, 1);

  const { t, hasResult, hasCta } = page.view();
  assert.ok(hasResult && !hasCta, 'Bug #7: a shown result replaces the button with the note');
  assert.match(t, /Today’s rate 1 VND = 0\.0000\d+ SGD/);
  assert.match(t, /[\d.]+% below the 30-day average/);
  assert.ok(t.includes('21 daily closes · Aug 27 – Sep 25, 2026'));
});

test('Case D: the full App renders a shared URL’s selection before loading', () => {
  const g = globalThis as any;
  g.window = { location: { search: '?have=SGD&want=VND&benchmark=30d', pathname: '/', hash: '' } };
  try {
    const html = renderToStaticMarkup(<App />);
    assert.match(html, /<select id="i-have-select"[^>]*>.*?<option value="SGD" selected=""/);
    assert.match(html, /<select id="i-want-select"[^>]*>.*?<option value="VND" selected=""/);
    assert.match(html, /id="benchmark-30d-btn"[^>]*aria-pressed="true"/);
    assert.ok(!html.includes('id="decision-result"'), 'no result until the API has answered');
  } finally {
    delete g.window;
  }
});

test('Case E: benchmark switches are history entries; Back/Forward restore them without refetching', () => {
  const browser = new FakeBrowser('');
  const page = new Page(browser);
  page.compare();
  assert.equal(page.url, '?have=VND&want=SGD&benchmark=7d', 'first shown comparison gets its URL');
  assert.deepEqual(browser.entries, ['', '?have=VND&want=SGD&benchmark=7d'], 'pushed, so Back returns to the page, not away');

  page.dispatch({ type: 'SET_BENCHMARK', benchmark: '30d' });
  assert.equal(page.url, '?have=VND&want=SGD&benchmark=30d');
  assert.equal(browser.entries.length, 3);

  browser.back();
  assert.equal(page.state.benchmark, '7d');
  const week = page.view();
  assert.match(week.t, /[\d.]+% above the 7-day average/);
  assert.ok(week.t.includes('5 daily closes · Sep 19–25, 2026'));
  assert.ok(!week.t.includes('30-day average 1') && !week.t.includes('21 daily closes'), 'no stale 30-day result');
  assert.match(week.html, /id="benchmark-7d-btn"[^>]*aria-pressed="true"/);

  browser.forward();
  assert.equal(page.state.benchmark, '30d');
  assert.match(page.view().t, /[\d.]+% below the 30-day average/);

  assert.deepEqual(page.fetches, ['SGD/VND'], 'Back/Forward reuse the loaded data');
  assert.equal(browser.entries.length, 3, 'popstate adds no entries');

  browser.back();
  browser.back();
  assert.equal(page.url, '');
  assert.equal(page.state.status, 'idle', 'the blank page again: the initial form');
  assert.ok(!page.view().hasResult && page.view().hasCta);
});

test('Case F: a swap is a history entry; Back/Forward restore the direction', () => {
  const browser = new FakeBrowser('');
  const page = new Page(browser);
  page.compare();
  page.dispatch({ type: 'SWAP' });
  assert.equal(page.url, '?have=SGD&want=VND&benchmark=7d');
  assert.match(page.view().t, /Today’s rate 1 SGD = 19,620 VND/);

  browser.back();
  assert.deepEqual([page.state.haveCurrency, page.state.wantCurrency], ['VND', 'SGD']);
  const back = page.view().t;
  assert.match(back, /Today’s rate 1 VND = 0\.0000\d+ SGD/);
  assert.ok(back.includes('Converting VND to SGD') && !back.includes('1 SGD ='));

  browser.forward();
  assert.deepEqual([page.state.haveCurrency, page.state.wantCurrency], ['SGD', 'VND']);
  assert.ok(page.view().t.includes('Converting SGD to VND'));
  assert.deepEqual(page.fetches, ['SGD/VND']);
});

test('Case G: no duplicate entries from hydration, popstate, re-comparing or re-selecting the same state', () => {
  const browser = new FakeBrowser('?have=VND&want=SGD&benchmark=7d');
  const page = new Page(browser);
  assert.equal(browser.pushes, 0, 'hydration');

  page.dispatch({ type: 'SET_BENCHMARK', benchmark: '7d' });
  assert.equal(browser.pushes, 0, 'same benchmark again');

  page.dispatch({ type: 'RESET' });
  page.compare();
  assert.equal(browser.pushes, 0, '"Check another rate" then comparing the same pair again');

  page.dispatch({ type: 'SET_BENCHMARK', benchmark: '30d' });
  assert.equal(browser.pushes, 1);
  browser.back();
  browser.forward();
  browser.back();
  assert.equal(browser.pushes, 1, 'popstate never pushes');
  assert.equal(browser.entries.length, 2);

  assert.equal(recordShownComparison(browser.location, browser, { haveCurrency: 'VND', wantCurrency: 'SGD', benchmark: '7d' }), false);
});

test('Case H: an unsubmitted new pair clears the result, shows the button, and leaves the URL at the last comparison', () => {
  const browser = new FakeBrowser('');
  const page = new Page(browser);
  page.compare();
  page.dispatch({ type: 'SET_CURRENCY', side: 'want', code: 'AUD' });

  const pending = page.view();
  assert.ok(!pending.hasResult && pending.hasCta, 'Bug #7: result cleared, button back');
  assert.equal(page.url, '?have=VND&want=SGD&benchmark=7d', 'no URL claims a VND -> AUD comparison yet');
  assert.equal(browser.entries.length, 2);

  page.compare();
  assert.equal(page.url, '?have=VND&want=AUD&benchmark=7d', 'the new comparison gets its URL once shown');
  assert.equal(browser.entries.length, 3);

  // Back to the VND -> SGD entry: a different market quote, so it is loaded again
  browser.back();
  assert.deepEqual(page.fetches, ['SGD/VND', 'AUD/VND', 'SGD/VND']);
  assert.ok(page.view().t.includes('Converting VND to SGD'));
  assert.equal(browser.entries.length, 3);
});

test('Case I: a provider failure for a shared URL shows Bug #2 recovery, keeps the URL, and shows no stale result', () => {
  const browser = new FakeBrowser('?have=VND&want=AUD&benchmark=7d');
  const page = new Page(browser, {
    failWith: { code: 'PROVIDER_ERROR', message: 'Rate data is temporarily unavailable. Please try again shortly.' },
  });

  const failed = page.view();
  assert.equal(page.state.status, 'provider_error');
  assert.ok(!failed.hasResult);
  assert.ok(failed.t.includes('Rate data is temporarily unavailable. Please try again shortly.') && failed.t.includes('Retry'));
  assert.equal(page.url, '?have=VND&want=AUD&benchmark=7d', 'a valid URL stays valid');
  assert.equal(page.fetches.length, 1, 'no automatic retry loop');

  // Retry succeeds
  page.failWith = null;
  page.compare();
  assert.ok(page.view().t.includes('Converting VND to AUD'));
  assert.equal(browser.pushes, 0, 'already the URL of this comparison');

  const unavailable = new Page(new FakeBrowser('?have=VND&want=AUD&benchmark=7d'), {
    failWith: { code: 'PAIR_UNAVAILABLE', message: 'This currency pair is not currently supported. Please choose a different currency pair.' },
  });
  assert.ok(!unavailable.view().t.includes('Retry'), 'Bug #2: no Retry for an unavailable pair');
});

test('a late response for a comparison left via Back cannot overwrite the restored one', () => {
  const browser = new FakeBrowser('');
  const page = new Page(browser);
  page.compare(); // VND -> SGD shown
  page.dispatch({ type: 'SET_CURRENCY', side: 'want', code: 'AUD' });
  page.compare(); // VND -> AUD shown
  page.dispatch({ type: 'SET_CURRENCY', side: 'want', code: 'THB' });
  const started = comparisonReducer(page.state, { type: 'REQUEST_START' }); // THB request in flight
  page.state = started;

  // The unsubmitted THB change added no entry, so the current entry is still VND -> AUD and Back
  // goes to the entry before it: VND -> SGD, restored and loaded again
  browser.back();
  const restored = page.state;
  page.dispatch({
    type: 'REQUEST_SUCCESS',
    requestId: started.requestId,
    pairKey: 'THB/VND',
    ...payload('SGD/VND'),
  });
  assert.equal(page.state, restored, 'the THB response is ignored');
  assert.ok(page.view().t.includes('Converting VND to SGD'));
});

test('Case J: Bugs #1-#7 hold on a restored comparison', () => {
  const page = new Page(new FakeBrowser('?have=VND&want=SGD&benchmark=7d'));
  const { hasCta, html } = page.view();
  const cardHtml = html.slice(html.indexOf('id="decision-result"'), html.indexOf('id="trend-details"'));
  const t = cardHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(t, /Today’s rate 1 VND = 0\.0000\d+ SGD/); // #1
  assert.match(t, /Rate as of Sep 2[78], 2026/); // #3
  assert.match(t, /[\d.]+% above the 7-day average/); // #4, #6
  assert.ok(t.includes('5 daily closes · Sep 19–25, 2026')); // #5
  assert.ok(!/better|worse|favorable/i.test(t)); // #6 (result card)
  assert.ok(!hasCta && html.includes('id="live-update-note"')); // #7
});
