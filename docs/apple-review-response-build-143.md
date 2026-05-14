# Apple App Review Response — Build 143 Rejection (May 14, 2026)

> Submission ID: `c92127ed-c79a-4444-9344-ded74fecc1a0`
> Review Device: iPad Air 11-inch (M3)
> Version reviewed: 1.0 (143)
>
> Paste the section below into the App Review message thread, and update the
> matching App Store Connect fields before resubmitting.

---

## Reply to App Review

Hi App Review Team,

Thank you for the detailed feedback on build 143. We have addressed all
three issues. Details below, grouped by guideline.

---

### Guideline 5.1.2(i) — App Tracking Transparency

**The app does not track users on any platform.** The App Privacy
declarations in App Store Connect have been updated to correctly reflect
this, so an ATT permission request is not required.

What the app collects (and the correct category in App Privacy):

| Data type | Linked to user | Used for tracking | Purpose |
|---|---|---|---|
| Crash Data | **No** | **No** | App Functionality (first-party Sentry crash reporting, anonymous) |
| Performance Data | **No** | **No** | Analytics (first-party, anonymous, opt-in via in-app consent) |
| Product Interaction | **No** | **No** | Analytics (first-party, anonymous, opt-in) |
| Purchase History | **No** | **No** | App Functionality (entitlement restoration via Apple StoreKit / RevenueCat) |

Specifically:

- **No advertising SDKs are linked.** No AdMob, no Meta Audience Network,
  no MoPub, no IronSource, no AppLovin, no Unity Ads, no Chartboost. CI
  guards prevent reintroduction of any GMA / AdMob framework
  (`src/test/launchCrashGuardrails.test.ts`).
- **No data is shared with data brokers or third-party advertising
  networks.** Crash reports go only to our own Sentry project; usage
  events go only to our own first-party analytics endpoint.
- **No IDFA is read.** The app never imports `AdSupport.framework` or
  calls `ASIdentifierManager`. `Info.plist` therefore intentionally
  contains **no `NSUserTrackingUsageDescription` key** and **no
  `SKAdNetworkItems`**.
- **The user is shown a first-launch privacy modal**
  (`src/components/AnalyticsConsentModal.tsx`) before any analytics
  events are sent. Consent can be revoked at any time from
  Settings → Privacy.

We have updated App Privacy in App Store Connect to mark **Crash Data**
and **Product Interaction** as **collected but not linked to the user
and not used to track the user**. With those toggles corrected, ATT is
no longer applicable per Apple's tracking definition.

---

### Guideline 3.1.2(c) — Required Subscription Info In-App

The hosted RevenueCat paywall surfaced on iPad in build 143 was missing
the required disclosures on every tier. We have **removed the hosted
paywall entirely** and replaced it with an in-app paywall we render
directly, where every required field is visible inside the same purchase
flow — no scrolling, no extra taps.

The new in-app paywall is at `/subscribe` (file:
`src/pages/SubscribeOnboarding.tsx`) and is shown:

- On first launch, before the user enters the main game, and
- From Shop → "View Plans" (`src/pages/ShopPage.tsx`).

What is now visible inside the purchase flow itself:

| Required field | Where it appears |
|---|---|
| **Title** of each subscription (e.g. "Dynasty Pro — Yearly") | Bold heading on each plan row |
| **Length** of each subscription ("12 months · auto-renews yearly", "Auto-renews monthly", "One-time purchase · no renewal") | Subtitle on each plan row |
| **Price** of each subscription ($14.99/year, $1.99/month, $19.99 lifetime — localised by Apple StoreKit) | Right-aligned, largest, heaviest weight on every row |
| **Per-period billing summary sentence** ("$14.99 per year. Auto-renews until cancelled.") | Centered paragraph directly above the CTA |
| **Functional link to Terms of Use (EULA)** | Apple's standard EULA — https://www.apple.com/legal/internet-services/itunes/dev/stdeula/ — footer of the paywall, opens in system browser |
| **Functional link to Privacy Policy** | https://wrexist.github.io/dynasty-manager/privacy.html — footer of the paywall, opens in system browser |
| **Restore Purchases** | Footer of the paywall, opens the Apple StoreKit restore flow |

App Store Connect metadata:

- **Privacy Policy URL** field is set to
  `https://wrexist.github.io/dynasty-manager/privacy.html`.
- **EULA**: we use Apple's standard EULA
  (`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`),
  linked from inside the paywall as "Terms of Use". No custom EULA has
  been uploaded to App Store Connect, per Apple's allowed default.

---

### Guideline 3.1.2(c) — Clarity of Billed Amount

The previous paywall promoted the free trial / per-month framing more
prominently than the billed amount. The new in-app paywall reverses
that emphasis:

- **Billed amount on each plan row** is rendered in `text-lg` (≈ 18 px),
  `font-black`, in the primary foreground color — the largest and
  heaviest pricing element on the row.
- **Free trial copy** appears only on the Monthly plan row, as a small
  `text-[10px]` (≈ 10 px) muted caption *below* the price — visibly
  subordinate in font size, weight, and color.
- **"Best Value" badge** on the Yearly plan is a small gold pill, not
  the dominant pricing element.
- **The CTA button** displays the resolved billed amount of the
  currently-selected plan (e.g. *"Continue — $14.99/year"*) so the
  amount the user will be charged appears in the call to action.
- **A plain-language billing summary** appears directly above the CTA:
  *"$14.99 per year. Auto-renews until cancelled."* — leaving no room
  for ambiguity about what will be charged and when.

A screen recording of the new paywall on iPad Air 11-inch (M3) is
attached to this message thread.

---

### Where to verify in the new build

1. Open the app. After the splash, the **Unlock Dynasty Pro** paywall
   appears with all three plans, the billed amount as the most
   prominent element, and Restore / Terms / Privacy links in the
   footer.
2. Tap **Maybe later** (or the close button) to bypass it.
3. From the main game: **Title Screen → Settings → Restore Purchases**,
   or **Shop → View Plans** to reach the same paywall.
4. Cancel anytime instructions appear under the CTA and again in
   Settings → Apple ID → Subscriptions per Apple guidelines.

Thanks again for the review.

Best,
The Dynasty Manager team
