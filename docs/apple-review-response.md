# Apple App Review Response — Guideline 2.1 (Information Needed)

> ⚠️ **Corrected 2026-09-25 — read before pasting anything below.**
> The original reply (written for the 92-fictional-club build) told App Review
> that every club, league and player was fictional, that the app used no
> real-world brands, and that its randomised packs were purely cosmetic. None
> of that is true of the current build: it ships 756 real clubs, real
> footballers' names and ratings, real-player portrait art, and paid
> randomised **player** packs that add players to the squad. Re-sending the
> old text would be a misrepresentation to Apple (Guidelines 2.3 / 5.2), which
> is an account-level risk, not just an app-level one.
>
> The sections below are rewritten to describe the current build factually.
> **Open decision for the owner:** Apple may ask for documentation of rights
> to third-party names and likenesses (Guideline 5.2.1). The developer does not
> hold such a licence today. Decide how to answer that — ideally with legal
> advice — *before* the next submission, not during it. See
> `marketing/PLAYBOOK.md` §4.

> Paste the section below into the **App Review Information → Notes** field
> in App Store Connect, and reply to the message thread with the same text.
> The screen recording goes in the message thread as a separate attachment.

---

## Reply to App Review

Hi App Review Team,

Thanks for the feedback. Please find the requested information below.

---

### 1. Screen recording

A screen recording captured on a physical **iPhone 15 Pro running iOS 18.4**
is attached to this reply. It begins with a cold launch and walks through:

- **App launch** → splash → title screen → "What's New" tile.
- **Manager creation** (no account / no login required — see §4 below).
- **Club selection** from 756 real-world clubs across 45 leagues in 37 countries.
- **Main game loop:** Dashboard → Squad → Tactics → Match Day (live
  match simulation) → Match Review → Inbox.
- **Transfers:** opening the Transfer Market, making an offer, responding
  to an incoming bid.
- **Season progression:** advancing weeks, end-of-season summary,
  promotion / relegation.
- **In-app purchases:** opening the Shop, viewing the Dynasty Pro
  subscription paywall (title / length / price / Terms of Use / Privacy
  Policy links are all visible), the cosmetic packs catalogue, and
  Restore Purchases. No purchase is completed in the recording.
- **Settings → Privacy:** analytics consent toggle (granted / denied) and
  Restore Purchases entry point.

The app has **no account registration, login, or account deletion flow**,
and **does not request any sensitive permissions** (no camera, location,
contacts, microphone, photos, or App Tracking Transparency prompt). There
is therefore nothing further to demonstrate in those categories.

---

### 2. Devices and OS tested before submission

| Device | OS |
|---|---|
| iPhone 15 Pro (physical) | iOS 18.4 |
| iPhone 13 (physical) | iOS 17.6 |
| iPhone SE 3rd gen (physical) | iOS 17.5 |
| iPad (10th gen) (physical) | iPadOS 18.3 |
| iPhone 15 Pro Simulator | iOS 18.2 |
| iPhone SE Simulator | iOS 16.4 (minimum deployment target) |

All builds distributed to internal testers via TestFlight before submission.

---

### 3. App purpose, target audience, and value

**Dynasty Manager** is an offline, single-player football (soccer) management
simulation. The player takes charge of one of 756 real-world clubs across
45 leagues and builds a multi-season "dynasty" — managing the
squad, setting tactics, simulating matches, handling transfers and loans,
developing youth players, and progressing through promotion / relegation,
cup competitions, and end-of-season awards.

- **Problem it solves:** Existing football management games on iOS are
  either watered-down ports of desktop titles or shallow tap-to-win
  freemium experiences. Dynasty Manager delivers a deep, premium
  management simulation designed mobile-first — playable in short
  sessions on a phone, with no ads and no energy timers.
- **Value provided:** A complete career-mode football experience —
  756 clubs, 45 leagues, 10 formations, an event-based minute-by-minute
  match engine, youth development, scouting, staff, finances, manager
  perks, and a Hall of Managers — entirely offline, with no required
  account.
- **Target audience:** Football fans aged 12+ who enjoy strategy and
  simulation games. Apple age rating: **9+** (mild simulated gambling
  disclosed for paid cosmetic pack openings — see §5).
- **Genre:** Sports / Simulation / Strategy.

---

### 4. Setup and access to main features

**No login or sample credentials are required.** The app is fully offline
and single-player. On first launch the user is taken straight into the
core flow:

1. **Title screen** → tap **Play**.
2. **Manager creation** → enter a manager name and choose an avatar
   (purely local — no account, no server call).
3. **Club selection** → pick any of 756 clubs across 45 leagues.
4. **Main game** lands on the **Dashboard**. Bottom navigation exposes
   the five primary screens: Dashboard, Squad, Tactics, Match Day,
   More (Transfer / Training / Staff / Scouting / Youth / Facilities /
   Finance / Inbox / Settings).
5. **To play a match:** Match Day → Pre-Match → Kick Off → watch live
   or **Simulate Instantly** (Pro feature).
6. **To progress time:** Dashboard → **Advance Week**. Match weeks
   pause for the player's fixture; non-match weeks advance immediately.
7. **In-app purchases / subscription:** Settings → Shop, or Title
   Screen → Shop. All products are listed with title, length, price,
   Terms of Use link, and Privacy Policy link.

Demo data: a fresh save is generated on first launch — no seed file
needed. Save slot is named "Default" and persisted to local storage.

---

### 5. External services, tools, and platforms

The app is offline-first. The only external services used are:

| Service | Purpose | Network use |
|---|---|---|
| **RevenueCat** (`@revenuecat/purchases-capacitor`) | Manages subscriptions and in-app purchase entitlements on top of Apple StoreKit. | HTTPS, only when the user opens the paywall, makes a purchase, or taps "Restore Purchases". |
| **Apple StoreKit** | Payment processor for all in-app purchases and subscriptions. | Standard Apple infrastructure. |
| **Sentry** (`@sentry/react`) | Crash and error reporting. Anonymous — no personal data is collected. The user is shown a consent prompt on first launch and can opt out at any time in Settings → Privacy. | HTTPS, only when a crash or error is reported and consent is granted. |
| **Google Fonts (Oswald, DM Sans)** | Typography. Fonts are bundled at build time via `@fontsource/*`; no runtime fetch. | None at runtime. |

The app does **not** use:
- Third-party authentication services (no Google / Apple / Facebook sign-in).
- Third-party data providers (all player, club, league, and fixture data
  is bundled with the app; there is no runtime data feed).
- AI services or LLM APIs.
- Advertising SDKs (no AdMob, no Meta Audience Network, no IDFA / ATT).
- Any analytics service other than Sentry's anonymous crash reports.

Club and player names refer to real-world football clubs and footballers.
Continental and international competitions use the app's own names. Player
data is bundled at build time; no third-party data service is called at
runtime.

---

### 6. Regional differences

**The app functions consistently across all regions.** There are no
geo-gated features, no regional content variations, and no
region-specific game modes. All content (clubs, leagues, players,
match commentary, UI copy) is currently in **English only**.

Pricing for in-app purchases follows Apple's standard regional price
tiers as configured in App Store Connect. The available products,
features, and gameplay are identical worldwide.

---

### 7. Regulated industry / third-party material

Dynasty Manager does not operate in a regulated industry.

- **Third-party names and likenesses.** The app uses the names of real
  football clubs and footballers, and shows portrait artwork of real
  players on player cards. Competition names are the app's own. *(See the
  open decision at the top of this file before submitting.)*
- **No gambling, betting, or wagering** on real-world outcomes, and nothing
  obtained in the app can be cashed out or traded for money.
- **Randomised paid items.** Player packs are consumable in-app purchases
  that add randomly selected players to the user's squad, and those players
  play in the simulation. Cosmetic packs (manager identity, stadium
  atmosphere) are non-consumable and do not affect the simulation.
  - Every pack shows its full drop-rate table before purchase
    (Guideline 3.1.1), generated from the same configuration the pack
    generator uses.
  - Free packs are available daily without purchase.
- **No regulated financial, medical, legal, or health content.**
- **No user-generated content** of any kind — no chat, comments,
  uploads, profiles, or social features. There is nothing to report
  or block, so a content reporting / blocking mechanism is not
  applicable (Guideline 1.2).

---

### Summary checklist (Apple's 7 items)

1. ✅ Screen recording attached (physical iPhone 15 Pro, iOS 18.4, core
   flow + IAP paywall).
2. ✅ Tested devices listed above.
3. ✅ Purpose, audience, and value provided above.
4. ✅ Setup steps — no credentials needed (offline single-player).
5. ✅ External services: RevenueCat, Apple StoreKit, Sentry. No others.
6. ✅ Consistent across regions; English only; standard Apple pricing
   tiers.
7. ✅ No regulated industry. Real club and player names and player
   portrait artwork are used (see the note at the top). Randomised paid
   player packs disclose odds before purchase.

Happy to provide additional clarification or a second recording on any
specific flow. Thanks again for the review.

Best,
The Dynasty Manager team
