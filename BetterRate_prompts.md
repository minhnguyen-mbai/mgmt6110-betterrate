# prompts.md — BetterRate

**Course:** MGMT6110 Human–AI Collaboration  
**Project:** BetterRate  
**Purpose of this log:** chronological record of prompts, agent outputs, human checks, corrections, and manual verification used to build BetterRate.

> **Note:** I kept the prompts below in chronological order. Where a step was manual verification rather than an AI prompt, I label it clearly as **Human verification / no prompt**.

---

# 1. Product Framing Before Build

## Human decision

I defined BetterRate as a beginner-friendly exchange-rate comparison and decision-support tool.

Core question:

> **“Is today’s exchange rate better or worse for the currency conversion I want to make, compared with recent rates?”**

Secondary question when the user enters an amount:

> **“How much difference would that make in actual money?”**

Initial scope:

- Supported pair: VND ↔ SGD
- Benchmarks: 7-day average and 30-day average
- Amount: optional
- No forecasting
- No trading execution
- No recommendations to buy or sell
- No monitoring or alerts yet

The important product principle was:

> BetterRate should interpret exchange-rate movement for the user’s direction instead of asking the user to interpret a chart.

---

# 2. Prompt 1 — Initial Mock Frontend

## Exact prompt

```text
ROLE

You are a senior product designer and front-end engineer specializing in simple consumer financial tools for people who are not professional traders.

GOAL

Build a beginner-friendly web application called BetterRate.

BetterRate helps a user understand whether today’s exchange rate is better or worse for the currency exchange they want to make, compared with a recent historical benchmark.

The product should answer two questions:

1. “Is today’s exchange rate better or worse for me compared with recent rates?”
2. “If I know the amount I want to exchange, how much difference does that make in actual money?”

The user should not need to interpret a forex chart or understand professional FX terminology.

PRODUCT POSITIONING

BetterRate is:

“An exchange-rate comparison and decision-support tool.”

It is NOT:

- a forex trading platform,
- a currency-exchange service,
- an investment product,
- a forecasting tool,
- financial advice.

Suggested tagline:

“Know if today’s rate is better for you.”


TARGET USER

A normal consumer who occasionally needs to exchange currencies for reasons such as:

- travel,
- overseas expenses,
- tuition,
- remittance,
- purchases,
- savings,
- personal cash-flow needs.

Do not design only for one scenario such as monthly rent.


CORE USER FLOW

The user should:

1. choose the currencies they have and want,
2. specify whether they want to buy or sell the target currency,
3. choose a historical benchmark,
4. optionally enter an exchange amount,
5. see whether today is better or worse for their direction,
6. understand the difference in percentage,
7. if an amount is entered, understand the difference in actual money.


SUPPORTED MVP

For this first mock version, support one currency pair:

VND ↔ SGD

The interface should still make the direction explicit.

Example:

I have:
VND

I want:
SGD

Action:
Buy SGD

Benchmarks:

- 7-day average
- 30-day average

Amount:

Optional

Example:
S$3,000


IMPORTANT PRODUCT LOGIC

The meaning of “better” depends on the user’s direction.

Example:

If the user wants to BUY SGD using VND:

A lower SGD/VND rate is better.

If the user wants to SELL SGD for VND:

A higher SGD/VND rate is better.

Do not label a rate simply as “good” or “bad” without considering the user’s direction.

Use transparent deterministic calculations.

Do not use AI prediction.


MOCK DATA

Use clearly labelled mock data only in this first version.

Example mock values:

Today:
1 SGD = 19,620 VND

7-day average:
1 SGD = 19,850 VND

30-day average:
1 SGD = 19,700 VND

For a user buying SGD:

Today is approximately 1.16% more favorable than the 7-day average.

If the optional amount is S$3,000:

Today’s estimated cost:
58,860,000 VND

At the 7-day average:
59,550,000 VND

Difference:
approximately 690,000 VND less today.

Use calculations rather than hard-coding the final explanation.


OUTPUT

Build a responsive React and TypeScript front end.

Use no more than three screens.


SCREEN 1 — CHECK A RATE

Main heading:

“Is today’s rate better for you?”

Help text should explain in simple language that BetterRate compares today’s rate with recent rates.

Inputs:

1. I have
   VND

2. I want
   SGD

3. What do you want to do?
   - Buy SGD
   - Sell SGD

4. Compare today with:
   - 7-day average
   - 30-day average

5. Amount
   Optional

Example:
S$3,000

Primary CTA:

“Check today’s rate”


SCREEN 2 — RATE COMPARISON

Make the interpretation the strongest result.

Example:

“Better for buying SGD”

Then show:

Today’s rate
1 SGD = 19,620 VND

7-day average
1 SGD = 19,850 VND

1.16% more favorable today

If the user entered an amount, show:

“What this means for S$3,000”

Today:
58.86M VND

At the 7-day average:
59.55M VND

Difference:
About 690K VND less today

Use plain language.

Do not make the user calculate or interpret the percentage themselves.

A small simple historical trend visualization may appear as secondary information, but the chart must NOT be the primary answer.

The primary value of BetterRate is the interpretation.


SCREEN 3 — SUMMARY

Summarize the user’s comparison.

Example:

“Today is better than your selected benchmark”

Show:

- Buy SGD
- Compared with 7-day average
- 1.16% more favorable
- About 690K VND difference for S$3,000

Primary CTA:

“Check another rate”

Do not implement real monitoring or alerts yet.


BEGINNER LANGUAGE

Prefer:

- “Today’s rate”
- “Recent average”
- “Better for buying SGD”
- “Worse for selling SGD”
- “About 690K VND less”
- “Compare with”

Avoid professional FX terminology such as:

- currency pair,
- bid,
- ask,
- spread,
- pip,
- forex position,
- long,
- short,
- technical indicator,
- moving-average crossover,
- trading signal.

If a financial concept is necessary, explain it briefly in everyday language.


DESIGN PRINCIPLES

1. The user should understand the product within five seconds.

2. The interpretation should be more prominent than the raw exchange-rate chart.

3. Percentage change is secondary to the plain-language conclusion.

4. If an amount is entered, monetary impact should be prominent.

5. Keep the interface lightweight and calm.

6. Prioritize mobile usability.

7. Design for approximately 390px mobile width as well as desktop.

8. One screen should focus on one job.


GUARDRAILS

Do not add:

- real currency conversion,
- bank integration,
- wallets,
- payments,
- forex execution,
- candlestick charts,
- professional trading charts,
- technical indicators,
- FX forecasts,
- AI price prediction,
- news,
- portfolios,
- P&L,
- leverage,
- trading signals,
- recommendations to buy or sell,
- account creation,
- login,
- database,
- notifications,
- automated monitoring.

Do not say:

- “This is the best rate.”
- “You should exchange now.”
- “SGD will rise.”
- “SGD will fall.”
- “This is the best time to buy.”

Instead say:

- “Today is more favorable than the selected benchmark.”
- “Today is less favorable than the selected benchmark.”
- “For your amount, this represents approximately X difference.”

DATA

Use mock data only.

Do not connect an API yet.

Clearly label mock exchange-rate data as simulated or mock data.

SUCCESS CRITERIA

The prototype is successful if a first-time user can:

1. understand what BetterRate does,
2. choose Buy SGD or Sell SGD,
3. select a benchmark,
4. optionally enter an amount,
5. immediately understand whether today is better or worse for them,
6. understand the approximate monetary difference,
7. complete the flow without needing to understand a forex chart.
```

## What came back

The agent created a three-screen frontend:

- Check Rate
- Rate Comparison
- Summary

The interface clearly highlighted:

- today’s rate,
- selected benchmark,
- percentage difference,
- monetary difference,
- a secondary historical trend chart.

However, the initial version used both:

- `I have / I want`
- and a separate `Buy SGD / Sell SGD`

This duplicated the same user intent and allowed contradictory states.

## Human judgment

I decided that currency direction itself should define intent.

Example:

```text
I have VND
I want SGD
```

already means:

```text
Convert VND → SGD
```

The separate Buy/Sell selector was unnecessary.

---

# 3. Prompt 2 — Fix Product Logic and Simplify Summary

## Exact prompt

```text
Review the current BetterRate prototype for product-logic clarity and beginner simplicity.

Do not redesign the application.
Do not connect an API yet.
Keep the current mock data and three-screen structure.

The current interface is strong overall, but fix these three issues.

1. REMOVE DUPLICATE BUY / SELL LOGIC

Currently the interface shows:

"I have: VND"
"I want: SGD"

and separately asks the user to choose:

"Buy SGD"
"Sell SGD"

This creates contradictory states.

Use the currency direction itself as the user's intent.

Example:

I have: VND
I want: SGD

means:

Convert VND → SGD

If the currencies are swapped:

I have: SGD
I want: VND

means:

Convert SGD → VND

Remove the separate Buy SGD / Sell SGD selector.

Keep the internal comparison logic correct:

- For VND → SGD, a lower SGD/VND rate is more favorable.
- For SGD → VND, a higher SGD/VND rate is more favorable.

Use beginner-friendly wording such as:

"Better for converting VND to SGD"

rather than requiring the user to understand buy/sell terminology.


2. MAKE BENCHMARK CHOICES NEUTRAL

Remove language that recommends one benchmark to the user.

Do not say:

"Recommended if you need to exchange in the next few days."

Instead explain each benchmark neutrally.

For example:

7-day average:
"Shows how today's rate compares with the recent week."

30-day average:
"Gives a broader view of the past month."

The user should choose the reference period.
BetterRate should not recommend a benchmark.


3. SIMPLIFY THE SUMMARY SCREEN

The current Summary screen repeats too much of the explanation already shown
on the Rate Comparison screen.

Keep the Summary focused on the final takeaway.

It should show:

- currency direction,
- selected benchmark,
- percentage difference,
- monetary difference if an amount was entered,
- "Check another rate" CTA.

Remove repeated step-by-step calculation explanations unless they are necessary
to understand the result.

The detailed calculation can remain on the Rate Comparison screen.

GUARDRAILS

Do not add:
- forecasts,
- recommendations,
- trading terminology,
- new screens,
- financial advice,
- monitoring,
- alerts,
- API integration.

Keep the historical chart secondary to the interpretation.

Keep mock-data disclosure visible.

After the changes, briefly explain:
1. what was simplified,
2. how currency direction now determines interpretation,
3. what information was removed from the Summary screen.
```

## What came back

The agent:

- removed the duplicated Buy/Sell selector,
- used VND → SGD or SGD → VND as the only direction signal,
- made benchmark descriptions neutral,
- shortened the Summary screen.

## Human judgment

This was a meaningful improvement because the interface required less explanation.

The main lesson was:

> Beginner-friendly design is not necessarily “more explanation.” It can be fewer decisions and clearer product logic.

---

# 4. Prompt 3 — Mobile 390px QA

## Exact prompt

```text
Review and optimize the current BetterRate prototype specifically for a mobile viewport of approximately 390px width.

Do not redesign the product.
Do not add new features.
Do not change the comparison logic or mock data.
Do not connect an API yet.

Keep the existing three-screen flow:

1. Check Rate
2. Rate Comparison
3. Summary

GOAL

A first-time user should be able to complete the BetterRate flow comfortably on a phone without zooming, horizontal scrolling, clipped text, or confusing layouts.

MOBILE REQUIREMENTS

Across all screens:

- No horizontal scrolling.
- No clipped or overlapping text.
- No number or currency value should overflow its container.
- Primary actions should be easy to tap.
- Keep comfortable spacing between interactive elements.
- Preserve clear visual hierarchy.
- Keep the desktop experience intact.

SCREEN 1 — CHECK RATE

Optimize the current layout for mobile.

1. Currency direction

The current intent is defined by:

I have → I want

Example:

VND → SGD

Make sure this remains easy to understand on a narrow screen.

If the two currency boxes do not fit comfortably side by side, stack or adapt them without changing the logic.

The swap control should remain easy to tap.

2. Benchmark choices

Keep:

- 7-day average
- 30-day average

On mobile, make each benchmark option easy to read and select.

Do not compress both cards if this makes the descriptions difficult to read.

3. Optional amount

The amount input should:

- fit comfortably within the screen,
- make the target currency clear,
- support larger values without overflow,
- keep the optional nature clear.

Quick amount examples should wrap cleanly if needed.

4. Primary CTA

Keep:

"Check today’s rate"

Make it prominent and easy to tap.


SCREEN 2 — RATE COMPARISON

The primary answer should remain the visual focus.

Example:

"Better for converting VND to SGD"

"0.41% more favorable today"

Keep this interpretation stronger than:

- raw exchange rates,
- percentage details,
- historical chart.

For the rate comparison section:

- Today’s rate
- Selected benchmark
- Rate difference

should remain readable on a narrow screen.

If two comparison cards do not fit comfortably side by side, stack them.

For the optional amount section:

Make the monetary impact highly visible.

Example:

"About 80K VND less today"

The user should be able to understand this result without reading the chart.

The historical chart must remain secondary.

Make sure the chart:

- fits within the viewport,
- does not create horizontal scrolling,
- keeps labels readable,
- does not dominate the screen.

Keep:

"Change inputs"
"View summary"

If they do not fit comfortably side by side, stack them.


SCREEN 3 — SUMMARY

Keep the Summary concise.

It should clearly show:

- currency direction,
- selected benchmark,
- percentage difference,
- monetary difference if an amount was entered.

Keep:

"Check another rate"

as the main CTA.

Avoid reintroducing long calculation explanations.

The user should be able to scan the result quickly on a phone.


BEGINNER CLARITY

Check that mobile layout does not create ambiguity around:

- which currency the user has,
- which currency the user wants,
- which benchmark is selected,
- whether today is more or less favorable,
- what the amount difference means.

GUARDRAILS

Do not add:

- mobile navigation menus,
- bottom navigation,
- new screens,
- forecasts,
- recommendations,
- monitoring,
- alerts,
- trading features,
- additional charts,
- new educational sections.

Do not change:

- benchmark calculation logic,
- mock rate values,
- currency-direction logic,
- three-screen structure.

Only make responsive layout, spacing, typography, wrapping, hierarchy, and tap-target improvements required for mobile usability.

After making the changes, summarize:

1. which mobile issues you found,
2. which elements were stacked or resized,
3. how the chart was adapted,
4. whether any remaining mobile limitations exist.
```

## What came back

The agent adapted the layout for narrow screens.

Human inspection later confirmed:

- no horizontal scrolling,
- currency cards remained understandable,
- benchmark cards remained readable,
- primary actions were reachable,
- the chart fit within the mobile layout.

---

# 5. Prompt 4 — Final Front-End QA Before API Integration

## Exact prompt

```text
Perform a final front-end QA review of the current BetterRate prototype before connecting it to a real exchange-rate API.

Do not redesign the application.
Do not add new features.
Do not change the current mock calculation logic.
Do not connect any external API yet.

Keep the existing three-screen flow:

1. Check Rate
2. Rate Comparison
3. Summary

GOAL

Confirm that a first-time user can understand and complete the BetterRate flow without needing forex or trading knowledge.

BetterRate should answer:

“Is today’s exchange rate better or worse for the currency conversion I want to make, compared with a recent benchmark?”

If the user enters an amount, BetterRate should also answer:

“How much difference would that make in actual money?”


CHECK THE FULL USER FLOW

1. The user understands which currency they currently have.
2. The user understands which currency they want.
3. Currency direction defines the interpretation automatically.

Example:

VND → SGD

means the user is converting VND into SGD.

For this direction:
a lower SGD/VND rate is more favorable.

SGD → VND

means the user is converting SGD into VND.

For this direction:
a higher SGD/VND rate is more favorable.

4. The user selects:
- 7-day average
or
- 30-day average

5. The user may optionally enter an amount.

6. The user sees:
- today’s rate,
- selected benchmark,
- percentage difference,
- whether today is more or less favorable for their direction.

7. If an amount is entered, the user sees the estimated monetary difference.

8. The user can view the Summary and start another comparison.


A. PURPOSE CLARITY

A user should understand within a few seconds that BetterRate compares today’s exchange rate with recent historical rates.

The product should not look like:

- a forex trading terminal,
- a currency exchange service,
- an investment app,
- a forecasting product.


B. CURRENCY-DIRECTION CLARITY

Confirm that there are no contradictory states.

The interface should use:

“I have”
and
“I want”

to determine the conversion direction.

Do not require a separate Buy / Sell decision if it duplicates the same intent.

The result should use beginner-friendly wording such as:

“Better for converting VND to SGD”

rather than relying on professional trading terminology.


C. BENCHMARK TRANSPARENCY

The user should always know which reference is being used.

Supported mock benchmarks:

- 7-day average
- 30-day average

Explain them neutrally.

Do not recommend one benchmark.

Do not imply that one period is objectively the best reference.


D. INTERPRETATION

The most important output should be:

- more favorable,
- less favorable,
- or approximately unchanged

for the user’s conversion direction.

The raw rate and percentage should support the conclusion,
not replace it.

Do not say:

- “Best rate”
- “You should exchange now”
- “Good time to buy”
- “SGD will rise”
- “SGD will fall”

Use transparent comparison language.


E. OPTIONAL AMOUNT IMPACT

If an amount is entered, confirm that the result clearly translates the rate difference into money.

Example:

“About 80K VND less today”

The monetary impact should be easier to understand than the percentage alone.

If no amount is entered, BetterRate should still provide a useful rate comparison without displaying broken or empty monetary values.


F. CHART ROLE

The historical chart must remain secondary.

The user should understand the answer without reading the chart.

Confirm that:

- the chart does not dominate the result,
- it supports the comparison,
- labels fit on desktop and mobile,
- it does not introduce trading-style indicators.


G. SUMMARY SCREEN

Keep the Summary concise.

It should show:

- currency direction,
- selected benchmark,
- percentage difference,
- monetary difference if available,
- “Check another rate”.

Do not repeat the full calculation explanation already shown on the Rate Comparison screen.


H. MOBILE USABILITY

Check all three screens at approximately 390px width.

Confirm:

- no horizontal scrolling,
- no clipped text,
- no overlapping elements,
- no currency value overflow,
- currency selectors remain understandable,
- benchmark options are easy to select,
- optional amount input is usable,
- chart fits within the viewport,
- primary buttons are easy to tap.


I. FUNCTIONAL QA

Check that:

- swapping currencies changes the direction correctly,
- changing the benchmark updates the comparison,
- adding an amount updates monetary impact,
- clearing the amount still leaves a valid comparison,
- Rate Comparison uses the selected benchmark,
- Summary carries the correct values,
- Check another rate returns to the first screen,
- no value displays undefined, NaN, null, or an invalid number.


J. PRODUCT SCOPE

Confirm that the product contains no unnecessary features.

Do not add:

- forex execution,
- bank connection,
- wallet,
- account,
- P&L,
- leverage,
- technical indicators,
- candlestick charts,
- forecasts,
- trading signals,
- recommendations,
- news,
- monitoring,
- alerts,
- AI prediction.


OUTPUT

Fix only issues that fail the checks above.

Do not make stylistic changes just for variety.

Do not add anything new.

After the review, summarize:

1. which issues you found,
2. which issues you changed,
3. which parts already passed and were left unchanged,
4. any remaining limitations that should be addressed when real FX data is connected.
```

## Human verification

After this prompt I manually reviewed the three screens and froze the frontend before API integration.

---

# 6. Human Verification — Alpha Vantage Historical API

## No AI prompt

I manually called Alpha Vantage `FX_DAILY` for SGD → VND before asking the agent to write backend code.

The real provider response contained:

```text
Meta Data
→ 5. Last Refreshed
→ 6. Time Zone

Time Series FX (Daily)
→ date
→ 1. open
→ 2. high
→ 3. low
→ 4. close
```

Example real values included:

```text
2026-09-11 close = 20456.15974
2026-09-10 close = 20442.42902
2026-09-09 close = 20495.29235
2026-09-08 close = 20537.67692
2026-09-07 close = 20548.97314
```

## Human decision

I defined the benchmark as:

### 7-day average

Average all available daily **close** observations within the 7 calendar days ending on the provider’s latest historical refresh date.

### 30-day average

Average all available daily **close** observations within the 30 calendar days ending on the provider’s latest historical refresh date.

I deliberately did **not** divide automatically by 7 or 30 because weekends or missing daily observations mean that the number of actual observations may be smaller.

For the manually inspected data:

```text
Historical last refreshed:
2026-09-11

7-day window:
2026-09-05 → 2026-09-11

Available observations:
5

7-day average:
≈ 20496.106234 VND per SGD
```

and:

```text
30-day window:
2026-08-13 → 2026-09-11

Available observations:
22

30-day average:
≈ 20514.010565 VND per SGD
```

---

# 7. Human Verification — Alpha Vantage Current FX API

## No AI prompt

I manually called Alpha Vantage `CURRENCY_EXCHANGE_RATE` for SGD → VND.

The real response contained:

```text
Realtime Currency Exchange Rate
→ 5. Exchange Rate
→ 6. Last Refreshed
→ 7. Time Zone
```

A real response at the time of verification included:

```text
Exchange Rate:
20436.65187524

Last Refreshed:
2026-09-13 01:44:10

Time Zone:
UTC
```

This confirmed the real response shape before backend implementation.

---

# 8. Prompt 5 — Backend Master Prompt

## Exact prompt

```text
ROLE

You are a senior full-stack developer working in my existing BetterRate
React and TypeScript project.

Do not redesign the existing interface.
Do not change the product concept.

Add a secure backend that replaces the current simulated FX data with real
Alpha Vantage exchange-rate data.

BetterRate helps a user answer:

“Is today’s exchange rate better or worse for the currency conversion I want
to make, compared with a recent historical benchmark?”

If the user enters an amount, BetterRate should also show:

“How much monetary difference does that make?”

Create three serverless functions:

1. api/fx-current.js
2. api/fx-history.js
3. api/health.js


--------------------------------
1. API/FX-CURRENT.JS
--------------------------------

Fetch the current SGD → VND exchange rate from Alpha Vantage using:

function=CURRENCY_EXCHANGE_RATE
from_currency=SGD
to_currency=VND

Read the credential only from:

process.env.ALPHAVANTAGE_API_KEY

From the actual provider response, use:

"Realtime Currency Exchange Rate"
→ "5. Exchange Rate"
→ "6. Last Refreshed"
→ "7. Time Zone"

Return normalized data only.

Example:

{
  "from": "SGD",
  "to": "VND",
  "rate": 20436.65187524,
  "lastRefreshed": "2026-09-13 01:44:10",
  "timeZone": "UTC"
}

Convert numeric strings into JavaScript numbers.

Do not return bid price or ask price.

Do not invent timestamps.

If Last Refreshed or Time Zone is missing, preserve null.


--------------------------------
2. API/FX-HISTORY.JS
--------------------------------

Fetch Alpha Vantage FX_DAILY using:

function=FX_DAILY
from_symbol=SGD
to_symbol=VND
outputsize=compact

Read the credential only from:

process.env.ALPHAVANTAGE_API_KEY

The actual response structure is:

"Meta Data"
→ "5. Last Refreshed"
→ "6. Time Zone"

and:

"Time Series FX (Daily)"
→ date
→ "4. close"


Use only daily CLOSE values for benchmark calculations.

Do not use:
- open
- high
- low

CALCULATE TWO BENCHMARKS

A. 7-day average

Definition:

Average all available daily close observations inside the 7 calendar days
ending on the provider’s latest historical refresh date.

Do NOT divide automatically by 7.

Only divide by the number of valid observations actually available in that
calendar window.

B. 30-day average

Definition:

Average all available daily close observations inside the 30 calendar days
ending on the provider’s latest historical refresh date.

Do NOT divide automatically by 30.

Only divide by the number of valid observations actually available in that
calendar window.

Example based on the real provider response:

Latest historical refresh date:
2026-09-11

7-day window:
2026-09-05 through 2026-09-11

Available observations:
5

Calculated 7-day average:
approximately 20496.106234 VND per SGD

30-day window:
2026-08-13 through 2026-09-11

Available observations:
22

Calculated 30-day average:
approximately 20514.010565 VND per SGD


RETURN NORMALIZED DATA

Example:

{
  "from": "SGD",
  "to": "VND",
  "lastRefreshed": "2026-09-11",
  "timeZone": "UTC",
  "benchmarks": {
    "7d": {
      "average": 20496.106234,
      "observationCount": 5,
      "startDate": "2026-09-05",
      "endDate": "2026-09-11"
    },
    "30d": {
      "average": 20514.010565,
      "observationCount": 22,
      "startDate": "2026-08-13",
      "endDate": "2026-09-11"
    }
  },
  "daily": [
    {
      "date": "2026-09-11",
      "close": 20456.15974
    }
  ]
}

Return normalized daily points only if needed for the existing trend chart.

Do not expose raw Alpha Vantage response fields to the browser.


--------------------------------
3. API/HEALTH.JS
--------------------------------

Create:

/api/health

Return:

- service: BetterRate
- whether ALPHAVANTAGE_API_KEY is configured
- whether Alpha Vantage can be reached
- upstream status if available
- checkedAt timestamp

Never return:

- the API key
- API key prefix
- API key length
- any credential fragment


--------------------------------
FRONT-END INTEGRATION
--------------------------------

Replace the current simulated:

- today’s SGD/VND rate
- 7-day average
- 30-day average
- trend chart data

with:

/api/fx-current
/api/fx-history

Never call Alpha Vantage directly from browser code.


--------------------------------
COMPARISON LOGIC
--------------------------------

BetterRate supports two conversion directions.

A. VND → SGD

This means the user is converting VND into SGD.

Because the rate is expressed as:

1 SGD = X VND

a LOWER rate is more favorable.

Use:

percentageDifference =
(benchmarkRate - currentRate)
÷ benchmarkRate
× 100

If currentRate < benchmarkRate:
“more favorable”

If currentRate > benchmarkRate:
“less favorable”

B. SGD → VND

This means the user is converting SGD into VND.

A HIGHER rate is more favorable.

Use:

percentageDifference =
(currentRate - benchmarkRate)
÷ benchmarkRate
× 100

If currentRate > benchmarkRate:
“more favorable”

If currentRate < benchmarkRate:
“less favorable”

If the difference is effectively zero after display rounding, use:

“approximately unchanged”

Do not say:
- good rate
- bad rate
- best rate
- best time to exchange
- you should exchange now


--------------------------------
OPTIONAL AMOUNT IMPACT
--------------------------------

If the user enters an amount in SGD:

moneyDifferenceVND =
absolute value of
(benchmarkRate - currentRate)
× amountSGD

Example:

Current rate:
20436.65187524

7-day average:
20496.106234

Amount:
S$1,000

Difference:
approximately 59,454 VND

For VND → SGD:

“About 59K VND less today”

For SGD → VND with the same current rate:

the interpretation is unfavorable because the user would receive less VND.

Keep the wording direction-aware.

If no amount is entered:
do not show a broken monetary section.


--------------------------------
FAILURE STATES
--------------------------------

The front end must distinguish:

LOADING

"Getting the latest exchange-rate data..."

EMPTY DATA

"We could not find enough exchange-rate data for this comparison."

PROVIDER ERROR

"The exchange-rate provider could not complete this request."

PROVIDER UNREACHABLE

"We cannot reach the exchange-rate service right now. Please try again later."

Never display:

- NaN
- undefined
- null
- fake fallback rates
- invented benchmark values


--------------------------------
SERVER-SIDE SAFETY
--------------------------------

Before Alpha Vantage requests:

Check:

process.env.ALPHAVANTAGE_API_KEY

If missing:
- return HTTP 503
- identify ALPHAVANTAGE_API_KEY as missing
- do not call the provider

After each provider request:

- check response.ok
- inspect the JSON body
- detect provider message responses such as Note, Information, or Error Message
- verify the expected response object exists
- validate every numeric rate before using it

Do not silently serve stale data after provider failure.

Do not invent missing provider metadata.


--------------------------------
CACHING
--------------------------------

Use reasonable Cache-Control headers.

Current FX data may be cached briefly.

Historical FX data may be cached longer because daily historical data changes
less frequently.

The user’s optional amount must be calculated locally and must NOT trigger a new
provider request.

Changing between 7-day and 30-day benchmark should reuse the same historical
response.

Explain the cache durations you choose.


--------------------------------
OUTPUT STRUCTURE
--------------------------------

Create:

api/
  fx-current.js
  fx-history.js
  health.js

The api folder must be at the PROJECT ROOT beside package.json.

Keep:

- current BetterRate three-screen flow
- existing mobile responsiveness
- current beginner-friendly design
- existing secondary chart role

Do not redesign the product.


--------------------------------
GUARDRAILS
--------------------------------

Never write ALPHAVANTAGE_API_KEY into code.

Never create:

VITE_ALPHAVANTAGE_API_KEY

Never expose the credential in:

- browser code
- API response
- logs
- README
- comments

Do not add:

- database
- login
- trading execution
- currency conversion execution
- wallet
- bank connection
- monitoring
- alerts
- forecasts
- technical indicators
- trading signals
- AI prediction
- recommendations


--------------------------------
CONTEXT — REAL CURRENT RESPONSE
--------------------------------

{
  "Realtime Currency Exchange Rate": {
    "1. From_Currency Code": "SGD",
    "2. From_Currency Name": "Singapore Dollar",
    "3. To_Currency Code": "VND",
    "4. To_Currency Name": "Vietnamese Dong",
    "5. Exchange Rate": "20436.65187524",
    "6. Last Refreshed": "2026-09-13 01:44:10",
    "7. Time Zone": "UTC",
    "8. Bid Price": "20435.71587658",
    "9. Ask Price": "20437.28438962"
  }
}


--------------------------------
CONTEXT — REAL HISTORICAL RESPONSE SHAPE
--------------------------------

{
  "Meta Data": {
    "1. Information": "Forex Daily Prices (open, high, low, close)",
    "2. From Symbol": "SGD",
    "3. To Symbol": "VND",
    "4. Output Size": "Compact",
    "5. Last Refreshed": "2026-09-11",
    "6. Time Zone": "UTC"
  },

  "Time Series FX (Daily)": {
    "2026-09-11": {
      "1. open": "20440.85173",
      "2. high": "20490.63759",
      "3. low": "20404.94761",
      "4. close": "20456.15974"
    },

    "2026-09-10": {
      "1. open": "20552.25888",
      "2. high": "20563.64788",
      "3. low": "20393.40902",
      "4. close": "20442.42902"
    },

    "2026-09-09": {
      "1. open": "20529.76991",
      "2. high": "20575.84158",
      "3. low": "20452.85703",
      "4. close": "20495.29235"
    },

    "2026-09-08": {
      "1. open": "20544.23381",
      "2. high": "20585.67471",
      "3. low": "20488.74852",
      "4. close": "20537.67692"
    },

    "2026-09-07": {
      "1. open": "20566.08242",
      "2. high": "20626.23547",
      "3. low": "20503.94322",
      "4. close": "20548.97314"
    }
  }
}

After implementation, summarize:

1. files created,
2. normalized response shapes,
3. benchmark calculation method,
4. failure handling,
5. cache durations,
6. any assumptions still requiring human review.
```

## What came back

The agent created:

```text
api/
  fx-current.js
  fx-history.js
  health.js
```

and connected the frontend through:

```text
src/services/fxApi.ts
```

The agent also added deterministic direction-aware calculations.

---

# 9. Human Inspection — File Structure and Secret Boundary

## No AI prompt

I manually inspected:

```text
api/
  fx-current.js
  fx-history.js
  health.js
```

at the project root beside `package.json`.

`package.json` contained:

```json
"type": "module"
```

I searched the codebase for:

```text
ALPHAVANTAGE_API_KEY
VITE_ALPHAVANTAGE
alphavantage.co
```

Observed:

- `VITE_ALPHAVANTAGE` returned no result.
- `alphavantage.co` appeared only in server-side `/api` files.
- frontend code called `/api/fx-current` and `/api/fx-history`.
- the API key was read through `process.env.ALPHAVANTAGE_API_KEY`.

The frontend reference to the environment-variable name appeared only in an error message; the credential itself was not exposed.

---

# 10. Human Inspection — Problem Found in `fx-current.js`

## What looked right but was not fully acceptable

The agent had added a sanitized raw provider message:

```text
providerMessage: scrub(data['Error Message'])
```

It also treated every Alpha Vantage `Information` response as a specific daily/provider limit.

## Human judgment

I decided that BetterRate should not forward raw provider text to the browser and should not infer a specific provider reason unless the provider response clearly supported it.

---

# 11. Prompt 6 — Correct `fx-current.js` Provider Error Handling

## Exact prompt

```text
Review only api/fx-current.js.

Do not redesign the application.
Do not modify any other file.

The endpoint is mostly correct, but make provider error handling more truthful
and avoid exposing raw upstream messages.

1. DO NOT RETURN RAW PROVIDER ERROR TEXT

Currently the endpoint may return:

providerMessage: scrub(data['Error Message'])

Remove this field completely.

Do not forward Alpha Vantage Error Message, Note, Information, or any other
raw provider text to the browser.

Return only standardized BetterRate error messages and codes.

2. DO NOT ASSUME EVERY "Information" RESPONSE MEANS A DAILY LIMIT

Currently an Alpha Vantage "Information" response may be labelled as:

PROVIDER_DAILY_LIMIT

Do not invent a specific reason unless the response structure explicitly
supports it.

Map provider informational/refusal responses to a standardized provider
failure code such as:

PROVIDER_RATE_LIMIT

or:

PROVIDER_ERROR

using a generic user-facing message:

"The exchange-rate provider could not complete this request."

Keep any distinction only if it is clearly supported by the provider response.

KEEP

- response.ok validation
- JSON parse protection
- Note / Information / Error Message detection
- timeout handling
- process.env.ALPHAVANTAGE_API_KEY
- numeric rate validation
- null for missing provider metadata
- current Cache-Control behavior
- normalized successful response

DO NOT

- expose provider raw text
- expose credentials
- add fallback rates
- invent timestamps
- modify fx-history.js
- modify health.js
- modify the front end

After the change, briefly explain what was removed and how provider errors are
now normalized.
```

## What came back

The agent removed raw provider messages and kept standardized BetterRate errors.

---

# 12. Human Inspection — Problem Found in `fx-history.js`

## What looked right

The historical benchmark logic itself was correct:

```text
7-day window:
provider latest date minus 6 days

30-day window:
provider latest date minus 29 days
```

The code:

- used only `4. close`,
- averaged by actual observation count,
- returned `observationCount`,
- returned normalized daily points.

## Problems found

The agent still:

- returned a sanitized raw provider message,
- treated every `Information` response as a specific provider daily limit,
- defaulted missing timezone metadata to `"UTC"`.

## Human judgment

I decided missing provider metadata should remain missing rather than being invented.

---

# 13. Prompt 7 — Correct `fx-history.js` Data Integrity

## Exact prompt

```text
Review only api/fx-history.js.

Do not redesign the application.
Do not change the benchmark calculation logic.
Do not modify any other file.

The calendar-window and average calculations are correct.
Keep them exactly as they are.

Make only these provider-integrity corrections.

1. DO NOT RETURN RAW PROVIDER ERROR TEXT

Currently the endpoint may return:

providerMessage: scrub(data['Error Message'])

Remove this field completely.

Do not forward Alpha Vantage Error Message, Note, Information, or any other
raw provider text to the browser.

Return only standardized BetterRate error messages and error codes.


2. DO NOT ASSUME EVERY "Information" RESPONSE MEANS A DAILY LIMIT

Currently an Alpha Vantage "Information" response may be labelled as:

PROVIDER_DAILY_LIMIT

Do not invent a specific reason unless the provider response explicitly
supports it.

Normalize provider informational/refusal responses to a generic code such as:

PROVIDER_RATE_LIMIT

or:

PROVIDER_ERROR

with the user-facing message:

"The exchange-rate provider could not complete this request."


3. DO NOT INVENT TIMEZONE METADATA

Currently the historical endpoint may fall back to:

timeZone: "UTC"

if the provider does not supply a timezone.

Change this behavior so missing provider timezone remains:

null

Use only the timezone explicitly supplied by:

Meta Data
→ "6. Time Zone"


KEEP EXACTLY AS-IS

- FX_DAILY provider call
- SGD → VND pair
- outputsize=compact
- process.env.ALPHAVANTAGE_API_KEY
- response.ok validation
- JSON parse protection
- Time Series FX (Daily) validation
- provider Last Refreshed anchoring
- 7 calendar-day window
- 30 calendar-day window
- "4. close" as the only benchmark value
- averaging by actual observation count
- observationCount metadata
- startDate and endDate
- chronologically sorted 30-day daily points
- Cache-Control behavior
- normalized successful response

DO NOT

- change the 7-day or 30-day formulas
- divide by 7 or 30 automatically
- switch to latest 7 or 30 observations
- use open/high/low
- invent historical rates
- expose credentials
- modify fx-current.js
- modify health.js
- modify the front end

After the change, briefly explain what was removed and what remained unchanged.
```

## What came back

The agent:

- removed raw provider error text,
- stopped making unsupported assumptions about provider informational responses,
- preserved missing timezone as `null`,
- kept the benchmark formulas unchanged.

---

# 14. Human Inspection — Frontend Service and Calculation Logic

## No AI prompt

I manually inspected:

```text
src/services/fxApi.ts
src/utils/calculations.ts
src/App.tsx
```

### `fxApi.ts`

Verified:

- frontend calls only `/api/fx-current` and `/api/fx-history`,
- no direct Alpha Vantage call from the browser,
- `rate` must be a valid positive number,
- 7-day and 30-day benchmark averages must be valid numbers,
- provider/network failures are normalized,
- no mock fallback is used after API failure.

### `calculations.ts`

Verified:

For VND → SGD:

```text
percentage =
(benchmark - current)
÷ benchmark
× 100
```

Lower current rate = more favorable.

For SGD → VND:

```text
percentage =
(current - benchmark)
÷ benchmark
× 100
```

Higher current rate = more favorable.

Optional monetary impact:

```text
|benchmark - current| × amountSGD
```

Direction-aware wording:

```text
VND → SGD
"less today" / "more today"

SGD → VND
"more received today" / "less received today"
```

### `App.tsx`

Verified:

- current and historical APIs load together,
- changing amount does not refetch market data,
- changing 7-day ↔ 30-day benchmark does not refetch historical data,
- real API data is passed to all three screens,
- there is no automatic mock fallback.

---

# 15. Deployment and Production Verification

## Human verification / no AI prompt

I pushed the project to GitHub and deployed it to Vercel.

The Alpha Vantage key was configured in the Production environment as:

```text
ALPHAVANTAGE_API_KEY
```

I redeployed after adding the environment variable.

### `/api/health`

Production response:

```json
{
  "service": "BetterRate",
  "configured": true,
  "reachable": true,
  "upstreamStatus": 200,
  "checkedAt": "2026-09-13T02:19:11.034Z"
}
```

### `/api/fx-current`

Production response:

```json
{
  "from": "SGD",
  "to": "VND",
  "rate": 20436.61944529,
  "lastRefreshed": "2026-09-13 02:17:35",
  "timeZone": "UTC"
}
```

### `/api/fx-history`

Production benchmark response:

```text
7-day average:
20496.106234

Observation count:
5

Window:
2026-09-05 → 2026-09-11
```

and:

```text
30-day average:
20514.010565

Observation count:
22

Window:
2026-08-13 → 2026-09-11
```

The normalized daily series contained 22 daily close observations for the 30-day calendar window.

---

# 16. Human Production QA — Direction and Amount Logic

## No AI prompt

I manually tested the real deployed product.

### VND → SGD

With:

```text
Current:
20,436.67

7-day average:
20,496.11
```

BetterRate correctly showed:

```text
0.29% more favorable today
```

For S$1,000:

```text
About 59K VND less today
```

For S$3,000:

```text
About 178K VND less today
```

This confirmed that changing amount changes the local monetary calculation without needing a new market-data request.

### SGD → VND

I swapped the currencies.

BetterRate correctly reversed the interpretation:

```text
0.29% less favorable today
```

For S$1,000:

```text
About 59K VND less received today
```

This was an important business-logic test because the same raw market movement should mean the opposite thing for the opposite conversion direction.

---

# 17. Human Inspection — Chart Data Integrity Issue

## What looked right but was wrong

The historical chart initially used:

```text
historical FX_DAILY data ending Sep 11
```

but visually placed the newer current rate:

```text
Sep 13 current rate
```

at the end of an x-axis position labelled:

```text
Sep 11
```

The chart looked reasonable visually, but it could make the user believe that the current rate was the Sep 11 historical close.

The actual Sep 11 close was different.

## Human judgment

I decided the chart must clearly distinguish:

1. historical daily close observations,
2. current real-time rate,
3. benchmark average.

The system should not invent Sep 12 or Sep 13 historical daily closes.

---

# 18. Prompt 8 — Correct Historical Chart Integrity

## Exact prompt

```text
Review only the historical trend chart in BetterRate.

Do not redesign the application.
Do not change any calculation logic.
Do not modify API endpoints or benchmark formulas.

There is one data-integrity issue in the chart.

The historical FX_DAILY series currently ends on the provider's latest historical date,
for example:

Sep 11 close = 20,456.16 VND

The current real-time rate may be newer, for example:

Sep 13 current rate = 20,436.67 VND

Do not visually place the current real-time rate on an x-axis position labelled Sep 11.

Fix the chart so the distinction between historical daily data and the current rate is truthful.

Preferred behavior:

- Historical line contains only FX_DAILY historical close points.
- The final historical point remains labelled with its actual date, e.g. Sep 11.
- Show the current rate separately as a clearly labelled current-rate marker or annotation.
- If the current rate has a newer date than the historical series, label it "Current" or with its actual current date.
- Do not imply that the current rate is the Sep 11 daily close.
- Do not invent missing Sep 12 or Sep 13 daily historical close values.
- Do not interpolate fake historical observations.

Keep:
- the 7-day or 30-day benchmark line,
- the chart as secondary information,
- current beginner-friendly styling,
- mobile responsiveness.

After the change, explain how the chart now distinguishes:
1. the latest historical daily close,
2. the current real-time rate,
3. the benchmark average.
```

## What came back

The agent updated the chart so that the historical series and the current real-time rate were no longer presented as the same dated observation.

---

# 19. Final Human QA

## No AI prompt

I manually confirmed:

- current endpoint works in Production,
- historical endpoint works in Production,
- health endpoint works in Production,
- VND → SGD interpretation is correct,
- SGD → VND interpretation is correct,
- 7-day and 30-day benchmark values match the backend,
- S$1,000 and S$3,000 monetary differences scale correctly,
- Summary carries the correct values,
- mobile layout remains usable,
- raw Alpha Vantage response fields are not exposed to the UI,
- API key remains server-side.

---

# 20. Main Human–AI Collaboration Lessons

## 1. The agent was strongest at production

The agent quickly created:

- React screens,
- API functions,
- response parsing,
- normalized data structures,
- error handling,
- calculations,
- responsive UI.

## 2. Several “technical details” were actually product decisions

Examples:

- whether Buy/Sell should exist separately from currency direction,
- whether provider raw error messages should be returned,
- whether `Information` automatically means a specific limit,
- whether missing timezone can be replaced with UTC,
- whether a newer current rate can be placed on an older historical chart date.

## 3. Manual source inspection was necessary

Calling Alpha Vantage manually before backend generation made it possible to catch incorrect assumptions about:

- response fields,
- freshness,
- benchmark dates,
- missing observations.

## 4. A UI can look correct while still being misleading

The strongest example was the chart.

The visual looked reasonable, but the date semantics were wrong until manually inspected.

## 5. Final division of work

```text
Human:
product purpose
user meaning
source trust
benchmark definition
data-integrity rules
accept / reject decisions

Agent:
code production
UI implementation
API wiring
parsing
calculation implementation
iteration
```

The main lesson was that the boundary between “implementation” and “judgment” can move without being obvious, so the human needs to inspect not only whether the product works, but what the generated system is implicitly claiming.
