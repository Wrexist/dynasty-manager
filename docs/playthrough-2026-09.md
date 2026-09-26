# Real-app playthrough — 2026-09-25

Branch `wp2/playthrough` from `b0256c1`. I played the web build like a new player, in headless
Chromium (`/opt/pw-browsers/chromium`) against `vite` dev on port 8091, at **390x844, touch, `en-GB`**.
The Playwright scripts are in `/tmp/playthrough/scripts/`. Screenshots and per-run logs are in
`/tmp/playthrough/` (`<run>-NN-<label>.png`, `<run>.log`). Those paths are scratch and are not kept.

**What the harness could not do:** there were no StoreKit or Play purchases (the web build mocks them to
succeed), no safe-area insets (`env()` is 0 in Chromium), no network (flagcdn.com was blocked), and no
real app suspension. To stand in for an app kill I closed the Chromium context. Everything below marked
*device check* still needs a phone.

Environment notes, not defects:
- The worktree's `node_modules` is a symlink into the main checkout, so Vite's `fs.allow` returned 403 on
  `@fontsource` files. I used a harness-only config (`/tmp/playthrough/vite.playthrough.config.mjs`) to
  allow the path. It was never committed.
- After a source edit, Vite HMR serves modules with `?t=` stamps. A script that runs
  `import('/src/store/gameStore.ts')` then gets a fresh, empty store instance. I restarted the server
  before every store-level check.

---

## Fixed (each with a Vitest test that fails without the fix)

| # | Sev | Commit | Defect | Repro (before) | Test |
|---|---|---|---|---|---|
| F1 | **P1** | `7a07979` | **The save rolled back after a restart.** A played match vanished. | New game → Quick Start → play the Week 1 match → Skip to FT → Continue to Match Review → close the browser → relaunch → Continue. The fixture was unplayed and the Dashboard said "Match Prep vs SOU" again (`b7-01-dash-after-match.png`). IDB held the played save (4.82 MB, `full_time`). The localStorage mirror on disk held the kickoff save (4.74 MB), because the browser flushes LS lazily. TitleScreen's first render called `readSaveSlot`, which **cached the stale mirror before IDB answered**. `hydrateOneSlot` then took that as an in-session write and kept it. | `saveStorageIntegrity.test.ts` "a stale localStorage mirror read before hydration…" |
| F2 | P2 | `1ebb040` | The engine emitted "Second half underway!" at **46, 61 and 76**. | The live second half runs in `SECOND_HALF_SEGMENTS`, and every resumed segment re-emitted the kickoff and regenerated the half-time insight. The stored events had kickoffs `[0,46,61,76]` (`b6.log`). Effects: the pitch reset to kickoff shape, the momentum bar reset to 50/50, and the 61' insight read "Level at half-time". After the fix: `[0,46]`, and momentum at 61' was 28–72 (`b13-06-min61.png`). Only events are emitted differently; no random draw moves. | `matchInteractivity.test.ts` "a second half simulated in segments has exactly one restart kickoff" |
| F3 | P2 | `4c327d0` | The Inbox had no back arrow. | League Table → top-bar Inbox → only the bottom tabs were left, and the table was lost (`b12-04-inbox.png`). `'inbox'` was the one non-tab screen missing from `DETAIL_SCREENS`. | `backNavigation.test.ts` "every More-drawer screen offers a way back" |
| F4 | P1 | `86d8172` | **A free pack was spent but its players were lost after an app kill.** | Market → Packs → Open Free (Rise to Glory) → close the app → relaunch. The device record showed `daily: 1` (spent), the squad was back to 28, and `openedPacks` was 0 (`c3-01-tracker.png`: "No packs opened yet"). The pulls stayed memory-only until the next week advance. Free, ad and currency opens now call `saveGame()`. IAP is unchanged: the reconciler still flushes durably. After the fix: squad 31, 1 opened pack. | `packCreditIntegrity.test.ts` "a free open asks for a save…" |
| F5 | P2 | `1a28d54` | A new route inherited the previous page's scroll offset. | Mode Select, scrolled to reach World Cup → World Cup setup opened scrolled, with its "Modes" back button at y = −15 (`d5-01-wc-setup.png`). | `routeScrollReset.test.tsx` |
| F6 | P2 | `a449846` | World Cup setup had no `safe-area-top`, and its back button was 20 px tall. | It was the only setup page without the class. With `viewport-fit=cover` its back button sits under a notched iPhone's status bar. I checked this in code, not in Chromium (inset 0). *Device check.* | `worldCupSetupHeader.test.tsx` |
| F7 | P3 | `7921130` | The Match Prep guide said tap "Edit Lineup", but that button only exists on Squad. | First Match Prep visit (`b1-03-match-prep.png`). Match Prep swaps players by tapping on its own pitch. | `pageHintsCopy.test.ts` |
| F8 | P3 | `d5d2ff4` | The guide card's dismiss X measured **14x14** on every screen that shows a guide. | Dashboard, Match Prep, Squad, Transfers, Inbox, Packs, Manager Pass. It is now 44x44, and the layout is unchanged (`a4-01-dash-hint.png`). | `pageHintTapTarget.test.tsx` |
| F9 | P2 (web) | `239679a` | **A right swipe on the League Table left the game for the title screen.** | Chromium fired its overscroll history navigation (a browser `popstate` with no JS history call) as well as the in-game swipe back. That popped `#/game` → `#/` (`b15-01-table-after-swipes.png` before the fix). The fix is `overscroll-behavior-x: none` on `html`; Chromium ignores it on `body`, which I tried first. Capacitor's WebViews are not expected to have this gesture. *Device check* on Android and a PWA. | `overscrollHistoryGesture.test.ts` |

Residual risk in F1, not reproduced: suppose the on-disk LS snapshot catches a **pending-IDB marker**
(`dynasty-idb-pending-N`) in the ~70 ms between setting and clearing it, and the browser is then killed.
The marked, older mirror still wins over a newer IDB main. That is the designed trade-off for "the IDB
write failed". Telling the two cases apart needs ordering information: a save sequence number, or an IDB
companion stamp written in the same transaction. That would change the persisted shape, so I left it
alone.

---

## Recorded, not fixed

Reasons for not fixing are given where it isn't obvious. Each one is outside a minimal runtime fix: a
product call, a rule against editing the file, or unclear intent.

| # | Sev | Where | Finding | Repro / evidence |
|---|---|---|---|---|
| R1 | P2 | Finance vs Weekly Digest | **The money numbers disagree.** The Weekly Digest showed "Net Income −£3,091K" (W2) and about −£3.0M each week to W7. Finance showed "Weekly Income £6.7M / Expenses £4.8M, +£1.9M/week". The budget actually fell from £126.9M (W2) to £118.6M (W8) with no signings. It needs a look at the finance model: projection vs realised, home vs away gate. | `b9-02-adv1-popup1.png`, `crawl-03-finance.png` |
| R2 | P3 | Dashboard header | "Season 1 · Week 1–7 · **Pre-Season**" while league matches are being played. `getSeasonStage` returns `preSeason` for every `week <= summerEnd`. Fixing it needs an en.ts copy change, and en.ts only takes additive edits. | `a3-01-dashboard-first.png`, `b9-01-dash.png` |
| R3 | P3 | Onboarding | There are two lists titled **"Getting Started"**. The first-session list keeps "Then: play your first match" after the match is played. After the first advance it is replaced by the Coach checklist (0/7, several Claim +XP at once). A separate "Your Dashboard" guide sits above both. | `b9-01-dash.png`, `b9-04-after-adv1.png` |
| R4 | P3 | Tap targets < 44 px at 390x844 (after F8) | Top bar "Lv.1" 35x16. Starter-kit dismiss 30x30. Title "Delete save slot" 32x32. Club-select back 32x32. Mode-select back 78x36. Paywall *Restore Purchases / Terms / Privacy* **17 px tall**. Match speed chips 23 px. Key-moment "Customize tactics manually…" 23 px, "Make Substitution" 32 px, "Continue Match" 36 px. Half-time plan chips 33 px, "Fine-tune tactics" 27 px. Match Review filters 18 px. Transfer filter chips 19 px, Make Offer 32 px. Settings toggles 44x24. Shop "View all N items" 15 px. The paywall links are the most visible; they are Apple-required links on the paywall. | inventories in `a.log`, `b2.log`, `b5.log`, `b10.log`, `c3.log`, `c5.log` |
| R5 | P3 | Quick Start lineup | The first XI is out of position: Salah (RW) is in the ST slot, and Isak and Ekitiké (both ST) are on the wings. Tactics shows "~+1 overall rating potential" behind **Pro** Smart Optimize, so a free player starts with an XI the game's own optimizer beats. | `b2-01-prep-lineup.png`, `b10-04-tactics.png` |
| R6 | P3 | Post-match Tactical Debrief | When the first half had no match-up insight, the debrief shows **half-time** advice after the final whistle, e.g. "Leading — SOU may push forward, watch for counters / Protect the lead…" under a 0–4 result. `extractMatchDebrief` takes the first kickoff that has an insight. `HINT_RULES` includes second-half phrasing, so this may be intended, and it is a product call. | `b5-04-after-skip.png` |
| R7 | design | Manager Career | A rookie at Brisbane Roar / Keflavík is offered the **England** national-team job on day 1 ("impressed by your potential"). `setManagerNationality` always makes an `initial` offer in career mode. | `d2-10-error.png` |
| R8 | P3 | Career job offers | Top-flight and single-tier clubs (FCSB Liga 1, Keflavík Úrvalsdeild) list a "Promotion: £25K" bonus that can't be earned. | `d2-07-step7.png` |
| R9 | P3 | Transfer market | "**Unattached**" players (e.g. Weston Balogun, 84 LW) have an asking fee (£50.3M), "Current deal 3 yrs left" and a "~15% sell-on clause". The fee is paid to no club. The negotiation's "Budget:" figure is the budget *after* the offer (£97.2M vs £126.9M on the page). | `b11-04-after-slider-swipe-left.png` |
| R10 | P3 | Paywall / Shop price | "$24.99/year" sits next to "Works out at **US$2.08**/month": the per-month figure is formatted in the device locale with the store currency. A real device shows the same mix when the storefront and the locale differ. | `a-paywall-full.png`, `c3-shop-full.png` |
| R11 | P3 | Odds disclosure copy | The rarity labels change meaning between packs: "Silver (70–74)" in Rise to Glory, "Silver (78–79)" in World Class. The World Class blurb says "one card guaranteed 84+" while the box above says "4 cards guaranteed 84+" (bonus). This is sensitive under Guideline 3.1.1, so the owner should decide. | `c2-03-odds-daily.png`, `c2-04-odds-worldclass.png` |
| R12 | P3 | Offline flags | Nation flags come from flagcdn.com. With no network, England falls back to an emoji and every other nation card shows a blank square. | `a2-01-club-select-1.png` (France row) |
| R13 | P3 | Match log view | The Log view lists oldest first. At 61' the newest events are below the fold. | `b13-06-min61.png` |
| R14 | design | Mid-match reload | Closing or reloading during a match discards it. It replays from kickoff with a fresh simulation, so a bad first half can be re-rolled. | `b4-01-dash-resume.png` |
| R15 | P3 | Popups | A dismissed Weekly Digest or Daily Reward reappears after an app kill (the dismissal is saved only at the next autosave). After a free pack, the "Boost your squad" upsell only closes via X or Maybe later, not by tapping the backdrop. | `b10-01-load-popup1.png`, `c2-10-opening-step4.png` |
| R16 | P3 | Manager Pass | Reward names are truncated in the 2-column track ("The Tinkerm…", "Midnight …"). | `c5-manager-pass-full.png` |
| R17 | P3 | Dashboard order | An active storyline card (e.g. Youth Prodigy, 3 choices) renders **above** the Continue card and pushes it to y ≈ 650. | `b14-06-end.png` |
| R18 | P3 | Inbox volume | 67 unread after 7 weeks. | `b14.log` |
| R19 | P3 | a11y console | Radix warns "Missing `Description` or `aria-describedby`" on every More-drawer open and on the forced-substitution sheet. | `crawl.log` |
| R20 | P3 | Insight pill | The in-match tactical insight pill uses `text-[9px]`, under the 11 px type floor. | `MatchDay.tsx:1158` |

---

## What worked

- **(a) Fresh install.**
  - Title → New Game → paywall. **Continue Free** is visible top-right (153x44) and works. The web mock shows the trial.
  - Mode Select → Sandbox → Nation / League / Club.
  - **Quick Start**: "Manage Liverpool" for the device locale (England). It reached the Dashboard in about 3 s.
  - The first Dashboard has one Continue CTA ("Match Prep vs SOU"), "Needs your attention (1)", and **More collapsed**.
  - The onboarding checklist and the tour entry are present (but see R3).
- **(b) Play.**
  - Match Prep → Ready to Play → Kick Off. A free player sees **no** skip in the first half. Key moments and a forced-substitution sheet pause the clock correctly.
  - Half-time (about 80 s at Fast) offers **"Skip to FT"** with a confirmation. Post-match popup → Match Review.
  - I ran 6 more advances. The **popup cap held**: at most 2 blocking popups per advance (W2: Weekly Summary plus a comeback celebration); the others had 0–1.
  - Squad, Tactics and Transfers render.
  - The **bid slider** took a horizontal swipe as a value change (£50.3M → £29.7M). The negotiation stayed open and the sub-nav stayed on Transfers.
  - The Squad filter-chip row scrolls sideways (scrollLeft 0 → 183) without switching sub-screen.
  - The League Table has no horizontal scroller at 390 px. A right swipe now does the in-game back (F9).
  - Inbox → back → League Table → back → Dashboard (F3).
- **(c) Market.**
  - The free daily pack opens, reveals, and "Keep all" works. The odds sheet opens from every card, the streak ladder is shown, and the pity note reads "raised toward 80+".
  - The guarantee tracker updates (after F4 the opening persists).
  - Shop shows plan cards, the trial copy and a per-month price (see R10).
  - Manager Pass and Settings work. The dev build shows Redeem and the developer tools, which is expected in dev.
- **(d) Other modes.**
  - Manager Career: the 5 steps (name, nationality, age, 2 traits, job offer) → Begin Career → Dashboard.
  - Sunday League: setup → hub.
  - World Cup: setup → The Draw.
- **(e) Reload mid-career.** The title shows "Continue — Liverpool, Season 1 Week 8", and Continue restores week 8 with 14 pts. After F1 this also holds across a full browser restart.
- **Crawl.** 18 More-drawer screens plus Training, Staff, Youth and Scouting render with **no page errors** and **no horizontal overflow** at 390 px (`crawl.log`).

## Device checks still needed

1. F1: Android. Play a match, swipe-kill on Match Review, relaunch: the result must be kept. The iOS
   WKWebView LS quota means the mirror rarely holds a full save there.
2. F4: open the free daily pack, swipe-kill during the reveal, relaunch: the players must be in the squad.
3. F6: World Cup setup on a notched iPhone: the "Modes" back button must clear the status bar.
4. F9: Android WebView and an installed PWA. A horizontal swipe on a detail screen must go back in-game
   and never leave `#/game`.
5. F8: at 375 px, the enlarged guide-card hit area must not overlap a neighbouring control.
