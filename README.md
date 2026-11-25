# CampusFest Growth Center

**RISA Growth APM assignment · Challenge A: Attendee Growth · Sohan Kamble (22EE38025)**

| Deliverable | Where |
|---|---|
| Three-slide strategy PDF | `deck/Sohan_Kamble_Growth_Strategy.pdf` |
| Working product (public link) | **ADD YOUR PUBLIC LINK HERE** (see Setup) |
| Single-file build of the product | `public/index.html` |
| Source, tests, model | this folder |
| Original data, unchanged | `data/Attendee_Dataset.xlsx` |

**Goal:** 2,350 verified external visitors on ₹3,00,000 (base) and 3,000 on ₹3,60,000 (stretch), for a proposed Bengaluru edition on 10–11 April 2027. The 2025 actual was 2,050 on ₹2,74,000.

**How to read the labels:** **[D]** = computed from the provided data (synthetic, no city). **[S]** = outside source. **[A]** = assumption or judgement.

Choosing Challenge A, Bengaluru and the 2027 dates were planning decisions, not facts from the brief. I picked Challenge A because the attendee data links spend to registration to verified check-in person by person.

---

## 1. Demo: one complete workflow (about 4 minutes)

The brief's line "Demonstrate one complete workflow:" has no text after it in the copy I worked from. This is the workflow I designed: **detect → diagnose → decide → create a task → execute → change data → re-check**.

1. Open the app and press **31 Mar** (12 days before the 2025 event). Later data is hidden.
2. **Overview:** the run-rate forecast is 2,013 visitors against a 2,200 goal. This uses an assumed 70% show rate.
3. **Diagnose:** look at each campaign's weakest funnel stage.
4. **Decide:** Creator Partners is CUT (1.98× blended cost per confirmed registration). Paid Social is CHANGE (1.29×).
5. **Copilot:** ask *"We are at 31 March. What should we change this week? Create one task."* Check the tool calls, then press **Confirm** on the proposed task. Nothing is saved before this.
6. **Execute:** find the new task, change its status, and reload the page. The change persists.
7. Press **Final**. In **Data → Row editor** (table `daily`), search `AD-C06-0120`. Press **Edit**, change `marketing_spend_inr` in the record text from 1400 to 51400, and press **Save**.
8. **Decide:** Organic Search flips from SCALE (0.50×) to CUT (1.95×). Total spend goes from ₹2,74,000 to ₹3,24,000. Blended cost per attendee goes from ₹142.34 to ₹168.31.
9. Ask the copilot *"Should we still scale Organic Search?"* It should read the new numbers. Earlier answers are marked out of date.
10. Undo the change from the log in **Execute**.

**2027 Bets tab:** press **Load simulated example weeks** to see the five bets get verdicts. These readings are labelled simulated. They are not results.

## 2. Chatbot test questions and expected answers

The expected values come from the engine on the original data. Wording will differ between models and between runs.

| Question (as-of date) | A good answer should |
|---|---|
| Did we hit our goals? (Final) | Visitors 2,050 vs 2,200; registrations 2,800 vs 3,200; identified 3,625 vs 3,600; spend ₹2,74,000 vs ₹3,00,000 |
| Are we on track? (31 Mar) | Forecast 2,013 (range 1,812–2,215) vs 2,200; say the 70% show rate is assumed |
| Which campaigns should we change? (31 Mar) | Creator CUT 1.98×; Paid CHANGE 1.29×; no use of attendance data |
| Does nurture email hurt attendance? (Final) | Emailed 34.5% vs not emailed 70.4% attended; observational; selection bias likely; propose a holdout |
| How many visitors came each day? (Final) | 1,430 on day 1 and 1,345 on day 2; the days overlap, so they do not add to 2,050 |
| Which college do most attendees come from? | Say the data has no college field |
| What was the event's profit or ROI? | Say there is no revenue or ticket data |
| What was the 2024 attendance? | Say only one edition exists |
| What if the budget were ₹2,00,000? (31 Mar) | Run the allocator and label it a scenario based on an assumed elasticity |
| Re-ask after step 7 above | Use ₹3,24,000 and the new Organic Search verdict |

Also try a follow-up ("why?"), a calculation ("how many more visitors for 2,500?") and a request to change data without confirming.

---

## 3. Research and sources

| Used for | Finding | Source |
|---|---|---|
| City choice | AISHE 2021-22 colleges by district: Bengaluru Urban 1,106, Jaipur 703, Hyderabad 491, Pune 475. Karnataka has 66 colleges per lakh population aged 18–23 | [S1] [AISHE 2021-22 report (mirror)](https://educationforallinindia.com/wp-content/uploads/2024/04/AISHE_Report_2021-22_Ministry_of_Education.pdf), cross-checked with [Careers360](https://news.careers360.com/up-has-highest-number-of-colleges-in-country-followed-maharashtra-karnataka-aishe-report/amp) and [The South First](https://thesouthfirst.com/pti/karnataka-has-3rd-highest-number-of-colleges-in-india-aishe-report/) |
| Show-rate context | One platform's data: median no-show about 28% for free events, 17% for paid | [PheedLoop](https://pheedloop.com/blog/event-data-lab-report-5). Other blogs report 40–60% no-shows for free events ([Eventtia](https://www.eventtia.com/?p=92920), [Nunify](https://www.nunify.com/blogs/event-attendance-rate)). I treat these as weak context only |
| Scale sanity check | One Bengaluru college fest, IIIT-B Synergy 2025, reported more than 2,400 attendees | [SMEStreet](https://smestreet.in/education/iiit-bangalores-annual-techno-cultural-fest-synergy-shined-with-innovation-and-collaboration-10648517) |
| Copilot | Gemini request format and function calling | [generateContent](https://ai.google.dev/api/generate-content), [function calling](https://ai.google.dev/gemini-api/docs/generate-content/function-calling) |

A [Free Press Journal article](https://www.freepressjournal.in/analysis/the-aishe-report-institutional-network-of-higher-education) gives different counts (Bengaluru Urban 1,148, Jaipur 742, Pune 517, Hyderabad 465). It appears to describe another report year. Bengaluru ranks first in both.

**Not found:** a reliable count of Bengaluru students, or benchmarks for squad or referral campaigns at Indian college fests. So all audience sizes are assumptions.

## 4. Data: audit and definitions

- The data is fictional: CampusFest 2025, 12–13 April 2025, with history from 15 January to 20 April.
- Duplicate IDs removed: 2 daily marketing rows, 4 status-history rows and 20 check-ins. The original rows stay in the file; the app de-duplicates when it loads.
- **Visitor:** a distinct external person with an admitted and verified check-in. Walk-ins count.
- **Confirmed:** latest status on or before the as-of date is "confirmed".
- **Spend:** net marketing ledger. Vendor credits (−₹6,500) are subtracted. No tax.
- **Attribution:** the recorded registration source. It equals first touch here, so assisted conversions cannot be measured.
- **Reach** is daily. Adding it up does not give unique people.
- **No future leakage:** a snapshot uses only rows dated on or before the as-of date.

### 2025 results [D]

3,625 identified (3,500 tied to a campaign) → 2,800 registered → 2,500 confirmed → 2,050 visitors (1,925 registered + 125 walk-ins). Show rate 68.75%. Confirmed registrants showed at 77%; the other statuses at 0%.

| Channel | Spend ₹ | Registered | Attended | Show rate | ₹ / registration | ₹ / attendee |
|---|---:|---:|---:|---:|---:|---:|
| Campus Ambassadors | 42,000 | 520 | 390 | 75.0% | 81 | 108 |
| Paid Social | 93,000 | 680 | 340 | 50.0% | 137 | 274 |
| Creator Partners | 59,000 | 350 | 175 | 50.0% | 169 | 337 |
| College Partnerships | 31,000 | 450 | 385 | 85.6% | 69 | 81 |
| Student Referrals | 19,000 | 350 | 275 | 78.6% | 54 | 69 |
| Organic Search | 14,000 | 250 | 195 | 78.0% | 56 | 72 |
| Community Groups | 16,000 | 200 | 165 | 82.5% | 80 | 97 |

Paid and Creator took about 55% of spend and produced about 25% of registered attendees.

- **Weakest stages:** Paid click rate 2.11% vs 3.58% for the other channels. Creator registered-to-attended 50% vs 71.4%. College Partnerships session-to-identified 9.5% vs 15.5%.
- **Selection trap:** people sent a nurture email attended at 34.5% vs 70.4% for others. Opens (32.4% vs 65.7%) look the same. The likely reason is that email targeted people who had not finished registering. This data cannot prove that.
- **Self-selection:** brochure downloaders attended more (61.6% vs 51.5%). This does not show that the brochure causes attendance.
- **Opt-outs:** 178 of 1,400 emailed people (12.7%) have an opt-out event.

---

## 5. Growth model: detailed calculations

Reproduce with:

```bash
cd model
python3 model.py ../data/Attendee_Dataset.xlsx   # needs pandas and openpyxl
```

It writes `model.json`. A saved copy of the printed output is in `model_out.txt`. `eda.py` is a separate pandas funnel analysis used to check the app's engine.

### 5.1 Method

For each channel, with `s0` = 2025 spend and `s1` = planned spend:

1. `multiplier = (s1 / s0) ^ e × transfer`
2. `registrations = 2025 registrations × multiplier` (impressions, clicks, sessions and identified people scale the same way)
3. `attendees = registrations × that channel's 2025 show rate`
4. **Overlap:** remove `overlap ×` the sum of attendee *gains* from College Partnerships, Referrals and Ambassadors. They reach the same students. Registrations and identified people are reduced in the same proportion.
5. **Show-up lift:** add `final registrations × show_lift`
6. **Visitors** = attendees after overlap + lift + walk-ins

`e < 1` gives diminishing returns. At e = 0.70, doubling spend multiplies output by 2^0.7 = 1.62, not 2.

**Worked example, College Squad Pass:** spend ₹31,000 → ₹62,000. Multiplier before transfer = 1.6245. Attendees = 385 × 1.6245 = 625.4, so the gross gain is **240**.

### 5.2 Assumptions [A]

| Input | Base | Stretch | Simulation range | Reasoning |
|---|---:|---:|---|---|
| Spend elasticity `e` | 0.70 | 0.80 | uniform 0.50–0.90 | Cannot be estimated from one edition |
| Overlap haircut | 15% | 10% | uniform 5–25% | Same colleges reached by three channels |
| Show-rate lift | +4.5 pts | +5.5 pts | triangular 0–8, mode 5 | Reminders and reconfirmation; no causal evidence here |
| Walk-ins | 120 | 150 | triangular 50–175, mode 125 | 2025 had 125 |
| New-city transfer | 0.96 | 1.00 | triangular 0.80–1.08, mode 0.98 | The source data has no city |

### 5.3 Channel plan

| Channel | 2025 ₹ | Base ₹ | Base regs | Base attendees | Stretch ₹ | Stretch ÷ 2025 spend |
|---|---:|---:|---:|---:|---:|---:|
| Campus Ambassadors | 42,000 | 60,000 | 641 | 481 | 74,000 | 1.76× |
| Paid Social | 93,000 | 45,000 | 393 | 196 | 50,000 | 0.54× |
| Creator Partners | 59,000 | 20,000 | 158 | 79 | 20,000 | 0.34× |
| College Partnerships | 31,000 | 62,000 | 702 | 600 | 86,000 | **2.77×** |
| Student Referrals | 19,000 | 38,000 | 546 | 429 | 54,000 | **2.84×** |
| Organic Search | 14,000 | 18,000 | 286 | 223 | 20,000 | 1.43× |
| Community Groups | 16,000 | 20,000 | 250 | 185 | 24,000 | 1.50× |

The channel rows are shown before the overlap deduction. Base also has Show-Up Engine ₹22,000 and reserve ₹15,000 (total ₹3,00,000). Stretch has Show-Up ₹32,000 and no reserve (total ₹3,60,000).

**Stretch warning:** it takes two channels to about 2.8× their observed spend. The app's allocator treats anything above 2× as unreliable. This is one reason the stretch is unlikely and gated.

### 5.4 Results

| | 2025 actual | Base model | Stretch model |
|---|---:|---:|---:|
| Impressions | 1,029,015 | 950,451 | 1,190,579 |
| Clicks | 32,070 | 33,750 | 43,869 |
| Landing sessions | 24,645 | 25,916 | 33,672 |
| Identified (campaign) | 3,500 | 3,435 | 4,374 |
| Registrations | 2,800 | 2,857 | 3,672 |
| Show rate | 68.75% | 78.9% | 81.2% |
| Walk-ins | 125 | 120 | 150 |
| **Visitors (model → target)** | **2,050** | **2,373 → 2,350** | **3,132 → 3,000** |
| Budget / target visitor | ₹134 (actual) | ₹128 | ₹120 |

Base arithmetic: 2,253 registered attendees (including 129 from show-up lift) + 120 walk-ins = 2,373.

The 78.9% show rate is well above 2025. About 5.7 points come from shifting the channel mix (to 74.4%) and 4.5 from the assumed lift. It is the part I would watch most.

**Bridge:** 2,050 + 240 squads + 172 referrals + 111 ambassadors + 65 organic and community − 228 paid and creator cut − 78 overlap + 134 show-up − 87 new city − 5 walk-ins = 2,373 (rounded terms add to 2,374). The bridge is sequential: channel gains are measured at transfer = 1, then each adjustment is added. So overlap shows as 78 here but is 69 inside the final base run.

### 5.5 Uncertainty (20,000 simulation draws)

- **Base plan:** P10 2,146, median 2,356, P90 2,562. P(more than 2,050) 97.5%; P(at least 2,200) 82.7%; **P(at least 2,350) 51.5%**; P(at least 2,500) 18.8%.
- **Stretch plan:** median 2,716, P90 3,052. **P(at least 3,000) about 14%**; P(at least 3,200) about 3%.

These probabilities only reflect the ranges I chose. Inputs are drawn independently, and the model's structure is not tested. They are not measured odds.

| One-at-a-time sensitivity (base) | Low → high input | Visitors |
|---|---|---|
| New-city transfer | 0.80 → 1.08 | 2,025 → 2,634 |
| Elasticity | 0.50 → 0.90 | 2,258 → 2,518 |
| Show-up lift | 0 → 8 pts | 2,244 → 2,473 |
| Overlap | 25% → 5% | 2,324 → 2,422 |
| Walk-ins | 50 → 175 | 2,303 → 2,428 |

If the new city performs at 80% of the old one, the base plan does not beat 2025.

### 5.6 Audience sizing and capacity

- **[A]** About 150 reachable colleges × about 600 reachable students = 90,000. Base needs 2.6% of that and stretch 3.3%, even if every visitor came from this pool. 3,000 visitors across 150 colleges is 20 per college.
- Other audiences: friends of registrants, ambassador peers, about 100 interest groups [A], search demand, and young alumni. Pre-university students are mostly minors, so they are not targeted. Host-campus students are not counted as external visitors.
- **[D]** 1.354 visit-days per visitor; busier-day share 51.5%; peak-hour share of that day 17.55%.
- Base: about 1,655 on the peak day and 291 arrivals in the peak hour. Stretch (model 3,132): 2,185 and 383.
- **[A]** 15 seconds per scan = 240 per lane per hour; at 70% use, 168. Stretch needs 3 lanes. Plan 4 (one spare), 2,500 per day and a manual fallback. Concurrent crowd is unknown because there are no exit scans. Venue safety needs its own check.

### 5.7 Pacing gates

Share of final registrations reached in 2025 at the same number of days before the event:

| Days out | 2027 date | Share | Base plan | Act if below 85% of plan |
|---|---|---:|---:|---:|
| 42 | 27 Feb | 40.9% | 1,169 | 993 |
| 28 | 13 Mar | 55.8% | 1,594 | 1,355 |
| 14 | 27 Mar | 80.1% | 2,288 | 1,945 |
| 7 | 3 Apr | 92.2% | 2,634 | 2,239 |

**Stretch unlock on 27 Feb:** at least 41% of 3,672 registrations (about 1,501) **and** cost per registration at most ₹89. Only then release ₹60,000.

### 5.8 Experiment power (Show-Up Engine)

- Detecting a 5-point lift from 68.75% with 80% power (two-sided α = 0.05) needs 1,286 per arm.
- I chose an **80/20 split** to give more people the likely benefit: about 2,286 treated and 571 control. From a 74.4% baseline, power for +5 points is about **73%** (normal approximation). A 50/50 split would give about 89%.
- This assumes all 2,857 base registrants can be messaged. If fewer opt in, power falls.
- The true outcome appears only on event day. Reconfirmation is a proxy, and the proxy itself is untested. A flat result would not prove there is no effect.

---

## 6. Prioritisation framework

`RICE = extra attendees × confidence ÷ person-weeks`
`Score = RICE ÷ (₹ per extra attendee ÷ 100)`

"Extra attendees" stands for reach × impact. The money term is my addition, because the budget is the binding limit. Confidence and effort are judgement calls [A]. Gains are gross: before overlap and new-city effects.

| Rank | Idea | Extra | Extra ₹ (total budget) | Confidence | Person-weeks | RICE | ₹ / extra | Score | Call |
|---|---|---:|---|---:|---:|---:|---:|---:|---|
| 1 | College Squad Pass | 240 | 31k (62k) | 80% | 6 | 32.1 | 129 | 24.9 | Double down |
| 2 | Crew Referral Loop | 172 | 19k (38k) | 70% | 4 | 30.1 | 111 | 27.2 | Double down |
| 3 | Show-Up Engine | 138 | 22k (22k) | 60% | 3 | 27.6 | 159 | 17.4 | Build, with holdout |
| 4 | Pay-per-Show Ambassadors | 111 | 18k (60k) | 60% | 8 | 8.3 | 163 | 5.1 | Restructure |
| 5 | Paid + Creator Blitz | 76 | 31k (31k) | 70% | 4 | 13.3 | 409 | 3.2 | Reject the scale-up; keep a ₹65k capped test |

- Scores use unrounded values, so redoing them from the rounded table can differ by about 0.1.
- **Override:** Referral scores slightly higher than Squad Pass (27.2 vs 24.9, under 10% apart). I rank Squad Pass first because referrals need squad registrants as seeds.
- The **Blitz** gain is ₹31,000 added to Paid Social's 2025 spend. The capped test in the plan is ₹45,000 paid + ₹20,000 creator.
- The squad, referral and ambassador gains come from **extra spend on those 2025 channels**. The new mechanics are how I plan to earn it. Nothing in the data proves the new mechanics work.
- Also rejected: a celebrity headliner (high cost, no evidence here) and more untargeted email (opt-outs).

## 7. Measurement rules

### Dashboard campaign verdicts (historical data)

Before the event the app uses cost per **confirmed registration**; after it, cost per **attendee**. Each is compared with the blended figure.

- At or below 0.85×: SCALE. At or above 1.20×: CHANGE. At or above 1.50×: CUT. Otherwise: HOLD.
- Fewer than 40 registrations or less than ₹8,000 spend: INSUFFICIENT EVIDENCE.
- A SCALE becomes HOLD if quality (confirmation or show rate) is more than 5 points below the portfolio.

You can change these thresholds in the app.

### 2027 bet verdicts

The app (`src/plan.js`) follows the table on slide 3. Starting thresholds are judgement calls to recalibrate around week 4. Where the slide shows only early signals (such as invitations within 72 hours or click rate), the team reads them by hand. The app does not turn all of them into verdicts.

### Backtest [D]

Creator Partners' cost per confirmed registration was 2.11× blended on 1 March, 2.13× on 14 March and 1.98× on 31 March. The rules said CUT each time. College Partnerships was 1.04× and 1.19× before improving to 0.71×, and finished at 0.57× cost per attendee. By cost per registration it went from ₹137 on 1 March to ₹69 at the end. This is why slow-ramp bets get a protected period and need two bad reads before a cost-based stop.

**Forecast accuracy** (2025 actual: 2,800 registrations, 2,050 visitors; 70% show assumed, no walk-ins):

| As of | Forecast registrations | Forecast visitors |
|---|---:|---:|
| 1 Mar | 2,775 | 1,942 |
| 14 Mar | 2,290 | 1,603 |
| 31 Mar | 2,876 | 2,013 |

The 14 March forecast missed badly, by 510 registrations, because sign-ups sped up later. Treat the run-rate forecast as a rough signal. One edition cannot validate it.

---

## 8. Product

| Need | Where |
|---|---|
| Measure: funnel, KPIs, target vs actual, budget, forecast | Overview, Diagnose |
| Diagnose: good and bad campaigns, bottlenecks, drivers of change | Diagnose |
| Decide: priorities, budget scenarios, scale / change / stop | Decide, 2027 Bets |
| Execute: campaigns, tasks, owners, deadlines | Execute |
| Change data, upload, export, restore | Data |
| Definitions and limits | Method |
| AI copilot | Side panel |

**Design**
- **One engine (`src/engine.js`)** supplies the screens and the copilot. The model is told to get figures through tools; it is not given numbers written into its instructions in advance.
- **Persistence:** the original data never changes. Each edit is a logged operation that can be undone. Storage is the hosted artifact database, Supabase, or the browser's local storage, depending on setup.
- **Copilot tools:** overview, campaign performance, decisions, period comparison, generic data query, engagement comparison, budget simulation, calculator, tasks, 2027 plan, definitions, propose task, propose campaign change.
- **Safety:** the copilot can only propose changes; you confirm them. It cannot see data after the as-of date.
- **Number check:** answers are checked for whether their figures appear in the tool results. This does **not** prove a figure is attached to the right metric, or that the reasoning is right.

## 9. Setup

Needs Node 18 or later.

### Run locally

```bash
node server.js          # open http://localhost:3000
```

For the copilot, use **Connect** inside the app to paste your own Gemini key (stored in that browser only), or set `GEMINI_API_KEY` in the server's environment before starting it. Create a key at [Google AI Studio](https://aistudio.google.com). Never put a key in the code or in Git.

### Deploy a public link (Vercel)

1. Push this folder to a GitHub repository, or use the Vercel command line.
2. Import it into Vercel. `vercel.json` already sets the output folder.
3. In the project's environment variables, add `GEMINI_API_KEY`. Optionally add `GEMINI_MODEL`.
4. Deploy. Open the link in a private window and run the demo and test questions.

The app tries `gemini-3.8-flash`, then `gemini-3.5-flash-lite`. Model names and free limits change. If calls fail, set `GEMINI_MODEL` to a Flash model your key can use.

### Shared saving (optional, Supabase)

Without this, each browser keeps its own changes. To share them: create a project, run `supabase.sql` in its SQL editor, then set `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Read the security limit below first.

### Rebuild and test

```bash
python3 build_data.py data/Attendee_Dataset.xlsx data/baseline.json   # only if the source data changes
python3 build.py        # writes public/index.html
node tests/test.js
```

To rebuild the slides (needs Python Playwright with Chromium): `python3 deck/make_deck.py "Your Name" "Roll number"`. The slide numbers come from `model/model.json`; some text on the slides is typed by hand, so re-read it after any model change.

## 10. What was checked, and what was not

All checks below were run by the AI assistant during the build.

**Checked**
- 23 automated tests pass. They cover key totals against a separate pandas calculation, de-duplication, no future leakage, changed data, undo, rules, tools, the number check, both model loops using a **scripted fake model**, and proxy guards.
- Browser test on the local build: a proposal saves only after Confirm; injected HTML did not run; task and campaign changes survive a reload; an edited workbook upload changes the totals; restore and export/re-import work; no horizontal overflow at 400 px; no page errors.
- Rerunning `model.py` reproduced `model.json` exactly.
- Slide pages were rendered and inspected.

**Not checked**
- **No real language model has been tested.** Gemini and the hosted Claude connection still need a live test with the questions in section 2.
- A Vercel deployment, a real Supabase project, and saving inside the hosted artifact.
- Browsers other than the Chromium used for testing.

## 11. Tools, reuse and plans

| Tool | Use | Plan |
|---|---|---|
| Claude (Anthropic) | Research, data analysis, growth model, strategy draft, product code, tests, slides and this README | **ADD YOUR CLAUDE PLAN** |
| Google Gemini API | Copilot in the self-hosted app | Meant for the free tier; check current limits |
| Vercel, Supabase (optional) | Hosting and shared storage | Free tiers intended |
| Python (pandas, Playwright), Node.js | Analysis, tests, PDF | Open source |

- **Reused:** the SheetJS `xlsx` 0.18.5 mini build for reading and writing Excel files (Apache-2.0; licence in `vendor/`). No UI template or chart library.
- **Created for this submission with Claude:** the engine, bet rules, copilot, storage, interface, proxy, model scripts, tests and slides.
- **Modified:** the data was converted to compact JSON with repeated name columns removed. All source rows, including duplicates, are kept.

## 12. Known limitations

**Evidence**
- The data is synthetic, covers one edition and has no city. Applying it to Bengaluru is an assumption.
- No experiments or multi-touch data exist, so channel costs are averages, not proof of what extra spend will do. Cutting paid and creator spend could hurt other channels in ways this data cannot show.
- Elasticity, overlap, show-up lift, confidence, effort and audience sizes are judgement calls.
- The event date has not been checked against exam calendars, holidays, venue availability or competing fests.
- The budget is marketing spend only. Check whether it can cover ambassador payouts, referral rewards, scanning and development time.
- Referral rewards and ambassador payouts invite fraud. Messaging needs consent and a working opt-out, and handling of personal data needs a legal check.

**Product**
- **The public proxy can use up your Gemini quota.** It checks the request origin, allows only Flash models, caps request size and limits requests per IP. The origin check can be faked outside a browser, and the rate limit is held in memory per server instance. Use a free-tier key with no billing attached, and delete it after review.
- **The Supabase demo rules are open:** anyone with the app's link can read, add and delete changes. Add sign-in before real use, and never load real personal data.
- **SheetJS 0.18.5 has two high-severity advisories** reported by `npm audit`: [prototype pollution](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) and [regex denial of service](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9). npm offers no fix. Upload only workbooks you trust. For real use, move to a patched release from SheetJS's own distribution.
- Without shared storage, changes stay in one browser. An uploaded workbook stays in that browser too.
- Questions and the tool results needed to answer them are sent to the model provider. Tool results can include rows from the data.
- The hosted Claude version needs the reviewer to be signed in to Claude and to have access to the artifact.
- The model can still misread results or invent reasoning. Check important answers against the screens.
