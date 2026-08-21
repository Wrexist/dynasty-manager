# Growth Overhaul — Step-by-Step Manual Runbook

> Updated **2026-08-21** for current HEAD (v1.4.0). This is YOUR task list — everything
> that requires your Apple/RevenueCat/GitHub accounts, devices, or money. Code work I
> handle is marked **[ME]** and listed in §0 so you can see what gates what.
> Deep background: `marketing/ads/RELEASE-READINESS.md` · findings: `docs/growth-overhaul-audit.md`.

**Already done (don't redo):** stale World Cup listing copy fixed in all 37 locales ✅ ·
trial-eligibility, PacksPage probe, Shop dead-affordances, ProUpsell routing, device
entitlement storage — all fixed in code ✅.

---

## §0 What I'm doing in code [ME] — gates marked per step

1. Onboarding fixes: impossible scout inbox string, Next Match above the fold,
   checklist "first match" made actionable — *gates nothing of yours; improves D1/D7*
2. Analytics event set (`app_open`, `surface`, `paywall_viewed/dismissed`,
   `trial_started`, `pack_opened`, WC funnel) + consent-copy refresh + IndexedDB consent mirror
3. Launch-time pending-pack-credit reconciliation (closes a paid-credit loss path)
4. PurchaseModal native USD-fallback guard
5. `build-hero.mjs` per-CPP panel ordering + synthetic-capture option — **gates §5.3/§5.4**
6. Windows fix for `validate-locales.mjs`
7. CI secret assertion + sourcemap upload — **gates §4 verification**

---

## §1 Decisions — do first (~15 min, everything depends on these)

Write each answer into this file or `marketing/ads/arpi-roadmap.md`.

- [ ] **1.1 Screenshot trademarks.** Hero panels currently use real club/player marks.
  (a) accept the risk knowingly, or (b) re-capture from synthetic names via
  CinematicCapturePage (I re-enable the route temporarily when you're ready).
  Assumption: scrubbing lowers conversion. Decide it as a risk trade, not a conversion play.
  **Blocks §5.3–§5.5.**
- [ ] **1.2 Analytics: build or delete.** (a) Build = deploy a tiny collector
  (Cloudflare Worker is enough) + my code-queue item 2 → real funnel numbers.
  (b) Delete transport → take numbers from RevenueCat + App Store Connect only
  (4 of 6 model inputs, zero engineering). Solo-dev defensible: do §2 baselines FIRST,
  decide with data in hand. **Blocks §4.3.**
- [ ] **1.3 Price ladder: defer.** Recommended: don't touch $1.99/$14.99 until you have
  30 days of measured `monthlyStart` baseline (§2). Repricing first = you can never tell
  whether a later trial-start drop was price elasticity. **Blocks §7 reprice step.**
- [ ] **1.4 Budget rule at $5/day total.** Phase 1 live spend = BRAND-DEFENCE-US only,
  $5/day cap. LONGTAIL-US unlocks only if brand CPA ≤ $1.00 after ~2 weeks. Everything
  else built-but-paused. **Governs §6.**

## §2 Baselines — day 0, before anything changes (~30 min)

- [ ] **2.1 App Store Connect → App Analytics:** record + screenshot D1/D7/D28 by cohort,
  product page CVR, impressions/day, installs/day, and the business numbers you already
  quoted (73.3K impressions / 6,050 views / 747 downloads / 25 IAPs / $166).
- [ ] **2.2 RevenueCat → Charts:** record `trialToPaid`, `monthlyChurn`, per-product
  conversion. **This is the cheapest highest-value step in the whole plan.**
- [ ] **2.3 Re-run the model with measured inputs:**
  `node marketing/ads/unit-economics.mjs --trial-to-paid=<x> --churn=<y> --pro=<z> ...`
  Paste output into `arpi-roadmap.md`. Never hand-edit figures there.

## §3 RevenueCat dashboard (~30 min) — app.revenuecat.com

- [ ] **3.1 ⚠ THE critical field:** Entitlements → the entitlement id must read exactly
  `pro` or `dynasty_pro` (case-sensitive). Attach: `pro`, `pro.lifetime`, `bundle.all`,
  `pro.monthly`, `pro.annual`. Wrong = no subscriber ever gets Pro from a subscription.
- [ ] **3.2 Product catalog:** all 12 IDs from `src/config/monetization.ts` registered verbatim.
- [ ] **3.3 Consumables** (pack.gold/premium_gold/rare_gold/icon) attached to NO entitlement.
- [ ] **3.4 Offerings:** an offering named `default` flagged **Current**, containing at least
  the 3 subscription SKUs (ideally all 8 Shop SKUs).
- [ ] **3.5 Server notifications:** ASC App-Specific Shared Secret pasted into RC; RC's
  notification URL into ASC (App Information → App Store Server Notifications V2). Verify
  green "receiving" indicator.
- [ ] **3.6 API keys:** Project Settings → API Keys — confirm the CI secrets
  (`VITE_REVENUECAT_API_KEY*`) hold public SDK keys (`appl_…`), not secret keys.

## §4 Secrets & observability (~45 min)

- [ ] **4.1 Check existing secrets:** github.com/Wrexist/dynasty-manager/settings/secrets/actions —
  look for `VITE_SENTRY_DSN`, `VITE_ANALYTICS_ENDPOINT`.
- [ ] **4.2 Sentry ON (non-negotiable):** create project at sentry.io → copy DSN → add
  `VITE_SENTRY_DSN` repo secret. Also create `SENTRY_AUTH_TOKEN` (+ org/project slugs) for
  sourcemap upload [my code-queue 7 adds the workflow steps].
- [ ] **4.3 Analytics endpoint (only if decision 1.2 = build):** deploy collector accepting
  POST of the `AnalyticsPayload` JSON (tolerate sendBeacon's text/plain), verify it returns
  2xx, THEN set `VITE_ANALYTICS_ENDPOINT`. Setting it before the collector exists = events
  fire into a 404 silently.
- [ ] **4.4 App Privacy labels:** declare Crash Data/Diagnostics BEFORE submitting any
  Sentry-enabled binary (5.1.1 exposure if declared late). If we ship the install-day
  bucket from code-queue 2, update privacy policy page → modal copy → ASC labels, in that order.

## §5 Store surfaces (active work ~2–3 h + review waits)

- [ ] **5.1 Promotional Text sweep:** already clean ✅ (validated 2026-08-21, 0/37 stale).
  Re-run `node marketing/aso/validate-locales.mjs` after my Windows fix whenever copy changes.
- [ ] **5.2 Ratings check:** ASC → Ratings and Reviews. Under 50 ratings? Tell me — I'll move
  the review prompt to a moment more installs reach (throttle stays).
- [ ] **5.3 Hero screenshots** *(needs decision 1.1 + my build-hero.mjs ordering work)*:
  `node marketing/appstore/build-hero.mjs` → upload 6.9"/6.5" (iPad optional) to a new version.
  Remember captions are search-indexed.
- [ ] **5.4 App Preview video:** tell me when ready → I re-enable CinematicCapturePage →
  you capture the Rare-Gold walkout loop → post-process via
  `marketing/postproduction/build-ad.sh` → upload (15–30s, no device frames, no pricing text)
  → I disable the route again.
- [ ] **5.5 Six Custom Product Pages** *(submit ≥1 week before ads — H5)*: ASC → Custom Product
  Pages → + . Panel orders: `career`(01,05,03) · `tactics`(02,03,01) · `transfers`(04,03,01) ·
  `nation`(05,02,01) · `brand`(01,02,04) · `pro`(03,01,02). Each must reach **Approved**;
  note each URL for §6. CPPs are reviewed independently of app versions.
- [ ] **5.6 In-App Event** for next season rollover — submit AFTER the next version ships.

## §6 Ship binary + device QA (~1–2 h)

- [ ] **6.1 Wait for my code queue to land on main**, then trigger TestFlight:
  github.com/Wrexist/dynasty-manager/actions/workflows/ios-testflight.yml → Run workflow →
  `marketing_version` blank, `dev_tools` ON. Read the `::notice::` version/build line before
  upload completes. Never submit a dev_tools build to the App Store.
- [ ] **6.2 Sandbox tester:** ASC → Users and Access → Sandbox → + (email NOT an existing
  Apple ID). Device: Settings → Developer → Sandbox Apple Account.
- [ ] **6.3 Full purchase sweep:** paywall each plan row · Shop hero/Starter Kit/one-time
  Pro/cosmetics · Packs all four tiles · Restore from all three surfaces. No error toasts anywhere.
- [ ] **6.4 Trial-ineligible path:** with a sandbox Apple ID that has consumed its intro offer,
  confirm full-price CTA (not "7 days free").
- [ ] **6.5 Airplane-mode test:** Shop shows "Store unavailable"; paywall shows retry; Packs
  shows no dead buy buttons.
- [ ] **6.6 Settle A-6:** temporarily probe a bogus SKU; note whether getProducts rejects the
  batch or returns the subset; report back so I finalize the chunking fix.
- [ ] **6.7 Real submission:** one version containing everything outstanding (screenshots,
  subtitles if any, code fixes). Merging ≠ shipping — only this puts fixes on phones.

## §7 Apple Ads — only after §5.5 CPPs Approved AND §2 baselines recorded

- [ ] **7.1 Account:** ads.apple.com → **Advanced** (never Basic — no CPPs/exact match there),
  payment method added.
- [ ] **7.2 Build all five campaigns but start ONLY BRAND-DEFENCE-US live:** Exact match,
  CPP `brand`, **$5/day cap**, CPT ceiling $0.50, keywords from
  `marketing/ads/keywords/en-US-brand.csv`. LONGTAIL-US ($8/d structure, exact, cluster→CPP)
  unlocks per decision 1.4. CONQUEST ($6/d, exact, CPP career) · DISCOVERY ($6/d, broad+search
  match, negatives loaded) · HEAD-TERMS built and PAUSED at $0.
- [ ] **7.3 Negatives:** upload `negatives.csv` to DISCOVERY (and HEAD before any unpause).
- [ ] **7.4 Pre-spend baseline:** screenshot category rank, keyword ranks, impressions, CVR.
- [ ] **7.5 Kill criteria (set now):** CPA > $1.00 (brand/longtail/discovery) or > $1.50
  (conquest); any keyword >30% of campaign spend at below-median CPA. Raise winning bids ≤20%/week.
- [ ] **7.6 Reprice gate:** only after 30 days of §2 baselines — monthly $2.99 / annual $19.99
  with "Preserve current price for existing subscribers" ON. Watch trial starts: >20% relative
  drop = elasticity wrong, stop.

## §8 Weekly cadence (15 min/week once ads live)

- [ ] TTR · tap→install · CPT · CPA · D7 retention by campaign · net revenue/install.
  Weekly, not daily — daily reads at $5/day are noise.
- [ ] **D7 override rule:** any change lifting ARPI but dropping D7 >2 points vs pre-change
  cohort gets reverted — D7 is a ranking input.
- [ ] Discovery loop: winning search-match terms → keyword field/CPP/screenshot copy candidates.
- [ ] Update `pendingNews.ts` bullets as fixes ship; bump version → seal → ship cycle per CLAUDE.md.

---

## Hazards (read before touching ASC/RC)

| # | Rule | Why |
|---|---|---|
| H1 | NEVER remove `com.dynastymanager.pro` from sale | Revokes Pro from every bundle/legacy buyer |
| H2 | SKU removal + binary hiding it ship together | Orphan CTA = 2.1.0 rejection (build 174) |
| H3 | New SKU: Approved → mapped in RC → then binary references it | One bad ID can blank the catalog |
| H4 | Intro offer must exist in ASC before any binary claims "7 days free" | 3.1.2 false claim (code now checks, still verify) |
| H5 | CPPs Approved before ad groups select them | Otherwise ads default to the weak main page |

**Order of operations in one line:** §1 decisions → §2 baselines → §3 RC → §4 secrets →
§5 store assets (start CPP review clock early) → §6 binary+QA → §7 ads → §8 forever.
