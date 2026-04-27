# Dynasty Manager — App Store Listing

> **File owner:** Marketing / Product  
> Last updated: 2026-04-27 (v1.0.5)

---

## ⚠️ CRITICAL: IP & LICENSING CHECKLIST — MUST RESOLVE BEFORE PUBLIC LAUNCH

The game currently ships with real-world trademarks and database-derived content.  
Apple will not reject the **listing** for this, but rights-holders file DMCA / trademark
takedowns once the app is publicly searchable. Several national gaming regulators also
treat loot-box mechanics as regulated gambling. Resolve every item below before submitting
for external TestFlight or public release.

| # | Risk | What to do |
|---|------|-----------|
| 1 | **Real club names** (Arsenal, Real Madrid, Juventus, etc.) | Obtain a licensing agreement from each club / national association, **or** replace all in-game club names with fictional alternatives. |
| 2 | **Real league names** (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, etc.) | Same choice: license from the commercial rights holder, or replace. The game already uses fictional domestic league names at the top level (`Monarch Premier League`, `Dynasty Championship`). Apply the same pattern to all 45 divisions. |
| 3 | **FC26 player names & ratings** | Player names are covered by FIFPro collective image rights; ratings/stats are EA IP. Using them without a data licence violates EA's Terms of Service and individual players' right of publicity in most jurisdictions. Either license from Opta / StatsBomb / FIFPro, or generate fictional players. |
| 4 | **FIFA / confederation tournament names** | "World Cup", "UEFA European Championship", "Copa América", "AFCON", "AFC Asian Cup", and "Gold Cup" are all registered marks. Use the fictional equivalents already partially present in the codebase (`Champions Cup`, etc.) or obtain licences. |
| 5 | **Loot-box gambling regulations** | Netherlands (KSA), Belgium, and South Korea classify paid randomised packs as gambling. Germany, UK, and Australia have active legislative reviews. Options: (a) display drop rates prominently before purchase (required by Apple Guideline 3.1.1 regardless), (b) remove real-money purchase from packs and keep only ad-rewarded and free opens, or (c) geo-block affected markets. |
| 6 | **Privacy Policy** | The current policy predates AdMob, RevenueCat, and Sentry integration. Rewrite to cover all three SDKs, ATT / GDPR / CCPA compliance, subscription auto-renewal language, and refund policy (see Privacy section below). |
| 7 | **Apple Guideline 3.1.1 — drop rate disclosure** | Apps with randomised virtual items purchasable with real money **must disclose item drop rates** before purchase. Add a drop-rate table to every paid pack's purchase screen. |

> **The listing copy in this file uses only generic descriptors (no real club, league, player, or tournament names) and is safe to submit as written. The in-game content IP risk above is separate from the listing text.**

---

## iOS App Store Metadata

### App Name
```
Dynasty Manager
```
*(15 characters — 30-char limit)*

---

### Subtitle
```
Build Your Football Empire
```
*(26 characters — 30-char limit)*

---

### Promotional Text
*(170-char max — editable without a new app submission, swap for seasonal campaigns)*

**Default (current):**
```
Dynasty Pro now includes a FREE 3-day trial. Unlock instant sim, advanced tactics, and ad-free play. New players only. Cancel anytime.
```
*(136 characters)*

**Seasonal alternates — swap without app update:**
- *Transfer window:* `Transfer window is open. Sign your targets before it slams shut. Dynasty Pro free trial included with every new save.`
- *Tournament season:* `Lead your nation to glory. World Championship qualifying is live. Dynasty Pro — 3-day free trial with every new game.`
- *Post-launch value:* `45+ divisions. 51 nations. Thousands of players. One manager. Start free today.`

---

### Description
*(4 000-char limit — copy below is ~3 450 characters including whitespace)*

```
Build the most powerful football dynasty on the planet.

Take charge of a struggling club buried in the lower divisions. Scout 
emerging talent, master tactical formations, survive board pressure, 
and rise from obscurity to continental glory.

━━━ MANAGE CLUBS ACROSS THE WORLD ━━━
Choose from clubs spanning 45+ divisions across 37 countries — 
top-flight European leagues, competitive South American football, Asian 
powerhouses, and beyond. Every club has a genuine squad with real player 
ratings, real wages, and a fanbase expecting results.

━━━ BUILD YOUR SQUAD ━━━
Buy, sell, and loan players through a dynamic transfer market with 
hundreds of targets. Develop talent through six specialist training 
modules. Promote youth academy prospects to your first team. Chemistry 
links connect your squad — play players in their best positions to 
unlock their full potential.

━━━ WIN ON THE PITCH ━━━
Your match engine simulates every one of 90 minutes. Adjust your 
formation mid-game, shift mentality, make tactical substitutions, and 
deliver the half-time team talk that swings the result. Choose from 
11 formations, 4 mentalities, and advanced sliders for tempo, width, 
pressing intensity, and defensive line.

━━━ COMPETE FOR EVERY TROPHY ━━━
Win your domestic league. Lift the national cup. Qualify for three-tier 
continental competition. Then lead your country through qualifying 
cycles to contest the global football championship and five continental 
tournaments — including the European, South American, African, Asian, 
and North American championships.

━━━ OPEN PLAYER PACKS ━━━
Discover your next star through a daily pack-opening system. Bronze and 
Silver packs reset every day — free to open, with extra opens via 
rewarded ads. Upgrade to Gold, Premium Gold, Rare Gold, or Icon packs 
for guaranteed elite players and cinematic walkout reveals. 
Drop rates disclosed before every purchase.

━━━ BUILD YOUR LEGACY ━━━
Unlock manager perks, earn prestige badges, stock your trophy cabinet, 
and cement your place in the Hall of Managers. An 88-question press 
conference system, weekly board objectives, and dynamic player 
storylines keep every season fresh.

━━━ DYNASTY PRO — 3-DAY FREE TRIAL ━━━
Subscribe to unlock the full experience:
• Ad-free gameplay across every mode
• One-tap instant match simulation
• Advanced per-match analytics and tactical insights
• Save up to 5 custom tactical presets
• Smart Optimize Lineup — AI-powered formation builder
• Pro-exclusive press conference responses
• Full career record book and milestones

Start free for 3 days, then £1.99/month — or own it forever with a 
one-time purchase.

━━━ FREE FOREVER ━━━
• Full league campaigns across 45+ divisions in 37 countries
• Daily free player packs (Bronze + Silver, resets midnight)
• National team management across 51 nations
• Youth academy, scouting, transfers, and staff management
• Rewarded-ad bonuses: budget boosts, academy previews, potential reveals

━━━ SUBSCRIPTIONS & IN-APP PURCHASES ━━━
Dynasty Pro Monthly: £1.99/month. Renews automatically. Cancel anytime 
in App Store Settings at least 24 hours before renewal.
Dynasty Pro (one-time): £7.99.
Dynasty Pro Lifetime: £19.99.
Player Packs: £2.99 – £9.99 per purchase (consumable).
Cosmetic Packs: £1.99 – £3.99 per purchase.
Payment charged to your Apple ID at purchase confirmation.
Manage subscriptions: App Store → Settings → Subscriptions.

Privacy Policy: [INSERT URL]
Terms of Use: [INSERT URL]
```

---

### Keywords
*(100-char limit, comma-separated, no spaces after commas — drives App Store search)*

```
football,manager,soccer,dynasty,tactics,squad,transfer,simulation,league,cup,career
```
*(85 characters)*

**Keyword rationale:**
- `football` + `manager` as separate terms avoids trademark proximity to Football Manager (SEGA) and captures both search intents independently.
- `soccer` covers US / Canadian searches (significant revenue market).
- `dynasty` is the unique brand differentiator — low competition, high brand relevance.
- `career`, `simulation`, `tactics` are high-intent sports management terms.
- Avoid `real`, `live`, `official` — Apple's algorithm penalises these in non-editorial contexts.

---

### What's New (v1.0.5)
*(Version release notes — 4 000-char limit)*

```
DYNASTY PRO FREE TRIAL

Every new Dynasty Manager save now includes a 3-day free trial of 
Dynasty Pro — no commitment required.

What Dynasty Pro unlocks during your trial:
• Ad-free play across the entire game
• One-tap instant match simulation
• Advanced per-match analytics and tactical insights
• Smart Optimize Lineup
• 5 custom tactical preset slots
• Pro-exclusive answers across all 88 press conference questions
• Full career record book

After the trial: £1.99/month, or keep it forever for a one-time price.
Cancel any time before the trial ends and you won't be charged.

Also in this update:
• Redesigned Pro onboarding that clearly explains every feature
• Inbox now shows a payment-failure warning if your subscription lapses
• Hall of Managers data validation fixed for long careers
```

---

## Age Rating

| Attribute | Selection | Notes |
|-----------|-----------|-------|
| **Recommended Apple age rating** | **9+** | |
| Simulated Gambling | Infrequent / Mild | Paid randomised pack openings with disclosed odds |
| In-App Purchases | ✓ Disclose | Required disclosure |
| Advertising Networks (AdMob) | ✓ Disclose | Rewarded video ads |
| Violence / Mature Content | None | No violent or adult content |

**⚠️ Loot-box note for specific markets:** The Netherlands (KSA), Belgium, and South Korea classify paid loot boxes as regulated gambling irrespective of age rating. A 9+ Apple rating does not satisfy those local laws. See IP checklist item #5 above.

---

## Privacy Policy — Required Updates

The existing privacy policy must be rewritten before public release to cover:

- [ ] **AdMob / Google Mobile Ads** — Advertising ID collected on Android; ATT prompt displayed on iOS 14.5+; SKAdNetwork used for privacy-preserving attribution; users can opt out via device Settings → Privacy → Tracking.
- [ ] **RevenueCat** — Purchase receipt data, subscription status, and an anonymous device ID are transmitted to RevenueCat servers for entitlement management. No PII is required.
- [ ] **Sentry** — Crash reports include device model, OS version, app version, stack traces, and breadcrumb events. Verify no user-entered text (e.g. manager name, team name) is captured in breadcrumbs before launch.
- [ ] **Subscription auto-renewal** — Apple requires this exact (or equivalent) disclosure: *"Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period."*
- [ ] **Refund policy** — Consumable IAPs (player packs) are non-refundable once opened. State this explicitly.
- [ ] **Children** — Given the 9+ rating and pack mechanics, explicitly state the app is not directed at children under 13 (COPPA / GDPR-K compliance).
- [ ] **GDPR / CCPA** — If distributing to EU or California residents: include a data deletion request mechanism and a CCPA "Do Not Sell or Share My Personal Information" opt-out link.
- [ ] **Data retention** — State how long crash logs and purchase records are retained by each third-party SDK.

---

## Screenshot Captions
*(Primary: 6.7" iPhone Pro Max. Reuse captions at 6.1" and iPad sizes.)*

| # | Screen | Headline (≤ 30 chars) | Body caption |
|---|--------|-----------------------|--------------|
| 1 | Dashboard / Club overview | **Your club. Your rules.** | Manage budgets, board confidence, and squad depth from the moment you arrive. |
| 2 | Live match engine | **90 minutes. Every decision matters.** | React in real time — change formation, shift mentality, and make the substitution that wins it. |
| 3 | Pack opening — walkout reveal | **Your next star is one pack away.** | Free daily packs. Premium drops for guaranteed elite players and cinematic reveals. |
| 4 | National Team page | **Lead your nation.** | Pick from 51 countries. Navigate qualifying and contest five continental championships plus the global tournament. |
| 5 | Tactics / Formation editor | **Build the system that wins.** | 11 formations, advanced sliders, and 5 saved custom presets (Dynasty Pro). |
| 6 | Dynasty Pro paywall / trial | **Try it free for 3 days.** | Ad-free play, instant sim, smart lineup optimizer. No commitment. Cancel any time. |

---

## App Store Connect — Technical Checklist

- [ ] App category: **Games → Sports**
- [ ] Secondary category: **Games → Simulation**
- [ ] Support URL — must resolve to a live page with a working contact method
- [ ] Privacy Policy URL — must resolve to a live, updated policy (see Privacy section above)
- [ ] All IAP product IDs registered in App Store Connect (see `src/config/monetization.ts` for full list of 13 SKUs)
- [ ] Drop rates disclosed on every paid pack purchase screen (Guideline 3.1.1)
- [ ] ATT permission string in Info.plist: *"We use your advertising ID to show relevant reward ads so you can open free packs."* ✓ already present
- [ ] `ITSAppUsesNonExemptEncryption = false` ✓ already declared
- [ ] `NSUserTrackingUsageDescription` ✓ already present
- [ ] 46 SKAdNetwork IDs registered in Info.plist ✓ already present
- [ ] Subscription group created in App Store Connect matching monthly + one-time product IDs
- [ ] Free trial duration in App Store Connect matches `FREE_TRIAL_DAYS = 3` in `src/config/monetization.ts`
- [ ] Age rating questionnaire complete — mark "Infrequent/Mild Simulated Gambling" and "Advertising Networks"

---

## Google Play Metadata

*(Adapt the iOS description above. Play Store allows 4 000 chars but has no subtitle field.)*

**Short description** *(80-char limit)*:
```
Manage clubs, open packs & lead 51 nations. Football management, reimagined.
```
*(77 characters)*

**Play-specific items to complete:**
- **Data safety form** — map AdMob, RevenueCat, and Sentry to their respective data types (Advertising ID, Purchase history, Crash logs).
- **Families policy** — explicitly exclude the under-13 audience unless additional parental-controls infrastructure is added.
- **Content rating questionnaire** — answer "yes" to simulated gambling (loot boxes); Play assigns an IARC rating automatically.
- **Financial features disclosure** — Play requires disclosure of in-app purchases on the store page; this is auto-generated if IAP products are registered.

---

## Version History Quick Reference

| Version | Date | Headline |
|---------|------|---------|
| 1.0.5 | 2026-04-27 | Dynasty Pro free 3-day trial; redesigned onboarding |
| 1.0.4 | 2026-04-26 | Real national-team squads; squad picker; FIFA-style rankings |
| 1.0.3 | 2026-04-26 | Rare Gold pack added as £6.99 IAP |
| 1.0.2 | 2026-04-26 | Daily free packs with live midnight-reset countdown |
| 1.0.1 | 2026-04-26 | Free Bronze packs with ad; Premium Gold & Icon IAPs |
| 1.0.0 | 2026-04-24 | Launch — What's New centre; Smart Optimize Lineup; review prompt |
