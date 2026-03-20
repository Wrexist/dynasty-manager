# LEARNINGS.md — Dynasty Manager

> **This file is maintained by Claude.** After completing any task, Claude should update this file with discoveries, gotchas, and patterns learned. This prevents repeating mistakes and builds project knowledge over time.

## Architecture Gotchas
- `gameStore.ts` is a Zustand store with ~600 lines. All state mutations happen here. If you need to change game behavior, this is where to look first.
- The store uses `set()` with spread — always spread nested objects before modifying or you'll mutate state.
- `advanceWeek()` is the most complex action — it handles training, AI matches, injuries, income, messages, offers, and transfer window logic all in one call.

## Type System Notes
- TypeScript strict mode is OFF. `noImplicitAny: false`. This means TS won't catch missing types, so be extra careful.
- All game types are centralized in `src/types/game.ts`. Don't create type files elsewhere.
- `FormationType` is a union literal — adding a new formation requires updating both the type and `FORMATION_POSITIONS` map.
- `POSITION_COMPATIBILITY` determines which players can fill which formation slots.

## Styling Patterns
- The app is dark-only. All colors use HSL CSS variables. Never hardcode colors.
- `GlassPanel` component is the standard container. Don't recreate its styles manually.
- Rating display: overall ≥80 = emerald, ≥70 = gold/primary, ≥60 = amber, <60 = muted.
- Mobile layout: `max-w-lg mx-auto` wraps everything. Top bar is 56px, bottom nav is 64px.

## Common Mistakes to Avoid
- Don't forget `filter(Boolean)` after mapping playerIds to players — some IDs may reference deleted players.
- `club.lineup` and `club.subs` are string arrays of player IDs, not Player objects.
- Match results need to be reflected in BOTH the fixtures array AND individual player stats (goals, assists, etc.).
- When selling a player, must update: seller club playerIds/lineup/subs/wageBill/budget, buyer club same, player's clubId, AND remove from transferMarket.

## Performance Notes
- The store has ~20 clubs × ~20 players each = ~400 player objects. Spread operations are fine at this scale.
- `buildLeagueTable()` iterates all played fixtures on every call. Currently fast but would need optimization at scale.
- Framer Motion AnimatePresence on page transitions — keep animation durations short (0.2s).

## File-Specific Notes
_Add entries here as you discover things:_

<!-- Example:
### src/engine/match.ts
- The `eventChance` increases after minute 85 to simulate late drama
- Home advantage is a flat 1.08x multiplier on team strength
-->
