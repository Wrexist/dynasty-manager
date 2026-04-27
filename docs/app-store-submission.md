# App Store Submission Checklist — Dynasty Manager

This document lists everything required to submit Dynasty Manager to the Apple App Store via App Store Connect. Fill in TODO items before the submission build is uploaded.

**Bundle ID:** `com.dynastymanager`
**App name in Capacitor config:** `Dynasty Manager`
**Current version:** `1.0.0` (see `package.json`)

---

## 1. App Name, Subtitle, Description

### App Name (max 30 chars)
**Proposed:** `Dynasty Manager: Football`  (25 chars)

Alternatives under 30 chars:
- `Dynasty Manager` (15)
- `Dynasty Football Manager` (24)
- `Dynasty: Football Tycoon` (24)

### Subtitle (max 30 chars)
**Proposed:** `Build Your Football Legacy` (26 chars)

Alternatives:
- `Manage. Sign. Win Trophies.` (27)
- `Ultimate Football Management` (28)
- `Tactics, Transfers, Trophies` (28)

### Description (max 4000 chars)

```
Take charge of one of 92 football clubs across 4 divisions and build a dynasty that lasts generations. Dynasty Manager is the deepest mobile football management sim built for fans who want real tactics, real transfers, and real consequences.

KEY FEATURES

• 92 clubs across 4 divisions — from the top-flight Monarch Premier League down to the Foundation League. Start at a minnow and work your way up, or take over a giant and defend your throne.

• Promotion & relegation — automatic promotion spots, playoff finals, and the drama of relegation battles every season.

• Cup competitions — knockout tournaments alongside your league campaign.

• Tactical depth — pick from 7 formations, set lineups, captain your squad, and make in-match substitutions that swing results.

• Live match simulation — event-based, minute-by-minute engine with late drama, injuries, red cards, and upsets. Watch it play out or simulate instantly.

• Transfers & loans — scout targets, negotiate fees, send players out on loan, and respond to incoming bids during open windows.

• Squad development — young players grow toward their potential, veterans decline, and every attribute evolves week by week based on training, minutes, and form.

• Training & staff — hire coaches, physios, and scouts. Tune your weekly training schedule to target specific attributes.

• Youth academy — promote homegrown talent from your youth setup.

• Scouting — dispatch scouts to uncover hidden gems at home and abroad.

• Facilities — invest in your stadium, training ground, and youth infrastructure for long-term returns.

• Finances — balance wages, transfer budget, ticket revenue, and board expectations.

• Manager career — earn prestige, unlock perks, hit milestones, and etch your name into the Hall of Managers.

• Storylines & press conferences — face the media, manage your players' personalities, and live through unfolding narratives.

• Trophy cabinet — every cup, every league title, every award you win is remembered.

• Season end — awards ceremonies, promotion/relegation drama, contract renewals, and the start of a new chapter.

BUILT FOR MOBILE

• Dark premium UI with glass-morphism and gold accents — designed for iPhone, not ported from desktop.
• Mobile-first controls — swipe, tap, and long-press gestures throughout.
• Haptic feedback on key moments.
• Fully offline — no internet required after install.
• No ads. No pay-to-win. No microtransactions.

Whether you're a Football Manager veteran or brand new to the genre, Dynasty Manager gives you the depth you want in a package you can actually play on the train.

Start your dynasty today.
```

TODO: Trim or expand as needed before submission. Current length is well under 4000 chars.

---

## 2. Keywords (max 100 chars total, comma-separated, no spaces after commas)

**Proposed (99 chars):**
```
football,soccer,manager,tactics,transfers,league,club,tycoon,sim,sports,squad,dynasty,career,fm
```

Keyword rationale:
- Category discovery: `football`, `soccer`, `sports`, `sim`
- Genre discovery: `manager`, `tycoon`, `career`
- Feature discovery: `tactics`, `transfers`, `squad`, `league`, `club`
- Brand: `dynasty`, `fm` (common shorthand competitors search for)

Do NOT include your app name or subtitle in keywords — Apple already indexes those.

---

## 3. Category

- **Primary category:** Games
- **Primary subcategory:** Sports
- **Secondary subcategory:** Simulation

---

## 4. Age Rating Questionnaire

Fill out in App Store Connect. Expected rating: **4+** (no objectionable content).

Expected answers:
- Cartoon or Fantasy Violence: **None**
- Realistic Violence: **None**
- Prolonged Graphic or Sadistic Realistic Violence: **None**
- Profanity or Crude Humor: **None**
- Mature/Suggestive Themes: **None**
- Horror/Fear Themes: **None**
- Medical/Treatment Information: **None**
- Alcohol, Tobacco, or Drug Use or References: **None**
- Simulated Gambling: **None** (no fantasy/real money wagering)
- Sexual Content or Nudity: **None**
- Graphic Sexual Content and Nudity: **None**
- Unrestricted Web Access: **No**
- Gambling and Contests: **No**
- Contests: **No**
- User Generated Content: **No** (manager name is a single free-text field — if this counts as UGC, answer **Yes** and note it is not shared with other users)
- Messaging/Chat: **No**
- Location sharing: **No**

TODO: Confirm "manager name" text entry does not require UGC flag. If it does, expected rating stays 4+ because the name is not shared.

---

## 5. Screenshots

### Required sizes
- **6.7" iPhone** (iPhone 15 Pro Max / 14 Pro Max): 1290 × 2796 px — **REQUIRED**
- **6.5" iPhone** (iPhone 11 Pro Max / XS Max): 1242 × 2688 px — **REQUIRED**
- **6.1" iPhone** (iPhone 15 / 14): 1179 × 2556 px — optional but recommended
- **iPad Pro 12.9"** (3rd gen+): 2048 × 2732 px — only if shipping iPad build

Minimum 3 screenshots per size. Maximum 10. PNG or JPEG. No transparency.

### Screenshot shot list (10 proposed, in order)

| # | Screen | What it shows | Caption overlay |
|---|--------|---------------|-----------------|
| 1 | Dashboard | Club badge, league position, next match, inbox count, finances at a glance | "Run your club, your way" |
| 2 | Live Match | Minute-by-minute match sim with event feed and score | "Feel every minute" |
| 3 | Tactics / Lineup Editor | Formation with 11 players on a pitch, subs bench | "Outsmart every opponent" |
| 4 | Squad | Player list with ratings, positions, ages | "Build the perfect squad" |
| 5 | Transfer Market | Transfer listings with bids, fees, negotiation UI | "Sign the stars of tomorrow" |
| 6 | League Table | Full league standings with promotion/relegation zones highlighted | "Climb from the 4th tier to the top" |
| 7 | Player Detail | Attributes, form, stats, contract | "Every player matters" |
| 8 | Training | Weekly training schedule, coach assignments | "Develop future legends" |
| 9 | Trophy Cabinet | Collected trophies across seasons | "Build a lasting dynasty" |
| 10 | Season Summary | Awards, promotion celebration, stats recap | "Write your story" |

### Production notes
- Capture on a real device or simulator at the exact pixel sizes above (no scaling).
- Use a demo save file with a realistic mid-season state — avoid empty data.
- Keep caption overlays short, high-contrast gold on dark (match in-app aesthetic).
- Screenshot 1 is the "hero" and appears in search results — make it count.
- Save to `docs/app-store-assets/screenshots/6.7/` and `.../6.5/` (directories TODO — create when assets land).

---

## 6. App Icon

- **Size:** 1024 × 1024 px
- **Format:** PNG
- **Alpha channel:** **NONE** (flatten before export)
- **Rounded corners:** **NONE** (Apple applies the squircle mask automatically)
- **Transparency:** NOT allowed
- **Text:** Avoid small text — it will be illegible at 60×60 pt on home screen

### Design brief
- Central emblem: stylized crown or shield combining a football and a manager's clipboard
- Gold (`hsl(43, 96%, 46%)`) as primary accent — matches in-app brand color
- Background: deep navy (`#0f1524`) — matches splash screen and dark theme
- Simple silhouette readable at 58×58 px (smallest home-screen size)
- No UI chrome, no screenshots, no photographic textures

### Asset export list
Generate all sizes from the 1024×1024 master via `cordova-res` or Xcode's asset catalog:
- 1024 (App Store), 180 (iPhone @3x), 167 (iPad Pro), 152 (iPad @2x), 120 (iPhone @2x), 87 (Settings @3x), 80 (Spotlight @2x), 60, 58, 40, 29, 20

TODO: Commit master to `docs/app-store-assets/icon-1024.png` once designed.

---

## 7. Privacy Policy URL

**Required** by Apple even for apps that collect no data.

- **Proposed URL:** `https://dynastymanager.app/privacy` (TODO: register domain and host)
- **Fallback (if no domain):** GitHub Pages page at `https://wrexist.github.io/dynasty-manager/privacy.html`

### Privacy policy content outline
Even though Dynasty Manager is fully offline, the policy must state:
1. No personal data is collected.
2. All save data is stored locally on the user's device (`localStorage`) and never transmitted.
3. No analytics, no third-party SDKs, no advertising identifiers.
4. No user accounts, no sign-in, no cloud sync.
5. Contact email for privacy questions: `privacy@dynastymanager.app` (TODO: set up email alias).
6. Children's privacy (COPPA): No data collection from any user, including children under 13.
7. Last updated date.

### App Privacy "Nutrition Label" answers
- Data Used to Track You: **None**
- Data Linked to You: **None**
- Data Not Linked to You: **None**
- Select "Data Not Collected" on the App Privacy screen

TODO: Draft full privacy policy as `docs/privacy-policy.md` and publish.

---

## 8. Support URL

**Required** — Apple rejects submissions without a reachable support page.

- **Proposed URL:** `https://dynastymanager.app/support` (TODO: host)
- **Fallback:** GitHub Issues page at `https://github.com/Wrexist/dynasty-manager/issues`
- **Contact email:** `support@dynastymanager.app` (TODO: set up)

Support page should include:
- FAQ (save file location, how to reset progress, how to report a bug)
- Email form or mailto link
- Known issues list
- Version history

---

## 9. What's New Text (Release Notes, max 4000 chars)

### Version 1.0.0 — Initial release

```
Welcome to Dynasty Manager!

• Manage one of 92 clubs across 4 fully-featured divisions
• Live match simulation with minute-by-minute drama
• Deep transfer market with negotiations, loans, and youth scouting
• Weekly training, staff hiring, and facility upgrades
• Promotion, relegation, playoffs, and cup competitions
• Manager career with perks, prestige, and a Hall of Managers
• 100% offline. No ads. No in-app purchases.

Thank you for playing — if you enjoy the game, please leave a review. It genuinely helps.
```

For future versions, follow this template:
```
What's new in X.Y.Z:
• [User-facing improvement 1]
• [User-facing improvement 2]
• [Bug fix summary]

Full changelog: https://dynastymanager.app/changelog
```

---

## Submission readiness checklist

Before uploading the build to App Store Connect:

- [ ] App name, subtitle, description finalized (this doc)
- [ ] Keywords under 100 chars verified
- [ ] Category set to Games > Sports + Simulation
- [ ] Age rating questionnaire answered (expected 4+)
- [ ] All required screenshot sizes produced (6.7" and 6.5" minimum)
- [ ] 1024×1024 icon exported with no alpha and no rounded corners
- [ ] Privacy policy written, published, and URL working
- [ ] Support URL live
- [ ] What's New text for v1.0.0 finalized
- [ ] Bundle ID `com.dynastymanager` registered in Apple Developer portal
- [ ] Distribution certificate + provisioning profile set up
- [ ] TestFlight build uploaded via `ios-testflight.yml` workflow
- [ ] Internal TestFlight testing passed (no crashes, launches on clean device)
- [ ] Export compliance questionnaire answered: **`ITSAppUsesNonExemptEncryption` = `false` (NO)** is correct — the app does not use non-exempt encryption. Crash reporting (Sentry), purchases (RevenueCat), and ads (Google Mobile Ads) use **HTTPS over the OS TLS stack only** (no custom crypto). In-app `crypto.randomUUID()` is exempt OS API usage, not export-controlled encryption.
- [ ] Content rights confirmed (all club names, player names are fictional/generated — NO real Premier League / FIFPro licensing needed; verify no real player name ever surfaces via generation)
- [ ] Demo account info for App Review (N/A — game is single-player offline, add a note in the review info field)
- [ ] App Review notes written (explain offline nature, how to start a new save, and that the game has no login)

---

## Android (Google Play) follow-up

Not covered in this document — Play Store has its own requirements (feature graphic 1024×500, different screenshot sizes, different privacy declaration format). Create `docs/play-store-submission.md` when starting that submission.
