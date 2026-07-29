# Release Readiness — surviving code defects + the manual runbook

> Companion to `marketing/ads/arpi-roadmap.md` and `marketing/ads/apple-ads-2026-27.md`.
> Written 2026-07-29 against **HEAD = `67e8525`**.
>
> **Part A** is what still needs fixing in the codebase.
> **Part B** is everything you have to do *outside* the codebase, in order.
>
> Five agents swept the code; every finding was adversarially re-verified, and
> then re-checked against HEAD before being written down here — three fix
> commits (`25c9ac6`, `a78bd4c`, `67e8525`) landed *during* the audit, so a
> number of reported defects were already dead by the time this was written.
> Those are in the cleared footnote at the end of Part A, by title, so nobody
> re-opens them.
>
> **No measured metric appears in this document.** Every dollar figure quoted
> from the roadmap is a modelled estimate from `unit-economics.mjs`, whose own
> output ends with the line *"ASSUMED, NOT MEASURED"*. Assumptions are marked
> **[ASSUMPTION]**. Things the audit could not determine from inside the repo
> are marked **[CANNOT VERIFY FROM REPO]** with instructions for checking.

---

> **STATUS UPDATE — items fixed after this audit ran.** The sweep executed
> against an earlier commit and several of its findings were fixed while it was
> still running. Fixed at HEAD, with commit and test coverage:
>
> | Item | Fixed by | Coverage |
> |---|---|---|
> | **A-1** trial eligibility from local state | `87c723e` — `isEligibleForIntroOffer()` asks RevenueCat; a definite "not eligible" always wins, unknown falls back to the local heuristic | manual (needs a sandbox Apple ID that has consumed its intro offer) |
> | **A-2** USD price claims in non-USD storefronts | `87c723e` — `getStoreAvailability` now returns numeric prices + currency; every percentage and per-period figure is derived per-storefront, and omitted when the store has not answered. The five USD constants are deleted | typecheck + render |
> | **A-5** PacksPage had no availability probe | this commit — `packSkuPurchasable()` gates the `iap` method | typecheck |
> | **A-12** `adBudgetReward` clamp when `min > max` | this commit — bounds normalised before clamping | `monetization.test.ts` |
> | **A-18** CLAUDE.md said schema v73 | `87c723e` — corrected to v78 in all four places | — |
>
> **A-3 remains the most important open item** and is not a code fix: the env
> wiring for `VITE_ANALYTICS_ENDPOINT` / `VITE_SENTRY_DSN` now exists in both
> workflows, but the **GitHub secrets do not**, so an unset secret still
> produces a build with no observability that looks identical to one with it.
> See §8.
>
> Everything else in Part A is unchanged and still open.

## Part A — what still needs fixing in code

### Severity key

| | Meaning |
|---|---|
| **P0** | Blocks shipping. None survive. |
| **P1** | App Review rejection risk, false claim to users, or a revenue leak with a live trigger. Fix before the next submission. |
| **P2** | Real defect with a constructible trigger; ship-blocking only for the roadmap work that depends on it. |
| **P3** | Latent, unreachable today, or a smell. Fix opportunistically or record as an accepted tradeoff. |

**There are no surviving P0s.** The two P0s the audit raised — `VITE_ANALYTICS_ENDPOINT`
and `VITE_SENTRY_DSN` never being injected into the release build — are **fixed in
the workflow YAML at HEAD** (`.github/workflows/ios-testflight.yml:100-101`,
`.github/workflows/android-build.yml:38-39`). What has *not* been verified is
whether the corresponding GitHub repository secrets actually exist. See **A-3**
and **Part B §8**.

---

### P1

#### A-1 · "7 days free" is shown to users the App Store will charge immediately

> **✅ FIXED at HEAD (87c723e).** Retained for the reasoning and for the sandbox test steps.

**Severity:** P1 — Guideline 3.1.2(c) false claim, plus refund/chargeback exposure.
**Status at HEAD:** live and unfixed. Two independent agents found it; the second
confirmed the first's read.

**Trigger.** Trial eligibility is derived entirely from local state:

```ts
// src/pages/SubscribeOnboarding.tsx:115
const trialEligible = monetization.subscription == null;
```

`extractSubscriptionInfo` (`src/utils/purchases.ts:491-504`) reads only
`customerInfo.entitlements.active`, which by definition never contains an
*expired* subscription. So on a fresh install by a lapsed subscriber,
`monetization.subscription` is `null` **permanently** — no sync path can ever
correct it. Concretely:

1. User subscribes to Pro Monthly, cancels a month later. Apple's introductory
   offer is now consumed for that Apple ID, forever.
2. They delete and reinstall (or install on a second device, or start a new
   save). Onboarding reaches `#/subscribe`.
3. The paywall renders `trialCaption` (`SubscribeOnboarding.tsx:496`), the CTA
   `Try 7 Days Free` (`:562`), the billing summary *"Free for 7 days, then
   $1.99 per month"* (`:321`), and *"No payment due now · cancel anytime"* (`:574`).
4. They tap. **Apple charges immediately.** No intro offer is available to them.
5. The app then toasts *"7-Day Free Trial Started!"* (`:233`) at someone who
   was just billed.

Secondary damage: `startFreeTrial(selected)` (`:226`) is gated by the same
null check, so it writes a fake `{tier:'trial', expiresAt: now+7d}` record. If
the subsequent `syncAfterPurchase()` fails or returns no active Pro entitlement,
a paying **annual** subscriber's local record expires in 7 days instead of 365.

Nothing in `src/` calls `checkTrialOrIntroductoryPriceEligibility` or inspects
`introPrice` — grep for both returns zero hits.

**Files.** `src/pages/SubscribeOnboarding.tsx:115` · `:225-226` · `:233` · `:321`
· `:496` · `:562` · `:574` | `src/utils/purchases.ts:491`

**Fix.** Add to `src/utils/purchases.ts`:

```ts
export async function checkTrialEligibility(
  productIds: ProductId[],
): Promise<Partial<Record<ProductId, boolean>>>
```

wrapping `Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers })`,
returning all-`true` when `!Capacitor.isNativePlatform()` so web/dev keeps
exercising the trial UI (same convention as every other wrapper in that file).
Call it in the existing availability effect (`SubscribeOnboarding.tsx:149-168`)
and store the result beside `availableIds`. Then:

```ts
const trialEligible = monetization.subscription == null && storeEligible[selected] === true;
```

**On device, default to NOT eligible while the probe is in flight or unanswered.**
Showing full price to an eligible user is a lost conversion; showing "free" to an
ineligible one is a false claim plus a refund. Because the caption, CTA label,
`billingSummary`, reassurance line, success toast and the `isTrial` guard all
already read `trialEligible`/`isTrialPlan`, this is one change point.

Separately, delete `if (isTrial) startFreeTrial(selected)` at `:226` and let
`extractSubscriptionInfo`'s `periodType` (`purchases.ts:510-511`) be the sole
source of trial state on device. Keep `startFreeTrial` for the web/dev mock path
only.

**Effort:** M (half a day including on-device sandbox verification).
**Manual dependency:** Part B §3 step 3.4 — confirm the intro offer actually
exists in App Store Connect and is 7 days. If the store offer differs from
`FREE_TRIAL_DAYS` (`src/config/monetization.ts:320`), the copy is a false claim
*independent of this code fix*.

---

#### A-2 · USD price claims render alongside store-localized prices in every non-USD storefront

> **✅ FIXED at HEAD (87c723e).** Retained for the list of affected claims.

**Severity:** P1 — false price claim outside the US (3.1.2 / 2.3.1), and one of
the claims is *provably* false rather than merely mis-currencied.
**Status at HEAD:** live and unfixed.

**Trigger.** Open Shop on a device with a German (or Japanese, or any non-US)
App Store account. `priceFor` correctly returns the store-localized string, but
five claims next to it are computed from USD constants that hardcode `$`:

| Claim | Line | Source constant |
|---|---|---|
| Dynasty Edition strikethrough — always `$16.96` | `ShopPage.tsx:299` (hero) and `:634` (lower card) | `BUNDLE_INDIVIDUAL_TOTAL`, `:61-64` |
| `Save {BUNDLE_SAVINGS_PCT}%` | `:279`, `:627` | `:65` |
| `Just $0.07/day` | `:463` | `MONTHLY_PER_DAY`, `:68` |
| `Just $1.25/month billed yearly` | `:405`, `:466` | `ANNUAL_PER_MONTH`, `:70` |
| `Save {ANNUAL_SAVINGS_PCT}%` | annual card, upgrade card | `:72-74` |

A German user sees `17,99 €` with `$16.96` struck through beside it. Because
Apple's per-currency price tiers are **not** proportional across SKUs, that
reference price is not the local sum of the four component products and can be
*lower* than the localized bundle price — which makes "Save 12%" a false
statement, not just a badly formatted one.

Secondary exposure: `priceFor` falls back to USD, and `PurchaseModal.tsx:44`
falls back to USD using the `storePrice` prop ShopPage passes from a possibly-empty
`storePrices` map. A device with a successful availability probe but an empty
price map shows a USD figure on the **final confirm-and-charge dialog**.

**Files.** `src/pages/ShopPage.tsx:61-74` (constants) · `:279` · `:299` · `:405`
· `:463` · `:466` · `:627` · `:634` | `src/components/game/PurchaseModal.tsx:44`

**Fix.** Add `hasLocalizedPrices = Object.keys(storePrices).length > 0`. Move
`MONTHLY_PER_DAY` / `ANNUAL_PER_MONTH` / `ANNUAL_SAVINGS_PCT` /
`BUNDLE_SAVINGS_PCT` / `BUNDLE_INDIVIDUAL_TOTAL` from module constants into a
`useMemo` keyed on `storePrices`, deriving them by parsing the numeric part of
the localized strings. When parsing fails **or** `hasLocalizedPrices` is false
on a native platform, **suppress** the strikethroughs, the per-day/per-month
captions and the Save-% badges entirely rather than falling back to USD. Keep
`formatPrice` as the web/dev fallback only. In `PurchaseModal`, disable the
confirm button when `storePrice` is undefined on a native platform rather than
charging against a USD label.

**Effort:** L (the parsing is fiddly — locale decimal separators, currency
position, non-breaking spaces). Budget a full day and write unit tests against
`17,99 €`, `¥1,800`, `£14.99`, `R$ 74,90`.

**Ordering note.** This fix is a hard prerequisite for the roadmap's P1 repricing
(Part B §2) — repricing changes the USD constants, which changes exactly these
five wrong numbers in every non-US storefront simultaneously.

---

#### A-3 · Nothing signals a missing analytics/Sentry secret — a build with the env wiring but no secret is silently identical to today

**Severity:** P1 — it is the difference between "observability shipped" and
"observability looks shipped."
**Status at HEAD:** the workflow injection lines exist; the failure mode does not.

**Trigger.** GitHub Actions expands `${{ secrets.VITE_SENTRY_DSN }}` to the
**empty string** when the secret does not exist. Vite then bakes
`import.meta.env.VITE_SENTRY_DSN === ''`, which is falsy, so:

- `src/bootstrap-sentry.ts:10` skips `Sentry.init` entirely.
- `initSentry()` returns at `src/utils/sentry.ts:64`, `initialized` never flips.
- `addGameBreadcrumb` returns at `sentry.ts:119` for every crumb, discarding the
  purchase trail (`SubscribeOnboarding.tsx:207/241/258`) *before* it is recorded.
- Every `Sentry.captureException` — `purchases.ts:323`, `:363`, `ShopPage.tsx:160`,
  `main.tsx:100/111/130` — ships to a client that was never configured.

Same shape for analytics: `defaultSink` (`analytics.ts:91-92`) returns before any
`sendBeacon`/`fetch`, killing all 24 event variants.

**There is no build log line, no annotation, and no runtime signal** that
distinguishes "secret configured" from "secret absent." The workflow will go
green either way.

This also invalidates the CLAUDE.md postmortem workflow that says to verify a
crash fix by asking the user for a new crash report — there may be no crash
reports to ask for.

**[CANNOT VERIFY FROM REPO]** Whether `VITE_SENTRY_DSN` and
`VITE_ANALYTICS_ENDPOINT` exist as repository secrets. Check per Part B §8 step 8.1.

**Files.** `.github/workflows/ios-testflight.yml:100-101` |
`.github/workflows/android-build.yml:38-39` | `src/bootstrap-sentry.ts:10` |
`src/utils/sentry.ts:63` · `:119` | `src/utils/analytics.ts:91-92`

**Fix.** Add a build-time assertion step to `ios-testflight.yml` immediately
before the web build:

```yaml
- name: Assert observability secrets are present
  run: |
    test -n "${{ secrets.VITE_SENTRY_DSN }}" || { echo "::error::VITE_SENTRY_DSN is not set"; exit 1; }
    echo "::notice::Sentry DSN present; analytics endpoint present=${{ secrets.VITE_ANALYTICS_ENDPOINT != '' }}"
```

Make Sentry a hard failure. Keep analytics a `::notice::` until you have decided
Part B §1 decision D3 — if you delete the transport, a hard failure there would
be wrong.

Additionally, note that `vite.config.ts:91` already emits `sourcemap: 'hidden'`
for Sentry upload, but **no workflow step uploads those maps**. Stack traces will
be minified and near-useless until a `sentry-cli sourcemaps upload` step is added
after the build. That needs `SENTRY_AUTH_TOKEN` plus org/project slugs — Part B §8
step 8.5.

**Effort:** S for the assertion, M including sourcemap upload.

---

### P2

#### A-4 · Purchase state has no device-scoped storage — the "New Game" path starts Pro-less

**Severity:** P2 (verifier corrected down from P1 — see caveats).
**Status at HEAD:** live. `mergeDeviceMonetization` fixed the *load* path; the
*init* path was never in scope.

**Trigger.** The only durable record of a purchase is inside a save slot.

1. Cold launch. `main.tsx` calls `initPurchases()`, which writes nothing into the
   store. `monetization` is `DEFAULT_MONETIZATION_STATE`. Every RevenueCat sync
   site in the app is post-navigation (`GameShell.tsx:232/240/247/251`,
   `SettingsPage.tsx:235/250`, `ShopPage.tsx:148/154`,
   `SubscribeOnboarding.tsx:199`) — nothing hydrates before TitleScreen renders.
2. Tap **New Game** (not Continue). `initGame` copies live state:
   ```ts
   // src/store/slices/orchestration/initGame.ts:669-674
   entitlements: get().monetization?.entitlements || [],           // [] || []
   firstLaunchTimestamp: get().monetization?.firstLaunchTimestamp || Date.now(),
   subscription: get().monetization?.subscription || null,
   ```
   → `isPro()` false for the new career, and the Starter Kit window re-arms
   because `0 || Date.now()` stamps a fresh anchor.
3. On the normal online path GameShell's mount effect repairs entitlements within
   a second. **Offline with no RevenueCat cache** (reinstall on a plane; SDK
   genuinely throws), `getEntitlements()` returns `[]`, `GameShell.tsx:232` guards
   `if (ids.length > 0)`, and nothing is restored for the session.

**Verifier's corrections, which you should not skip:**
- The offline case is narrower than first reported. `purchases.ts:402` is the
  *off-device* guard (`!isNativePlatform() || !NATIVE_MONETIZATION_READY`), and
  `NATIVE_MONETIZATION_READY = true`, so it never fires on a real device. Offline,
  the call reaches the SDK, which serves **cached** `CustomerInfo`. The empty
  result requires no cache at all — i.e. reinstall *and* never having been online.
- Nothing is **permanently** lost: `mergeDeviceMonetization` only ever *adds*
  (`utils/monetization.ts:117-119`), so loading that slot once live state is
  populated restores Pro.

So the real impact is a **session-scoped Pro gap** on a narrow path, plus a
re-armed $2.99 Starter Kit promo. That is architecture debt, not a revenue leak.

**Files.** `src/store/slices/orchestration/initGame.ts:669-674` |
`src/pages/GameShell.tsx:232` | `src/store/helpers/persistence.ts:270-310`

**Fix.** Give device-scoped state device-scoped storage. Add
`DEVICE_ENTITLEMENTS: 'dynasty-entitlements'` to `STORAGE_KEYS` (same precedent
as `ANALYTICS_CONSENT`), write `{entitlements, subscription, firstLaunchTimestamp}`
from `grantEntitlement` / `restoreEntitlements` / `updateSubscription` /
`initMonetizationTimestamp`, and read it in `main.tsx` alongside
`hydrateSaveStorage()` so live state is populated **before TitleScreen renders**.
`mergeDeviceMonetization` then merges save-vs-device instead of save-vs-empty, and
`initGame`/`makeFreshState` inherit a real record. Closes the New Game path, the
deleted-slot path, the reinstall path and the Starter Kit re-arm in one change.

**Effort:** M. **Migration:** none — this is a new device-level key outside the
per-slot save, so `CURRENT_VERSION` is unaffected.

---

#### A-5 · PacksPage sells consumables with no store-availability probe — the dead-CTA condition that got build 174 rejected

> **✅ FIXED at HEAD.** PacksPage now probes store availability and only offers the IAP method for SKUs the store confirmed.

**Severity:** P2 — Guideline 2.1.0.
**Status at HEAD:** live. ShopPage and SubscribeOnboarding got the gate; PacksPage
did not.

**Trigger.** `PacksPage.tsx:405` calls `purchaseConsumable(tier.productId)`
directly. There is no `getStoreAvailability` call anywhere in the file (grep
confirms). If any of the four consumable pack SKUs is unconfigured, pulled from
sale, or still propagating, the paid pack tile still renders a buy button →
`buyProduct` → `fetchStoreProducts` returns nothing →
`throw new Error('Product ... is not available from the store')`
(`purchases.ts:233`) → generic failure toast. A reviewer tapping a paid pack tile
in a sandbox where the consumables are not yet Approved reproduces exactly the
build-174 sequence.

**Files.** `src/pages/PacksPage.tsx:389-405` | `src/utils/purchases.ts:233` |
`src/pages/ShopPage.tsx:112-130` (the reference implementation)

**Fix.** Mirror ShopPage exactly: probe `getStoreAvailability(CONSUMABLE_PRODUCT_IDS)`
in a mount effect, keep `null` (show everything) when `supported === false` so
web/dev is unaffected, and hide or disable the paid-tier CTA for SKUs the store
did not confirm. Reuse the `availableIds === null || availableIds.includes(id)`
convention so all three surfaces behave identically.

**Effort:** S.

---

#### A-6 · `fetchStoreProducts` still batches all IDs into one call — one unconfigured SKU blanks the whole direct-lookup path

**Severity:** P2 — and it is the **ordering hazard** behind every SKU change in
Part B §2.
**Status at HEAD:** partially mitigated. ShopPage now probes only the 8 SKUs it
sells (`SHOP_PROBE_IDS`, `ShopPage.tsx:44-53`), which was the worst of it. The
underlying batching is unchanged.

**Trigger.** `fetchStoreProducts` (`purchases.ts:188-212`) issues one
`getProducts({ productIdentifiers: ids })` per platform type. Per the code's own
comment at `:200-201`, *"getProducts rejects wholesale when ANY requested ID is
unconfigured"* — and the `catch` returns `[]` for the entire batch. So a single
SKU among the 8 that is retired, removed from sale, or mid-propagation makes the
direct-lookup path yield nothing, and `available` is populated **only** from
`fetchOfferingPackages`. If your RevenueCat offering contains subscriptions only
(the common configuration), `available` comes back non-empty as the three
subscription IDs — so ShopPage keeps it — and every one-time SKU silently fails
`isPurchasable`: the Dynasty Edition button, the Starter Kit button, the one-time
Pro card and all three cosmetic packs vanish, with no error shown to anyone.

**[ASSUMPTION]** The "rejects wholesale" behaviour is asserted by the comment at
`purchases.ts:200-201`; it was not executed during the audit. Verify it on device
per Part B §9 step 9.6 before treating the per-ID chunking as required rather than
defensive.

**Files.** `src/utils/purchases.ts:188-212` · `:277` | `src/pages/ShopPage.tsx:112`

**Fix.** Make the direct lookup failure-isolating: when the batched call rejects,
retry per-ID via `Promise.allSettled` over single-element queries, so one
unconfigured SKU costs you that SKU and nothing else. Add a Sentry breadcrumb on
the fallback path so this becomes visible instead of silent. Keep the merge logic
as-is.

**Effort:** S.

---

#### A-7 · No install or session denominator event — every conversion rate in the model is uncomputable even with a working endpoint

**Severity:** P2 — this is the item that decides whether Part B §8 is worth doing
at all.
**Status at HEAD:** live.

**Trigger.** Wire the endpoint, ship, collect a week of data, then try to compute
`proOneTime = Dynasty Pro purchases ÷ installs`. **The denominator does not
exist.** The `AnalyticsEvent` union (`analytics.ts:16-43`) has no `app_open`, no
`session_start`, no install event. `game_started` fires only inside `initGame`, so
a returning player who taps Continue emits `save_loaded` and never `game_started`,
and a player who installs, opens, browses the Shop and quits emits **nothing**.

Deduplication is impossible by design: `SESSION_ID` is regenerated on every module
load and explicitly not persisted (`analytics.ts:62-74`), so N events cannot be
collapsed to a device count. Every `DEFAULTS` rate at `unit-economics.mjs:61-70`
is expressed *as a fraction of installs* and none of the six is derivable.

**Files.** `src/utils/analytics.ts:16` · `:62-74` |
`src/store/slices/orchestration/initGame.ts:184` | `marketing/ads/unit-economics.mjs:61`

**Fix.** Add
`{ name: 'app_open'; data: { firstLaunch: boolean; daysSinceInstall: number } }`
to the union and fire it once from `main.tsx` after the consent cache is seeded.
Supply the denominator with a persisted random install id: register `INSTALL_ID`
in `STORAGE_KEYS` alongside `ANALYTICS_CONSENT`, mint it lazily on the first
*granted* `track()`, and add it to `AnalyticsPayload`.

**⚠ This is a deliberate change to the privacy posture** documented at
`analytics.ts:62-65` and promised in the consent modal copy
(`AnalyticsConsentModal.tsx:71-75`, which currently says *no device fingerprints*).
Either the modal text **and** the privacy policy **and** the App Store Connect
privacy nutrition labels are updated in the same change (Part B §6 step 6.3), or
the install id must instead be a coarse install-day bucket that cannot re-identify.
Do not ship the id without picking one of those two.

**Effort:** M (S for the code, M once the privacy-copy work is counted).

---

#### A-8 · Consumable pack IAP is entirely uninstrumented — `consumableArpi` has no data source

**Severity:** P2.
**Status at HEAD:** live.

**Trigger.** Open Packs → tap an Icon pack → complete the purchase → pack reveals.
**Zero** analytics events fire for the whole flow. `PacksPage.tsx` has no `track(`
call anywhere (only `addGameBreadcrumb` at `:396` and `:415`, which itself no-ops
with no DSN); `packsSlice.ts` has none; and the union contains no `pack_opened` or
`pack_purchased` variant to fire. `purchase_initiated`/`completed` exist only in
`ShopPage.tsx` and `SubscribeOnboarding.tsx`, neither of which is on the pack path.

The app's highest-frequency commerce surface is its only commerce surface with no
funnel. `consumableArpi` (`unit-economics.mjs:69`, guessed at $0.05) is not merely
unmeasured but **unmeasurable**, and the free bronze/silver daily opens that drive
the habit loop are invisible too.

**Files.** `src/pages/PacksPage.tsx:389-433` | `src/utils/analytics.ts:25` |
`marketing/ads/unit-economics.mjs:69`

**Fix.** Add
`{ name: 'pack_opened'; data: { tierKey: string; method: 'free'|'currency'|'ad'|'iap'; pityTriggered: boolean } }`
and reuse the existing `purchase_*` events for the IAP leg. Fire
`purchase_initiated` beside the breadcrumb at `:396`, `purchase_cancelled` in the
`!purchased` branch at `:407`, `purchase_completed` after `clearPendingPackCredit()`,
and `purchase_failed` in the catch. Fire `pack_opened` at all three `setOpening`
call sites so free and paid opens share one funnel.

**⚠ Keep every `track()` call OUTSIDE the try/catch that decides whether to clear
the pending-credit marker** (`PacksPage.tsx:404`, `:426`, `:433-443`). A throw from
analytics inside that block produces spurious pack re-grants — the reconciler at
`PacksPage.tsx:142-174` exists precisely because that marker is load-bearing for
money that has already changed hands.

**Effort:** S.

---

### P3

#### A-9 · `purchase_initiated` means different things in Shop and Onboarding; Shop's modal cancel emits nothing

`ShopPage.tsx:113-117` fires `purchase_initiated` when the confirm modal *opens*,
before StoreKit is touched. `onCancel` (`:680`) is `() => setPurchaseProduct(null)`
with no `track` call, so every abandoned modal is an orphaned `initiated` inflating
the denominator forever. `SubscribeOnboarding.tsx:206` fires the same event name
one stage later, immediately before `await purchaseProduct(selected)`. The payload
is `{ productId }` only — **no `surface` field** — so the two cannot be separated
post-hoc and per-surface CVR is uncomputable.

**Fix.** Add `surface: string` to all four `purchase_*` variants. Move ShopPage's
`track('purchase_initiated')` into `handleConfirmPurchase` beside the breadcrumb at
`:138`. Add `track('purchase_cancelled', { productId, surface: 'shop_modal' })` to
`onCancel`. Pass `surface: 'shop' | 'onboarding' | 'packs'` everywhere. **Effort:** S.

#### A-10 · No paywall impression, dismissal, or trial-start events

`ShopPage.tsx:190-193` navigates to `/subscribe` with no event, so paywall
view→purchase CVR — the single most actionable number for the price-ladder work —
cannot be computed. At `SubscribeOnboarding.tsx:225-229` a trial start and a direct
paid monthly start emit the *identical* `purchase_completed { productId: '...monthly' }`;
`isTrial` is computed and used for toast copy but never for an event.

**Fix.** Add `paywall_viewed { surface, trialEligible }`,
`paywall_dismissed { surface, secondsOnScreen }`, `trial_started { productId }`.
Fire the first from a mount effect in `SubscribeOnboarding`, the second from its
cleanup and the `finish()`/back paths, the third inside the `isTrial` branch.

**Do not attempt to synthesise `trialToPaid` or `monthlyChurn` from `expiresAt`.**
Those are renewal-lifecycle facts the client cannot observe reliably; take them
from the RevenueCat dashboard (Part B §4 step 4.7). **Effort:** M.

#### A-11 · `isPurchasable` dead-affordance survives on the Dynasty Edition hero and the Starter Kit card

Commit `67e8525` hoisted the gate correctly for subscriptions
(`ShopPage.tsx:431`) and cosmetics (`:567`), both now `isPurchasable(id) || hasProduct(...)`,
and added a "Store unavailable" panel (`:418-427`). **Two cards were missed.** The
Dynasty Edition hero (`:271-308`) and the Starter Kit card (`:315-335`) still gate
only the inner `<button>` (`:302`, `:328`), so when their SKU fails the probe the
full banner — "BEST DEAL", "Save 12%", four content chips, price, strikethrough —
renders as a dead panel with nothing to tap. Same for the lower bundle card (`:636`).
JSX nesting is intact; this is dead affordance, not a render crash.

**Fix.** Hoist the gate to the card boundary: add
`isPurchasable('com.dynastymanager.bundle.all')` to the existing conditions at
`:272` and `:619`, and `isPurchasable('com.dynastymanager.pack.manager')` to the
`starterKitAvailable &&` condition at `:315`; then drop the inner button wrappers.
**Effort:** S.

#### A-12 · `adBudgetReward` drops the floor when `min > max`, and a string budget concatenates

> **✅ FIXED at HEAD.** Bounds are normalised before clamping.

**The only finding the verifier marked CONFIRMED outright**, and the reporter is
honest that there is no user-reachable trigger today.

`config/monetization.ts:231-240` computes `Math.min(Math.max(x, min), max)`. Set
`TRANSFER_BUDGET_BONUS_MIN` above `MAX` in a future edit and the max silently
wins — the documented minimum is never honoured, and no test covers `min > max`
(`monetization.test.ts:355-381` only exercises well-ordered clamps plus `0`/`-5000`/`NaN`).
Separately, `Number.isFinite` does not coerce, so a `budget` arriving as a string
yields `safeBudget = 0` → returns the min → `monetizationSlice.ts:186` evaluates
`club.budget + 50000` with a string LHS, producing `'100000050000'` as the new budget.

Both appliers are dead code while `REWARDED_ADS_USABLE` is false, and nothing in
the codebase produces a string budget. This is defence against a save-corruption
threat model the app does not otherwise defend.

**Fix.**
```ts
const n = Number(budget);
const safeBudget = Number.isFinite(n) && n > 0 ? n : 0;
const lo = Math.min(min, max), hi = Math.max(min, max);
return Math.round(Math.min(Math.max(safeBudget * pct, lo), hi));
```
plus `Number(club.budget) || 0` in both appliers, plus test cases for `min > max`
and a string budget. Existing test expectations are unchanged by this. **Effort:** S.

#### A-13 · A save-resident subscription restores Pro with no store confirmation — accepted tradeoff, do not "fix" naively

`utils/monetization.ts:126-127` takes the saved subscription when live is null, so
after a refund or revocation `isPro()` is true at cold launch and stays true until
the original `expiresAt` passes — days for monthly, up to a year for annual.
`GameShell.tsx:235-241` deliberately never writes a null subscription, so it cannot
correct this.

**The verifier's judgement, which overrides the reporter's:** the obvious fix
(write `null` when a *successful* fetch returns no Pro entitlement) is worse.
`extractSubscriptionInfo` (`purchases.ts:489-504`) returns null for **any** payload
lacking an active `pro`/`dynasty_pro` entitlement — including the RevenueCat
entitlement-misnaming case the code itself warns about at `:494-499`, and an
anonymous app-user-id after reinstall. One such successful-but-empty fetch would
destroy a subscriber's only Pro record, with no `entitlements` fallback (subscription
SKUs are barred from `entitlements` by design) and no self-healing path short of a
manual Restore. Lifetime buyers are safe; **recurring subscribers — the entire
affected population — are not.**

**Verdict:** keep as a known, bounded fail-open. **Record it as a decision.** If it
is ever changed it needs a confirmation threshold (two consecutive confirmed-empty
syncs, or an explicit RevenueCat entitlement-revoked signal), not a single-shot
null write. **Effort:** M if ever done. Related: Part B §4 step 4.4 makes the
misnaming case impossible, which is the cheaper half of this problem.

#### A-14 · A mid-season club change destroys claimed ad rewards while the season counter still blocks re-claiming

`careerSlice.ts` (same-league branch) resets `youthPreviewEnhanced: false` and
`scouting.reports: []` in a `set()` that does not touch `monetization`, so
`canClaimAdReward` (`utils/monetization.ts:180-189`) still reads a nonzero
`adRewardsClaimed['youth_preview_s5']` and blocks re-claiming for the rest of the
season.

**Unreachable today** — `claimAdReward` has exactly two call sites
(`AdRewardButton.tsx:61`, `:68`) and `AdRewardButton` returns `null` at `:51` for
*every* user because `REWARDED_ADS_USABLE` is false, so `adRewardsClaimed` is
permanently `{}` in any shipped build. The different-league branch behaves the
**opposite** way to the report: it routes through `initGame`, which rebuilds
monetization from `DEFAULT_MONETIZATION_STATE` and therefore **wipes** the counter
— a latent anti-farm hole rather than a lost reward.

**Verdict:** a latent inconsistency to resolve *before* ads are ever re-enabled,
not a defect in the current build. If you do fix it, fix both branches; the
proposed same-league fix does not address the cross-league one. **Effort:** S.

#### A-15 · `startFreeTrial` accepts an arbitrary `ProductId` while hardcoding `tier: 'trial'`

`monetizationSlice.ts:215` writes `{tier:'trial', productId}` with whatever ID it
is handed, and `isSubscriptionExpired` short-circuits to `return false` for any
`productId` in `PRO_ONE_TIME_PRODUCT_IDS` (`utils/monetization.ts:44`). The only
caller passes `selected` from the paywall, which includes
`com.dynastymanager.pro.lifetime` in `PLAN_ROWS` — kept out today solely by the
`SUB_TRIAL_PRODUCT_IDS.includes(selected)` guard at `SubscribeOnboarding.tsx:225`.
Loosen that guard or add a second call site and a free local trial becomes
permanent Pro that no sync can correct.

**Fix.** Move the invariant next to the state write: early-return in the slice
unless `SUB_TRIAL_PRODUCT_IDS.includes(productId)`. **Effort:** S. Smell, no
current trigger.

#### A-16 · Analytics consent lives only in raw localStorage

`persistence.ts:621-632` uses localStorage directly with no IndexedDB mirror, while
the save system was moved to IndexedDB precisely because WKWebView localStorage is
capped and evictable. If iOS clears it, `readAnalyticsConsent` returns `'unknown'`
and the **non-dismissible** consent modal reappears to a user who already answered.
Fail-safe, not fail-open (`analytics.ts:143` requires an explicit `'granted'`), so
a wiped key stops events rather than leaking them. Cost is a repeated mandatory
modal.

**Fix.** Mirror `ANALYTICS_CONSENT` into IndexedDB alongside the save slots and
restore it in `hydrateSaveStorage`. **No `CURRENT_VERSION` bump** — the consent key
is device-level and lives outside the per-slot save. **Effort:** S.

#### A-17 · `ProUpsell` routes Pro intent to a surface with zero trial copy

`src/components/game/ProUpsell.tsx:16` calls `setScreen('shop')`.
`grep -in trial src/pages/ShopPage.tsx` returns **nothing**, while
`SubscribeOnboarding.tsx:562` renders `Try {FREE_TRIAL_DAYS} Days Free`. Every
in-game Pro upsell therefore lands on the one paywall that never mentions the
strongest offer.

**Fix — ship only the routing half.** Point `ProUpsell` at `/subscribe`. Do **not**
replicate trial copy into ShopPage or PurchaseModal: that would copy an eligibility
decision into a surface with none of `SubscribeOnboarding.tsx:115`'s reasoning, and
it is the same 3.1.2(c) exposure as **A-1** on a second surface. **Effort:** S.
(Roadmap Wave 2 item C.)

#### A-18 · `CLAUDE.md` documents save schema v73; the code is v78

> **✅ FIXED at HEAD (87c723e).**

`src/utils/saveMigration.ts:15` reads `CURRENT_VERSION = 78`. The CLAUDE.md header
and the "Persistence & Saves" section both say 73. The file's own preamble says
*"If the numbers below disagree with the code, trust the code — and update this
file."* Do that. **Effort:** trivial. Not a runtime defect, but it will mislead the
next migration.

---

### Checked and cleared — do not re-investigate

Confirmed dead by adversarial verification or by re-checking against HEAD `67e8525`.

**Fixed in code during this session:**
- *loadGame at cold launch wipes entitlements + subscription* — fixed by `25c9ac6`'s
  `mergeDeviceMonetization`.
- *`firstLaunchTimestamp` nullish-coalescing never fires on 0* — fixed; now
  `Math.min` of the real stamps.
- *ShopPage Restore tells subscription-only customers "No Purchases Found"* — fixed
  by `67e8525`; sync now runs before the toast (`ShopPage.tsx:215`).
- *ShopPage `isPurchasable` fails OPEN when the store is unreachable* — fixed;
  `supported ? available : null` plus a "Store unavailable" panel.
- *ShopPage probes all 12 SKUs including consumables* — fixed; `SHOP_PROBE_IDS`
  is now the 8 SKUs the page sells.
- *`isPurchasable` hides cosmetic packs the user already owns* — fixed;
  `|| hasProduct(...)` on both the cosmetic and subscription filters. (The hero and
  Starter Kit cards were missed — that residue is **A-11**.)
- *Flipping `NATIVE_ADS_READY` re-creates a Pro-only economic buff* — fixed by
  `a78bd4c`; `REWARDED_ADS_USABLE = NATIVE_ADS_READY && !REWARDED_AD_IMPL_IS_STUB`,
  and `launchCrashGuardrails.test.ts:144-150` now greps every reward surface and
  fails if any reads `NATIVE_ADS_READY` directly.
- *Ad reward copy still promises the flat £500K / £1M amounts* — fixed by `a78bd4c`;
  the descriptions no longer contain currency figures. (The report's secondary claim
  that `season_bonus` credits the *current* season was itself wrong: the summary
  screen only renders after the rollover is committed.)
- *`mergeDeviceMonetization` unions entitlements raw, bypassing
  `isPersistableEntitlement`* — fixed by `67e8525`; the predicate moved to
  `utils/monetization.ts:81-87`, the union filters through it at `:117-119`, with a
  regression test.
- *`VITE_ANALYTICS_ENDPOINT` / `VITE_SENTRY_DSN` never injected into the release
  build* — the workflow YAML is fixed in both iOS and Android. Whether the
  **secrets** exist is a separate, open question → **A-3** and Part B §8.

**Refuted:**
- *The subscription-preference branch of `mergeDeviceMonetization` has zero test
  coverage* — false. `monetization.test.ts:532-543` covers both orderings, shipped
  in the same commit. The verifier applied the report's exact proposed mutation and
  the suite failed at that line, which is precisely what the report claimed nothing
  would catch.

**Invariants re-attacked and holding** (no action needed, recorded so they are not
re-audited): sub-SKUs never reach `entitlements` (double-guarded by
`mapEntitlements` + `isPersistableEntitlement`); consumables are never persisted or
restorable; no `presentPaywall` path exists anywhere in `src/` — the RevenueCat
hosted paywall is genuinely gone; all six `updateSubscription` call sites guard
`if (sub)`; `isSubscriptionExpired` fails closed on null/malformed/unanchored
expiries; the removal of `xp_double` needs **no** migration (orphan
`xp_double_s3` keys are inert — `adRewardsClaimed` is `Record<string, number>` and
nothing enumerates the union); consent gating is clean (no pre-consent leak was
constructible); and the save-loss paths (quota, IndexedDB timeout, backup rotation,
migration failure) are all correctly defended.

---

## Part B — the manual runbook

Everything below happens **outside** the codebase. Work through it in order.
Section §1 is decisions; skipping it makes several later steps unreversible in the
wrong direction.

**Global ordering hazards — read these five before you start.**

| # | Hazard | Consequence |
|---|---|---|
| **H1** | **Never remove `com.dynastymanager.pro` from sale.** `grantEntitlement` expands `bundle.all`'s `includes` array and writes that exact ID into `entitlements`. Removing it revokes Pro from every Dynasty Edition buyer *and* every legacy $7.99 buyer. | Mass silent Pro revocation. Unrecoverable without a support campaign. |
| **H2** | **Any SKU removal from sale and the binary that stops showing it must go live together.** Removing first leaves a CTA that can only fail — the exact Guideline 2.1.0 condition that rejected build 174. | Rejection. |
| **H3** | **Any *new* SKU must be Approved in App Store Connect and mapped in RevenueCat BEFORE a binary references it.** Because of **A-6**, one unconfigured ID in the probe batch can blank the entire direct-lookup path. | Whole one-time catalog silently disappears from the Shop. No error anywhere. |
| **H4** | **The introductory offer must exist in App Store Connect before any binary claims "7 days free."** Today the app claims it unconditionally (**A-1**). | 3.1.2(c) false claim + refunds. |
| **H5** | **A Custom Product Page must be Approved before an Apple Ads ad group can select it as a destination.** CPPs in "Waiting for Review" are not selectable. | You build the campaign, then cannot point it anywhere, and default to the main product page — which is the 17% CVR page the whole exercise exists to bypass. |

---

### §1 — Decisions to make first (nothing else is safe until these are made)

These are choices, not tasks. Write each answer down in this file or in
`marketing/ads/arpi-roadmap.md` so the next session inherits them.

**1.1 — Trademark position on the hero screenshots.**
The ready-to-upload hero assets bake in real club and player marks.
`marketing/aso/season-2026-refresh.md:138-148` incorrectly tells the next reader
that panels 01–04 are clean; they are not. Two coherent positions, no third:
- **(a) Accept the risk knowingly and log it here.** The real clubs are the
  listing's strongest differentiator.
- **(b) Re-capture from a save built on synthetic names** via the same generator
  `CinematicCapturePage` uses (`src/pages/CinematicCapturePage.tsx:38-44`). Note
  the route and Settings entry for that page are **currently disabled** — re-enable
  the commented-out import and route in `src/App.tsx` to capture, then disable again.

**[ASSUMPTION]** Scrubbing will probably *lower* conversion. Do not ship (b) as a
"conversion improvement." Decide it as a risk trade.
**Blocks:** §7 (screenshots, CPPs, App Preview) — which in turn blocks §10 (Apple Ads).

**1.2 — Price ladder: commit or don't.**
The roadmap's Wave 1 P1 is monthly $1.99→$2.99 and annual $14.99→$19.99. That is an
App Store Connect action needing no binary. But it changes the USD constants the
app displays (**A-2**), and the elasticity assumption behind it is unmeasured.
**Recommendation: do §11 (baseline measurement) for 30 days first, then reprice.**
Repricing before you have a `monthlyStart` baseline means you can never tell whether
the price rise suppressed trial starts.

**1.3 — Analytics: build the pipeline, or delete the transport.**
The current state — a fully-typed 24-event union feeding a sink with no endpoint —
is the worst of both. Pick one:
- **(a) Build it.** §8 in full, plus code items **A-7**, **A-8**, **A-9**, **A-10**.
  Realistically 2–3 days of work including the collector and the privacy-copy
  changes.
- **(b) Delete it.** Remove the transport at `src/utils/analytics.ts:83-110` and take
  every number from RevenueCat + App Store Connect App Analytics instead.

**Be honest about (b): it is defensible.** RevenueCat gives you `trialToPaid`,
`monthlyChurn`, and product-level conversion directly. App Store Connect gives you
installs, D1/D7/D28 and page CVR. That is **four of the six** guessed model inputs
with zero engineering. First-party analytics only adds the *per-surface* rates
(`paywall_viewed` → `trial_started`) and the pack free-vs-paid split. If you are one
person, do §4 and §11 first and decide (a) vs (b) with real data in hand.

**1.4 — Sentry: on or off.**
Unlike analytics there is no "delete it" option worth taking — the SDK is already
integrated, the breadcrumb trail is already built, and you currently have **zero**
crash visibility on a live App Store app. Do §8 steps 8.1–8.5.

---

### §2 — App Store Connect: products and pricing

URL: <https://appstoreconnect.apple.com> → **Apps** → *Dynasty Manager: Football*
(Apple ID **6760918006**) → **Monetization** → **In-App Purchases** / **Subscriptions**.

**2.1 — Inventory every product ID and record its state.**
There are 12 IDs in `src/config/monetization.ts:28-128`. Open each and write down
its status.

| Product ID | Type in ASC | Expected state |
|---|---|---|
| `com.dynastymanager.pro` | Non-Consumable | **Approved / Ready to Submit — never remove (H1)** |
| `com.dynastymanager.pro.lifetime` | Non-Consumable | Approved |
| `com.dynastymanager.bundle.all` | Non-Consumable | Approved |
| `com.dynastymanager.pack.manager` | Non-Consumable | Approved |
| `com.dynastymanager.pack.stadium` | Non-Consumable | Approved |
| `com.dynastymanager.pack.legends` | Non-Consumable | Approved |
| `com.dynastymanager.pro.monthly` | Auto-Renewable Subscription | Approved |
| `com.dynastymanager.pro.annual` | Auto-Renewable Subscription | Approved |
| `com.dynastymanager.pack.gold` | **Consumable** | Approved |
| `com.dynastymanager.pack.premium_gold` | **Consumable** | Approved |
| `com.dynastymanager.pack.rare_gold` | **Consumable** | Approved |
| `com.dynastymanager.pack.icon` | **Consumable** | Approved |

**Verify:** every row reads *Approved* or *Ready to Submit*. Anything in
*Waiting for Review*, *Developer Action Needed*, *Rejected* or *Removed from Sale*
is a live problem.
**If skipped:** because of **A-6**, a single non-Approved ID among the eight
ShopPage probes can blank the entire one-time catalog in the Shop with no error
shown anywhere. The four consumables are no longer in ShopPage's probe (fixed in
`67e8525`) but they *are* what PacksPage sells, and PacksPage has no probe at all
(**A-5**) — a non-Approved consumable there is a guaranteed dead CTA.

**2.2 — Confirm the four pack SKUs are typed Consumable, not Non-Consumable.**
Same screen, **Type** column.
**Verify:** the type reads *Consumable*.
**If wrong:** Apple will list them in `allPurchasedProductIdentifiers` forever and
users can "restore" a pack they already opened. The app already refuses to persist
them as entitlements, so the app-side invariant holds either way — but a
Non-Consumable pack **cannot be repurchased**, so the user buys one Icon pack and
can never buy another. That is a direct revenue stop, and it is not fixable from
code. **You cannot change a product's type after creation** — a wrongly-typed SKU
must be replaced with a new ID, which is an **H3** situation.

**2.3 — (Deferred by decision 1.2) Reprice the subscriptions.**
**Subscriptions** → subscription group → each SKU → **Subscription Prices** →
**+** → set the new price → **Preserve current price for existing subscribers**.
- Monthly `$1.99` → `$2.99`
- Annual `$14.99` → `$19.99`

**Verify:** the price row shows a future effective date and the "existing
subscribers keep their price" toggle is ON.
**If you skip the preserve toggle:** Apple triggers its consent flow and existing
subscribers must actively re-consent or be cancelled. That is a churn event you
inflicted on your only paying cohort.
**Ordering:** the ASC price change is live-immediately for *new* subscribers. Update
the `priceUsd` fallbacks at `src/config/monetization.ts:40` and `:49` in the next
binary so the model parser and the web/dev display stay honest — but note this does
**not** create a mismatch on device, because `priceFor` uses the store-localized
string. It *does* create one everywhere **A-2** is unfixed, since those five claims
are computed from the stale USD constants. **Fix A-2 before or with the reprice.**

**2.4 — Do NOT create or remove any SKU without reading H1, H2, H3.**
If the roadmap's Wave-2 ladder reshuffle ever happens: create the new SKU, wait for
Approved, map it in RevenueCat (§4), ship the binary that references it, *then*
remove the old one from sale — never the reverse.

---

### §3 — App Store Connect: subscription group, intro offers, localizations

**3.1 — Verify there is exactly one subscription group containing both Pro SKUs.**
**Monetization → Subscriptions**.
**Verify:** `pro.monthly` and `pro.annual` are in the same group.
**If they are in different groups:** a user can hold both simultaneously and Apple
will not offer upgrade/downgrade/crossgrade between them. The app's
`openSubscriptionManagement` path assumes one group.

**3.2 — Set the upgrade/downgrade ranking within the group.**
Same screen → drag annual above monthly (level 1 = highest).
**Verify:** annual sits at a higher level than monthly.
**If skipped:** the annual "upgrade" card in ShopPage triggers a *crossgrade* that
takes effect at the next renewal instead of an immediate upgrade with proration.
The user pays and sees nothing change, which reads as a broken purchase.

**3.3 — Each subscription SKU needs a Localization (display name + description) for
every storefront you sell in.**
Subscription → **App Store Localization** → **+**.
**Verify:** no SKU shows a "Missing Metadata" warning.
**If skipped:** the SKU cannot be submitted, and an un-submitted SKU is exactly the
**A-6** poison-the-batch case.

**3.4 — ⚠ Confirm the introductory offer exists and is 7 days. (H4)**
Subscription → **Subscription Prices** → **Introductory Offers** → **+**.
- Type: **Free Trial**
- Duration: **1 week** (= `FREE_TRIAL_DAYS = 7`, `src/config/monetization.ts:320`)
- Territories: all where you sell
- Do this for **both** `pro.monthly` and `pro.annual`.

**Verify:** each SKU lists an active Free Trial offer of 1 week, with no end date
in the past.
**If it does not exist:** the app's `Try 7 Days Free` CTA, the *"Free for 7 days,
then …"* billing summary, and the *"7-Day Free Trial Started!"* toast are all false
claims **for every user, not just lapsed ones** — a strictly worse version of
**A-1**. This is the single highest-value verification in §3 and it takes two
minutes.
**If the duration differs from 7 days:** either change it here or change
`FREE_TRIAL_DAYS` and ship a binary. The mismatch is a 3.1.2 false claim on its own.

**3.5 — Check the Family Sharing flag on each product.**
**Verify:** whatever you choose is deliberate.
**Why it matters here:** the app resolves Pro from RevenueCat's active entitlements.
Family-shared access appears and disappears with the organiser's membership, which
is one of the concrete triggers behind **A-13** (a save-resident subscription
outliving its store-side validity). Enabling Family Sharing widens that window; it
does not create a new bug.

---

### §4 — RevenueCat dashboard

URL: <https://app.revenuecat.com> → your project.

**4.1 — Verify both platform API keys match what CI injects.**
**Project Settings → API Keys**. CI injects `VITE_REVENUECAT_API_KEY` and
`VITE_REVENUECAT_API_KEY_IOS` (`.github/workflows/ios-testflight.yml:92-93`) and
`VITE_REVENUECAT_API_KEY_ANDROID` (`android-build.yml:36`).
**Verify:** the public **SDK** key (starts `appl_` for iOS), not a secret key.
**[CANNOT VERIFY FROM REPO]** whether the stored secrets are current. Compare by
eye against the dashboard.
**If wrong:** `ensureConfigured()` throws, `getEntitlements()` returns `[]`, and
every purchase surface degrades to the empty-store path.

**4.2 — Register all 12 products.**
**Product catalog → Products → + New**. Each App Store product ID must exist here
verbatim.
**Verify:** 12 rows, IDs matching `src/config/monetization.ts` character for character.
**If a product is missing:** it will not appear in any offering, and
`fetchOfferingPackages` will not surface it. It can still be found by the direct
`getProducts` lookup — unless that batch rejects (**A-6**), in which case it
disappears entirely.

**4.3 — Mark the four pack SKUs as non-restoring / consumable.**
**Verify:** gold / premium_gold / rare_gold / icon are not attached to any
entitlement.
**If wrong:** RevenueCat grants a permanent entitlement for a consumable. The app
filters it out (`isPersistableEntitlement`), so nothing breaks in-app — but your
dashboard revenue attribution and any future server logic will be wrong.

**4.4 — ⚠ The entitlement identifier must be exactly `pro` or `dynasty_pro`.**
**Entitlements → + New**. This is hardcoded:

```ts
// src/utils/purchases.ts:499
const proEntitlement = activeEntitlements['pro'] || activeEntitlements['dynasty_pro'];
```

Attach to it: `com.dynastymanager.pro`, `com.dynastymanager.pro.lifetime`,
`com.dynastymanager.bundle.all`, `com.dynastymanager.pro.monthly`,
`com.dynastymanager.pro.annual`.
**Verify:** the entitlement's identifier string in the dashboard reads `pro` (or
`dynasty_pro`) — not `Pro`, not `pro_access`, not `dynasty-pro`. It is
case-sensitive and exact.
**If wrong:** `extractSubscriptionInfo` returns `null` for every customer,
**no subscriber ever gets Pro from a subscription**, and — per **A-13** — this is
also the failure mode that makes the "revoke on empty sync" fix dangerous. This is
the single highest-consequence field in the entire RevenueCat setup.

**4.5 — Create an Offering containing the purchasable packages.**
**Product catalog → Offerings → + New**, identifier `default`, marked **Current**.
Add packages for at minimum the three subscription SKUs, and ideally all eight
ShopPage SKUs.
**Verify:** the offering is flagged *Current*.
**If skipped:** `fetchOfferingPackages` returns `[]` and every product resolves
through the fragile direct-lookup path alone — turning **A-6** from a latent risk
into your only code path.

**4.6 — Connect the App Store Server Notifications / shared secret.**
**Project Settings → Apps → App Store** → paste the App-Specific Shared Secret from
ASC (**Users and Access → Integrations → App-Specific Shared Secret**), and copy
RevenueCat's notification URL into ASC (**App Information → App Store Server
Notifications**, Version 2).
**Verify:** RevenueCat shows a green "receiving notifications" indicator.
**If skipped:** RevenueCat learns about cancellations, refunds, billing failures and
renewals only when the app next opens and fetches. Your churn number becomes
lagged and wrong, and **A-13**'s exposure window lengthens.

**4.7 — Record your baseline numbers.** **Charts →** Trial conversion, Subscription
retention, Product-level conversion.
Write down: `trialToPaid`, `monthlyChurn`, and per-product conversion.
**Then re-run the model with real inputs:**
```bash
node marketing/ads/unit-economics.mjs --trial-to-paid=<x> --churn=<y> --pro=<z> ...
```
**If skipped:** every figure in `arpi-roadmap.md` remains a guess, and the script
prints *"ASSUMED, NOT MEASURED"* at you for a reason. **This is the cheapest,
highest-value step in the entire document — it is reading four numbers off a
dashboard you already have.**

---

### §5 — Apple agreements, banking and tax

URL: <https://appstoreconnect.apple.com> → **Business** (formerly Agreements, Tax,
and Banking).

**5.1 — Verify the Paid Applications agreement is Active.**
**Verify:** status reads *Active*, not *Pending* / *Expired*.
**If not active:** every IAP product silently fails to load — `getProducts` returns
nothing for the whole batch, which is indistinguishable from **A-6** and will send
you debugging the wrong thing for a day.
**[ASSUMPTION]** Since the app is live with IAP, this is almost certainly already
Active. Confirm anyway — Apple periodically reissues the agreement and it lapses
silently.

**5.2 — Verify banking and tax forms are complete and unexpired.**
Same screen.
**Verify:** no yellow warning triangles.
**If expired:** payouts stop. Products keep selling, so there is no in-app signal.

**5.3 — Apple Ads billing is separate.** Do not assume §5.1 covers it. See §10.1.

---

### §6 — App Store Connect: App Privacy

URL: app → **App Privacy** (left sidebar).

**6.1 — Reconcile the current declaration against what the app actually sends today.**
Today, with no analytics endpoint reaching a server and no Sentry DSN, the app
transmits **nothing** first-party. RevenueCat transmits purchase data.
**Verify:** *Purchases* is declared (linked to identity: No; used for tracking: No),
and you are not over-declaring collection you do not perform.

**6.2 — If you turn on Sentry (§8), update the declaration BEFORE that binary is
submitted.** Sentry collects crash data and, depending on configuration, coarse
device/OS info.
**Verify:** *Diagnostics → Crash Data* is declared.
**Ordering hazard:** the privacy declaration must be accurate **at submission time**
for the binary being submitted. Submitting a Sentry-enabled build under a
declaration that says you collect no diagnostics is a Guideline 5.1.1 problem.
Declaring it *early* (before the build ships) is harmless — declaring it *late* is not.
**Do this in the same session you add the secret.**

**6.3 — If you ship the persisted install id from A-7, this becomes a bigger change.**
A stable per-install identifier is *Identifiers → User ID* or *Device ID* depending
on derivation, and it makes the consent modal's *"we do not collect device
fingerprints"* copy (`AnalyticsConsentModal.tsx:71-75`) false.
Three things must move together, in this order:
1. Update the privacy policy page (the URL linked from the app and from ASC).
2. Update the modal copy in the binary.
3. Update App Privacy in ASC **before** submitting that binary.
**If done out of order:** you have a live app whose in-app promise contradicts its
own behaviour — worse than the missing analytics it was meant to fix.

---

### §7 — App Store Connect: store surfaces

**Which fields need a new version, and which do not — get this right first.**

| Field | Editable on the live version? |
|---|---|
| **Promotional Text** | **Yes** — no new version, no review wait |
| Privacy Policy URL, Support URL | Yes |
| App Name, Subtitle, Keywords, Description, What's New | **No** — requires a new version submission |
| Screenshots, App Preview | **No** — requires a new version submission |
| Custom Product Pages | Reviewed independently of the app version |
| In-App Events | Reviewed independently |

**[ASSUMPTION — verify before planning around it]** A new *version* in App Store
Connect requires an attached build, so the subtitle/keyword fixes below realistically
ride along with your next binary rather than shipping standalone. **The roadmap
states this work needs "no binary"; for Promotional Text that is true, for
Subtitle/Keywords it is not.** Confirm by opening the live version in ASC and
checking whether the Subtitle field is editable or greyed out. Plan the locale work
to ship with the **A-1 / A-2** binary.

**7.1 — Fix the 20 locales still selling an expired tournament.**
Run the validator:
```bash
node marketing/aso/validate-locales.mjs
```
It reports **20 locales** whose Subtitle and/or Promotional Text still advertise
*World Cup 2026* (the final was 2026-07-19):

`ar-SA · cs · da · el · fi · he · hr · hu · ja · ko · nl-NL · no · ro · ru · sk · sv · th · uk · zh-Hans · zh-Hant`

For each: ASC → **App Store** tab → language selector → paste the corrected copy
from `marketing/aso/locales/<locale>.md`.
**Verify:** re-run the validator; the stale-tournament rows disappear. Then confirm
each field's character count is within Apple's limit (the validator prints
`used/limit` per field — every locale currently passes).
**Do the Promotional Text for all 20 today** (instant, reversible, no review).
**Queue the Subtitle changes for the next version submission.**
**If skipped:** 20 storefronts are advertising an event that ended over a week ago,
in the highest-visibility text on the listing. It is also a credibility problem for
any reviewer who checks.

**7.2 — Capture the App Preview video.**
`CinematicCapturePage` (`src/pages/CinematicCapturePage.tsx`) renders a Rare-Gold
walkout loop with synthetic players at 9:16 for exactly this. Its route and Settings
entry are **currently disabled** — re-enable the commented-out import and route in
`src/App.tsx`, capture, then disable again before shipping.
Post-production pipeline: `marketing/postproduction/build-ad.sh`.
**Verify:** upload to ASC and confirm it passes the automated checks (duration
15–30s, correct resolution per device size, no device frames, no pricing text).
**If skipped:** the roadmap flags this as blocking phase 2 of the ad plan
(`apple-ads-2026-27.md:79-97` gate check). **[ASSUMPTION]** the +25-35% CVR figure
quoted there is an industry-general estimate, not a measurement of your app.

**7.3 — Build the hero screenshot set.** Gated on **decision 1.1**.
```bash
node marketing/appstore/build-hero.mjs
```
**Verify:** upload for 6.7" and 6.5" at minimum; check each renders correctly in
ASC's preview.
**Note:** screenshot **captions are indexed by App Store search** since 2025. If you
reorder panels, re-check `marketing/appstore/build-hero.mjs` and
`marketing/aso/season-2026-refresh.md` together.

**7.4 — Build the six Custom Product Pages. (H5)**
ASC → app → **Custom Product Pages** → **+**. You can have up to 35; you need 6.
Panel orders are specified in `apple-ads-2026-27.md:173-180`:

| CPP identifier | Lead panels | Used by |
|---|---|---|
| `career` | 01, 05, 03 | Campaigns 2, 3, 4, 5 |
| `tactics` | 02, 03, 01 | Campaigns 2, 5 |
| `transfers` | 04, 03, 01 | Campaign 2 |
| `nation` | 05, 02, 01 | Campaign 2 |
| `brand` | 01, 02, 04 | Campaign 1 |
| `pro` | 03, 01, 02 | Today-tab ads |

Each is one re-render of the generator with a different panel order — ~2 min per size.
**Verify:** each CPP reaches **Approved** (not *Waiting for Review*), and note its
URL — you need it in §10.
**Ordering hazard (H5):** CPPs must be Approved before an Apple Ads ad group can
select one as a destination. Submit these **at least a week before** you plan to
launch campaigns. If you build campaigns first, they default to the main product
page — the 17% CVR page the CPPs exist to bypass — and you will be paying for taps
against the worse page.
**Note:** CPPs carry their own indexed keywords since July 2025, so this lifts
organic and paid together. That is why the roadmap puts store work in Wave 1 despite
it contributing $0.00 to ARPI — it moves the CPI denominator, not the ARPI numerator.

**7.5 — Create an In-App Event for the next season rollover.**
ASC → app → **In-App Events** → **+**. Events are indexed in search and appear on
the product page and Today tab.
**Verify:** event reaches Approved; the event card renders in the App Store preview.
**Ordering:** an in-app event must reference a currently-live app version. Submit
after §9 lands, not before.
**If skipped:** you lose a free, recurring, indexed store surface. No breakage.

**7.6 — Check the ratings count.**
ASC → **Ratings and Reviews**.
**Verify:** whether you are above 50 ratings.
**[CANNOT VERIFY FROM REPO]** — the plan lists this as *unknown*
(`apple-ads-2026-27.md` gate check).
**Why it matters:** under 50 ratings the reviews module is hidden on the product
page and conversion drops sharply. If you are under 50, add review-prompt trigger
sites in `src/utils/appReview.ts` at moments more installs actually reach — but
**do not relax `MIN_DAYS_BETWEEN_PROMPTS = 60` or `MAX_LIFETIME_PROMPTS = 4`**
(`appReview.ts:21-22`). Keep the throttle; move where the one allowed prompt lands.

---

### §8 — Analytics and Sentry: secrets, collector, sourcemaps

**8.1 — Check whether the secrets already exist.**
<https://github.com/Wrexist/dynasty-manager/settings/secrets/actions>
**Verify:** look for `VITE_SENTRY_DSN` and `VITE_ANALYTICS_ENDPOINT` in the list.
GitHub shows names but never values.
**[CANNOT VERIFY FROM REPO]** — the workflow *references* them
(`ios-testflight.yml:100-101`), but a missing secret expands to the empty string and
the build still passes. This is **A-3**.

**8.2 — Create `VITE_SENTRY_DSN`.**
Get it from <https://sentry.io> → your project → **Settings → Client Keys (DSN)** →
copy the DSN (`https://<key>@o<org>.ingest.sentry.io/<project>`).
Add it as a repository secret with that exact name.
**Verify:** trigger a TestFlight build, install it, force a crash (the dev-tools
build has a Developer section — see §9.3), and confirm the event appears in Sentry
within a minute or two.
**If skipped:** you continue to run a live App Store app with **zero crash
visibility**. Every `Sentry.captureException` in the purchase paths and every
breadcrumb in the subscribe flow is discarded before it is recorded.

**8.3 — Add the build-time assertion (code item A-3).** Without it, a future build
that loses the secret is silently indistinguishable from one that has it.

**8.4 — Decide analytics per decision 1.3.** If **(b) delete**, stop here and skip
8.5's analytics half.
If **(a) build**: you need an HTTPS collector that accepts the `AnalyticsPayload`
JSON shape (`src/utils/analytics.ts:52-60`) by POST, and tolerates
`navigator.sendBeacon` (which sends `text/plain` in some browsers — accept both
content types). **No collector exists in this repo.** A Cloudflare Worker or a
Supabase edge function writing to one table is sufficient; the payload is five
fields. Set `VITE_ANALYTICS_ENDPOINT` to its URL only **after** it is live and
returning 2xx.
**Verify:** ship a TestFlight build, grant consent on first launch, start a game,
and confirm a `game_started` row lands in your table.
**If you set the secret before the collector exists:** events fire into a 404 and
are dropped silently — functionally identical to today, but now you believe it
works.

**8.5 — Add a sourcemap upload step.**
`vite.config.ts:91` already emits `sourcemap: 'hidden'` for exactly this, but no
workflow step uploads them. Add a `sentry-cli sourcemaps upload` step after the web
build in `ios-testflight.yml`. Needs a `SENTRY_AUTH_TOKEN` secret plus the org and
project slugs.
**Verify:** a crash in Sentry shows readable function names and line numbers rather
than minified `t.a` frames.
**If skipped:** you get crash *counts* but stack traces that are close to useless —
which is most of the value.

---

### §9 — Xcode, TestFlight and submission

**9.1 — Ship a build.**
<https://github.com/Wrexist/dynasty-manager/actions/workflows/ios-testflight.yml>
→ **Run workflow**.

| Input | For a real release | For an IAP test build |
|---|---|---|
| `marketing_version` | leave **blank** unless intentionally bumping | blank |
| `dev_tools` | **OFF** | **ON** |

**Verify:** the run summary's `::notice::` annotation at the top shows the
`marketing_version` and `build_number` you expected. **Read it before the upload
step completes.** The `build_number` is the GitHub Actions `run_number`.
**If you run with a blank version while `package.json` is stale:** the marketing
version regression guard (`scripts/check-marketing-version.mjs`) fails the build.
That guard exists because of the build-#142 saga where an upload landed on an older
version train and became invisible in TestFlight. Let it fail — do not work around it.

**9.2 — Merging is not shipping.** The TestFlight workflow is `workflow_dispatch`
only. A fix merged to `main` is **not** on your phone until you run the workflow,
wait ~15 min, and update from TestFlight. To confirm a fix is live, check that the
build number on the device is **higher** than the last known-bad one.

**9.3 — Use the dev-tools build for on-device IAP testing.**
Run the workflow with `dev_tools: true`. That exposes an in-app Developer section
including **Reset Pro & open paywall** (added in `557c36a`), which wipes local
Pro/entitlement state so you can re-exercise the paywall funnel without a new
sandbox account. It never touches RevenueCat, so store-owned products re-restore on
the next launch.
**⚠ Never submit a `dev_tools: true` build to the App Store.**

**9.4 — Create a Sandbox tester account.**
ASC → **Users and Access → Sandbox → Testers → +**. Use an email address you control
that is **not** an existing Apple ID. On the device: **Settings → Developer → Sandbox
Apple Account** (iOS 16+) — not the main Apple ID sign-in.
**Verify:** a sandbox purchase shows the `[Environment: Sandbox]` banner in the
StoreKit dialog.

**9.5 — Sandbox-verify every purchase surface before submitting.** This is the
2.1.0 defence.
- SubscribeOnboarding: each plan row renders a price and a working CTA.
- ShopPage: Dynasty Edition hero, Starter Kit, one-time Pro, three cosmetic packs.
- PacksPage: all four paid pack tiles (**this is the surface with no availability
  probe — A-5 — so it is the most likely to show a CTA that errors**).
- Restore Purchases from all three surfaces (Shop, Settings, SubscribeOnboarding).
**Verify:** no CTA anywhere produces an error toast.
**If skipped:** any tile whose SKU is not Approved is a live Guideline 2.1.0
rejection waiting for a reviewer to tap it.

**9.6 — While you are on device, settle the A-6 assumption.**
Temporarily add a bogus identifier to a probe list and observe whether
`Purchases.getProducts` rejects the whole call or returns the valid subset. Write the
answer into **A-6** above. It determines whether the per-ID chunking is required or
merely defensive.

**9.7 — Airplane-mode test.** Put the device in Airplane Mode and open Shop,
SubscribeOnboarding and Packs.
**Verify:** Shop shows the "Store unavailable" panel (fixed in `67e8525`);
SubscribeOnboarding shows its retry card; **Packs will still show buy buttons** until
**A-5** is fixed — confirm that and use it as the acceptance test for the fix.

---

### §10 — Apple Search Ads (Apple Ads) account

⚠ **Do not start this section until §7.4 CPPs are Approved (H5) and §4.7 baselines
are recorded.** The campaigns are a measurement instrument; without the CPPs they
measure the wrong landing page, and without the baselines you cannot interpret the
result.

**Read first:** `marketing/ads/apple-ads-2026-27.md` §0. The honest summary from the
roadmap: **brand terms are reachable; head terms are permanently unaffordable at
this price ladder** — modelled break-even for head terms is $2.567 gross per install
against a full-roadmap ceiling of $0.648. Treat paid UA as brand defence and a
per-keyword ARPI measurement channel, not a growth engine. **[ASSUMPTION — all
modelled, none measured.]**

**10.1 — Create the Apple Ads account.**
<https://ads.apple.com> → sign in with the Apple ID that owns the app → choose
**Advanced** (not Basic — Basic cannot use CPPs, exact match, or negative keywords).
Accept the Apple Ads terms and add a payment method.
**Verify:** the app appears in the account's app list.
**If you pick Basic:** none of the structure below is expressible and you cannot
undo the choice within the same account.

**10.2 — Build five campaigns, US storefront only.** One job each; do not merge them.

| # | Campaign | Match | CPP destination | Daily cap | Bid ceiling (CPT) |
|---|---|---|---|---|---|
| 1 | `BRAND-DEFENCE-US` | Exact | `brand` | $5 | $0.50 |
| 2 | `LONGTAIL-US` | Exact | by cluster | $8 | $0.60 |
| 3 | `CONQUEST-US` | Exact | `career` | $6 | $0.75 |
| 4 | `DISCOVERY-US` | Broad + Search Match | `career` | $6 | $0.40 |
| 5 | `HEAD-TERMS-US` | Exact | `tactics` | **$0 — build and pause** | $1.20 |

Phase 1 live spend: **$19/day ≈ $570 over 30 days.**
**If you merge campaigns:** mixed-intent CPA is uninterpretable and the entire
measurement purpose is lost.

**10.3 — Create the ad groups.** The CPP is set at **ad group** level, which is the
whole point — query→creative match.
```
BRAND-DEFENCE-US → ag_brand_exact → CPP brand
LONGTAIL-US      → ag_career, ag_transfers, ag_tactics_matchday, ag_nation, ag_offline
CONQUEST-US      → ag_conquest_premium_sim, ag_conquest_realtime_pvp, ag_conquest_breadth  (all → career)
DISCOVERY-US     → ag_discovery_broad → CPP career
HEAD-TERMS-US    → ag_head_manager (tactics), ag_head_career_mode (career)   [paused]
```
**Verify:** every ad group shows a CPP in its Creative Set, not "Default Product Page."

**10.4 — Upload keywords.** Paste-ready CSVs are in `marketing/ads/keywords/`:
`en-US-brand.csv` (campaign 1) · `en-US-longtail.csv` (campaign 2, tagged by ad
group) · `en-US-conquest.csv` (campaign 3) · `en-US-head.csv` (campaign 5, staged).
**Exact match only in campaigns 1–3.** Broad match at these ceilings burns budget on
irrelevant queries.

**10.5 — Add negative keywords**, especially to campaign 4 (Discovery) so it does not
cannibalise 1–3, and to campaign 5 before it is ever unpaused.

**10.6 — Set up attribution.** Apple Ads reports installs natively; SKAdNetwork /
AdAttributionKit conversion values are configured per
`apple-ads-2026-27.md` §5. **[ASSUMPTION]** the plan's conversion-value schema is
untested against real postbacks.

**10.7 — Baseline before day 0, or the whole exercise is uninterpretable.** Record:
category rank, keyword ranks for the campaign 1–3 terms, impressions, page CVR,
installs/day. Screenshot them.
**If skipped:** you cannot separate paid lift from organic drift, which is the only
question the $570 is buying an answer to.

**10.8 — Kill criteria, set before you spend.** From `apple-ads-2026-27.md` §6:
CPA > $1.00 (campaigns 1, 2, 4) or > $1.50 (campaign 3); any single keyword taking
>30% of campaign spend at below-median CPA. Phase 2 requires all three gates to
clear — **do not unpause campaign 5 otherwise.** Raise winning bids by ≤20% per
week; Apple's auction punishes step changes with CPT spikes.

**10.9 — Today-tab ads require a CPP destination** and render app name + icon +
subtitle only. That makes the subtitle an **ad asset**, not just a keyword bag.
`Tactics, Transfers & Trophies` is the one to run; `Deep Career Sim · No Timers` is
the A/B partner.

---

### §11 — Measurement cadence

**11.1 — Before anything else (day 0).** App Store Connect → **App Analytics**:
record D1/D7/D28 by cohort, product page CVR, impressions/day, installs/day.
RevenueCat → **Charts**: the five rates from §4.7.
**These 10 numbers turn four of the six guessed model inputs into measured ones with
zero engineering.** Nothing else in this document has that ratio.

**11.2 — Re-run the model with them.**
```bash
node marketing/ads/unit-economics.mjs \
  --pro=<measured> --lifetime=<measured> --bundle=<measured> \
  --monthly=<measured> --annual=<measured> \
  --trial-to-paid=<measured> --churn=<measured>
```
**Do not hand-edit a figure in `arpi-roadmap.md`** — re-run the command and paste
the output.

**11.3 — Weekly, once ads are live.** TTR · tap→install CR · CPT · CPA · **D7
retention by campaign** · net revenue per install by campaign. Weekly, not daily —
daily reads on $19/day are noise.

**11.4 — The kill criterion that overrides revenue.** **D7 retention is a 2026 App
Store ranking input.** A change that lifts ARPI and drops D7 more than 2 points
against the pre-change cohort is a net loss. Revert it. This applies to the whole
roadmap, and most sharply to any change that removes something players currently
have.

**11.5 — After a reprice (§2.3), watch trial starts specifically.** If `monthlyStart`
falls more than 20% relative, the elasticity assumption behind the price rise is
wrong and any larger price bet must be re-modelled before shipping.

---

## Suggested order of work

Assuming one developer, and assuming decision **1.3 = (b) delete the transport** —
which is the defensible solo-dev choice.

**A-1, A-2, A-5, A-12 and A-18 are already fixed on the branch** (see the status
banner at the top of Part A), so the code days below are much shorter than the
original audit assumed. What remains before a binary is A-11 and A-17, both small.

| Day | Work |
|---|---|
| 1 | §1 decisions written down · §4 (RevenueCat: **4.4 is the one that matters**) · §4.7 + §11.1 baselines · §2.1 product inventory · §5 agreements |
| 1 (same day) | §7.1 Promotional Text for all 20 stale locales — instant, reversible, no review |
| 2 | §8.1–8.3 Sentry + analytics secrets (**the env wiring already exists in both workflows — only the secrets are missing**) · §6.2 App Privacy for crash data |
| 3 | Code: **A-11** + **A-17** — the only remaining pre-binary code items |
| 4 | §9.1 dev-tools build · §9.4–9.7 full sandbox sweep on device. **Priority: verify A-1's fix against a sandbox Apple ID that has already consumed its intro offer** — that path cannot be tested off-device · settle **A-6**'s assumption |
| 5 | §7.2 App Preview capture · §7.3 hero set (gated on decision 1.1) |
| 6 | Submit: A-11 + A-17 + the already-fixed A-1/A-2/A-5 + the 20 Subtitle fixes, as **one** submission |
| 7+ | §7.4 CPPs (submit early — H5) · then §10 Apple Ads once CPPs are Approved |
| Later | §2.3 reprice, only after 30 days of §11.1 baseline · A-4, A-6, A-7/8/9/10 if decision 1.3 = (a) |

**Ship everything outstanding as one binary.** Splitting across two review cycles
doubles the rejection surface for no gain.
