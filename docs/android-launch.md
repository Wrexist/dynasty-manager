# Google Play launch — owner checklist

Written 2026-09-29. Dynasty Manager is live on iOS and **not yet on Google
Play**. The Android code is ready to ship (see §0); everything left is console
work that only the account owner can do. Do the steps in order — step 1 starts
a clock you cannot shorten.

Companion files:
- `marketing/play/listing-en.md` — every store-listing field, copy-paste ready.
- `marketing/play/app-content.md` — answers for Data safety, content rating,
  target audience, ads and app access.
- `docs/iap-verification.md` — the iOS version of §5's table; the SKU × flow
  matrix there applies to Android too.

---

## 0. What the code already does (verified in this repo, 2026-09-29)

| Area | State | Where |
|---|---|---|
| Build | Signed release AAB from `android-build.yml` (manual dispatch, `version_code` input) | `.github/workflows/android-build.yml` |
| Target SDK | 36 (compile 36, min 24) — above Play's new-app floor | `android/variables.gradle` |
| Package | `com.dynastymanager` — **permanent once uploaded** | `android/app/build.gradle` |
| Purchases | RevenueCat with a separate `goog_…` key; Play's `subscriptionId:basePlanId` identifiers are normalised back to our product IDs | `utils/purchases.ts` `normalizeStoreProductId` |
| Legal links | Point of purchase links Google Play's terms and "Google Play → Payments & subscriptions" on Android | `config/legal.ts` `termsUrlFor`, `subscriptionSettingsPathFor` |
| Privacy policy | Already names Google Play and RevenueCat | `docs/privacy.html` |
| Back button | Hardware back handled inside the game shell | `hooks/useHardwareBack.ts` |
| Review prompt | Native Play in-app review | `utils/appReview.ts` |
| Share links | **Fixed in this change:** shares from Android now link the Play listing (they linked the App Store) | `config/legal.ts` `storeUrlFor` |
| Permissions | INTERNET, VIBRATE, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, WAKE_LOCK (merged from plugins). **No exact-alarm permission**, so no Play declaration is needed | manifest + plugins |

**Not tested — no one has made a Play purchase yet.** Step 9 is mandatory.

**Known cosmetic gap:** the "device storage is full" message in
`orchestrationSlice.ts` names the iPhone Storage settings path on Android too.

---

## 1. Create the developer account — today

1. https://play.google.com/console/signup — one-time US$25, identity
   verification (government ID; an organisation also needs a D-U-N-S number).
2. **Personal or organisation?** Google requires *new personal* accounts to run
   a **closed test with at least 12 testers opted in for 14 continuous days**
   before production access is granted (the rule at time of writing — confirm on
   the Console dashboard, it tells you exactly what is outstanding).
   Organisation accounts are not subject to it. If you have a registered
   company, register as an organisation and skip ~3 weeks.
3. Verify a contact email and phone. The public developer name and email are
   shown on the listing — use `support@dynastymanager.app`.
4. Set up a **payments profile** (Console → Settings → Payments profile) —
   without it you cannot create paid products.

## 2. Create the app

Console → **Create app**:
- App name: `Dynasty Manager: Football`
- Default language: English (United Kingdom) — en-GB
- App or game: **Game** · Free or paid: **Free**
- Accept the Developer Programme Policies and US export laws declarations.

## 3. App content (Console → Policy → App content)

Paste from `marketing/play/app-content.md`: privacy policy, ads (**No**), app
access (**all functionality available without special access**), content
rating questionnaire, target audience (**18+**), Data safety, government app
(No), financial features (None), health (No), news (No).

## 4. Store listing (Console → Grow → Store presence → Main store listing)

Paste from `marketing/play/listing-en.md`. Graphics:

| Asset | Spec | File |
|---|---|---|
| App icon | 512×512 PNG, 32-bit | `marketing/play/graphics/icon-512.png` |
| Feature graphic | 1024×500 PNG/JPEG, no alpha | `marketing/play/graphics/feature-1024x500.png` |
| Phone screenshots | 2–8, 16:9 or 9:16, 320–3840 px per side, long side ≤ 2× short | `marketing/play/graphics/phone-0*.png` (1080×1920) |

Do **not** reuse `marketing/appstore-2026-09/` for Play: those are 1242×2688
(ratio 2.16 — Play rejects anything over 2:1) and they are promotional
concepts with generated likenesses, not gameplay. The Play set is captured from
the running app.

Category: **Games → Sports**. Tags (up to 5): Sports, Football, Management,
Simulation, Offline. Contact email `support@dynastymanager.app`, website
`https://wrexist.github.io/dynasty-manager/`.

## 5. In-app products (Console → Monetise → Products)

Create each with the **exact** ID below (invariant 6 in CLAUDE.md — StoreKit,
Play and RevenueCat all match by string, and a mismatch fails silently).
Prices: set the USD price, then let Play convert per country.

**One-time products**

| Product ID | Name (must match the in-app card) | USD | RevenueCat product type |
|---|---|---|---|
| `com.dynastymanager.pro.lifetime` | Dynasty Pro Lifetime | 39.99 | Non-consumable |
| `com.dynastymanager.bundle.all` | Dynasty Edition | 42.99 | Non-consumable |
| `com.dynastymanager.pack.manager` | Manager Identity Pack | 2.99 | Non-consumable |
| `com.dynastymanager.pack.stadium` | Stadium Atmosphere Pack | 1.99 | Non-consumable |
| `com.dynastymanager.pack.legends` | Dynasty Legacy Pack | 3.99 | Non-consumable |
| `com.dynastymanager.pack.gold` | Gold Pack | 2.99 | **Consumable** |
| `com.dynastymanager.pack.premium_gold` | Elite Pack | 4.99 | **Consumable** |
| `com.dynastymanager.pack.rare_gold` | World Class Pack | 6.99 | **Consumable** |
| `com.dynastymanager.pack.icon` | Legends Pack | 9.99 | **Consumable** |

Skip the retired `com.dynastymanager.pro` — nobody on Android owns it.

**Play has no consumable/non-consumable switch on the product.** Consumption is
done by the app, through RevenueCat. The type column above is set in
**RevenueCat → Products** for each Play product. Get it wrong one way and a
Pro Lifetime buyer's purchase is consumed and cannot be restored (revenue +
refund bug); the other way and a pack can be bought once only.

**Subscriptions**

| Subscription ID | Base plan ID | Billing | Offer |
|---|---|---|---|
| `com.dynastymanager.pro.monthly` | `monthly` | Auto-renewing, 1 month, US$4.99 | Free trial 7 days, eligibility "New customer acquisition — never had this subscription" |
| `com.dynastymanager.pro.yearly` | `yearly` | Auto-renewing, 1 year, US$24.99 | Same 7-day free trial |

Base plan IDs are free choices (lowercase, digits, hyphens); the code strips
everything after the colon, so any base plan ID works. Activate the base plans
and the offers — a draft base plan is invisible to the SDK.

## 6. First upload — by hand

Google refuses API uploads until an app has one release made in the Console.

1. GitHub → Actions → **Android Build** → Run workflow: `version_code` = `1`,
   `version_name` blank. Download the `dynasty-manager-release` artifact.
2. Console → Testing → **Internal testing** → Create release → upload the AAB.
   Accept **Play App Signing** (Google holds the app signing key; the
   `KEYSTORE_BASE64` secret becomes your *upload* key — back it up offline, and
   losing it means a key-reset request to Google, not a lost app).
3. Add yourself as an internal tester, install from the opt-in link.

Every later build: bump `version_code` by 1 (Play rejects a reused code).

## 7. RevenueCat — Android app

1. RevenueCat → Project → **+ App → Play Store**, package `com.dynastymanager`.
2. Upload **service credentials**: a Google Cloud service-account JSON with
   Play Console permissions *View financial data* and *Manage orders and
   subscriptions* (RevenueCat's "Google Play service credentials" guide walks
   through it; new credentials can take up to ~36 h to start validating).
3. Enable **Real-time developer notifications** (Pub/Sub topic RevenueCat
   gives you → Console → Monetisation setup) — refunds and lapses reach
   RevenueCat through it.
4. Import the products from §5, set their types, attach monthly / yearly /
   lifetime / bundle.all to the **`pro`** entitlement (same as iOS — C2 in
   `docs/iap-verification.md`). Do NOT attach cosmetics or packs to `pro`.
5. Add the Play packages to the same offerings as iOS (current: yearly,
   monthly, lifetime; `packs`: the four consumables).
6. Copy the public **`goog_…`** SDK key → GitHub → Settings → Secrets →
   Actions → `VITE_REVENUECAT_API_KEY_ANDROID`. Re-run step 6.1 with
   `version_code` = 2 — a build made before the secret existed has no store.

## 8. Closed test (personal accounts: 12 testers × 14 days)

1. Testing → **Closed testing** → create track → promote the internal release.
2. Add testers by Google Group or email list. Sources that work: the Discord,
   friends, the r/iosgaming / football-game communities asking for Android
   testers, a pinned TikTok comment ("Android testers wanted — link in bio").
3. Testers must **opt in and keep the app installed** for the 14 days. Ask them
   to actually play one season — Google asks what feedback you received.
4. Then Dashboard → **Apply for production** and answer the questionnaire.

## 9. Device test before production — mandatory

On a real Android phone from the testing track, with a **licence tester**
account (Console → Settings → License testing) so nothing is charged:

- [ ] Paywall shows Monthly and Yearly with localised prices and "7-day free
      trial" on both.
- [ ] Buy Yearly with trial → Pro active → Settings → Restore on a second device
      restores it.
- [ ] Buy Lifetime → uninstall → reinstall → Restore → Pro still active
      (proves it was NOT consumed).
- [ ] Buy a Gold Pack twice in a row (proves it IS consumed).
- [ ] Cancel the subscription in Play → after test-renewal expiry Pro turns off.
- [ ] Odds sheet opens from every paid pack card before purchase.
- [ ] Share best pull → the card and link say `play.google.com/...`.
- [ ] Hardware back closes sheets and steps back through screens; from the
      Dashboard it does not silently kill a match.
- [ ] Notifications: permission prompt appears once (Android 13+), streak
      reminder arrives.

## 10. Production

- Release → Production → promote the tested build. Staged rollout 20% → 50% →
  100% over 3–4 days; watch Android vitals (crash rate, ANR) between steps.
- Countries: start where the store listing language is native and loot-box
  rules are clear. Before enabling **Belgium** (paid random items effectively
  banned) or other markets with loot-box rules, check current law — this doc is
  not legal advice.
- Then flip the marketing CTA from "Free on iOS" to "Free on iPhone & Android"
  (video CTA variants are pre-rendered — `marketing/content/videos.md`).

## Upload automation — not done, owner decision

A fastlane `upload_to_play_store` lane + an optional `play_track` input on
`android-build.yml` would push each AAB to a track automatically (needs a
`PLAY_SERVICE_ACCOUNT_JSON` secret). Editing the release pipeline was outside
what this session was permitted to change; until then, step 6's manual upload
is the release path. It is ~2 minutes per build.
