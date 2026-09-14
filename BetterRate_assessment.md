# assessment.md — BetterRate

**Name:** Minh  
**Course:** MGMT6110 Human-AI Collaboration  
**Problem Set 2:** BetterRate  

---

# 1. Product Summary

BetterRate is a simple exchange-rate comparison tool.

The main question is:

> **Is today’s exchange rate better or worse for the currency conversion I want to make, compared with recent rates?**

The user can:

- choose VND → SGD or SGD → VND,
- compare today with a 7-day or 30-day average,
- optionally enter an SGD amount,
- see whether today is more or less favorable,
- see the approximate money difference in VND.

BetterRate does not predict future rates and does not tell the user when to exchange money.

The app uses real exchange-rate data from Alpha Vantage through my own backend API.

---

# 2. Front-End Assessment Criteria

| Criterion | Result | Evidence |
|---|---|---|
| 1. Purpose is clear for a first-time user | **Met** | The first screen asks “Is today’s rate better for you?” and explains that BetterRate compares today’s exchange rate with recent averages. |
| 2. Currency direction is easy to understand | **Met** | The app uses “I have” and “I want” instead of asking a second Buy/Sell question. VND → SGD and SGD → VND also give opposite interpretations correctly. |
| 3. Benchmark is transparent | **Met** | The user can choose 7-day average or 30-day average. The UI shows the benchmark value and explains that it is based on daily close rates. |
| 4. The app explains the result in simple language | **Met** | The result says things like “0.29% more favorable today” and “About 59K VND less today” instead of asking the user to understand the chart by themself. |
| 5. Optional amount gives useful money impact | **Met** | S$1,000 showed about 59K VND difference, and S$3,000 showed about 178K VND difference. The calculation scaled correctly. |
| 6. Mobile usability | **Met** | I checked the three screens at a mobile-size layout. The cards, amount field, benchmark choices and buttons stayed usable without horizontal scrolling. |

---

# 3. Back-End Assessment Criteria

| Criterion | Result | Evidence |
|---|---|---|
| 1. API key stays on the server | **Met** | `ALPHAVANTAGE_API_KEY` is read using `process.env`. Search found no `VITE_ALPHAVANTAGE` variable and no Alpha Vantage URL inside the frontend code. |
| 2. Current FX data is normalized correctly | **Met** | `/api/fx-current` returns only `from`, `to`, `rate`, `lastRefreshed`, and `timeZone`. It does not expose the API key or the raw Alpha Vantage response. |
| 3. Historical benchmark logic is correct and auditable | **Met** | The 7-day average used 5 available daily closes from Sep 5–11. The 30-day average used 22 closes from Aug 13–Sep 11. The code does not divide automatically by 7 or 30. |
| 4. Health endpoint is useful | **Met** | `/api/health` showed `configured: true`, `reachable: true`, and `upstreamStatus: 200` after deployment. |
| 5. Failure states are separated | **Partly Met** | The code has different handling for empty data, provider error, unreachable provider and missing key. However, I did not purposely break every production condition after final deployment, so I cannot say I tested every failure path end-to-end. |
| 6. Request discipline and caching | **Met** | Current and historical data are fetched once and reused. Changing amount or switching between 7-day and 30-day benchmark does not call Alpha Vantage again. |

---

# 4. Self-Assessment Notes

Overall, I think the product meets the main goal.

The strongest part is not the chart. It is the interpretation.

For example, the same current rate can mean:

- **more favorable** for VND → SGD,
- **less favorable** for SGD → VND.

This was important because at first I was thinking mostly about showing the exchange-rate movement. During the build I realised the more useful job is to translate that movement into something the user can understand quickly.

I also think the product became simpler after removing the Buy/Sell selector. At first the interface had both:

- “I have / I want”
- and Buy SGD / Sell SGD.

This looked okay but it was actually duplicate logic and could create a confusing state.

One area that is only partly tested is failure behaviour. The code is there, but I didnt intentionally break every condition on the final production deployment because I was more focused on verifying the real happy path and data logic.

---

# 5. Human–AI Collaboration Questions

## Q1. Where did the agent make you faster? By how much, and what type of task was it?

The agent made me much faster in production work.

The main examples were:

- creating the React screens,
- responsive layout,
- serverless API files,
- parsing Alpha Vantage responses,
- wiring frontend to backend,
- formatting numbers,
- writing the calculation functions.

Without the agent, I think this project would probably take me a few days because I am still quite new to coding.

With the agent, I could get a working version in a few hours and spend more of my time checking whether the logic made sense.

I would say the agent was especially fast for tasks where the desired behaviour was already clear.

For example:

> “Create `/api/fx-history` and calculate the 7-day and 30-day average from the daily close data.”

Once I defined the rule clearly, the agent could produce most of the implementation quickly.

---

## Q2. Where did the agent cost you time? Was the agent wrong, or was your instruction unfinished?

The agent cost me time mainly when my instruction was not specific enough.

The first example was the Buy/Sell logic.

I originally asked for:

- “I have VND”
- “I want SGD”
- and also “Buy SGD / Sell SGD”.

The agent followed that literally.

The result looked complete, but the product had duplicate intent.

I later realised that:

> “I have VND → I want SGD”

already means the user is converting VND to SGD.

So this was mostly an unfinished product instruction from me, not just an agent mistake.

Another example was provider error handling.

The agent tried to return sanitized raw Alpha Vantage error messages and also assumed some `Information` responses meant a specific daily limit.

That part was more of an agent over-assumption. It was technically trying to help, but it was adding meaning that I did not want the product to claim.

---

## Q3. What looked right but was not? How did you find it?

The clearest example was the trend chart.

The chart looked correct visually.

But the historical FX data ended on Sep 11, while the current rate was from Sep 13.

The chart originally put the newer current rate at the end of the historical line near the Sep 11 position.

This could make the user think:

> the current Sep 13 rate was actually the Sep 11 historical close.

I noticed this after manually comparing:

- the date shown in `/api/fx-current`,
- the latest date in `/api/fx-history`,
- and the chart label.

The real Sep 11 close was:

> 20,456.16 VND

while the current rate was around:

> 20,436.67 VND.

So the UI looked fine, but the data meaning was not fully correct.

This was probably the best example for me that visual correctness is not the same as data correctness.

---

## Q4. What knowledge did you need in order to supervise the agent and catch problems?

I needed a mix of product knowledge and basic technical understanding.

The most important things were:

### Product logic

I needed to understand that:

- lower SGD/VND is better for someone converting VND → SGD,
- higher SGD/VND is better for someone converting SGD → VND.

Without this, I could not check whether the result wording was right.

### API response structure

I manually called Alpha Vantage before asking the agent to build the backend.

This helped me see the actual fields:

- `5. Exchange Rate`
- `4. close`
- `Last Refreshed`
- `Time Zone`

This was very useful because otherwise I would just trust whatever field the agent selected.

### Historical benchmark logic

I needed to understand that 7 calendar days does not always mean 7 observations.

For example, the 7-day window only had 5 available daily closes.

So dividing by 7 would be wrong.

### Basic security

I also needed to understand that the API key should stay in:

> `process.env.ALPHAVANTAGE_API_KEY`

and not appear in browser code or a `VITE_` variable.

I am still a newbie in code, but I could supervise the agent much better once I knew these few important rules.

---

## Q5. What decisions did you keep? Should you have kept more or fewer?

I kept the main product and data-trust decisions.

For example, I decided:

- what “better” means,
- that currency direction should define the interpretation,
- how 7-day and 30-day averages should be calculated,
- that only daily close values should be used,
- that missing provider metadata should stay missing instead of being invented,
- that raw provider error text should not be passed to the user,
- that the chart should not mix current and historical dates.

I think these were the right decisions for me to keep.

One decision I delegated too easily at first was:

> how provider errors and missing metadata should be interpreted.

It looked like a technical implementation detail, but actually it affects what the user is being told to trust.

So I should have kept that decision earlier.

On the other side, I probably held some UI production work for too long during the first prototype.

Things like:

- spacing,
- responsive stacking,
- basic card layout,
- button styling

were safe to delegate more to the agent because they did not change the core product meaning.

So I think I should keep fewer low-risk visual production decisions, but keep more decisions that affect meaning, trust, and data interpretation.

---

## Q6. If this scaled to a team of 30, what review policy would you use? What should agents not settle, and how would you audit it?

If this was used by a team of 30 people, I would not review every line of agent-generated code manually.

I would create a simple review policy based on risk.

### Agents can usually settle

- layout implementation,
- formatting,
- repeated UI components,
- basic API wiring,
- simple transformation code,
- documentation drafts.

### Agents should not settle alone

- calculation definitions,
- financial interpretation,
- source selection,
- missing-data behaviour,
- user-facing claims,
- error wording that explains why something happened,
- security boundaries,
- anything that could change the meaning of the result.

### Review process

I would require three checks before release:

1. **Source check**  
   A human manually inspects at least one real provider response.

2. **Logic check**  
   A human writes a small set of expected examples before approving the code.

   Example:

   ```text
   Current < benchmark
   VND → SGD
   Expected: more favorable
   ```

3. **Production check**  
   The team checks:

   - health endpoint,
   - one real current data request,
   - one historical request,
   - one opposite-direction example,
   - one failure state.

I would also keep an audit trail similar to `prompts.md`, because it shows not only what the agent produced, but also where a human accepted, rejected, or changed the agent's decision.

For me, the main rule would be:

> Agents can produce fast, but humans should approve what the system is claiming.
