# World Cup Mode — implementation plan

> Standalone game mode: pick a nation, the whole game is one World Cup —
> group stage → knockout → champion or eliminated. Plus festival depth
> (match-play points + nation theming). Chosen scope: **interactive matches**.

## Verified architecture (from real code, not assumptions)
- **The international engine is fully reusable & club-decoupled** —
  `generateTournament`, `processGroupWeek`, `generateKnockoutBracket`,
  `processKnockoutRound`, `generateNationalTeamPool`, `autoSelectNationalSquad`
  (`utils/international.ts`) need only nation names + a player pool.
- **The game loop already drives the whole tournament** —
  `advanceInternationalWeekImpl` (`weekAdvance.ts:100+`) runs group → knockout →
  completion when `seasonPhase === 'international'`. Its no-tournament reset
  guard (line 103) only fires when the tournament is *missing*, so a correctly
  booted World Cup passes straight through to the squad picker.
- **Two seams couple it to club mode:** international matches are **auto-simmed**
  (no interactive MatchDay), and **completion rolls into a club season**
  (`weekAdvance.ts:445` → `runPostSeasonTail`).
- **Chrome assumes a club** — `TopBar` shows "Loading…" with no club; `BottomNav`
  shows club tabs.
- **No save migration** — `gameMode: 'world-cup'` is a flag on existing fields
  (`nationalTeam` / `internationalTournament` / `managerNationality`).

## Phases (each independently shippable & tested)

- [x] **Phase 1 — Core boot.** `GameMode += 'world-cup'`; `startWorldCup(nation)`
      reuses `resetGame` (clean slate) + `initNationalTeam` + `generateTournament`,
      lands on `national-squad-picker`, `seasonPhase: 'international'`. Tested
      (`worldCupMode.test.ts`, 4 tests). **DONE.**
- [ ] **Phase 2 — Entry UI.** A "World Cup" card in `ModeSelect`; a
      `/world-cup` nation-select page (reuse `FlagIcon` + nation list) →
      `startWorldCup(nation)` → `navigate('/game')`.
- [ ] **Phase 3 — Chrome guards.** `gameMode === 'world-cup'` branches in
      `TopBar` (nation crest + tournament round instead of club/league),
      `BottomNav`/`GameShell` (minimal nav: Squad picker · Tournament), and
      `validateGameState` (skip club/league invariants). Makes the
      squad-picker → tournament loop usable end-to-end (auto-sim baseline).
- [ ] **Phase 4 — Completion + end screen.** Guard `weekAdvance.ts:445`: in
      world-cup mode route to a new `world-cup-result` screen (champion /
      eliminated-in-round, tournament recap) instead of rolling into a club
      season. After elimination, fast-forward the AI bracket to crown a champion
      for the recap.
- [ ] **Phase 5 — Interactive matches (the chosen vision).** Route the player's
      group/knockout fixture through MatchDay (live pitch, subs, team talks)
      instead of auto-sim. Sub-steps:
  - [x] **5a — Team construction (foundation).** `utils/internationalMatch.ts`
        `buildInternationalMatchTeams` builds both nations as match-ready Clubs
        (player nation from the confirmed squad; opponent generated via the
        national pool), mirroring `createEphemeralClub`. Tested
        (`internationalMatch.test.ts`, 3 tests). **DONE.**
  - [ ] **5b — Match setup + MatchDay route.** In `advanceInternationalWeekImpl`,
        when the player has a fixture this week, stop auto-simming: merge the two
        clubs + opponent players into state, replicate the `playCurrentMatchImpl`
        setup (`simulateMatch` → `currentMatchResult` + `matchPhase` +
        `preMatchSnapshot` + `lastMatchCompetition: 'World Cup'`), route to the
        `match` screen. Stash the fixture id + opponent + isHome for 5c.
  - [ ] **5c — Result → tournament.** On MatchDay finish, apply the live score to
        the tournament fixture (mark played, rebuild group tables / advance the
        knockout tie), record caps + international goals, AI-sim the rest of the
        week, then return to the tournament screen. This replaces the auto-sim
        result path for the player's match only.
  > 5b/5c are a deep integration through the match orchestration (the most
  > fragile code) + a new result-application tail. Build with tests at each step;
  > keep the auto-sim path as the fallback for AI matches.
- [ ] **Phase 6 — Festival depth.** (a) Match-play points — a guarded hook so
      wins during the event window grant Festival Points (not just check-in).
      (b) Nation theming — `FlagIcon`/nation colours + a World Cup motif in the
      Festival hub so it reads as a real tournament event.

## Top risks / landmines
1. **Chrome crashes on empty club** (`TopBar`, `BottomNav`, `validateGameState`)
   → Phase 3 guards are mandatory before the mode is user-visible.
2. **Completion rolling into a phantom club season** → Phase 4 guard.
3. **Interactive international MatchDay is net-new wiring** → Phase 5 is the
   biggest single piece; keep the auto-sim path as a fallback.
