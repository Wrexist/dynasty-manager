# Monetization Optimisation Prompt

> Copy-paste this entire prompt into a Claude Code session to audit, refine, and grow Dynasty Manager's existing monetization stack — never to redesign it from scratch.

---

You are the monetization architect for Dynasty Manager — a premium mobile football management sim with a **fully-shipped monetization layer**: configured products (`src/config/monetization.ts`), a working `monetizationSlice.ts`, helpers in `src/utils/monetization.ts`, an iOS subscription product (`com.dynastymanager.pro.monthly`), trial onboarding (`src/pages/SubscribeOnboarding.tsx`), the consumer-facing `ShopPage.tsx`, a `PurchaseModal.tsx`, a `GemRevealModal.tsx`, an `AdRewardButton.tsx`, and integrated AdMob (`@capacitor-community/admob`) plus in-app review (`@capacitor-community/in-app-review`). The packs system is live (`packsSlice.ts`, ~664 LOC) with walkout reveals and quick-sell flows. The architectural decisions are made. **Your job is to optimize what ships, not to redesign.**

Player-first ethos is non-negotiable: no pay-to-win, no premium currency, no loot-box obscurity, no energy gates, no dark patterns. Every change must pass the test: *"Would I feel good about this as a paying player? Would the free experience still feel complete?"*

## NON-NEGOTIABLE CONSTRAINTS

- **Existing infra is canonical** — extend, don't recreate. Never propose a new monetization slice, page, or config when one exists.
- **No pay-to-win** — purchased advantage must never affect match outcomes, transfer success, AI behaviour, or simulation balance
- **No premium currency** — in-game budget is the currency; packs award players, not coins
- **No energy / timer gates** on core gameplay
- **No loot-box obscurity** — pack contents must be transparent (rarity odds, possible pulls visible)
- **No dark patterns** — no fake countdowns, no manipulative FOMO, no predatory targeting of recent purchasers
- **Offline-first** — purchased entitlements must work offline after restore
- **Receipt validation** — preserve whatever validation strategy is currently in `monetizationSlice.ts`. Don't downgrade trust assumptions.
- **All new constants → `src/config/monetization.ts`** (extend, don't replace)
- **All new types → `src/types/game.ts`** (single source of truth)
- **No changes to `src/components/ui/*`** unless explicitly required for a new shop affordance
- **Test coverage** — anything touching purchases, entitlements, or pack odds gets tests in `src/test/monetization.test.ts` or `src/test/packs.test.ts`

---

## Phase 0: Inventory the Existing Stack

Read in parallel where possible. State what exists before proposing anything.

### Monetization core (read fully)
1. **`src/config/monetization.ts`** — every `ProductId`, `ProductDef`, subscription tier, ad-reward type, cosmetic catalogue. Note `PRODUCTS`, `CONSUMABLE_PRODUCT_IDS`, `PRO_PRODUCT_IDS`, `TRIAL_TARGET_PRODUCT_ID`.
2. **`src/store/slices/monetizationSlice.ts`** (~240 LOC) — purchase state, entitlements, ad rewards, cosmetics, trial logic
3. **`src/utils/monetization.ts`** (~5 KB) — entitlement helpers
4. **`src/utils/purchases.ts`** — purchase orchestration / restore flow
5. **`src/utils/ads.ts`** — AdMob wrapper

### UX surfaces (read fully)
6. **`src/pages/ShopPage.tsx`** — main commerce surface
7. **`src/pages/SubscribeOnboarding.tsx`** — trial onboarding
8. **`src/components/game/PurchaseModal.tsx`** — purchase confirm
9. **`src/components/game/GemRevealModal.tsx`** — reveal celebration
10. **`src/components/game/AdRewardButton.tsx`** — opt-in ad CTA

### Adjacent systems that monetization touches
11. **`src/store/slices/packsSlice.ts`** (~664 LOC) + `src/config/packs.ts` — packs economy, rarity, pull rates
12. **`src/utils/managerPerks.ts`** (34 perks) + `src/utils/prestige.ts` + `src/utils/achievements.ts` (39) — XP economy
13. **`src/utils/ballonDor.ts`** + `src/utils/ballonDorBoost.ts` — note any premium-tied boosts
14. **`src/store/helpers/persistence.ts`** — multi-slot save infra (`STORAGE_KEYS.saveSlot(n)`); note free-tier slot count
15. **`src/config/gameBalance.ts`** — confirm no monetization knob shifts a `MATCH_*`, `TRAINING_*`, `TRANSFER_*`, or AI parameter

### Platform readiness
16. **`capacitor.config.ts`** + **`package.json`** — installed plugins (admob, in-app-review). No payment plugin? Note the gap.
17. **`src/test/monetization.test.ts`** + **`src/test/packs.test.ts`** + **`src/test/packsSlice.test.ts`** — current coverage

After loading, output a **State of the Stack** report:

```xml
<inventory>
  <products count="N">List ProductIds and what each delivers.</products>
  <subscriptions tier="...">Pricing, trial config, grace period, lapse handling.</subscriptions>
  <packs tiers="N">Tier names + pull-rate transparency status.</packs>
  <ads placements="N">Where ad rewards trigger; reward types.</ads>
  <cosmetics count="N">What's catalogued, what's wired, what's stubbed.</cosmetics>
  <gaps>Most material missing piece.</gaps>
  <integration-quality>Score the polish of each surface 1–5 with one sentence.</integration-quality>
</inventory>
```

---

## Phase 1: Spending Desire Audit

Walk the player journey and identify **natural** "I wish I could…" moments — places where a paying option feels welcome rather than imposed.

### Existing trigger points to evaluate
- Pack-pull near-miss (pulled a 4★ when a 5★ was 1 in 50)
- Save-slot pressure (already gated by free-tier count)
- Multi-club career save management
- "Open another pack" right after a great pull (variable reward chasing)
- Cosmetic envy (saw another manager's avatar/badge in match flow)
- Convenience cravings (instant-sim, deeper analytics, scout reveal)
- Trial conversion (within first 7 days of install)

### Anti-trigger checklist (any YES = redesign needed)
- ❌ Does anything currently feel like a wall, not a window?
- ❌ Does any free flow get worse when a premium alternative exists?
- ❌ Does the shop interrupt without invitation?
- ❌ Is any pricing or contents ambiguous?

---

## Phase 2: Optimisation Targets

For each of the streams below, **state what already exists** before proposing changes. Reject any proposal that duplicates shipped work.

### A. Subscription (Pro Monthly) — refinements only
- Trial-to-paid conversion: friction points in `SubscribeOnboarding.tsx`?
- Grace-period UX when payment fails (`SubscriptionInfo.billingIssue` field exists — is it surfaced?)
- Cancellation save (offer alternate value, not pressure)
- Lapse re-engagement (gentle, never punishing)
- Pro-only conveniences worth listing (advanced analytics, instant sim, expanded scouting, extra slots, exclusive cosmetics, premium support)

### B. Packs Economy — tuning, not redesign
- Pull-rate transparency — are odds visible per tier?
- Pity timer / soft floor — does a long dry streak guarantee a high-rarity drop?
- Walkout-reveal animation pacing — already polished; preserve
- Quick-sell economics — does it feel respectful of the pull?
- Duplicate handling — does the player feel the dupe is recognised?
- New pack types worth proposing only if they fill a content gap, not if they cannibalise existing tiers

### C. Cosmetics — surface what's catalogued
- Manager avatar / outfit / badge — wired? Or catalogued but invisible?
- Club kits, board pitches (`src/components/game/BoardPitch.tsx` + `src/data/boardPitches.ts`), badges — surfacing across matchday?
- Premium accent themes beyond the gold default
- Trophy-cabinet display upgrades

### D. Convenience IAPs / Bundles — gap fillers
- Starter bundle (only if conversion data suggests one helps)
- "Manager's Toolkit" combos (slots + analytics + cosmetics)
- Lifetime "Dynasty Edition" — already a concept? Verify before proposing
- Seasonal cosmetic bundles aligned to in-game season (not real-world calendar — that triggers FOMO)

### E. Ad Rewards — opt-in only, already-wired
- Current placements (in `AdRewardButton.tsx` consumers): where, what reward?
- Frequency cap per session/day (anti-fatigue)
- Reward design: scout reveal, transfer-budget micro-injection, XP boost, pack discount voucher — all *temporary, never permanent advantage*
- Pro tier should hide ad CTAs entirely

### F. Save-Slot Tier (already partly built)
- Free-tier slot count — confirm and state
- Premium slot unlock path: per-slot vs. all-at-once vs. Pro-included
- Slot management UX (delete, rename, clone)

---

## Phase 3: Economy & Balance Verification

> **Trace the causal chain before answering each balance check.** If a paying player gets benefit X, what gameplay outcome does it touch, and what is the delta vs. a free player at season 5, season 10, season 20? Mark `[NEEDS VERIFICATION]` if the chain is unclear.

Hard checks (must hold):
- ✅ A free player can reach the same gameplay outcomes as a paying player (no league/cup/Ballon d'Or gated by money)
- ❌ Existing free progression must not feel worse to nudge spending (no pacing regressions)
- ❌ A £50 spend cannot translate into a meaningful league-table edge after 10 seasons
- ✅ The free experience feels complete and fun standalone

Then re-state the rule: monetization knobs live in `src/config/monetization.ts`. If a proposal requires changing a `MATCH_*`, `TRAINING_*`, or `TRANSFER_*` constant in `gameBalance.ts`, **reject it**.

---

## Phase 4: Pricing & Conversion Hygiene

### Benchmarks (genre)
- Football Manager Mobile (£8.99 premium)
- Top Eleven (freemium with pacing gates — anti-pattern)
- Retro Bowl / Goal (premium / cosmetics)
- New Star Soccer (one-time + cosmetics)

### For each product currently in `PRODUCTS`
- Is the US price competitive for the value delivered?
- Is regional pricing handled by the store, or hardcoded?
- Is the value prop visible *before* the purchase modal (i.e., on the shop tile)?
- Is "what you get" enumerated, with no hidden gotchas?
- Is "what you keep if you cancel" explicit (Pro especially)?

### Conversion hygiene
- Is "Restore Purchases" prominent on every shop surface?
- Does the shop work offline (cached catalogue)?
- Are receipts re-validated on app open, not just on purchase?
- Is there ANY copy that uses urgency without a real, mechanical deadline?

---

## Phase 5: Implementation Plan

For every change, format as:

```xml
<change priority="P0|P1|P2" effort="S|M|L">
  <name>Specific change name</name>
  <category>Subscription | Packs | Cosmetics | IAP | Ads | Slots | Pricing | Conversion</category>
  <existing-infra>Files this extends — be specific.</existing-infra>
  <new-work>What's actually new (lines of code or new file).</new-work>
  <player-benefit>What the paying player gets. What the free player gets.</player-benefit>
  <balance-impact>Any economy delta. Must be zero or marginal.</balance-impact>
  <risk>What could regress (purchase failures, save corruption, ad-fatigue, dark-pattern slide).</risk>
  <test>Specific test to add in src/test/.</test>
</change>
```

Priorities:
- **P0** — bugs in shipped flows (purchase fails, restore broken, trial doesn't convert, entitlement leaks across slots)
- **P1** — measurable conversion / retention lift with low risk
- **P2** — polish, future surface area

Sort P0 → P2, then S → L within each tier.

---

## Phase 6: Build Phase 1 of the Plan

Implement P0 fixes only in this session (P1+ require user sign-off because they touch player-visible UX). For each:

1. Read the file (if not loaded)
2. Make the surgical change — never refactor surrounding code
3. Add or extend the relevant test
4. State: `"Implemented [name]. Touched: [files]. Test: [name]."`

Run `npm run preflight` before marking done.

---

## Deliverables

1. **Inventory report** — what already ships
2. **Spending-desire map** — where the natural triggers live
3. **Stream-by-stream recommendations** — extending shipped infra only
4. **Balance proof** — every recommendation passes the four hard checks
5. **Pricing & conversion hygiene checklist** — pass/fail per product
6. **P0 fixes implemented** — with tests, preflight green
