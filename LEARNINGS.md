# LEARNINGS.md — Dynasty Manager

> **This file is maintained by Claude.** After completing any task, Claude should update this file with discoveries, gotchas, and patterns learned. This prevents repeating mistakes and builds project knowledge over time.

## Architecture Gotchas
- `gameStore.ts` is a Zustand store with ~750 lines. All state mutations happen here. If you need to change game behavior, this is where to look first.
- The store uses `set()` with spread — always spread nested objects before modifying or you'll mutate state.
- `advanceWeek()` is the most complex action — it handles training, AI matches, injuries, income, messages, offers, and transfer window logic all in one call.
- `advanceWeek()` resets `matchSubsUsed` to 0 at the end of the action.
- There are 20 clubs in the league (not 24). All defined in `src/data/league.ts`.
- `getSuffix()` helper is duplicated in `gameStore.ts`, `Dashboard.tsx`, and `SeasonSummary.tsx`.
- `pick()` and `clamp()` helpers are duplicated across `gameStore.ts`, `playerGen.ts`, and `match.ts`.

## Type System Notes
- TypeScript strict mode is OFF. `noImplicitAny: false`. This means TS won't catch missing types, so be extra careful.
- All game types are centralized in `src/types/game.ts`. Don't create type files elsewhere.
- `FormationType` is a union literal — adding a new formation requires updating both the type and `FORMATION_POSITIONS` map.
- `POSITION_COMPATIBILITY` determines which players can fill which formation slots.
- `SportType` is defined in `game.ts` but never used anywhere in the codebase — it was a placeholder for multi-sport support.

## Styling Patterns
- The app is dark-only. All colors use HSL CSS variables. Never hardcode colors.
- `GlassPanel` component is the standard container. Don't recreate its styles manually.
- Rating display: overall ≥80 = emerald, ≥70 = gold/primary, ≥60 = amber, <60 = muted.
- Mobile layout: `max-w-lg mx-auto` wraps everything. Top bar is 56px, bottom nav is 64px.
- Club colors are the only place where inline `style={{ backgroundColor }}` is acceptable.

## Common Mistakes to Avoid
- Don't forget `filter(Boolean)` after mapping playerIds to players — some IDs may reference deleted players.
- `club.lineup` and `club.subs` are string arrays of player IDs, not Player objects.
- Match results need to be reflected in BOTH the fixtures array AND individual player stats (goals, assists, etc.).
- When selling a player, must update: seller club playerIds/lineup/subs/wageBill/budget, buyer club same, player's clubId, AND remove from transferMarket.

## Performance Notes
- The store has 20 clubs × ~20 players each = ~400 player objects. Spread operations are fine at this scale.
- `generateFixtures()` creates 380 matches (20 teams × 19 opponents × 2 = 380).
- `buildLeagueTable()` iterates all played fixtures on every call. Currently fast but would need optimization at scale.
- Framer Motion AnimatePresence on page transitions — keep animation durations short (0.2s).

## File-Specific Notes

### src/engine/match.ts
- `eventChance` increases after minute 85 (0.18 → 0.26) to simulate late drama.
- Home advantage is a flat 1.08x multiplier on team strength.
- Corners are purely random (1-8 range), not based on match flow.

### src/store/gameStore.ts
- Player match is handled separately via `playCurrentMatch()`, not inside `advanceWeek()`.
- Weekly income formula: `fanBase * 50000 + reputation * 200000`.
- Transfer window open during weeks 1-8 and 20-24.
- Messages capped at 80 via `addMsg()` helper.

### src/App.tsx
- Wraps entire app in `QueryClientProvider` despite zero queries existing. Harmless but dead weight.

### src/App.css (DELETED)
- Was a dead file, never imported anywhere. Removed during Lovable cleanup.

### src/pages/Index.tsx (DELETED)
- Was a dead file, not referenced in any route. Removed during Lovable cleanup.
