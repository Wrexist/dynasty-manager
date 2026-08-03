# ARPI Roadmap — getting revenue per install from $0.286 to a payable bid

> Companion to `marketing/ads/apple-ads-2026-27.md` §0 and §7, and to
> `marketing/ads/unit-economics.mjs`, which produces every number below.
> Do not hand-edit a figure in this file — re-run the command printed beside it.
>
> Built from a six-surface monetization audit whose findings were adversarially
> re-verified. Where the verifier corrected a number, the corrected number is
> used. Nine findings were verified line-by-line; fifteen were not reviewed and
> carry an explicit haircut (see *Evidence grading*).

---

## 0. The answer, before the plan

**The roadmap makes brand-term Apple Ads profitable. It does not make category
head terms profitable, and no realistic version of it ever will.**

| Threshold | Gross/install needed | Reached? | Where |
|---|---|---|---|
| Brand terms pay back ($0.35 CPT @ 75% CR) | **$0.549** | **Yes** | Wave 2, row 14 ($0.550) |
| Head terms pay back ($1.20 CPT @ 55% CR) | **$2.567** | **No** | Roadmap ceiling is $0.648 |

Two corrections to the brief's own framing, both in your favour and both against it:

1. **The brand-term threshold is $0.549 gross, not $0.70.** The $0.70 figure in
   `apple-ads-2026-27.md:38` is a rounded scenario row, not a solved threshold.
   The actual break-even is `cpt / cr / (1 − commission)` = `0.35 / 0.75 / 0.85`
   = **$0.549**. That is ~21% closer than the brief assumes, and it is the
   difference between "reachable in one binary" and "reachable in two."
2. **The head-term threshold is $2.567 gross — 9.0× today and 4.4× the full
   roadmap ceiling.** Every item in this document, shipped, verified, and
   working exactly as modelled, gets you to $0.648. There is no combination of
   the surviving findings that reaches $2.50. Say it plainly: **head terms are
   permanently unaffordable at this product's price ladder.** Getting there
   would require either a fundamentally different monetization model (which the
   no-timers / no-pay-to-win positioning forbids) or a tap→install CR far above
   any plausible value. Stop planning for `HEAD-TERMS-US` (campaign 5 in
   `apple-ads-2026-27.md:104`) and delete it from the roadmap rather than
   leaving it paused as an aspiration.

**Strategic consequence.** Paid UA for this app is a *brand-defence and
long-tail* instrument, permanently. It buys you protection against competitors
bidding your name and a measurement channel for per-keyword ARPI. It is not,
and will not become, a growth engine. Growth has to come from organic rank
(where D7 retention is a 2026 ranking input) and from store conversion — which
is why the CPI-side work in §6 matters as much as the ARPI-side work, despite
contributing $0.00 to the tables below.

---

## 1. Evidence grading

Every dollar figure here is a **MODELLED ESTIMATE**. There are no measured
conversion rates in this repo, in the model, or in any shipped analytics.
`grep -rn VITE_ANALYTICS_ENDPOINT .github/` returns nothing — the variable is
never injected into the iOS release build, so `defaultSink` at
`src/utils/analytics.ts:83` returns early and **no analytics event has ever left
a production device.** Every rate in `unit-economics.mjs:61-87` is a guess, and
the script says so at the bottom of every run.

Three grades appear in the tables:

| Grade | Meaning | Treatment |
|---|---|---|
| **CONFIRMED** | Auditor's evidence re-checked line-by-line by a second reviewer; number accepted | Used as-is |
| **CORRECTED** | Evidence held, number cut by the verifier | Verifier's number used |
| **UNVERIFIED** | Not adversarially reviewed | Auditor's claim × **0.40** |

The 0.40 haircut is the mean of the eleven verified `claimed → corrected`
ratios (median 0.33: 1.00, 0.58, 0.50, 0.50, 0.40, 0.33, 0.33, 0.31, 0.30,
0.27, 0.20). It is a modelled assumption, stated here once so it is not
re-argued per row. Price changes are exempt — those are arithmetic on the
shipped catalog, and only their *elasticity* is assumed.

**Deltas are sub-additive and the tables treat them that way.** Findings A, B,
C and D all move the same `monthlyStart` input; F, H and I all move
`consumableArpi`. Summing their standalone claims would imply a payer base
larger than the model's entire assumed payer base (2.36% of installs,
`unit-economics.mjs:63-68`). The cumulative table applies the verifier's own
sub-additive stack multipliers, not the naive sum.

---

## 2. Ranking logic

Ordered by **corrected ARPI delta ÷ effort weight**, where S=1, M=3, L=8, XL=20
(a modelled effort scale — roughly person-days on a log-ish curve). An S-effort
$0.005 win outranks an L-effort $0.030 win, which is the point.

| # | Item | Δ ARPI | Effort | Δ/effort | Grade |
|---|---|---|---|---|---|
| C | Route `ProUpsell` → `/subscribe` instead of the Shop | $0.018 | S (1) | **0.0180** | CORRECTED |
| P1 | Monthly $1.99→$2.99, Annual $14.99→$19.99 | $0.016 | S (1) | **0.0160** | Arithmetic |
| I | Shop gets a Player Packs section; Featured slot gets a real bonus | $0.015 | S (1) | **0.0150** | CONFIRMED |
| A | Paywall re-entry policy + post-celebration moment triggers | $0.043 | M (3) | **0.0143** | CORRECTED |
| P2 | Kill $7.99 Pro; Lifetime →$24.99; Bundle →$29.99 | $0.036 | M (3) | **0.0120** | UNVERIFIED |
| B | Taste-then-gate: show the locked Pro feature before locking it | $0.034 | M (3) | **0.0113** | CONFIRMED |
| F | Cut the free-pack quick-sell cash faucet | $0.019 | M (3) | **0.0063** | CORRECTED |
| G | Three new cosmetic SKUs (card frames, atmosphere II, kits) | $0.015 | M (3) | **0.0050** | CORRECTED |
| H | Pack multi-open consumable SKUs | $0.015 | M (3) | **0.0050** | CORRECTED |
| D | Fix paywall bullets: drop `ad_free`, add `optimize_lineup` | $0.005 | S (1) | **0.0050** | CORRECTED |
| K | First match above the fold; score the checklist; "Surprise me" | $0.014 | M (3) | **0.0047** | CORRECTED |
| J | Trial-end nudge + cancellation / grace-period intervention | $0.013 | M (3) | **0.0043** | CORRECTED |
| L | Lapse ladder D+1 / D+7 / D+14 / D+30 | $0.004 | S (1) | **0.0040** | CORRECTED |
| P3 | Add the Dynasty Edition row to `SubscribeOnboarding` | $0.004 | S (1) | **0.0040** | UNVERIFIED |
| E | Premium Festival track on the live-events framework | $0.030 | L (8) | **0.0038** | CORRECTED |
| M | Season-milestone save-export prompt | $0.003 | S (1) | **0.0030** | CORRECTED |
| P4 | Icon pack: 3 cards, 88 floor (fix content, not price) | $0.002 | S (1) | **0.0020** | UNVERIFIED |
| ADS | Re-enable rewarded video, pack slots only | $0.035 | XL (20) | **0.0018** | UNVERIFIED |
| N,O,Q,P5 | Instrumentation and remote catalog | $0.000 | S–L | **0** | CONFIRMED |

**Wave assignment overrides pure ratio in three places, and only three:**

- **P1 ships first in wall-clock** despite ranking second, because it is the
  only revenue item that needs **no binary**. `ShopPage.tsx:82-90` fetches
  localized prices from RevenueCat on mount and `priceFor` (`:89-90`) falls
  back to the USD literal only when the store is silent, so an App Store
  Connect price change reaches every shipped binary immediately.
- **N, O and Q ship before everything** despite $0.000, because every other
  number in this document is currently unfalsifiable.
- **P2's App Store Connect half must land *with* its binary, never before.**
  Verified: `ShopPage.tsx:416-434` renders the $7.99 one-time card
  unconditionally, with no availability filter (unlike `SubscribeOnboarding`,
  which filters `visibleRows` against `getStoreAvailability` at `:171-174`).
  Set the SKU to *Removed from Sale* first and that card renders "$7.99" from
  the config fallback and fails on tap — which is precisely the
  Guideline 2.1.0 rejection that killed build 174 (see the comment at
  `SubscribeOnboarding.tsx:138-142`).

---

## 3. Cumulative model

Starting at **$0.2855 gross / $0.2427 net** per install. Every row is a real
run of `unit-economics.mjs`; the flag state is cumulative down the column.

| # | Item | Wave | Binary? | Migration? | Gross | Net | maxCPT @75% CR |
|---|---|---|---|---|---|---|---|
| 0 | *baseline* | — | — | — | $0.2855 | $0.2427 | $0.182 |
| 1 | **Q** read ASC App Analytics + RevenueCat | 1 | no | no | $0.2855 | $0.2427 | $0.182 |
| 2 | **P1** monthly $2.99 / annual $19.99 | 1 | **no** | no | $0.3012 | $0.2560 | $0.192 |
| 3 | **Store CVR block** (CPPs, locale copy, preview video) | 1 | no | no | $0.3012 | $0.2560 | $0.192 |
| 4 | **N + O** paywall + pack funnel instrumentation | 2 | yes | no | $0.3012 | $0.2560 | $0.192 |
| 5 | **C** `ProUpsell` → `/subscribe` | 2 | yes | no | $0.3227 | $0.2743 | $0.206 |
| 6 | **I** Shop pack section + Featured bonus | 2 | yes | no | $0.3377 | $0.2870 | $0.215 |
| 7 | **A** paywall re-entry + moment triggers | 2 | yes | no | $0.3902 | $0.3316 | $0.249 |
| 8 | **P2** perpetual-Pro reshuffle | 2 | yes | no | $0.4257 | $0.3619 | $0.271 |
| 9 | **B** taste-then-gate | 2 | yes | no | $0.4628 | $0.3934 | $0.295 |
| 10 | **F** quick-sell faucet | 2 | yes | **73→74** | $0.4818 | $0.4096 | $0.307 |
| 11 | **G** three cosmetic SKUs | 2 | yes | **73→74** | $0.4968 | $0.4223 | $0.317 |
| 12 | **H** pack multi-open bundles | 2 | yes | **73→74** | $0.5118 | $0.4351 | $0.326 |
| 13 | **D** paywall bullet fix | 2 | yes | no | $0.5238 | $0.4452 | $0.334 |
| 14 | **K** onboarding / first-match ordering | 2 | yes | no | **$0.5500** | **$0.4675** | **$0.351** |
| | ↑ **BRAND TERMS CROSS OVER HERE** ($0.35 CPT @ 75% CR → ROAS 1.00x) | | | | | | |
| 15 | **J** trial-end + cancellation intervention | 2 | yes | no | $0.5625 | $0.4781 | $0.359 |
| 16 | **L** lapse ladder | 2 | yes | no | $0.5710 | $0.4853 | $0.364 |
| 17 | **P3** bundle row on the paywall | 2 | yes | no | $0.5789 | $0.4921 | $0.369 |
| 18 | **M** save-export prompt | 2 | yes | no | $0.5807 | $0.4936 | $0.370 |
| 19 | **P4** Icon pack content fix | 2 | yes | no | **$0.5830** | **$0.4956** | **$0.372** |
| | ↑ **END OF WAVE 2** — brand terms at 1.06x ROAS, ~6% headroom | | | | | | |
| 20 | **P** walkout share card | 2 | yes | no | $0.5830 | $0.4956 | $0.372 |
| 21 | **E** Premium Festival track | 3 | yes | **74→75** | $0.6130 | $0.5211 | $0.391 |
| 22 | **P5** offerings-driven catalog | 3 | yes | no | $0.6130 | $0.5211 | $0.391 |
| 23 | **ADS** rewarded video, pack slots only | 3 | yes | no | **$0.6483** | **$0.5511** | **$0.413** |
| | ↑ **CEILING. $0.70 never reached. $2.50 never remotely reached.** | | | | | | |

**Read the ceiling honestly.** The full roadmap — 23 changes, three waves,
two save migrations, an ads re-enable that carries launch-crash risk — lands at
**$0.648 gross**, which is **25% of the $2.567 needed for head terms**. Rows 21
and 23 add $0.065 between them for L and XL effort; they are the two worst
value-for-effort items on the board and they exist in Wave 3 precisely because
the decision to skip them should be easy.

**Where the money actually is.** Rows 5–14 are 82% of the total gain
($0.2488 of $0.3628 minus the ads line). All ten are in a single binary. That
binary is the whole project.

---

## 4. Waves

### Wave 1 — days, no binary, no review

Everything here reaches shipped devices without an App Store submission.

| Item | What | Binary | Migration |
|---|---|---|---|
| **Q** | Read App Store Connect → App Analytics (D1/D7/D28 by cohort, page CVR) and RevenueCat (trial→paid, monthly churn by product). Write the six numbers down. | no | no |
| **Q2** | Decide the first-party pipeline: either set `VITE_ANALYTICS_ENDPOINT` as a secret in `.github/workflows/ios-testflight.yml`, or delete the transport in `src/utils/analytics.ts:83-110`. The current state — a full 24-variant event union feeding a sink with no endpoint — is the worst of both. | no (secret only) | no |
| **P1** | App Store Connect: monthly $1.99→$2.99, annual $14.99→$19.99. Preserve legacy pricing for existing subscribers (do **not** force Apple's consent flow). Update the `priceUsd` fallbacks at `src/config/monetization.ts:40` and `:49` in the next binary so the model parser and web/dev display stay honest. | **no** | no |
| **Store** | Fix the 20 locales still selling an expired tournament in the subtitle; ship the `build-hero.mjs` screenshot set (blocked on the trademark decision, §7); build the `brand` and `career` CPPs. Capture the App Preview video from `CinematicCapturePage`. | no | no |
| **Ladder hygiene** | Fix the false comment at `src/config/gameBalance.ts:820-822` asserting sim-neutrality that `xp_double` violates (see §7). | code-only, ships with W2 | no |

Wave 1 moves ARPI by **+$0.016** and moves measurement from zero to four of the
six guessed inputs. That is the real deliverable.

### Wave 2 — one binary, the whole project

Ship rows 4–20 as **one** submission. Splitting it across two review cycles
doubles the rejection surface for no gain.

Order inside the binary, because some items gate others:

1. **N + O** — instrumentation lands first in the source tree so the rest of
   the binary is measurable from day one. Add `paywall_viewed`,
   `paywall_dismissed`, `upsell_impression`, `upsell_tapped`, `trial_started`
   and `pack_open` to the union at `src/utils/analytics.ts:16-43`. Fire
   `pack_open` from `PacksPage.handleOpen` (`src/pages/PacksPage.tsx:336-448`),
   which currently has **zero** `track()` calls — the app's
   highest-frequency purchase surface is its only commerce surface with no
   funnel. Keep every `track()` call **outside** the try/catch that decides
   whether to clear the pending-credit marker (`PacksPage.tsx:404`, `:426`,
   `:433-443`), or a throw from analytics produces spurious re-grants.
2. **C, D** — routing and copy. `ProUpsell.tsx:16` currently calls
   `setScreen('shop')`; the Shop contains **no mention of the free trial**
   (verified: `grep -in trial src/pages/ShopPage.tsx` returns nothing) while
   `SubscribeOnboarding.tsx:562` renders `Try {FREE_TRIAL_DAYS} Days Free`.
   Route Pro intent to `/subscribe`. **Ship only part 1 of that finding** —
   replicating trial copy into ShopPage/PurchaseModal gated on the local
   `monetization.subscription == null` copies an eligibility decision into a
   surface that has none of `SubscribeOnboarding.tsx:115`'s reasoning, and
   `monetization` is loaded from the save slot
   (`orchestrationSlice.ts:1011`), so it is untrustworthy before the
   RevenueCat sync lands. That is a 3.1.2(c) exposure for ~$0 of the delta.
3. **A, B** — paywall placement. Fire moment paywalls strictly *after* the
   celebration exit animation, never on a loss or sacking, capped at one per
   real-world day and three lifetime dismissals. Note
   `CelebrationModal.tsx:110` uses `usePresentationSlot('celebration', open)`,
   an overlay queue — a `navigate()` from a celebration site can race the
   weekly digest, so enqueue rather than navigate directly.
4. **P2, P3** — ladder reshuffle. **Keep `com.dynastymanager.pro` in
   `PRODUCTS`, in `PRO_ONE_TIME_PRODUCT_IDS` (`monetization.ts:144-148`) and in
   `mapEntitlements` forever.** `grantEntitlement` expands `bundle.all`'s
   `includes` array (`monetizationSlice.ts:52-58` → `monetization.ts:89-94`),
   writing that exact ID into `entitlements` — dropping it revokes Pro from
   every Dynasty Edition buyer as well as every legacy $7.99 buyer. Add a
   regression test asserting the ID survives in both lists. Re-anchor
   `BUNDLE_INDIVIDUAL_TOTAL` (`ShopPage.tsx:46-50`) off `pro.lifetime`, or the
   Save-% badge quotes a price nobody can pay.
5. **F, G, H, P4** — pack and cosmetic economy. One migration
   (`CURRENT_VERSION` 73→74) covering `method` on `OpenedPackRecord`, the
   count-based pack-credit marker, and the new `CosmeticCategory` keys.
6. **K, J, L, M, P** — retention and lifecycle.

**Save migration is required at Wave 2** (73→74). One migration, three shape
changes, defaults: `method: 'free'` on existing `OpenedPackRecord`s,
`remaining: 1` on any pending pack credit, no-op additive for the new
`activeCosmetics` keys.

### Wave 3 — structural, and mostly optional

| Item | Verdict |
|---|---|
| **E** Premium Festival track | Ship only if the pass unlock is stored in **save state with an IndexedDB-backed write**, not via `writeLiveEventProgress` (`persistence.ts:478-479`), which is a bare `localStorage.setItem` inside a silently-swallowing `catch`. Storing a real-money, non-restorable unlock in the one store this codebase treats as best-effort is the same loss-of-purchase class that `PacksPage.tsx:142-174` built an entire reconciler to defend against. Requires 74→75. |
| **P5** Offerings-driven catalog | $0.000 direct and L effort, but it is the only way to test elasticity without a review cycle. Mandatory fallback to the hardcoded arrays when offerings are empty — a dashboard misconfiguration must never silently empty the paywall. |
| **ADS** Rewarded video | **Recommend not doing this.** $0.035 gross for XL effort, a re-linked GMA framework whose failure mode is the build-136 launch crash (a native `NSException` from a libdispatch block that a JS `try/catch` at `main.tsx:193-198` cannot catch), a permanent App Privacy flip to Device ID → tracking, and the dismantling of `src/test/launchCrashGuardrails.test.ts`. It is 5% of the roadmap's gain for the highest catastrophic risk on the board. |

---

## 5. Measurement

The six inputs `unit-economics.mjs` flags as ASSUMED, and which wave finally
measures each:

| Model input | Flag | Today | Measured by |
|---|---|---|---|
| `proOneTime` / `lifetime` / `bundle` | `--pro`, `--lifetime`, `--bundle` | guessed 1.0% / 0.2% / 0.2% | **Wave 1** — RevenueCat product-level conversion |
| `monthlyStart` / `annualStart` | `--monthly`, `--annual` | guessed 2.0% / 0.4% | **Wave 1** (RevenueCat trial starts ÷ ASC installs), refined by **Wave 2** N (`paywall_viewed` → `trial_started` gives a *per-surface* rate, which is what A and C actually move) |
| `trialToPaid` | `--trial-to-paid` | guessed 40% | **Wave 1** — RevenueCat, directly |
| `monthlyChurn` | `--churn` | guessed 25% | **Wave 1** — RevenueCat, directly |
| `consumableArpi` | `--consumables` | guessed $0.05 | **Wave 2** O — `pack_open` with `{tierKey, method}` gives the free-vs-paid split, which is the number that proves or kills F |
| `cr` (tap→install) | `--cr` | placeholder 0.55 | **Only by running the ads.** Nothing in the app measures it. |

**Before / after per wave:**

- **Wave 1.** Before: record page CVR (17%, stale), impressions/day, installs/day,
  and the five RevenueCat rates. After 30 days: re-read the same five. The one
  thing to watch is whether the $2.99 monthly *suppressed trial starts* — if
  `monthlyStart` falls more than 20% relative, the elasticity assumption behind
  P1 is wrong and P2's much larger price bet should be re-modelled before shipping.
- **Wave 2.** Before: the Wave 1 numbers, plus a D1/D7 cohort baseline from ASC.
  After: the same, plus the new event ratios — `paywall_viewed` per install,
  `trial_started` / `paywall_viewed` by source, `pack_open` free-vs-paid split,
  `upsell_tapped` / `upsell_impression` per gate. **D7 is the kill criterion.**
  If D7 drops more than 2 points against the pre-Wave-2 cohort, revert F first
  (see §7) — it is the only item in the binary that removes something players
  currently have.
- **Wave 3.** Only start once Wave 2's numbers are in and the model has been
  re-run with measured inputs. If the measured post-Wave-2 gross lands below
  $0.549, Wave 3 does not close the gap and the honest move is to stop.

**One methodological fix, free:** `apple-ads-2026-27.md:138-139` conflates the
17% *page CVR* (impressions → installs on the product page) with the model's
55% *tap→install CR*. They are different quantities and every CPT ceiling
downstream inherits the confusion. Split them in the model — keep `cr` for the
bid ceiling, add a separate `pageCvr` used only for organic arithmetic — and
re-derive the §7 table from the corrected script rather than by hand.

---

## 6. The CPI side — why the store work is in Wave 1 despite $0.000 ARPI

ROAS is `netARPI ÷ CPI`, and `maxCPT = netARPI × cr`. The store surface moves
the *denominator* and the *CR multiplier*, not ARPI. Assigning it an ARPI delta
(as the original audit did, at $0.06 for the preview video and $0.029 for
screenshots) is a category error — a preview video that raises page CVR brings
in *more marginal installs*, which if anything dilutes ARPI slightly.

Its value is real and shows up in a different column:

| Store item | Effect | Post-Wave-2 affordable CPT |
|---|---|---|
| — | `cr` = 0.55 (model placeholder) | $0.273 |
| App Preview video + CPPs + hero screenshots | `cr` = 0.65 | $0.322 |
| …plus brand-term traffic (high intent) | `cr` = 0.75 | $0.372 |

Reproduce: `node marketing/ads/unit-economics.mjs <wave-2 flags> --cr=0.65`.

Two store items are also the cheapest things on this entire document: the
20 stale locale files (no build, instant rollback) and the review-prompt trigger
sites (`src/utils/appReview.ts`) — under 50 ratings the reviews module is hidden
and CVR craters, and the current triggers fire at moments most installs never
reach. Do **not** relax `MIN_DAYS_BETWEEN_PROMPTS = 60` or
`MAX_LIFETIME_PROMPTS = 4` (`appReview.ts:21-22`); add trigger sites at the same
throttle so the one allowed prompt lands on a peak.

---

## 7. What could go wrong

### App Store review rejection risk

| Item | Exposure | Mitigation |
|---|---|---|
| **P2** | **Highest.** Removing `com.dynastymanager.pro` from sale before the binary ships leaves `ShopPage.tsx:416-434` rendering a CTA that can only fail — the exact Guideline 2.1.0 condition that rejected build 174. | ASC removal and binary must go live together. Sandbox-verify every paywall row on device before submission. |
| **C part 2** (dropped) | Replicating trial copy into ShopPage gated on save-loaded `monetization.subscription == null` can show "7 days free" to a lapsed subscriber who is then charged immediately → 3.1.2(c) + refund. | **Cut from the roadmap.** Ship only the routing half. |
| **J** trial-end copy | Any stated post-trial price must use the store-localized string from `getStorePrices`, never the USD fallback in `PRODUCTS`, or it is a false price claim outside the US. | Use `priceFor`-style resolution everywhere. |
| **P2/G** bundle at $29.99 | "$30 for a mobile game" review comments. | The bundle stops being the entry price and becomes the ceiling; $24.99 Lifetime remains the cheapest perpetual path. Nobody is forced past it. |
| **ADS** | App Privacy flips permanently to Device ID → tracking. ATT prompt must sequence against the existing first-launch `AnalyticsConsentModal`. Google UMP needed for EEA. | Another reason not to. |
| **P5** | Any change to what the paywall renders needs on-device sandbox verification. | Fallback-to-hardcoded is mandatory, not optional. |

### D7 retention risk (the ranking input — a change that lifts ARPI and drops D7 is a net loss)

| Item | Risk | Verdict |
|---|---|---|
| **F** quick-sell faucet | **The single largest D7 risk in the roadmap.** For any save past season 1, a 74–82 pull does not crack the XI — the actual reward from a free daily pack *is* the quick-sell cash. Cutting 65%→10% **and** dropping free gold's `ovrMax` 82→78 removes both halves of the reward at once, retroactively, on a surface `packs.ts:66-74` documents as already having been nerfed once. | Ship it, but **stage it**: cut the multiplier first, leave `ovrMax` at 82, and watch D7 for a full cohort before touching the band. It is $0.019 — it is not worth a retention regression. |
| **A** moment paywalls | Interrupting a trophy celebration makes a good moment feel cheap. | Fire strictly after the exit animation, never on a loss/sacking, one per day, three dismissals lifetime. |
| **K** Dashboard reorder | Pushing the onboarding checklist below the match card risks the sponsor offer lapsing unread (six-week window) and the player never discovering Scouting. | Keep the checklist immediately below the match card, not at the bottom. |
| **E** Premium Festival | Adding a locked paid row beside a track players currently climb for free converts a pure-reward surface into a partly-withheld one on every visit. | The free tier's five tiers and XP values must not change by a single point. |
| **L** lapse ladder | Five notifications instead of one is an uninstall / notifications-off risk. | Each rung must read differently; all are cancelled on resume (`main.tsx:227`) so an engaged player never sees rung 2. |
| **B, G, I, M, P, D** | None. B *adds* content free users currently do not see (`MatchReview.tsx:659` shows them nothing today). | Ship freely. |

### Positioning risk — no-timers, no-pay-to-win

The wedge is intact across the whole roadmap, but three items sit close to the line:

1. **F's split quick-sell rate** (65% for `iap` opens, 10% for `free` opens) means
   real money yields ~6.5× more in-game transfer budget per identical card.
   The header contracts at `config/monetization.ts:5-6` and
   `utils/monetization.ts:5-6` are file-scoped and this change lives in
   `packs.ts` / `packsSlice`, so it is **not** a literal breach — `player.value`
   is untouched and nothing is gated on `isPro()`. But it is the nearest miss on
   CLAUDE.md's "monetization must never touch transfer values." **Make this an
   explicit, recorded decision, not a footnote.** The safe alternative is a
   single lowered rate for all opens.
2. **H and P4** increase the maximum squad advantage purchasable in one
   transaction. `AI_BACKFILL_PER_TIER` (`packs.ts:164-175`) is the existing
   compensation and is calibrated per-open; it must scale with the multi-buy,
   and `icon: 0` (`packs.ts:170`) must become non-zero if Icon goes to 3 cards.
3. **`xp_double` is a live latent violation, today, in shipped config.** It
   routes an ad reward into training rates and match probabilities via the perk
   tree (`monetizationSlice.ts:281-289` → `weekAdvance.ts:944-945`,
   `matchActions.ts:596`, `:1080`), under a comment at
   `gameBalance.ts:820-822` that asserts the opposite. It is currently inert
   because `AdRewardButton` returns null for everyone while
   `NATIVE_ADS_READY = false` (`src/utils/ads.ts:38`). **Remove `xp_double`
   from `AdRewardType` and fix the comment in Wave 2**, before anyone
   re-enables ads and ships an actual breach. Orphaned `xp_double_s3` keys in
   `adRewardsClaimed` are harmless (read by string key, nothing iterates the
   union) — no migration needed for this.

Also fix in Wave 2, no revenue attached: `AD_REWARD_VALUES`
(`monetization.ts:212-216`) grants a flat £500K/£1M, which is 100% of a
bottom-tier club's entire budget. Make it proportional and clamped
(`clamp(club.budget * PCT, MIN, MAX)`) *before* ads could ever ship it. Nobody
has ever received these rewards, so there is no expectation to break.

### Trademark exposure (blocks the store work)

The ready-to-upload hero assets bake in real club and player marks — a larger
exposure than the single "World Cup 1" item currently tracked, and
`marketing/aso/season-2026-refresh.md:138-148` incorrectly tells the next
reader that panels 01–04 are clean. Two coherent positions: accept the risk
knowingly and log it, or re-capture from a save built on synthetic names via
the same generator `CinematicCapturePage` uses
(`src/pages/CinematicCapturePage.tsx:38-44`). Note that scrubbing will probably
**lower** CVR — the real clubs are the listing's strongest differentiator. Do
not ship it as a "conversion improvement." Decide it as a risk trade.

---

## 8. Reproducible commands

Baseline:

```bash
node marketing/ads/unit-economics.mjs
```

**Post-Wave-1** (subscription reprice only, elasticity haircut applied:
`monthlyStart` 2.0%→1.6%, `annualStart` 0.40%→0.34% — a modelled 20%/15%
reduction in trial starts from the price rise), evaluated against brand-term
economics:

```bash
node marketing/ads/unit-economics.mjs \
  --price-monthly=2.99 --price-annual=19.99 \
  --monthly=0.016 --annual=0.0034 \
  --cpt=0.35 --cr=0.75
# → gross $0.301 · net $0.256 · maxCPT@75% $0.192
# → verdict: LOSES MONEY — 1.8x over the affordable bid
```

**Post-Wave-2**, same brand-term basis:

```bash
node marketing/ads/unit-economics.mjs \
  --price-monthly=2.99 --price-annual=19.99 \
  --price-lifetime=24.99 --price-bundle=29.99 \
  --pro=0 --lifetime=0.006174 --bundle=0.002910 \
  --monthly=0.026880 --annual=0.005355 \
  --trial-to-paid=0.50 --churn=0.232 --consumables=0.122 \
  --cpt=0.35 --cr=0.75
# → gross $0.583 · net $0.496 · maxCPT@75% $0.372
# → verdict: PAYS BACK — scale within the kill criteria (ROAS 1.06x)
```

**Post-Wave-2 against head terms**, to see the gap that does not close:

```bash
node marketing/ads/unit-economics.mjs \
  --price-monthly=2.99 --price-annual=19.99 \
  --price-lifetime=24.99 --price-bundle=29.99 \
  --pro=0 --lifetime=0.006174 --bundle=0.002910 \
  --monthly=0.026880 --annual=0.005355 \
  --trial-to-paid=0.50 --churn=0.232 --consumables=0.122 \
  --cpt=1.20 --cr=0.55
# → 4.4x over the affordable bid. Wave 3 does not fix this.
```

**Post-Wave-3** (adds `--consumables=0.152` for the Festival pass and
`--ad-arpi=0.03` for rewarded video): gross $0.648, net $0.551,
maxCPT@75% $0.413.

Where each parameter comes from:

| Flag | Derivation |
|---|---|
| `--monthly=0.026880` | 0.020 baseline × 0.80 (P1 elasticity) × 1.60 (verifier's sub-additive A+B+C+D stack) × 1.05 (K) |
| `--annual=0.005355` | 0.004 × 0.85 × 1.50 × 1.05 |
| `--lifetime=0.006174` `--bundle=0.002910` | Perpetual-Pro block modelled as: buyer count halves (1.4% → 0.7% of installs) while blended price rises $10.70 → $26.50, then × 1.20 (B) × 1.05 (K) × 1.10 (P3, bundle only). **The single most assumption-loaded line in the model.** |
| `--trial-to-paid=0.50` | 0.40 → 0.47 (paywall stack) → 0.50 (J). J's standalone +15% relative overlaps the stack. |
| `--churn=0.232` | 0.25 → 0.235 (L, ~6% relative) → 0.232 (M) |
| `--consumables=0.122` | $0.05 + I $0.015 + F $0.019 + G $0.015 + H $0.015 + P4 $0.002, × 1.05 (K). Cosmetics are folded here because the model has no cosmetic line — add one if this ships. |

---

## 9. Discarded — do not re-propose

| Proposal | Why it is dead |
|---|---|
| **Starter Kit row inside `OnboardingChecklist`** | **REFUTED.** The finding proposed either making the Starter Kit a real discount or "renaming it Recommended and dropping the 7-day window, which implies urgency the price does not back up." That work is already done, deliberately: `config/monetization.ts:313-322` carries an explicit honesty note stating it is the Manager Identity Pack at its normal price, is not time-limited, and "must NOT be dressed up with a countdown or limited offer urgency." `getStarterKitRemainingMs` has zero callsites — no countdown is ever rendered, so the window is invisible to the user and cannot imply urgency. Separately, putting a purchase row inside the first-session tutorial is the **worst risk/reward on the entire board**: the highest D7 exposure for a one-off $2.99 cosmetic that does not compound. What survives is a five-minute cleanup — wire the dead `dismissStarterKit` action (`monetizationSlice.ts:157`) or delete it. Worth ~$0.000. |
| **Season pass with non-cosmetic rewards** | Every reward that would make a season pass compelling in a management sim is a simulation parameter. Automatically invalid under the no-pay-to-win rule. The cosmetic-only version is a worse product than the three cosmetic packs already shipped. (The Festival Premium track in Wave 3 survives only because it is strictly cosmetics + XP + pack opens.) |
| **Banners or interstitials to make `ad_free` worth buying** | Forced ad placements in a no-timers management sim trade a large D7 hit for a small ad line. `ad_free` is permanently dead inventory — reclaim the paywall slot (item D), do not resurrect the feature. |
| **AdMob mediation** | Not worth an SDK below ~50K rewarded impressions/month, which this app will not reach. |
| **Energy timers, rest packs, waiting mechanics of any kind** | Destroys the marketed wedge. Non-negotiable. |
| **Pro-only better quick-sell rate** | Would make monetization touch transfer values. Direct hard-rule violation. |
| **RevenueCat hosted paywall** | Banned. App Store rejection, Guideline 3.1.2(c). All Pro flows go through `SubscribeOnboarding`. |
| **Checking subscription SKUs against `monetization.entitlements`** | Grants permanent Pro to lapsed subscribers. `isPersistableEntitlement` (`monetizationSlice.ts:17-23`) guards `grantEntitlement`/`restoreEntitlements` — never route a consumable or subscription SKU through `ShopPage.handleConfirmPurchase`, which calls `restoreEntitlements(result.granted)` unconditionally at `:128`. This is why item I navigates to the Packs screen rather than duplicating the purchase flow. |
| **`HEAD-TERMS-US` campaign (`apple-ads-2026-27.md:104`)** | Needs $2.567 gross/install. The full roadmap ceiling is $0.648. Delete the campaign rather than leaving it paused as an aspiration. |
| **Meta / TikTok paid UA** | The §0 arithmetic is channel-independent and both run higher CPI than Apple Ads search. Same verdict, worse. |

---

## 10. If you only do one thing

Ship **P1 this week** (App Store Connect price change, no binary, no review,
+$0.016 and a free elasticity reading), and **read the RevenueCat dashboard**.
Four of the six assumptions in this document become measurements the same
afternoon, at zero engineering cost — and if the measured `trialToPaid` or
`monthlyChurn` differ materially from the 40% / 25% guesses, every number in
§3 shifts and the ranking should be recomputed before the Wave 2 binary is
scoped.
