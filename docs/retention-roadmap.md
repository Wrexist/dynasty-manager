# Dynasty Manager — Retention & "Next Big Thing" Roadmap

> Status: **strategy + checklist, no code yet.** Drafted 2026-06-19.
> Grounded in the current codebase (app v1.0.13, save schema v71) and
> competitor research (June 2026). Companion to `docs/online-mode-plan.md`
> and `docs/immersive-match-view-plan.md`.

---

## 0. Strategic thesis (read first)

**Be the anti-FM26.** Football Manager 26 is shedding players faster than any
FM since 2016 (concurrent players ~51k within a month of launch). The recurring
complaints: *win the treble and nothing changes*, repetitive press conferences,
no consequences to in-game events, and a season eats a week of real life.

Dynasty Manager's wedge:
1. **Respect the player's time** — a season should be completable in sittings,
   not a second job. Lean into instant-sim, smart defaults, and a tight weekly loop.
2. **Make consequences and identity stick** — the difference between "I played a
   football game" and "I built a dynasty" is whether the world remembers what you
   did. This is the single biggest retention lever and the one rivals fumble.

Every bet below ladders up to one of those two.

### Hard constraints (from `docs/online-mode-plan.md`)
- **No backend.** Anything social (clans, shared leagues, global leaderboards,
  server live-ops) requires Supabase + Sign-in-with-Apple first. Tiered as
  "backend-gated" below.
- **Match engine is non-deterministic** (`Math.random()` throughout `match.ts`),
  which blocks shared/competitive leagues until resolved server-side.
- **Monetization invariants** (`CLAUDE.md`): monetization must NEVER touch sim
  parameters. All retention monetization stays cosmetic / convenience / content.
- **Offline-first**: a "live event" for us is a **client-side scheduled** event
  (date-driven content already shipped in the binary or fetched as static JSON),
  not a server push.

---

## 1. Competitor intelligence (condensed)

| Game | Core retention engine | Portable offline? |
|---|---|---|
| Top Eleven | 28-day seasons, Battle Pass, Associations (clans), weekend tournaments, free 3D mini-games, seasonal Super League | Battle pass ✅ · season cadence ✅ · clans ❌ |
| EA FC / FIFA Mobile | Live-events calendar (daily refresh / evergreen / seasonal), Squad Building Challenges, season pass, real-world tie-ins (2026 World Cup event) | Local event calendar ✅ · pack/squad objectives ✅ |
| OSM | ~10-week seasons then reset, friend leagues, async, in-game chat | Short "sprint season" mode ✅ · social ❌ |
| FM26 (cautionary tale) | Deep sim, but hollow payoff + time sink → churn | Lesson: endgame must *mean* something |
| Hades / roguelites | Persistent meta-progression across runs + narrative; ~70% of roguelike revenue is meta-progression-driven | **Career as meta-progression** — your biggest untapped idea ✅ |

**Retention benchmarks to instrument against (2025 data):**
D1 ~26–35% (iOS ~35%), D7 ~10–12%, D30 ~4–5% (iOS ~5%). The first 60 seconds
and the D7→D30 content cadence decide survival.

---

## 2. The retention funnel — map every feature to a stage

### D0–D1: First session (target D1 ≥ 32%)
The first 60 seconds decide tomorrow. Current onboarding exists
(`OnboardingChecklist`, `onboardingReward`) but the first win is too far away.

- [ ] **60-second first win**: pre-pick a strong, recognisable club for a fast
      "quick start" so a new player wins/plays a match inside the first session
      (full club selection still one tap away).
- [ ] **First match within the first session, guaranteed** — never let onboarding
      strand a player on menus before they've seen a live match.
- [ ] **Onboarding payoff visible**: surface the onboarding reward + "next step"
      card on the Dashboard until the checklist is complete.
- [ ] **Push-notification opt-in framed as value** ("get notified before your next
      match / transfer window"), asked *after* the first win, not on launch.

### D1–D7: Habit formation (target D7 ≥ 11%)
**This is the biggest current gap — there is no daily return loop.** Weekly
objectives exist; there is no daily reason to open the app.

- [ ] **Daily login / return streak** (client-side, persisted via
      `persistence.ts` `getFlag`/`setFlag`, no backend). Escalating cosmetic +
      pack-currency rewards; streak freeze item as a Pro perk.
- [ ] **Daily Challenge** (single bite-size scenario from a rotating local pool,
      built on the existing `challenges.ts` / `challengeSlice` infra). "Score from
      a corner in the 90th minute", "win 2–0 with a back three", etc.
- [ ] **Push notifications for time-sensitive hooks**: match day, transfer window
      opening (weeks 1–8 / 20–24), contract expiring, cup final, streak-about-to-break.
      (Capacitor local notifications — no server needed.)
- [ ] **"Continue where you left off"** one-tap resume on launch straight into the
      pending decision (lineup, offer, board ask).

### D7–D30: Depth & investment (target D30 ≥ 5%)
Players who survive a week stay for the long arc. This is where the
**consequences thesis** lives.

- [ ] **Season Pass / "Manager Pass"** (free + Pro track) running across a real
      season — cosmetic rewards, pack currency, badges. Top Eleven's single
      strongest retention device, and fully cosmetic so it respects the sim
      invariant.
- [ ] **Local Live-Event calendar**: date-driven themed events shipped in the
      binary (e.g. "World Cup Festival" June–July 2026, "Deadline Day", "Winter
      Cup"). Each is a bounded challenge set with cosmetic rewards. Static JSON
      means new events can ship as app updates without a backend.
- [ ] **Rivalry & consequence system**: rival managers/clubs that *remember*
      results, talk trash in press, and escalate over seasons (build on
      `storylineChains.ts`, `pressConferences.ts`, `aiManager.ts`).
- [ ] **Living club history / "Dynasty Wall"**: a permanent, beautiful record of
      trophies, record signings, legends, rivalries-won, per save. The antidote to
      "nothing changed." (`historical_records` is already a Pro feature — deepen it.)

### D30–D90+: Mastery & replay (the dynasty payoff)
- [ ] **Career-as-meta-progression (the headline bet — see §4).**
- [ ] **New-game-plus / prestige**: starting a fresh save carries cosmetic
      unlocks, manager perks (TalentTree), and Hall-of-Managers entries forward.
- [ ] **Achievements/milestones with teeth**: long-horizon goals (win all 6
      continental trophies, take a tier-4 club to a continental title) that span
      many seasons and unlock cosmetics + Dynasty Wall entries.

---

## 3. The "remake / DLC / expansion" candidates (ranked)

These are the big content drops players would perceive as a new chapter. Ranked
by **(retention impact × timeliness) ÷ effort**, and tagged by backend need.

### Tier A — ship-now, client-only, highest leverage
1. **Career Legacy update ("Dynasty mode" proper)** — turn the disconnected save
   files into one persistent managerial career with cross-save meta-progression.
   *This is the headline. See §4.*
2. **2026 World Cup / International Festival** *(timeliness is NOW — June–July
   2026)* — a themed international tournament event built on the existing
   `nationalTeamSlice` / `InternationalTournament` / `nations.ts`. Real-world tie-in
   is exactly what FC Mobile is doing this summer. **Highest urgency: the window
   closes in ~6 weeks.**
3. **Season Pass + Daily loop + Live-event calendar** (§2) — the live-ops spine.
   Cosmetic-only, no backend, directly lifts D7/D30.

### Tier B — meaningful content, moderate effort, client-only
4. **Create-a-Club / Custom Club editor** — name, colours, badge, stadium, starting
   tier. Massive replay + identity driver; UGC-style retention without a server.
   (Respect `clubTemplateAliases.ts` and the generated-data rules.)
5. **Women's football** — FM26's flagship 2026 feature and a genuine audience
   expansion. Large data effort (rosters), but rides the World Cup-year narrative.
6. **Immersive Match View** — already planned (`docs/immersive-match-view-plan.md`).
   Better match-day = better D1/D7 because the match is the core loop.
7. **Manager RPG depth** — deeper `ManagerCreation`, personality traits that affect
   press/board/players, manager reputation arc. Directly answers FM26's "no
   personalities" complaint.

### Tier C — backend-gated (do `docs/online-mode-plan.md` first)
8. **Cloud Save + Accounts** — foundational, useful even with zero multiplayer;
   also a retention/trust feature (never lose your dynasty).
9. **Async Online Leagues** (friends, invite code) — social retention, but blocked
   on the determinism problem (server-side sim).
10. **Global / friends leaderboards + async Head-to-Head challenges.**

> **Recommendation:** lock Tier A for the next two releases. Slot the **World Cup
> event first** because its window is open *now*. Treat Tier C as a separate
> quarter-scale project, sequenced via the existing online-mode plan.

---

## 4. The headline bet: Career as meta-progression ("Dynasty Legacy")

The roguelite insight (Hades, Slay the Spire, Rogue Legacy) is that **persistent
progression across runs** is the strongest retention mechanic in single-player
games — ~70% of roguelike revenue rides on it. Football management is *already*
a run-based loop (a save = a run). You're leaving the meta layer on the table.

**Concept:** a persistent **Manager Profile** that sits above all saves and
remembers everything you've ever achieved:
- Lifetime trophies, clubs managed, legends developed, rivalries won.
- **Manager Level / Prestige** that unlocks cosmetic identity (badges, kits,
  stadium atmospheres — tie into existing cosmetic packs) and TalentTree perks.
- **Hall of Managers** as the permanent trophy room across every save.
- New saves start with your accumulated reputation affecting job offers and
  board expectations (career-mode flavour, **not** sim balance — stay inside the
  monetization/sim invariant: reputation gates *job access*, not match outcomes).

**Why it wins:** it makes *every* season matter even after you've "won
everything", directly fixing the FM26 hollow-endgame problem, and it gives a
reason to start save #2, #3, #4 — which is where lifetime value compounds.

**Save-schema note:** Manager Profile is a *new top-level persisted object*, not
inside a save slot. Requires a `CURRENT_VERSION` bump in `saveMigration.ts` + a
migration step, and a new `STORAGE_KEY`.

---

## 5. Monetization-safe retention (no sim impact, ever)

All of this respects the §0 invariant — nothing here touches match/training/
transfer math.

- [ ] **Manager Pass** (Pro track) — cosmetic + convenience rewards across a season.
- [ ] **Streak freeze / streak insurance** as a Pro convenience perk.
- [ ] **Cosmetic event packs** tied to live events (World Cup kit/badge sets).
- [ ] **Dynasty Wall themes** as cosmetic unlocks.
- [ ] Keep consumable player packs exactly as-is (never entitlements, per invariant).
- [ ] **Re-engagement offer** (Starter-Kit-style) for lapsed players on return —
      cosmetic/pack-currency, time-boxed.

---

## 6. New thinking / contrarian bets

- **Time-respect as a marketing pillar.** Literally advertise "a full season in an
  evening" against FM26's week-long seasons. The instant-sim Pro feature
  (`config/matchSpeed.ts`) is the product proof.
- **The world remembers you.** Lean the entire narrative system into persistence:
  newspapers that reference your history, players who cite you as the manager who
  signed them, rivals with multi-season memory. This is cheap (text/data) and is
  exactly what rivals fail at.
- **Bite-size dailies over grind.** Don't copy FIFA's grind-heavy event treadmill;
  ship *short* dailies that fit a commute. Matches your time-respect positioning.
- **Generative narrative (cautious).** Storyline/press text is a candidate for
  on-device or build-time generation to fight repetition — but only if it stays
  offline-safe and doesn't bloat the eager bundle. Investigate, don't commit.
- **AI-assisted balance & content tooling** (internal): use the existing balance
  report tests + `/balance` workflow to keep difficulty fresh across updates.

---

## 7. Instrumentation (do this alongside, not after)

You have Sentry + consent-gated analytics (`utils/analytics.ts`,
`AnalyticsConsentModal`). You can't improve retention you don't measure.

- [ ] Define and log the funnel: install → first match → D1/D7/D30 return →
      season completed → save #2 started.
- [ ] Event: onboarding-step completion + drop-off point.
- [ ] Event: daily streak length distribution.
- [ ] Event: season-pass / live-event engagement rate.
- [ ] Event: "nothing-changed" proxy — sessions per save after first trophy.
- [ ] Dashboard these so each release can be judged against D1/D7/D30 deltas.

---

## 8. Suggested sequencing (next 3 releases)

| Release | Theme | Contents | Backend? |
|---|---|---|---|
| **v1.1 — "Live & Daily"** | The live-ops spine | Daily streak + Daily Challenge + push notifications + local Live-event calendar + **World Cup Festival event** (ship before mid-July) | No |
| **v1.2 — "Dynasty Legacy"** | Meta-progression | Manager Profile + Hall of Managers + Dynasty Wall + Manager Pass + prestige/NG+ | No (schema bump) |
| **v1.3 — "Identity"** | Replay & expansion | Create-a-Club editor + deeper Manager RPG + Immersive Match View | No |
| **(parallel track)** | Online foundation | Cloud Save + Accounts → Async Leagues (per `online-mode-plan.md`) | **Yes** |

> **The one urgent call:** the 2026 World Cup window is open right now. The
> International Festival event is the single highest timeliness-weighted item and
> should be pulled forward into v1.1 even if the rest of the daily loop slips.

---

## 9. Risks & what each bet could break

- **Daily loop / streaks**: persistence edge cases (timezone, clock change,
  offline). Test against `persistence.ts` + add migration. Don't punish offline
  players harshly (you're offline-first).
- **Season/Manager Pass**: must not leak into sim balance; cosmetic only. App
  Store review risk if framed as pay-to-win — keep it clearly cosmetic/convenience.
- **Career meta-progression**: schema migration risk — top-level object, needs
  `CURRENT_VERSION` bump + backfill for existing players' history (or accept
  "starts now").
- **World Cup event**: timeliness pressure → don't cut corners on the existing
  national-team flows; reuse `InternationalTournament`, don't fork it.
- **Women's football / Create-a-Club**: large data + bundle-size risk; must stay
  behind dynamic `import()` (`size:check` guard) like community-pack data.
- **Online**: the determinism blocker is real and non-negotiable — server-side
  sim or no shared leagues. Don't promise multiplayer before that's solved.

---

## Sources
- FM26 player-count decline: frvr.com/blog, Steam community, soccergaming.com
- Top Eleven seasons/battle pass/associations: Nordeus app listings, supercheats guide
- FC/FIFA Mobile live events & SBCs: ea.com, fifplay.com, fifamobileguide.com
- OSM seasons/social: GameBasics app listings, osmtactic.com
- FM26 Mobile features (women's football, international): footballmanager.com, si.com
- Retention benchmarks (D1/D7/D30): businessofapps.com, mistplay, nudgenow, GameAnalytics 2025
- Roguelite meta-progression revenue share & examples: market reports, Hades/Slay the Spire/Rogue Legacy
