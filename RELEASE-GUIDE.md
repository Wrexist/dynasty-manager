# Release Guide — every step to ship

> One ordered checklist. Everything in **Part 1** is done and on a branch.
> **Part 2** is what only you can do — each step says exactly where to click,
> what to enter, how to check it worked, and what breaks if you skip it.
>
> Deeper reference: `marketing/ads/RELEASE-READINESS.md` (defect detail),
> `marketing/ads/arpi-roadmap.md` (revenue model), `marketing/ads/apple-ads-2026-27.md`
> (ad campaigns). This file is the operational path; those are the reasoning.

---

## Part 1 — Done in code

Three branches. Merge in this order; each is independently green.

| # | Branch | What |
|---|---|---|
| 1 | `claude/whats-new-1-3-1-card` | Player-facing release notes + version bump to 1.3.1 |
| 2 | `claude/ads-system` | Rewarded-ad offer system (inert until §2.6) |
| 3 | — | *(merged)* `#599` — IAP fixes, 37-locale ASO pivot |

**Already fixed and verified:**

- Pro no longer revoked when loading an older save or starting a new career
- Purchases now survive in device-scoped storage, not just inside a save slot
- Free trial only offered when the App Store will actually grant it
- Prices and savings shown in local currency, never USD-derived
- Shop and Packs no longer show buy buttons for unsellable SKUs
- Restore Purchases recognises subscription-only customers
- `xp_double` removed (it fed the perk tree → training rates and match odds)
- Ad budget rewards proportional and clamped, not flat
- One unconfigured SKU can no longer blank the whole store catalog
- `startFreeTrial` refuses non-trial SKUs (a one-time SKU became permanent Pro)
- All 37 locales pivoted off the closed tournament window
- Validator now catches tournament marks in What's New + local abbreviations
- Build warns when observability secrets are missing (`npm run check:observability`)

**Save schema is now 79.** Saves written by this build will not load on an older binary.

---

## Part 2 — Only you can do these

### §1 — RevenueCat (30 min) — do this first

You already confirmed the entitlement identifier is `pro` ✅ and all 12 products exist ✅.

**1.1** <https://app.revenuecat.com> → **Project Settings → API Keys**.
Confirm the iOS key starts `appl_` and matches the `VITE_REVENUECAT_API_KEY_IOS` GitHub secret.
*Verify:* it's the public **SDK** key, not a secret key.
*If wrong:* every purchase surface degrades to the empty-store path and nobody can buy anything.

**1.2** **Product catalog → Products** → confirm the 4 pack SKUs (`pack.gold`, `pack.premium_gold`, `pack.rare_gold`, `pack.icon`) are **not** attached to any entitlement.
*If wrong:* RevenueCat grants a permanent entitlement for a consumable. The app filters it out, so nothing breaks in-app — but your revenue attribution is wrong.

**1.3** **Offerings** → confirm one offering contains the purchasable packages.
*If wrong:* the app falls back to direct `getProducts` lookup, which now recovers per-ID, so this degrades rather than breaks.

---

### §2 — Ads: AdMob (2–4 hours) — the only real engineering left

⚠️ **This is the step that crashed TestFlight build 136.** Do it carefully and test on a real device before submitting.

**2.1** Install the plugin:
```bash
npm install @capacitor-community/admob
npx cap sync ios
```

**2.2** Confirm `ios/App/CapApp-SPM/Package.swift` picked up the package + product. If `cap sync` didn't add it, add it by hand.

**2.3** In `ios/App/App/Info.plist`, restore:
- `GADApplicationIdentifier` — your AdMob app ID
- `NSUserTrackingUsageDescription` — the ATT purpose string
- `SKAdNetworkItems` — Google's SKAdNetwork IDs

Then add the localized purpose strings to every `ios/App/App/*.lproj/InfoPlist.strings`.
*If skipped:* ITMS-90683 rejection on upload.

**2.4** Replace `showRewardedAd()` in `src/utils/ads.ts` with a real implementation.
**It must resolve `true` ONLY from the reward callback** — never on dismiss, never on error, never on timeout.
*If wrong:* players get rewards without watching, and your fill revenue goes to zero.

**2.5** Call `AdMob.initialize()` at startup in `initAds()`.
*If skipped:* this is precisely the build-136 crash — `GADApplicationVerifyPublisherInitializedCorrectly` fires from a background dispatch block and kills the app at launch.

**2.6** Flip **both** flags in `src/utils/ads.ts`, in the same commit:
```ts
export const NATIVE_ADS_READY = true;
const REWARDED_AD_IMPL_IS_STUB = false;
```
*Verify:* `npx vitest run src/test/launchCrashGuardrails.test.ts` — the guardrail tests pin these as a pair and will fail if you flip only one.
*If you flip only `NATIVE_ADS_READY`:* Pro users collect every reward and free users collect none — a paid economic advantage, i.e. pay-to-win.

**2.7** Sequence the ATT prompt **after** the existing first-launch `AnalyticsConsentModal`, so users don't get two system-looking dialogs back to back. Add Google UMP for EEA consent.

**2.8** **App Store Connect → App Privacy** → declare **Device ID → Tracking** and **Third-Party Advertising**.
*If skipped:* rejection, or a privacy-label mismatch after you ship.

---

### §3 — GitHub secrets (10 min)

**3.1** <https://github.com/Wrexist/dynasty-manager/settings/secrets/actions> → **New repository secret**:

| Name | Value | Why |
|---|---|---|
| `VITE_SENTRY_DSN` | DSN from a new project at <https://sentry.io> | **No crash report has ever left a production device.** Every `Sentry.captureException` in the purchase paths is currently a no-op. |
| `VITE_ANALYTICS_ENDPOINT` | Your collector URL — *or skip, see below* | Without it every conversion rate in the model stays a guess. |

*Verify:* the "Check observability secrets" step in the next workflow run prints **"all secrets present"** instead of the warning block.

**3.2** Once both exist, change `--strict` into the workflow step in `.github/workflows/ios-testflight.yml` so a rotated secret fails the build instead of silently blinding production.

> **On analytics — a real decision, not a chore.** RevenueCat gives you trial→paid, churn and product conversion. App Store Connect gives you installs, D1/D7/D28 and page CVR. That's **four of the six** inputs the revenue model needs, for zero engineering. First-party analytics only adds per-surface rates. If you don't want to run a collector, skip `VITE_ANALYTICS_ENDPOINT` deliberately and take those four from the dashboards. Do **not** leave it half-built.

---

### §4 — App Store Connect metadata (1 hour, no build needed)

**4.1 — Ship the 20 locale updates.** This is the highest-ROI free action available.

For each locale, **App Store Connect → your app → the version → Localizations**, paste from `marketing/aso/locales/<locale>.md`:
- **Subtitle**
- **Promotional Text**
- **Keywords**

The 20: `ar-SA cs da el fi he hr hu ja ko nl-NL no ro ru sk sv th uk zh-Hans zh-Hant`

*Verify:* `node marketing/aso/validate-locales.mjs` exits 0 locally (it does).
*Why now:* these three fields need **no build and no review** — they go live immediately and revert instantly.
*If skipped:* 20 storefronts keep selling a tournament that ended 19 July, in the second-most-weighted field you own.

**4.2** **Description**, **What's New** and **App Name** need a version submission — they ride the next binary. Same files.

**4.3 — Custom product pages.** `App Store Connect → Custom Product Pages`. Create the six in `marketing/aso/season-2026-refresh.md`: `career`, `tactics`, `transfers`, `nation`, `brand`, `pro`.
⚠️ **Submit these early** — a CPP must be **Approved** before an Apple Ads ad group can select it as a destination.

---

### §5 — Build and test (2 hours)

**5.1** Merge the two branches (§Part 1), in order.

**5.2** Check TestFlight: if **1.3.0 is already there**, keep 1.3.1. If it never shipped, drop `package.json` back to `1.3.0`.

**5.3** Trigger the build: <https://github.com/Wrexist/dynasty-manager/actions/workflows/ios-testflight.yml> → **Run workflow** → leave `marketing_version` **blank** → green button.

**5.4** Read the run summary's `::notice::` line and confirm the version is what you intended **before** the upload step runs.

**5.5 — Sandbox test on device.** In order:

1. Buy Dynasty Pro → confirm the Pro badge appears
2. **Save, then load an older slot → confirm Pro survives** *(the bug that revoked it)*
3. Start a **New Game** → confirm Pro is still active *(device-scoped storage)*
4. **Restore Purchases** as a subscription-only account → must say *"Your Pro subscription is active"*, not *"No Purchases Found"*
5. **The one I could not test at all:** sign in with a sandbox Apple ID that has **already consumed its intro offer**, open the paywall, and confirm it does **not** say "7 days free". This path cannot be exercised off-device — purchases are mocked. If it still promises a trial, that's a Guideline 3.1.2(c) false claim plus refund requests.
6. Switch the device to a non-US storefront → confirm prices show in local currency and no "$" figures appear
7. If ads are live: confirm a free user must watch to completion, and a Pro user gets the same reward with no video

---

### §6 — Apple Ads (1 hour) — only after §4.3 CPPs are Approved

**6.1** <https://ads.apple.com> → sign in with the Apple ID that owns the app → choose **Advanced**, **not Basic**.
⚠️ Basic cannot use CPPs, exact match or negative keywords, and **the choice is irreversible within that account**.

**6.2** Build the five campaigns in `marketing/ads/apple-ads-2026-27.md` §2. Paste keywords from `marketing/ads/keywords/*.csv`. Apply `negatives.csv` account-wide.

**6.3** Leave `HEAD-TERMS-US` **paused at $0**. Phase 1 is $19/day across the other four.

> **Read `marketing/ads/apple-ads-2026-27.md` §0 first.** Head terms need $2.567 revenue per install against a modelled ceiling of $0.648. They are not affordable at this price ladder and the campaign exists only so it's ready if that changes.

---

## Ordering hazards — read before you start

| # | Hazard | Consequence |
|---|---|---|
| **H1** | **Never remove `com.dynastymanager.pro` from sale.** `grantEntitlement` expands the bundle's `includes` and writes that exact ID into entitlements. | Mass silent Pro revocation for every Dynasty Edition and legacy buyer. |
| **H2** | Any SKU removal and the binary that stops showing it must go live **together**. | Guideline 2.1.0 rejection — the dead CTA that rejected build 174. |
| **H3** | A new SKU must be **Approved** in ASC and mapped in RevenueCat **before** a binary references it. | It silently disappears from the store UI. |
| **H4** | The intro offer must exist in ASC **before** any binary claims "7 days free". | 3.1.2(c) false claim + refunds. |
| **H5** | A CPP must be **Approved** before an Apple Ads ad group can select it. | You build the campaign and can't point it anywhere. |
| **H6** | Flip `NATIVE_ADS_READY` and `REWARDED_AD_IMPL_IS_STUB` **together**. | Pro-only rewards = pay-to-win. |

---

## Do not do these

- **Don't reprice yet.** Raising monthly to $2.99 is the top revenue item, but do 30 days of baseline first or you'll never know whether the rise suppressed trial starts.
- **Don't run head-term ad campaigns.** The arithmetic is in §6.3.
- **Don't skip the sandbox sweep.** With Sentry off (§3), it is your only detection mechanism for a purchase-path regression.

---

## Fastest path to shipping

If you want the shortest route to a build that's better than what's live:

1. §4.1 — paste 20 locale subtitles *(1 hour, no build, ships immediately)*
2. §3.1 — add `VITE_SENTRY_DSN` *(10 min)*
3. §5.1–5.4 — merge and build *(30 min)*
4. §5.5 — sandbox test *(1 hour)*

**Ads (§2) and Apple Ads (§6) are not on that path.** They're the biggest chunk of remaining work and neither blocks a release that fixes the revenue bugs already found.
