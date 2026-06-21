# 🏆 The World Cup Update — Plan

> A focused plan to make **World Cup mode** the headline of Dynasty Manager: Football,
> ride the real-world **World Cup** hype, and convert that attention into installs,
> retention, and revenue. The World Cup is the single biggest moment in football —
> this update makes Dynasty Manager *the* game to play when the World Cup is on.

App Store id `6760918006` · current World Cup mode: standalone tournament, live
matches, penalties, results. This plan builds on that foundation.

---

## 1. Why now — the World Cup window

- **The World Cup is the most-searched football topic on the planet** during the
  tournament. ASO + paid traffic for "world cup", "world cup game", "world cup
  manager" spike massively and stay cheap-ish vs. evergreen "football manager".
- We already ship a **complete, playable World Cup mode** — we don't need to build
  the feature, we need to **deepen it and market it hard** under the World Cup banner.
- A themed **"World Cup Update"** gives us an App Store feature-pitch, a fresh
  set of World Cup screenshots, and a reason for lapsed players to reopen.

**Thesis:** every surface — store listing, screenshots, onboarding, push — leads
with **World Cup**. Make the World Cup the front door.

---

## 2. Product roadmap — deepen World Cup mode

Phased so each phase ships on its own and is independently valuable.

### Phase 1 — World Cup polish & identity (fast follow)
- **World Cup intro sequence** — a short branded "Road to the World Cup" splash
  when you start World Cup mode (trophy, your nation's flag, the bracket forming).
- **World Cup trophy lift** — a proper champion celebration screen (confetti,
  the World Cup trophy, your captain lifting it) on winning the Final.
- **World Cup wall / record book** — track every World Cup you've won, your best
  finish, top scorers — a permanent "World Cup honours" page.
- **Nation prestige** — small flourishes (anthem moment pre-Final, host-nation
  flavour) that make each World Cup run feel like *the* World Cup.

### Phase 2 — Replayability & depth
- **World Cup difficulty / seeds** — choose an underdog nation for a hard World
  Cup run, or a favourite for a front-runner story.
- **Golden Boot & World Cup awards** — Player of the Tournament, Golden Boot,
  Young Player — awarded on the World Cup results screen.
- **Group draw ceremony** — a quick, tappable World Cup group draw reveal.
- **Knockout bracket view** — a polished, swipeable World Cup bracket you can
  watch fill in round by round.

### Phase 3 — Live-ops & seasonal World Cup
- **World Cup Festival event** (the live-event system already exists) — a timed
  "World Cup" event with a point/reward track that recurs every real tournament
  and every in-game World Cup season.
- **Daily World Cup challenge** — "win today's World Cup fixture as [nation]" for
  a streak reward.
- **Shareable World Cup result card** — auto-generate a branded "I won the World
  Cup with [nation]!" image to share (organic UA loop).

> Guardrail: World Cup mode must stay a clean standalone experience — no
> club-economy bleed, mobile-first, 375px-safe. Monetization never touches the
> World Cup simulation.

---

## 3. Marketing & ASO — lead with "World Cup"

### App Store listing
- **Title/subtitle:** work "World Cup" into the subtitle, e.g.
  *"Football Manager — World Cup, Leagues & Cups."*
- **Keywords:** world cup, world cup game, world cup manager, world cup 2026,
  national team, international football, manage your country, world cup soccer.
- **Screenshots:** lead with the new **World Cup App Store set**
  (`marketing/world-cup/appstore/`) — "The World Cup Is Here", "Live World Cup
  Matches", "Win the World Cup".
- **What's New / promo text:** headline the **"World Cup Update"** every refresh.

### Social & paid (kit already built)
- Use `marketing/world-cup/` posters + captions — World-Cup-heavy headlines,
  hashtags (`#WorldCup #WorldCup2026`), and a launch-week post sequence.
- **Paid angle:** "Win the World Cup" / "Your country needs you" creatives —
  cheap, high-intent traffic during the tournament window.
- **Organic loop:** the shareable World Cup result card (Phase 3) turns wins
  into free reach.

### Timing
- Align the **"World Cup Update"** TestFlight → App Store push with the real
  World Cup news cycle (qualifiers, draw, kickoff) for free attention.

---

## 4. Release sequence

| Step | What | Channel |
|------|------|---------|
| 0 | Ship current World Cup mode + pitch-realism polish | (done — on `main`) |
| 1 | **World Cup Update v1**: Phase 1 polish + new App Store screenshots + listing refresh | App Store |
| 2 | **World Cup Update v2**: Phase 2 depth (awards, bracket, draw) | App Store |
| 3 | **World Cup Festival**: Phase 3 live-ops, recurring around real World Cup dates | Live-ops |

Each step: build → `iOS TestFlight Deploy` → verify on device → submit. Remember
**merging ≠ shipping** — the TestFlight/App Store build is the gate.

---

## 5. Success metrics

- **Acquisition:** installs + impression→install rate on "world cup" keywords.
- **Activation:** % of new users who start a **World Cup** within session 1.
- **Retention:** D1/D7 for users who played World Cup mode vs. who didn't.
- **Virality:** shares of the World Cup result card → installs.
- **Revenue:** Pro conversion among World Cup-mode players (instant-sim,
  analytics) — without ever touching the World Cup simulation itself.

---

## 6. Assets in this repo

- **App Store screenshots:** `marketing/world-cup/appstore/` (1290×2796, 3 panels).
- **Social/ad creatives + copy:** `marketing/world-cup/` (`LAUNCH-KIT.md`, posters).
- **In-game source screenshots:** `marketing/world-cup/screens/`.
- **Regenerate:** `node marketing/world-cup/build-appstore.mjs` /
  `node marketing/world-cup/build.mjs`.

**Bottom line:** we already have the World Cup. This plan makes every player —
and every App Store visitor — *feel* the World Cup, and gives us a recurring,
on-brand reason to push the **World Cup Update** every time the world is watching.
