# IAP & subscription verification — every SKU × every flow

Written 2026-09-25 against branch `wp/iap`. Three parts:

1. **Store configuration that the code assumes** — check once in App Store Connect
   (ASC) and RevenueCat (RC). Code cannot see either console.
2. **The matrix** — every product × purchase / cancel / pending / restore / expiry /
   refund, with the code path and the Vitest test that pins it.
3. **The device checklist** — what only a real StoreKit sandbox / TestFlight run can
   prove. Run it on a TestFlight build of this branch before release.

Test files (all under `src/test/`): `iapMatrix.test.ts` (the matrix itself),
`iapLifecycle.test.ts` (flow fixes), `trialSurfaces.test.tsx` (trial copy),
`purchaseFailureModes.test.ts`, `paywallTrials.test.ts`, `proUpsellTrial.test.tsx`,
`subscriptionSync.test.ts`, `entitlementReconciliation.test.ts`,
`packCreditRecovery.test.ts`, `packCreditIntegrity.test.ts`, `monetization.test.ts`,
`redeemCodes.test.ts`. Run them with
`npx vitest run src/test/iapMatrix.test.ts src/test/iapLifecycle.test.ts src/test/trialSurfaces.test.tsx`.

---

## 1. Store configuration the code assumes

A mismatch here fails **silently**: the product reads as "not available" and its row
disappears, or a purchase succeeds and grants nothing. Check each line.

| # | Where | Must be true | Why the code needs it |
|---|---|---|---|
| C1 | ASC + RC | Product IDs exactly: `com.dynastymanager.pro.monthly`, `.pro.yearly`, `.pro.lifetime`, `.bundle.all`, `.pack.manager`, `.pack.stadium`, `.pack.legends`, `.pack.gold`, `.pack.premium_gold`, `.pack.rare_gold`, `.pack.icon`, and the retired `com.dynastymanager.pro` | StoreKit and RC match by exact string. Pinned by `iapMatrix › catalogue invariants › product IDs are byte-for-byte…` |
| C2 | RC → Entitlements | One entitlement with identifier **`pro`** (lowercase), attached to: monthly, yearly, lifetime, bundle.all, and the grandfathered `com.dynastymanager.pro` | `extractSubscriptionInfo` reads `entitlements.active.pro` (legacy alias `dynasty_pro`). Any other name = paid but no Pro |
| C3 | RC → Entitlements | Cosmetic packs and the four consumables are **not** attached to `pro` | Cosmetics are read from the purchase record; a consumable on an entitlement would look like a permanent purchase |
| C4 | RC → Products | The four player packs have product type **Consumable** | Non-consumable handling would make them restorable / un-rebuyable |
| C5 | RC → Offerings | Current offering contains Yearly, Monthly, Lifetime; a `packs` offering contains the four consumables | Packages are looked up across *all* offerings; a product missing from every offering still sells via a direct store lookup, but loses offering attribution |
| C6 | ASC → Subscriptions | Monthly and Yearly are in **one** subscription group | Apple grants the intro offer once per group; the eligibility probe assumes one group |
| C7 | ASC → Subscriptions → each plan → Introductory Offers | "Free, 1 week" on **both** Monthly and Yearly, all intended territories, start date in the past, no end date soon | The paywall and Shop read the offer's length from the store and show it only where it exists |
| C8 | ASC → App Information → App Store Server Notifications | Production **and** sandbox URLs point at RevenueCat (RC → Project → Apple App Store → "Apple Server to Server notification URL") | Refunds, revocations and billing-retry lapses reach RC through these; without them a refund is only noticed on the next receipt refresh |
| C9 | RC → Apple App Store config | In-App Purchase Key (StoreKit 2) and App-Specific Shared Secret uploaded | RC SDK 12 validates through StoreKit 2 |
| C10 | ASC display names | Consumables: Champions / Elite / World Class / Legends; cosmetic: Dynasty Legacy Pack | The StoreKit sheet must name the item the card sold (CLAUDE.md ASC action item) |
| C11 | GitHub → Secrets | `VITE_REVENUECAT_API_KEY_IOS` (`appl_…`) set | A production build without a key refuses to configure RC (Sentry: "RevenueCat API key missing") |
| C12 | GitHub → Secrets + `ios-testflight.yml` | **Optional:** `VITE_REDEEM_SECRET` (16+ chars) passed in the build step's `env` | Without it, production builds hide Settings → Redeem Code and redeem nothing (deliberate — see §2.6) |

---

## 2. The matrix

Legend — **P** purchase, **C** user cancel, **Q** payment pending (Ask to Buy / SCA),
**E** store error, **U** product unavailable, **R** restore on reinstall, **X** expiry /
lapse, **F** refund / revocation.

### 2.1 Shared code path

- **Surfaces:** `SubscribeOnboarding` (paywall), `ShopPage` (+ `PurchaseModal`),
  `SettingsPage` → Restore / Manage, `ProUpsell` (routes to the paywall),
  `StarterKitBanner` (routes to the Shop), `PacksPage` (+ the deal popup, which routes
  to `PacksPage`).
- **Non-consumables:** surface → `utils/purchaseSync.purchaseAndSync` →
  `utils/purchases.purchaseProduct` → `buyProduct` (offering package, else direct
  store product) → `syncStoreState` (`getEntitlements` + `getCustomerInfo` →
  `extractSubscriptionInfo`) → slice `restoreEntitlements` / `updateSubscription` →
  `isPro()`. Restore: `restoreAndSync`. Launch: `GameShell` sync
  (`getEntitlementsDefinitive` → `reconcileEntitlements`, plus the customer-info
  listener).
- **Consumables:** `PacksPage.handleOpen` → `readConsumableHistory` → un-charged
  marker → `purchaseConsumable` → marker `charged: true` →
  `packCreditRecovery.reconcilePendingPackCreditAtLaunch` → `openPack(skipPayment)` →
  `flushSave` → marker cleared.

### 2.2 Pro subscriptions — Monthly (`.pro.monthly`), Yearly (`.pro.yearly`)

Status lives **only** in `monetization.subscription` (`expiresAt`); the SKU never
enters `entitlements`.

| Flow | What the player gets | Code | Test |
|---|---|---|---|
| P | Pro; Settings/Shop show plan, renewal date, Manage Subscription | `purchaseAndSync` → `extractSubscriptionInfo` | `iapMatrix › <sku> (subscription) › purchase → …` |
| P, trial | Both rows (paywall) and both cards (Shop) name "N-day free trial" **only** where the store confirms offer + eligibility; record `tier: 'trial'`, `isTrial: true` | `resolvePaywallTrials`, `probePaywallTrials`, `extractSubscriptionInfo` (`periodType: TRIAL`) | `trialSurfaces` (all); `iapMatrix › subscription states › <sku> free trial`; `paywallTrials` |
| P, store record lags | Pro now, via a bounded local record (trial: store length; paid: undated, ends after 32 / 367 days unless a sync replaces it) | `purchaseAndSync` local record | `iapLifecycle › one purchase path › a store that completes a PAID subscription…`, `…ends after one billing period…`, `…trial length the surface showed` |
| P, Monthly → Yearly | Store's Monthly record kept until Apple applies the switch | same, guarded by `isSubscriptionActive` | `iapLifecycle › Monthly → Yearly applied at renewal…` |
| C | "Purchase Cancelled — no charge"; nothing granted; no Sentry | `isUserCancelledError` | `iapMatrix › … › user cancel`; `purchaseFailureModes › cancel handling` |
| Q | "Waiting for approval"; nothing granted; Pro arrives via the listener on approval | `isPaymentPendingError` → `{ pending: true }` | `iapMatrix › … › Ask to Buy`; `iapLifecycle › Ask to Buy…` |
| E | Error banner/toast; nothing granted; Sentry. If the SDK threw *after* the charge and the re-sync finds it → treated as success | `purchaseAndSync` catch → `purchaseLanded` | `iapMatrix › … › store error`; `iapLifecycle › a throw AFTER the charge…` |
| U | Row/card hidden before any tap (`getStoreAvailability`); a direct call fails before StoreKit opens | `PurchaseNotAttemptedError` | `iapMatrix › … › product unavailable`; `purchaseFailureModes › getStoreAvailability` |
| R | "Your Pro subscription is active" (no entitlement IDs are restored for subs) | `restoreAndSync` | `iapMatrix › … › restore on a fresh install`; `iapLifecycle › restore › a subscription-only customer…` |
| X | Pro ends at `expiresAt` (judged against the clock high-water mark, so winding the clock back does nothing); lapsed Monthly/Yearly never regain Pro from the store's forever-list | `isSubscriptionExpired`, `mapEntitlements` | `iapMatrix › a lapsed <sku> subscription`; `monetization › subscription expiry is anchored…` |
| X, grace | Still Pro; amber "Payment issue detected" | `isInGracePeriod` | `iapMatrix › subscription states › billing grace period` |
| X, cancelled | Still Pro until expiry; "Expires: date" | `willRenew: false` | `iapMatrix › … › cancelled but still paid up` |
| F | Pro ends at the next sync (launch, restore, purchase, or the listener) — previously kept until the original expiry, up to a year | `extractConfirmedLapse`; `mergeDeviceMonetization` lets the newer lapse win over a pre-refund save | `iapLifecycle › a refunded, revoked or lapsed subscription…` (all) |
| Manage | Opens RC's `managementURL`, else the platform's own page (Apple / Google Play) | `openSubscriptionManagement` | `iapLifecycle › Android … › management` (both) |

### 2.3 Pro one-time — Lifetime (`.pro.lifetime`), Dynasty Edition (`.bundle.all`), retired `com.dynastymanager.pro`

Pro via `entitlements` ∩ `PRO_ONE_TIME_PRODUCT_IDS`. The bundle expands to Lifetime +
the three cosmetic packs. The retired SKU is not sold anywhere and still restores.

| Flow | What the player gets | Code | Test |
|---|---|---|---|
| P | Pro forever; Shop shows "Your Pro Features — Unlocked", **no** "Active Subscription / Manage" card | `mapEntitlements`, `restoreEntitlements`, `hasRecurringSubscription` | `iapMatrix › <sku> (pro-one-time) › purchase`; `iapLifecycle › what the Shop and Settings show › a Lifetime owner…` |
| C / Q / E / U | as §2.2 | as §2.2 | `iapMatrix › <sku> (pro-one-time) › …` |
| R | "N products restored"; bundle re-expands | `restoreAndSync` | `iapMatrix › … › restore`; `iapLifecycle › restore › …expanding the bundle`; `iapMatrix › the retired com.dynastymanager.pro…` |
| X | n/a — never expires. Keeps Pro when a subscription lapses | `isPro` | `iapMatrix › a lapsed <sku> subscription › keeps Pro when <keeper> is owned` |
| F | Pruned at the next launch sync that gets a definitive store answer — the entitlement **and** the never-expiring Lifetime record `extractSubscriptionInfo` puts in the subscription slot (before this, a refunded Lifetime kept Pro forever through that record) | `getEntitlementsDefinitive` → `reconcileEntitlements` | `entitlementReconciliation`; `iapLifecycle › a refunded Lifetime loses Pro at the launch reconcile…` |

### 2.4 Cosmetic packs — Manager Identity (`.pack.manager`), Stadium (`.pack.stadium`), Dynasty Legacy (`.pack.legends`)

Non-consumable, no Pro. Read from the purchase record (no RC entitlement needed).

| Flow | What the player gets | Code | Test |
|---|---|---|---|
| P | "Owned"; cosmetics selectable; Starter Kit no longer recommended after the Manager pack | `restoreEntitlements`, `isStarterKitAvailable` | `iapMatrix › <sku> (cosmetic) › purchase`; `iapLifecycle › …Starter Kit is not recommended…` |
| C / Q / E / U / R | as §2.3 | as §2.3 | `iapMatrix › <sku> (cosmetic) › …` |
| F | Pruned at launch sync; an equipped cosmetic falls back to default | `reconcileEntitlements`, `getActiveCosmetic` | `entitlementReconciliation`; `monetization › getActiveCosmetic` |

### 2.5 Consumable player packs — Champions (`.pack.gold`), Elite (`.pack.premium_gold`), World Class (`.pack.rare_gold`), Legends (`.pack.icon`)

Never an entitlement, never restorable. The pack-credit marker is the only proof of
payment.

| Flow | What the player gets | Code | Test |
|---|---|---|---|
| P | Pack opens; players on the squad; marker cleared after a durable save | `purchaseConsumable` → reconciler → `openPack` | `iapMatrix › consumable <sku> › purchase`; `packCreditRecovery` |
| C | Nothing; marker dropped; Market stays open | returns `false` | `iapMatrix › consumable … › user cancel` |
| Q | "Waiting for approval"; marker kept as `deferred` (72 h window) and credited when the store shows the transaction | `isPaymentPendingError`, `PACK_DEFERRED_SETTLE_MS` | `iapMatrix › consumable … › Ask to Buy`; `packCreditRecovery` |
| E | "Purchase failed"; marker **kept** (the SDK may have charged) and verified against purchase history: one new transaction → credited, none after 30 min → released | reconciler | `iapMatrix › consumable … › store error`; `packCreditRecovery` |
| U | "Purchase failed"; marker dropped (definitively un-charged) | `PurchaseNotAttemptedError` | `iapMatrix › consumable … › product unavailable` |
| Crash mid-purchase | Credited on next launch (GameShell) or Market visit | `reconcilePendingPackCreditAtLaunch` | `packCreditRecovery`, `packCreditIntegrity` |
| R | Nothing (by design); players already granted stay | `mapEntitlements` excludes | `iapMatrix › consumable … › is never restorable and never persistable` |
| F | Not revoked: a consumed pack's players stay. Accepted — Apple refunds of consumables are rare, and removing squad players after the fact is worse for everyone | — | — |

### 2.6 Redeem codes (not an IAP; audited because they mint in-game value)

| Build | Behaviour | Test |
|---|---|---|
| Production, no `VITE_REDEEM_SECRET` | Settings → Redeem Code hidden; any code rejected | `redeemCodes › production builds redeem nothing…` |
| Production, secret set (16+ chars, not the public dev value) | Codes signed with that secret redeem once per device, capped at £1,000,000 / 500 XP (`REDEEM_CODE_MAX_REWARD`) | `redeemCodes › per-code reward caps`, `…a real build secret enables it…` |
| Dev / tests | Public dev secret; mint with `npm run redeem-code -- --dev xp 100` | `redeemCodes › …dev builds…`, `scripts/gen-redeem-code.mjs` suite |
| Generator | Refuses to run without `REDEEM_SECRET` (or `--dev`), refuses the public/short secret and over-cap amounts | `redeemCodes › scripts/gen-redeem-code.mjs` |

---

## 3. Device checklist (StoreKit sandbox / TestFlight)

Code tests prove the logic against a mocked SDK. They cannot prove the consoles are
configured (§1), that StoreKit shows what we expect, or timing. Run on a **TestFlight
build of this branch**. Record the build number next to each result.

**Setup.** ASC → Users and Access → Sandbox → Testers: create **two new** testers
(A, B) that have never purchased. On the device: sign out of the App Store's sandbox
account, then sign in with tester A when the first purchase sheet asks. Sandbox time
is compressed — a 1-week free trial lasts about 3 minutes, a month about 5 minutes, a
year about an hour; subscriptions auto-renew a limited number of times and then lapse.
The tester's renewal rate and "Clear Purchase History" are on the device under
Settings → App Store → Sandbox Account (iOS 18: Settings → Developer → Sandbox Apple
Account) → Manage; the menu path moves between iOS versions.

### A. Trials on both plans (tester A, fresh install)
1. Launch → New Game → paywall. **Expect:** the Yearly *and* Monthly rows each say
   "7-day free trial included"; Yearly is preselected; CTA "Try 7 Days Free"; the
   summary reads "Free for 7 days, then <local price> per year. Auto-renews until
   cancelled."; prices in the device's currency.
   *If neither row shows the trial:* check C6/C7, and that tester A has never
   subscribed (the store, not the app, decides eligibility).
2. Tap the Monthly row. **Expect:** summary switches to "…then <price> per month";
   CTA still "Try 7 Days Free".
3. Tap "Continue Free" → Menu → Shop. **Expect:** the Dynasty Pro Annual and Monthly
   cards each show "Free for 7 days, then <price>/year|month. Cancel anytime."; the
   Lifetime card shows no trial line.
4. Tap the Annual card's price. **Expect:** confirm dialog, Total "<price>/year", the
   trial line under it, button "Start 7-Day Free Trial".
5. Tap it, then **cancel** the Apple sheet. **Expect:** "Purchase Cancelled — No
   charge was made."; no Pro.
6. Buy it for real (sandbox). The Apple sheet must say "1 week free" then the yearly
   price. **Expect:** toast "7-Day Free Trial Started!"; Settings → Purchases: "Dynasty
   Pro Annual · trial", "Renews: <date>", Manage Subscription button; Pro features
   unlocked (Instant Match Sim etc.).
7. Wait ~4 minutes (trial ends, first renewal). Force-quit and relaunch. **Expect:**
   still Pro; Settings shows "annual" instead of "trial".

### B. Monthly trial from the Shop (tester B, fresh install)
1. Skip the paywall → Shop → Monthly card → "Start 7-Day Free Trial" → buy.
   **Expect:** trial toast; Settings shows "Dynasty Pro Monthly · trial".
2. Shop now shows no trial lines anywhere (the offer is spent) and, once the trial
   converts, a "Switch to Annual" card.

### C. Cancel, lapse, restore (tester A or B)
1. Settings → Manage Subscription → Apple's page opens → cancel. Relaunch the app.
   **Expect:** "Expires: <date>", still Pro.
2. After sandbox expiry, relaunch. **Expect:** Pro gone; ProUpsell banners say
   "Upgrade to Dynasty Pro" with no trial line; paywall shows no trial.
3. Buy Monthly again (no trial now: the Apple sheet shows the full price). Delete the
   app, reinstall, Settings → Restore Purchases. **Expect:** "Purchases Restored — Your
   Pro subscription is active." and Pro back.

### D. Lifetime, bundle, cosmetics (use Clear Purchase History between runs)
1. Buy Pro Lifetime from the paywall. **Expect:** "Welcome to Dynasty Pro!"; Shop shows
   "Your Pro Features — Unlocked" and **no** Active Subscription / Manage card;
   Settings shows only the Pro badge.
2. Buy Dynasty Edition (clear history first). **Expect:** Pro plus all three cosmetic
   packs "Owned"; My Cosmetics selectors appear.
3. Buy the Manager Identity Pack alone (clear history). **Expect:** "Owned"; the
   Starter Kit card (Shop) and banner (Dashboard) disappear; not Pro.
4. Reinstall → Restore Purchases. **Expect:** "N products restored", everything above
   back.

### E. Player packs (any tester)
1. Market → buy each of Champions, Elite, World Class, Legends once. **Expect:** the
   Apple sheet names the pack as the card does (C10); the pack opens; players on the
   squad.
2. Airplane Mode on → tap a paid pack. **Expect:** "Purchase failed" and no charge.
   Turn Airplane Mode off. **Expect:** the Market lets you buy again — immediately if
   the failure happened before the Apple sheet, otherwise after it says "Checking your
   last purchase" and at most 30 minutes (`PACK_UNCONFIRMED_SETTLE_MS`), once the store
   confirms no payment arrived. It must never stay locked.
3. Tap a paid pack, confirm the Apple sheet, and force-quit the app the instant the
   sheet closes. Relaunch into the same save. **Expect:** "Purchase restored — Your
   paid <pack> has been credited."
4. Reinstall → Restore Purchases. **Expect:** no pack is restored (consumables are not
   restorable); nothing else lost.

### F. Ask to Buy, refund, billing retry — Xcode StoreKit Testing only
These cannot be produced on a TestFlight sandbox account. Run the app from Xcode with a
StoreKit Configuration file (Product → Scheme → Edit Scheme → Run → Options → StoreKit
Configuration). RevenueCat needs the StoreKit test certificate uploaded for this
(RC → Project → Apple App Store → StoreKit test certificate).
1. **Ask to Buy:** Editor → Enable Ask To Buy. Buy Yearly. **Expect:** "Waiting for
   approval — It unlocks automatically once the purchase is approved." and the app
   continues. Approve in Debug → StoreKit → Manage Transactions. **Expect:** Pro
   appears without relaunch. Repeat with a player pack: "Waiting for approval", then
   credited on the next Market visit after approval; a decline releases the Market
   within 72 hours.
2. **Refund:** in Manage Transactions, refund the Yearly transaction, then relaunch.
   **Expect:** Pro gone at launch (it used to survive until the original expiry).
   Loading an older save must not bring it back. Repeat with **Lifetime**: refund it,
   relaunch online — Pro gone, Settings shows no Pro badge.
3. **Billing grace:** enable Billing Grace Period + Billing Retry in the StoreKit file,
   let a renewal fail. **Expect:** Pro kept, amber "Payment issue detected" in Settings
   and Shop; after grace ends, Pro gone.
4. **Interrupted purchase:** enable Interrupted Purchases, buy Lifetime. **Expect:** no
   error dialog loop; Pro once the interruption is resolved (or "Purchase Could Not
   Complete… tap Restore Purchases" and Restore works).

### G. Things to read afterwards
- Sentry: no `purchase completed but the store showed no active pro entitlement`
  warnings (that one means C2 is wrong); no `subscribe: store did not return every
  configured plan` (C1/C5).
- RC dashboard → the sandbox customers: trial start/conversion events on **both**
  products; the refund in F2 shows as a cancellation with refund.

---

## 4. Known gaps and decisions

- **Android trials are never advertised.** RC's intro-eligibility check always answers
  "unknown" on Google Play, and unknown never qualifies (by design — a false trial
  claim is worse than a missing one). Play still applies an eligible free phase at
  purchase. Android is not on Google Play yet; revisit (read
  `defaultOption.freePhase`, which Play only returns to eligible users) before it is.
- **Android identifiers** (`<sub>:<basePlan>`) are normalised and unit-tested, but
  nothing Android has been run on a device.
- **Redeem codes are off in production** until `VITE_REDEEM_SECRET` is added to the
  repo secrets and passed in `ios-testflight.yml` (C12). No codes were ever handed out.
- **Consumable refunds are not clawed back** (§2.5 F).
- `@revenuecat/purchases-capacitor-ui` is still a dependency (native RevenueCatUI
  ships in the binary) though nothing imports it; a test forbids importing it.
  Removing the native plugin is a build change to schedule separately.
- `startFreeTrial` (slice) is no longer called by any surface — the paywall and Shop
  use `purchaseAndSync`'s store-confirmed record — and remains for tests/dev tools.
