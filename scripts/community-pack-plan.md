# Community Pack — Implementation Plan

A pack-opening / collection system that layers on top of the existing squad
engine. Players come from an FC26 dataset (separate from the FC25 squad data
already baked into `src/data/squads/*`), are sorted into tiers, packaged into
buyable packs, and — once collected — become assignable to the user's club or
usable as transfer-market pool.

Card art and pack covers already exist under `public/packs/*.webp` and
`public/player-cards/*.webp` (six tiers: bronze / silver / gold / rare /
premium / icon). Those assets define the tier vocabulary this plan uses.

---

## Goals & non-goals

**Goals**
- Reuse FC26 player data (a ~25k-row CSV) as the pool for a collection layer.
- Keep it fully offline — no network calls, no external APIs at runtime.
- Zero impact on existing save games when the feature is off. Additive only.
- Pack opening must feel fast on mobile (≤ 375px width, 60fps animation).

**Non-goals (for this plan)**
- No monetization. Pack currency is in-game credits / prestige.
- No multiplayer trading. Purely single-player collection.
- No re-skinning of the existing squad/transfer UI. New surfaces only.

---

## Architecture at a glance

```
fc26_players.csv          (raw input, not committed — user-supplied)
        │
        ▼
scripts/analyzeFC26.mjs   Phase 0 — schema + buckets report (✅ done)
        │
        ▼
scripts/fc26-report.json  column catalogue + bucket summaries
        │
        ▼
scripts/processFC26.mjs   Phase 1 — CSV → TS data files
        │
        ├──▶ src/data/communityPack/pool.ts      (all players flat, typed)
        ├──▶ src/data/communityPack/tiers.ts     (tier → ids index)
        └──▶ src/data/communityPack/meta.json    (counts, version, checksum)
                │
                ▼
src/store/slices/communityPackSlice.ts           Phase 3 — runtime state
        │
        ▼
src/pages/PackStore.tsx / PackOpen.tsx /         Phase 4 — UI surfaces
src/pages/Collection.tsx
```

The processed data is **checked into the repo** (similar to `src/data/squads/*`)
so the build is reproducible and nobody needs the raw CSV to build. Size
budget: aim for ≤ 500kb total across the three generated files, gzipped.

---

## Phase 0 — Analyze FC26 CSV ✅

Produces `scripts/fc26-report.json` containing:
- Column catalogue (headers, inferred types, non-null counts, sample values).
- OVR histogram (1-point buckets 40–99).
- Position distribution (raw FC26 positions + "GK vs outfield" split).
- League / nation top-20 lists.
- Unknown-token report for position strings that don't match any known alias.

Used by Phase 1 to validate that `translateStats`, `mapPosition`, and the
GK/outfield branch cover 100% of rows.

---

## Phase 1 — Data pipeline (`scripts/processFC26.mjs`)

Built in small turns to avoid one giant script. Each turn lands one function.

### Turn order
1. **Skeleton** — imports, constants, parser lifted verbatim from
   `importFC25.mjs`, empty function stubs. No logic yet.
2. **`mapPosition`** — FC26 position string → game `Position`. Reuse the
   `aliases` table from `importFC25.mjs` (LWB→LB, RWB→RB, CF→ST, LF→LW,
   RF→RW) and fall back to `CM`. Unknown tokens are logged to
   `fc26-unknowns.json` and counted.
3. **`translateStats`** — outfield players only. Map FC26 attribute columns
   to the 6-field game schema:
   | game field | FC26 source                                    |
   |-----------|-------------------------------------------------|
   | pace      | `PAC`                                           |
   | shooting  | `SHO`                                           |
   | passing   | `PAS`                                           |
   | defending | `DEF`                                           |
   | physical  | `PHY`                                           |
   | mental    | derived — see `deriveMental`                    |
   Values are clamped to `[1, 99]`. Missing cells default to `50`.
4. **`translateGKStats`** — goalkeepers. FC26 GK columns (`GK Diving`,
   `GK Handling`, `GK Kicking`, `GK Reflexes`, `GK Speed`, `GK Positioning`)
   collapse into the same 6-field schema so GKs share one row shape:
   | game field | GK derivation                                          |
   |-----------|---------------------------------------------------------|
   | pace      | `GK Speed`                                              |
   | shooting  | `GK Kicking`                                            |
   | passing   | `GK Kicking` (same column — GKs only distribute)        |
   | defending | mean(`GK Diving`, `GK Handling`, `GK Reflexes`)         |
   | physical  | mean(`Strength`, `Stamina`) — body columns, not GK      |
   | mental    | `GK Positioning`                                        |
   This preserves the `PlayerTemplate` shape so squad code is agnostic.
5. **`deriveMental`** — outfield mental from sub-attrs. Mirror
   `importFC25.mjs`:
   `round((Composure + Vision + Reactions) / 3)`, default 50 per missing.
6. **`applyFudge`** — tiny post-hoc balancing:
   - Strikers with `shooting < 50` get bumped to `shooting = pace - 5`
     (FC26 occasionally tags young wingers as ST with broken SHO).
   - CBs with `passing > 85` get capped at 85 (keeps distribution sane).
   - Any outfield player with `pace < 30` and `age < 24` gets `pace = 50`
     (junk data signal — bench-warmers in FC26 have zeroed stats).
   - Constants live in `scripts/fc26-fudge.json` so tuning doesn't require
     code changes.
7. **`buildPlayer`** — glue. Takes one CSV row and returns:
   ```ts
   {
     id: string;          // stable — hash of fc26_id || `${fn}-${ln}-${nat}`
     fn, ln, pos, altPos, age, nat, ovr, pot,
     pace, shooting, passing, defending, physical, mental,
     skillMoves, weakFoot, preferredFoot,
     club: string | null, league: string | null,
     tier: 'bronze' | 'silver' | 'gold' | 'rare' | 'premium' | 'icon',
   }
   ```
   `tier` is derived from OVR bands — see Phase 2.
8. **`writeOutputs`** — emit three files:
   - `src/data/communityPack/pool.ts` — `export const POOL: CommunityPlayer[]`
   - `src/data/communityPack/tiers.ts` — `export const TIERS: Record<Tier, string[]>`
     (tier → array of player IDs; avoids duplicating player data).
   - `src/data/communityPack/meta.json` — row count, OVR histogram, source
     checksum, processing timestamp, script version.
9. **`main`** — orchestration. Reads CSV, runs every row through
   `buildPlayer`, validates (no empty names, unique IDs, all positions valid),
   then calls `writeOutputs`. Prints a summary table at the end.

### Output shapes

```ts
// src/data/communityPack/types.ts (new, committed in Phase 1)
export type Tier = 'bronze' | 'silver' | 'gold' | 'rare' | 'premium' | 'icon';

export interface CommunityPlayer extends PlayerTemplate {
  id: string;
  tier: Tier;
  club: string | null;
  league: string | null;
  weakFoot?: number;
  preferredFoot?: 'Left' | 'Right';
}
```

---

## Phase 2 — Pool & tier system

### Tier assignment (OVR-banded, adjustable)

| Tier    | OVR band | Expected share | Source |
|---------|----------|----------------|--------|
| bronze  | ≤ 64     | ~55%           | OVR    |
| silver  | 65–74    | ~30%           | OVR    |
| gold    | 75–82    | ~12%           | OVR    |
| rare    | 83–87    | ~2.5%          | OVR    |
| premium | 88+      | ~0.5%          | OVR    |
| icon    | —        | curated        | `ICON_IDS` whitelist from Phase 1 |

Bands live in `src/config/communityPack.ts` (follows the
`src/config/gameBalance.ts` convention). Adjusting them does NOT require
re-running the pipeline — tier is computed at read time from the `ovr`
column in `pool.ts` via a pure function, with `icon` as an override set.

### Pack definitions (`src/config/communityPack.ts`)

```ts
export const PACKS = {
  bronze:   { cost:   5_000, count: 5,  odds: { bronze: 0.95, silver: 0.05 } },
  silver:   { cost:  25_000, count: 5,  odds: { bronze: 0.50, silver: 0.45, gold: 0.05 } },
  gold:     { cost: 100_000, count: 5,  odds: { silver: 0.40, gold: 0.55, rare: 0.05 } },
  premium:  { cost: 500_000, count: 5,  odds: { gold: 0.60, rare: 0.30, premium: 0.09, icon: 0.01 } },
  icon:     { cost: 'prestige:5', count: 1, odds: { icon: 1.0 } },
};
```

Draw algorithm:
1. For each card in the pack: roll `Math.random()` against the pack's
   `odds` cumulative distribution.
2. Sample a random player ID from `TIERS[rolledTier]`.
3. Re-roll once if the player is already owned **and** tier ≠ icon
   (bronze/silver duplicates are expected and fine — they feed a later
   "quick-sell" mechanic, out of scope for now).

All randomness goes through `src/utils/rng.ts` (existing seeded RNG) so
pack pulls are deterministic under save/replay.

---

## Phase 3 — Store slice

New file: `src/store/slices/communityPackSlice.ts`.

State shape added to `GameState`:
```ts
communityPack: {
  ownedIds: Record<string, number>;   // playerId → copies owned
  openedPacks: number;
  lastPull: { packType: PackType; playerIds: string[]; at: number } | null;
};
```

Actions:
- `openPack(packType)` — charges cost, rolls contents via the draw algorithm,
  pushes into `ownedIds`, sets `lastPull`, emits a toast + haptic. Returns the
  pulled IDs synchronously so the UI can animate them.
- `assignToSquad(playerId, clubId)` — spawns a `Player` object from the
  `CommunityPlayer` template, injects into the club's `playerIds`. One-way —
  once assigned, the card is consumed from `ownedIds`.
- `quickSell(playerId)` — refunds 20% of the tier's notional value. Stub for
  now, full implementation later.

Invariant: `ownedIds` never references a missing pool entry. A save
migration (Phase 6) prunes dangling IDs on load.

---

## Phase 4 — UI flow

Three new pages, all under `src/pages/`:

1. **`PackStore.tsx`** — grid of pack covers (one per tier). Shows cost,
   contents preview, and odds in a collapsible row. Tapping a card opens
   a confirm sheet; confirming fires `openPack()` and navigates to
   `PackOpen`.
2. **`PackOpen.tsx`** — pack-opening animation. Sequential card reveals
   with framer-motion (flip + shine). Uses `public/player-cards/<tier>.webp`
   as the card background and overlays player portrait + stats. Skip
   button compresses the sequence. Final screen lists pulls with "Add to
   collection" / "Quick-sell" buttons per card.
3. **`Collection.tsx`** — inventory browser. Filter by tier / position /
   nation / club. Sort by OVR / recently pulled. Each cell is a mini-card;
   tapping opens a detail sheet with `assignToSquad` action.

Navigation: new entry in `BottomNav` gated behind a feature flag
(`featureSlice.communityPackEnabled`). Default off. Settings page gets a
toggle to turn it on — experimental tag, save-compatible either way.

---

## Phase 5 — Squad & transfer integration

- When a card is assigned to a club, `assignToSquad` wraps the template with
  the existing player-generation path (`utils/playerGen.ts` →
  `hydratePlayerFromTemplate`) so the player gets a unique runtime ID,
  contract, wage, morale, etc. — keeping the rest of the game ignorant of
  their origin.
- Assigned players behave like any other squad member: they can be sold,
  loaned, fired, injured. Selling returns cash like normal; it does NOT
  return the card to the collection (card is consumed on assignment).
- Optional later: a "summon" toggle that makes rare+ cards reappear in the
  collection after sale. Deferred.

---

## Phase 6 — Persistence, migration, balance

- Bump save version in `utils/saveMigration.ts`. Add migration step:
  create empty `communityPack` substate on old saves, prune any
  `ownedIds` that don't exist in `POOL` (defensive).
- `communityPack.ownedIds` is serialized as a sparse object (only owned
  entries). Budget: a maxed-out collection of ~25k cards at 1 byte each
  after gzip — well under the 5MB localStorage ceiling.
- Balance knobs live in `src/config/communityPack.ts` alone. The
  `/project:balance` slash command should load this file when the scope
  is community-pack.

---

## Phase 7 — Tests (Vitest)

New file: `src/test/communityPack.test.ts`. Coverage targets:
- `tier assignment` — every OVR 40–99 lands in exactly one band.
- `openPack` — given a seeded RNG and known pool, pulls are
  reproducible and match expected odds over 10k iterations (±5%).
- `save migration` — old save without `communityPack` key loads cleanly,
  defaults applied.
- `assignToSquad` — consumes one copy, injects a hydrated player, club
  budget unchanged, no duplicate player IDs.
- `pruneDangling` — a save referencing a stale ID loads without crashing
  and surfaces a recoverable warning.

Golden-path UI is covered manually on 375px-wide mobile, with a note in
the PR body (not automated — no Playwright in the repo yet).

---

## Open questions (decide before Phase 2)

1. Where does pack currency come from? Options: match attendance revenue,
   prestige points, a new weekly "community pack voucher" drop. Default
   pick: spend the existing `budget` — simplest, no new pipe.
2. Should `altPos` carry into the collection card, or be shown only on
   assign? Default pick: carry, display on hover/tap.
3. Icon pool source — curated whitelist by hand, or OVR ≥ 90 auto?
   Default pick: manual whitelist committed in `src/data/communityPack/icons.ts`.
4. Duplicate behaviour — stack with a copies counter, or quick-sell
   immediately? Default pick: stack. Quick-sell is a tap away.

Every default is reversible — none of them block Phase 1.
