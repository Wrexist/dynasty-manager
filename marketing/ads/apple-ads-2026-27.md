# Apple Ads — 2026-27 season plan

> App Store id **6760918006**. Window: 2026-27 club season (European kickoffs
> through August, summer transfer window closes 1 September).
> Companion to `marketing/aso/season-2026-refresh.md` (organic) and
> `marketing/aso/RESEARCH-2026.md` (ranking theory). Bid ceilings in this file
> are produced by `node marketing/ads/unit-economics.mjs` — do not hand-edit a
> number here without re-running it.

---

## 0. The verdict, before the plan

**At the current price ladder, category head terms cannot pay back at any
realistic Apple Ads price. Brand defence and long-tail can — barely, and only
if the paywall funnel is at the optimistic end of plausible.**

That is arithmetic, not caution. Run the model:

```
$ node marketing/ads/unit-economics.mjs
Gross per install                     $0.286
Net per install (after Apple's cut)   $0.243
Max CPI at 1.00x ROAS                 $0.243
Max CPT at 55% tap→install CR         $0.133
Planned CPT $1.20 → ROAS 0.11x        LOSES MONEY — 9.0x over the affordable bid
```

Even on a deliberately generous funnel (3% buy Pro outright, 5% start the
monthly trial, 50% of trials bill, 15% monthly churn, $0.15/install of
consumables) the picture only moves this far:

| Scenario | Net rev / install | Max CPT | Plan CPT | ROAS @12mo | Verdict |
|---|---|---|---|---|---|
| Baseline funnel, head terms @55% CR | $0.24 | $0.13 | $1.20 | 0.11x | 9.0x over |
| Baseline funnel, brand terms @75% CR | $0.24 | $0.18 | $0.35 | 0.52x | 1.9x over |
| Optimistic funnel, head terms @55% CR | $0.70 | $0.38 | $1.20 | 0.32x | 3.1x over |
| **Optimistic funnel, brand terms @75% CR** | **$0.70** | **$0.52** | **$0.35** | **1.49x** | **Pays back** |

Reproduce any row:

```bash
node marketing/ads/unit-economics.mjs --cpt=0.35 --cr=0.75
node marketing/ads/unit-economics.mjs --pro=0.03 --monthly=0.05 --annual=0.01 \
  --trial-to-paid=0.5 --churn=0.15 --consumables=0.15 --cpt=0.35 --cr=0.75
```

**What this means for the ask "most optimal for ROI and gain subscriptions".**
Subscriptions are not won in the ad account. A $1.99/month plan generates
~$0.06 per install even at a 5% trial-start rate — the ad account cannot
manufacture margin that the price ladder never had. So this plan does two
things at once:

1. Runs Apple Ads at a **hard-capped, ARPI-derived bid** where it is provably
   profitable (brand, long-tail, competitor conquest) and nowhere else.
2. Treats phase 1 as a **paid measurement instrument** whose real output is a
   per-keyword ARPI reading, which then either unlocks head terms or proves
   the ARPI work in §7 has to land first.

Anyone who tells you to put $500 into category head terms at this ARPI is
telling you to buy $0.24 of revenue for $2.18. Don't.

---

## 1. Gate check

From `marketing/README.md` and the last audit (~46 installs/day, 3.66K
impressions/day, 17% page CVR). These are stale — re-read them in App Analytics
before spending.

| Check | Threshold | Status | Consequence if failing |
|---|---|---|---|
| Page CVR | ≥ 25% | **17% ✗** | Every paid tap lands on a page that loses 5 of 6 visitors. Fixed by CPPs (§3) faster than by anything else. |
| D1 retention | ≥ 40% | unmeasured | Measure before phase 2. |
| D7 retention | ≥ 20-25% | unmeasured | D7 is a 2026 *ranking* input, so it gates organic too. |
| Live on App Store | yes | ✓ | |
| App Preview video | yes | **✗** | +25-35% CVR, single highest-ROI store fix. Blocks phase 2. |
| ≥ 50 ratings | yes | unknown | Under 50 the reviews module is hidden and CVR craters. |
| Net revenue / install | ≥ $0.50 | **~$0.24 modelled** | The binding constraint on every bid in this file. |

**2 of 7 clear.** Under the playbook's own rule (4+ to spend) this account is
not ready for broad paid. It *is* ready for phase 1 below, because phase 1 is
capped at a bid the current economics already support and its purpose is
measurement.

---

## 2. Account structure

Five campaigns. Each has one job, one CPP destination, one bid ceiling. Do not
merge them — mixed-intent campaigns make the CPA read useless.

| # | Campaign | Match | Destination CPP | Daily cap | Bid ceiling (CPT) | Job |
|---|---|---|---|---|---|---|
| 1 | `BRAND-DEFENCE-US` | Exact | `brand` | $5 | **$0.50** | Stop rivals buying your name. Cheapest install you will ever get. |
| 2 | `LONGTAIL-US` | Exact | matched by cluster | $8 | **$0.60** | Low-competition feature queries. The ARPI instrument. |
| 3 | `CONQUEST-US` | Exact | `career` | $6 | **$0.75** | Rival brand terms. Legal in Apple Ads; see §4. |
| 4 | `DISCOVERY-US` | Broad + Search Match | `career` | $6 | **$0.40** | Harvest unknown queries. Feeds 1-3 *and* the organic keyword field. |
| 5 | `HEAD-TERMS-US` | Exact | `tactics` | **$0** — paused | $1.20 | Built, negative-keyworded, and left off until §6 gate 3 clears. |

Phase 1 live spend: **$19/day ≈ $570 over 30 days.** Campaign 5 exists so that
the day the gate clears you turn it on rather than spending a week building it.

**Storefront:** US only in phase 1. `marketing/aso/RESEARCH-2026.md` §3 —
the US storefront also indexes es-MX, so US spend and the es-MX locale file
compound. Do not open a storefront whose locale file the validator reports as
stale.

### Ad group split inside each campaign

One ad group per intent cluster, because the CPP is set at ad-group level and
the whole point is query→creative match:

```
BRAND-DEFENCE-US
  └── ag_brand_exact                → CPP `brand`
LONGTAIL-US
  ├── ag_career                     → CPP `career`
  ├── ag_transfers                  → CPP `transfers`
  ├── ag_tactics_matchday           → CPP `tactics`
  ├── ag_nation                     → CPP `nation`
  └── ag_offline                    → CPP `career`
CONQUEST-US
  ├── ag_conquest_premium_sim       → CPP `career`
  ├── ag_conquest_realtime_pvp      → CPP `career`   (lead on "no timers")
  └── ag_conquest_breadth           → CPP `career`   (lead on depth, not count)
DISCOVERY-US
  └── ag_discovery_broad            → CPP `career`
HEAD-TERMS-US  (paused)
  ├── ag_head_manager               → CPP `tactics`
  └── ag_head_career_mode           → CPP `career`
```

---

## 3. Custom product pages — the highest-leverage lever in this document

Page CVR is 17%. A paid tap into a 17% page costs 6× the CPT to produce one
install. **Fixing the landing page is worth more than any bid change**, and CPPs
are free, need no build, and since July 2025 carry their own organic keywords —
so the same asset lifts paid and organic together.

The four content CPPs already exist in
`marketing/aso/season-2026-refresh.md` §Custom product pages. This plan adds
two ad-specific ones (also added to that table so the set stays single-source):

| CPP | Campaign | Lead panels | First-panel promise |
|---|---|---|---|
| `career` | 2, 3, 4, 5 | 01, 05, 03 | Career mode: start unknown, end a legend |
| `tactics` | 2, 5 | 02, 03, 01 | Every minute, every substitution |
| `transfers` | 2 | 04, 03, 01 | Own the transfer window |
| `nation` | 2 | 05, 02, 01 | Club and country |
| `brand` | 1 | 01, 02, 04 | Brand recall — the exact thing they searched for, immediately |
| `pro` | Today tab | 03, 01, 02 | Depth without a subscription wall |

Each is one re-render of the existing generator with a different panel order
(`node marketing/appstore/build-hero.mjs`), so the marginal cost is ~2 min per
size. **The captions are indexed** — if you reorder panels, re-check
`marketing/appstore/build-hero.mjs` and the ASO doc together, per the
`store-conversion` rule.

**Today-tab ads require a CPP destination** and render app name + icon +
subtitle only. That makes the subtitle an ad asset, not just a keyword bag —
`Tactics, Transfers & Trophies` reads as a benefit and is the right one to run;
`Deep Career Sim · No Timers` is the A/B partner.

---

## 4. Keywords

Paste-ready sets live in `marketing/ads/keywords/`:

- `en-US-brand.csv` — campaign 1
- `en-US-longtail.csv` — campaign 2, tagged by ad group
- `en-US-conquest.csv` — campaign 3
- `en-US-head.csv` — campaign 5, staged
- `negatives.csv` — applies account-wide

### Rules that decide what goes in

1. **Validate every pick against Search Popularity in the Apple Ads keyword
   planner before it gets budget.** The organic keyword fields in this repo were
   built from category knowledge and character-limit maximisation, *not* live
   volume data — that caveat is stated in `marketing/aso/locales/README.md` and
   it applies here with money attached.
2. **Exact match only in campaigns 1-3.** Broad match at a $0.50 ceiling in a
   category this competitive buys the queries nobody else wanted.
3. **Discovery feeds organic and vice versa.** Any term that converts in
   campaign 4 is a candidate for the 100-char keyword field; any term already in
   the keyword field that ranks organically top-3 is a candidate to *stop*
   bidding on. Sync both directions in the same pass — this is the single
   biggest efficiency win available and it costs nothing.
4. **Judge terms on retained users, not installs.** D7 is a ranking input in
   2026, so a keyword that buys volume and drags D7 hurts organic rank *and*
   ROAS. Kill on D7, not on CPI alone.

### Competitor conquest — the rule people get wrong

Bidding on a rival's brand name in **Apple Ads is allowed**. Putting that same
name in your **App Store metadata is a Guideline 2.3.7 violation**. These are
different rules and `marketing/aso/RESEARCH-2026.md` §2 covers the metadata
side. Nothing in `en-US-conquest.csv` may ever be copied into a locale file.

The conquest set is grouped by the four postures in `RESEARCH-2026.md` §4, so
the ad group's CPP answers that posture's specific weakness:

| Posture | Live examples (verified July 2026) | Their claim | Our counter on the CPP |
|---|---|---|---|
| Licensed premium sim | [Football Manager 26 Mobile](https://apps.apple.com/us/app/football-manager-26-mobile/id6446123740) (Netflix) | Licence, brand recall | Full depth, free to download, no subscription required to play |
| Real-time 3D PvP | [Top Eleven](https://apps.apple.com/us/app/top-eleven-be-football-manager/id459035295), [Top Football Manager 2026](https://apps.apple.com/us/app/top-football-manager-2026/id1068396437) | Live PvP, 3D | **No energy timers, no rest packs, no waiting** — the sharpest wedge we own |
| Breadth collectors | [Soccer Manager 2026](https://apps.apple.com/us/app/soccer-manager-2026-football/id6449935779) ("90+ leagues, 54 countries"), [Football Club Management 2026](https://apps.apple.com/us/app/-/id6752708527) | Raw league count | Don't fight on count (45/756 loses). Fight on career + packs + national team in one app |
| Fast-session sims | [RFM26](https://apps.apple.com/us/app/rfm26-football-manager/id6550908549) | Season in a commute | Minute-by-minute match day when you want it, instant sim when you don't |

Conquest CPA runs high and intent is hostile — the searcher wanted someone
else. Cap it at $6/day and kill any ad group at CPA > $1.50 (see §6).

---

## 5. Measurement

### Baseline these before day 0, or the whole exercise is uninterpretable

Category rank · keyword ranks for the campaign 1-3 terms · impressions →
product page views → installs (App Analytics) · D1/D7 · **and the six funnel
rates the model in §0 currently guesses** (RevenueCat: trial starts per install,
trial→paid, monthly churn, one-time purchase rate, consumable ARPI).

That last group is the point. Phase 1's deliverable is not installs — it is
replacing the `⚠ ASSUMED, NOT MEASURED` line at the bottom of
`unit-economics.mjs` with real numbers.

### Read weekly, not daily

TTR · CR (tap→install) · CPT · CPA · **D7 retention by campaign** · net revenue
per install by campaign. Attribute through SKAdNetwork/AdAttributionKit
honestly: postbacks lag 24-72h, small-sample postbacks are noisy, and
**re-bidding on one day of data is how indie ad accounts burn out**. Weekly
reads, minimum 100 taps per keyword before any decision.

### SKAN conversion values

Set the CV schema on D0-D3 monetization *proxies*, not on revenue — revenue is
too rare at this volume to read fast:

| CV | Event |
|---|---|
| 1 | first save created |
| 2 | first match played to full time |
| 3 | session > 5 min on day 0 |
| 4 | first pack opened |
| 5 | trial started |
| 6 | any purchase |

---

## 6. Phasing, kill criteria, scale gates

### Phase 1 — weeks 1-4, $570, measurement

Campaigns 1-4 live at the caps in §2. Campaign 5 built and paused.

**Kill rules, applied at the ad-group level after ≥100 taps:**

| Signal | Kill threshold |
|---|---|
| CPA | > $1.00 (campaigns 1, 2, 4) · > $1.50 (campaign 3) |
| Tap→install CR | < 35% — this is a CPP problem, fix the page before killing the keyword |
| D7 retention | < 15% — kill even if CPA is good; it costs organic rank |
| Any single keyword | > 30% of campaign spend with below-median CPA |

**Phase 1 succeeds if** ≥1 ad group holds CPA < $0.60 with D7 ≥ 20%, *and* the
six funnel rates are now measured. It has a real chance of failing, and failing
is a $570 answer to a question that would otherwise cost $5,000.

### Gates to phase 2 — all three, no exceptions

1. **Page CVR ≥ 25%** (CPPs shipped, App Preview video live).
2. **D7 ≥ 20%** measured, not assumed.
3. **`node marketing/ads/unit-economics.mjs` with *measured* rates prints a max
   CPT above the head-term market clearing price.** If it doesn't, the answer
   is §7, not more budget.

### Phase 2 — weeks 5-12, if and only if all three gates clear

Unpause campaign 5 at $10/day. Raise winners from phase 1 by ≤20% per week —
Apple's auction punishes step changes with CPT spikes. Open a second storefront
(en-GB first: strongest football intent per capita, and `en-GB` falls back to
`en-US`, so the locale file is already coherent) only after the US account has
four consecutive profitable weeks.

### What is explicitly NOT in this plan

Meta and TikTok at this ARPI (the §0 arithmetic is channel-independent and both
run higher CPI than Apple Ads search) · Today-tab ads before the `pro` CPP
exists · any storefront whose locale file the validator flags · manual bid
management daily · optimising for D30 ROAS at the creative level.

---

## 7. The actual ROI lever: ARPI, not the ad account

Every bid ceiling in this document is `net revenue per install ÷ target ROAS`.
The ad account cannot change the numerator. These can, and each one multiplies
the affordable bid on *every* campaign simultaneously:

| Lever | Effect on max CPT | Where |
|---|---|---|
| **Raise page CVR 17% → 25%** | +47% affordable CPT, and it lifts organic rank too | CPPs (§3) + App Preview video |
| **Annual plan is underpriced at $14.99 vs $1.99/mo** | Annual currently prices at 7.5 months. Industry norm is 10-12. Moving to $19.99 lifts annual revenue 33% with minimal conversion loss | `src/config/monetization.ts` |
| **Trial→paid conversion** | Linear on the whole monthly line | Trial-end reminder timing, `SubscribeOnboarding` |
| **Trial-start rate per install** | Linear | Paywall placement — first trophy, first promotion, first walkout |
| **Monthly churn 25% → 15%** | Monthly line +48% ($0.062 → $0.092/install) | Retention, i.e. the game |
| **Consumable pack ARPI** | Currently modelled at $0.05/install and the least-known number in the model | Pack pricing and daily-free-pack cadence |

**Concretely:** the optimistic scenario in §0 that finally prints "PAYS BACK" is
not fantasy — it is 3% Pro one-time + 5% trial start + 50% trial→paid + 15%
churn. That is a normal well-tuned F2P sim funnel. Getting there is worth more
than any keyword in `marketing/ads/keywords/`, and it is the *only* path to
head terms ever being affordable.

Do not treat §7 as a footnote to the ad plan. It is the ad plan.

---

## 8. Do this in the next 48 hours

1. `node marketing/ads/unit-economics.mjs` — read the assumption warning at the
   bottom and write down which six numbers you can pull from RevenueCat today.
2. Build the `brand` and `career` CPPs in App Store Connect (no build required,
   no review wait) and re-render their panel orders.
3. Create campaigns 1 and 2 only, at the §2 caps. Leave 3-5 for week 2 — a new
   Apple Ads account with five campaigns and no baseline is unreadable.
4. Record the §5 baseline **before** any of the above goes live.

---

## Sources

- [Football Manager 26 Mobile — App Store](https://apps.apple.com/us/app/football-manager-26-mobile/id6446123740)
- [Soccer Manager 2026 - Football — App Store](https://apps.apple.com/us/app/soccer-manager-2026-football/id6449935779)
- [Top Eleven: Be Football Manager — App Store](https://apps.apple.com/us/app/top-eleven-be-football-manager/id459035295)
- [Top Football Manager 2026 — App Store](https://apps.apple.com/us/app/top-football-manager-2026/id1068396437)
- [RFM26 Football Manager — App Store](https://apps.apple.com/us/app/rfm26-football-manager/id6550908549)
- [Football Club Management 2026 — App Store](https://apps.apple.com/us/app/-/id6752708527)
- Ranking-factor and Apple Ads placement sources are catalogued in
  `marketing/aso/RESEARCH-2026.md` §Sources.
