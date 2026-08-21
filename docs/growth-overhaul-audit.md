# Growth Overhaul — Forensic Audit

> Sweep date: **2026-08-21** · Method: 5 parallel code sweeps (onboarding/first-session,
> monetization surfaces, analytics/Sentry, World Cup lifecycle, store assets/versioning).
> Supersedes findings status in `marketing/ads/RELEASE-READINESS.md` Part A where noted.
> Every claim below was verified against current HEAD. Severity: **P1** ship/revenue-blocking,
> **P2** real defect or blocked roadmap dependency, **P3** latent/polish.

---

## 1. Already fixed since the 2026-07-29 audit (verified at HEAD — do not re-open)

| Item | Status | Evidence |
|---|---|---|
| A-1 trial eligibility from store (`isEligibleForIntroOffer`) | ✅ FIXED | `purchases.ts:493-499`, `SubscribeOnboarding.tsx:136-156`; ineligible users get full-price CTA/copy |
| A-2 USD claims in non-USD storefronts | ✅ FIXED | localized-price derivation shipped; USD constants deleted |
| A-4 device-scoped entitlement storage | ✅ FIXED | `DEVICE_ENTITLEMENTS` key (`persistence.ts:324`), hydrated pre-render (`main.tsx:52-68`), `initGame` inherits (`initGame.ts:698-703`), mirrored on every mutation (`monetizationSlice.ts:19-26`) |
| A-5 PacksPage store-availability probe | ✅ FIXED | `PacksPage.tsx:349-365`, IAP method only for store-confirmed SKUs |
| A-11 Shop dead-affordance cards | ✅ FIXED | card-boundary gating: hero `ShopPage.tsx:329`, Starter Kit `:376`, lower bundle `:682` |
| A-15 `startFreeTrial` SKU guard | ✅ FIXED | `monetizationSlice.ts:293,300` |
| A-17 ProUpsell routes to paywall | ✅ FIXED | `ProUpsell.tsx:26` → `/subscribe` with returnTo |
| Stale "World Cup 2026" listing copy in 20 locales | ✅ FIXED | re-validated 2026-08-21: **0 of 37 locales** carry stale tokens; 0 char-limit violations |

## 2. Still open from the prior audit (re-confirmed today)

| Item | Sev | Status |
|---|---|---|
| **A-3** No CI assertion that observability secrets exist; no sourcemap upload step | P1 | Open. Missing secret silently produces an unobservable build identical to a good one. `vite.config.ts:91` emits hidden sourcemaps nobody uploads. |
| **A-6** `fetchStoreProducts` batch rejection blanks whole direct-lookup path | P2 | ✅ FIXED at HEAD (verified 2026-08-21): failure-isolating per-ID retry + Sentry warning exists (`purchases.ts:208-237`). The on-device settle (§9.6 of the runbook) remains worthwhile to confirm the wholesale-reject assumption, but the defensive path is in place. |
| **A-7** No install denominator (`app_open`), no persisted install id | P2 | Confirmed open: union has 33 events, none lifecycle-opening; payload has no identifier (`analytics.ts:16-66`). |
| **A-8** Packs commerce fully uninstrumented | P2 | Confirmed open: **zero `track()` calls in PacksPage**. |
| **A-9/A-10** purchase events lack `surface`; no paywall_viewed/dismissed/trial_started | P2 | Confirmed open: all four `purchase_*` carry `{productId}` only (`analytics.ts:25-28`). |
| **A-13** save-resident subscription outlives revocation | P3 | Accepted fail-open tradeoff — keep recorded, do not naive-fix. |
| **A-16** analytics consent in raw localStorage only | P3 | Confirmed open (`persistence.ts:841-852`); eviction re-shows mandatory modal, stops events (fail-safe). |

## 3. New findings (this sweep)

### N1 · P1 — Day-1 inbox gives impossible Scouting instructions
`initGame.ts:497` tells every new career: *"tap 'More' … then tap 'Scouting'"* — Scouting is not in the More drawer (`MoreDrawer.tsx:53-95`); it lives on the Market sub-nav (`config/ui.ts:430-432`). `OnboardingChecklist.tsx:168-175` documents this exact trap and uses correct wording — the inbox message was never fixed. Shown to 100% of new careers. One-string fix.

### N2 · P2 — First match is far below the fold
Dashboard render order puts ~8 blocks (WelcomeCard overlay, modals, PageHint, FestivalBanner, DynastyStatusChip, OnboardingChecklist, WeeklyDigest, club hero…) above Last Result (:1067) and **Next Match (:1099)** — off-screen at 375×667 on week 1. The checklist even claims *"Your next match card is right at the top"* (`OnboardingChecklist.tsx:215`) — false.

### N3 · P2 — Checklist demotes the core loop
The two tickable day-1 tasks are meta-economy chores (sponsor, scout); "play your first match" is the last row, muted, non-tickable, and its "Take me there" targets `dashboard` not `match-prep` (`OnboardingChecklist.tsx:203-219, :209, :308-314`).

### N4 · P2 — Paid transaction TTL loss path (crash durability residue)
`pendingPackCredit` reconciler runs **only on PacksPage mount** (`PacksPage.tsx:151-202`). A crash-stranded `charged:true` marker expires after the 7-day TTL (`config/monetization.ts:349`) and is dropped with a Sentry warning if the user doesn't open Packs within TTL — money taken, credit gone. Reconciliation should also run at app launch (main.tsx hydration path).

### N5 · P3 — PurchaseModal USD fallback survives on native
`PurchaseModal.tsx:44`: `storePrice || '$' + priceUsd` with no native guard. Mitigated (store usually answers; Shop gates unconfirmed SKUs) but the final confirm dialog can still render USD for a non-US user in edge cases.

### N6 · P3 — Consent modal copy drifts from the event union
`AnalyticsConsentModal.tsx:61-64` promises only "game events… and app version" but the union now collects purchase funnels, streaks/festivals, reminders, shares. Any analytics expansion (A-7 etc.) must update this copy + privacy policy + ASC labels together.

### N7 · P3 — `validate-locales.mjs` crashes on Windows
POSIX-only path construction (`new URL('./locales', import.meta.url).pathname` → doubled drive letter). Blocks the ASO verification loop on this machine. Trivial fix.

### N8 · P2 — `build-hero.mjs` cannot produce CPP panel orders
Five hardcoded panels, single target filter, no per-CPP ordering, no synthetic-name capture mode. The ads plan assumes "one re-render with a different panel order" per CPP — that capability must be added before the 6 CPPs can be generated efficiently (H5 dependency).

### N9 · P3 — Analytics sink is fire-and-forget
No batching, retry, or persistence (`analytics.ts:97-114`, comment: "best-effort, never retried"). Acceptable for v1 transport; matters if decision 1.3 = build.

## 4. World Cup lifecycle verdict

Architecture is sound and stays: standalone `gameMode:'world-cup'` session (`nationalTeamSlice.ts:16-43`), live matches through the real engine via `worldCupMatchActions.ts` while `weekAdvance` handles only AI weeks; elimination fast-forwards the bracket (`international.ts:549-569`) so ties can't strand; final win → ceremony + Golden Boot + share card (`WorldCupResult.tsx`). State lives in the main save; Continue works mid-tournament.

Notes: `startWorldCup()` deletes the target save slot by design (confirmed in setup flow) — ensure setup copy keeps saying so. **Zero analytics coverage** of the WC funnel (no `world_cup_*` events exist).

## 5. Store assets & versioning state

- `package.json` **1.4.0** = top sealed whatsNew entry (2026-08-17, build null until CI injects). **13 pending bullets** await the next seal (needs version bump past 1.4.0). Save schema v83 ✓ matches docs.
- Keyword CSVs ready: brand ~10, longtail ~31, conquest ~16, head ~17 (staged), negatives ~33.
- Campaign structure per `apple-ads-2026-27.md`: BRAND $5/d · LONGTAIL $8/d · CONQUEST $6/d · DISCOVERY $6/d · HEAD paused. At the user's stated **$5/day total**, phase 1 = BRAND-DEFENCE-US only; others built-but-paused.
- `unit-economics.mjs` defaults are all flagged ASSUMED; baselines (§11.1 of runbook) remain unrecorded.
- `CinematicCapturePage` route disabled (`App.tsx:35,120-125`) — needs temporary re-enable for App Preview capture.

## 6. Prioritised code queue (unblocks the manual runbook)

| # | Work | Unblocks | Effort |
|---|---|---|---|
| 1 | N1+N2+N3 onboarding fixes (inbox string, hoist Next Match, checklist CTA/copy) | First-session quality (retention input) | S |
| 2 | Analytics gap set: `app_open` + coarse install-day bucket, `surface` on purchase_*, `paywall_viewed/dismissed`, `trial_started`, `pack_opened` + PacksPage instrumentation, WC funnel events; consent-modal copy refresh; consent mirrored to IndexedDB | Decision 1.3(a); every conversion rate | M |
| 3 | Launch-time `pendingPackCredit` reconciliation | Closes N4 money-loss path | S |
| 4 | PurchaseModal native USD-fallback guard | Closes N5 | S |
| 5 | `build-hero.mjs`: per-CPP panel ordering + optional synthetic-capture mode | Phase 5 CPPs (H5) | M |
| 6 | Windows fix for `validate-locales.mjs` | ASO loop | S |
| 7 | CI: secret-presence assertion + sentry-cli sourcemap upload step | A-3 | S |
| 8 | Regression tests for 2–4 | Revenue safety | M |
