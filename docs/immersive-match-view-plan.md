# Immersive Match View (2.5D Pitch) — Implementation Plan

> Status: **planning only, no production code yet.** A sequenced, scoped plan to
> react to — not a committed design. Today the live match is text-only:
> `MatchDay.tsx` (1,725 LOC) renders a scrolling commentary log + score header +
> momentum bar + stats. There is no on-pitch visual.

## TL;DR — what to build, and what NOT to build

**Build a 2.5D top-down animated pitch** (dots/chips + ball, light isometric tilt,
team colours, set-piece staging, goal celebrations) that plays *in sync with the
existing commentary log*, on the existing minute-tick clock. Ship it as a
**toggleable view inside MatchDay**, lazy-loaded, with the commentary log as the
always-available fallback.

**Do NOT build true polygonal 3D** (Three.js, 3D models, mocap, per-player
animation rigs). That is Football Manager / Unity territory — months of asset
work, 500 KB–2 MB+ of engine + models, GPU/battery cost on phones, and it would
shatter the eager-bundle budget. For a *management* sim the player watches for
**information and emotional beats**, not graphical fidelity. FM itself keeps a
"classic 2D pitch view" for exactly this reason. 2.5D delivers ~90% of the
immersion for ~10% of the cost and risk.

### The one hard fact that dictates everything

**The match engine produces zero spatial data and is non-deterministic.**

- `MatchEvent` is `{ minute, type, playerId, assistPlayerId, goalkeeperId,
  clubId, description, momentum?, homeXG?, awayXG?, displayMinute? }`
  (`src/types/game.ts:287`). **No x/y, no ball position, no pitch zones, no
  attacking direction.**
- The sim is a per-minute loop driven by `Math.random()`
  (`src/engine/match.ts:1022`), heavily covered by balance/longevity/adversarial
  test suites. It is the source of truth for *outcomes*.

So "render the match in 3D" is really **"synthesise a motion layer that does not
exist."** That synthesis — not the renderer — is the bulk of the work, and it is
identical whether we draw with Canvas, Pixi, or Three. **We solve the data
problem first; the pretty pixels come second.**

We do **not** modify the match engine. Adding coordinates into a 2,000-LOC,
balance-critical, randomised engine is high-risk and unnecessary. Motion is a
*pure presentation-layer derivation* computed from the already-finished event
list. This also keeps us clear of the project invariant that visual/monetization
code must never touch sim parameters.

---

## Architecture

```
Match.events[]              (fixed once the half is simulated — engine output)
      │
      ▼
MatchChoreographer          PURE, DETERMINISTIC transform (new, fully unit-tested)
  events + lineups + ──►     derives a seed from the event list, then maps each
  formations + momentum      minute/event to a "beat": ball target + 22 player
      │                      targets + event tag. No Math.random at render time.
      ▼
MatchTimeline               keyframes: [{ minute, ballPos, players[22], tag }]
      │                      runtime-only, NOT persisted (no save-migration cost)
      ▼
PitchRenderer               Canvas 2D first (zero new deps). Driven by MatchDay's
  (interpolates between ──►  EXISTING minute-tick clock + speed tiers. Eases
   beats, idle jitter)       between beats; commentary log scrolls in lockstep.
```

### Why this shape

- **Engine stays untouched** → no balance regressions, no save-schema bump
  (timeline is derived at view time, never stored, so `CURRENT_VERSION` is
  unaffected — confirm in review).
- **Determinism where it matters.** The engine stays random, but the timeline is
  a *pure function of the finished event list*, so the same match always
  animates the same way (replays, pause/scrub, key-moment re-entry are stable).
  We derive a seed by hashing the event list — no engine reseeding required.
- **Renderer is swappable.** Canvas 2D in Phase 1–3 (no bundle cost). An optional
  Pixi upgrade (Phase 4) slots in behind the same `MatchTimeline` interface as a
  lazy chunk. Three.js stays explicitly off the table.
- **Reuses the existing coordinate system.** `FORMATION_POSITIONS`
  (`src/types/game.ts:666`) already gives normalized `{x,y}` (0–100, y=5 = own
  goal, y=82 = striker) per formation. Home plays bottom→top, away is the
  mirror. Lineup view and pitch view share one coordinate space.

### The choreography model (the actual cleverness)

We do **not** simulate physics. We model the match as a sequence of **beats**,
one per minute (plus extra beats around events), and interpolate.

- **Ball flow by possession.** `momentum` (−100..+100, already on each event) +
  which club owns the next event drives the ball into the attacking third of the
  team in possession. Between events the ball drifts/hops among that team's
  players around midfield and their attacking third (cheap "keep-ball" motion).
- **Event → staged location** (semantic mapping, no coordinates needed):
  | Event | Ball target | Staging |
  |---|---|---|
  | `goal` / `header_goal` / etc. | into the net, then centre-circle restart | scorer + assister converge, net ripple, celebration beat |
  | `shot_saved` / `hit_woodwork` | shooting position → keeper / post | keeper dives to ball |
  | `free_kick_goal` | set-piece spot → net | wall forms, taker steps up |
  | `corner` (from stats) | corner flag → box | bodies crowd the 6-yard box |
  | `foul` / cards | midfield/defensive third | fouler + victim near ball, ref beat |
  | `injury` / `substitution` | play pauses near touchline | swap chips at halfway line |
  | penalties | hand off to existing `PenaltyShootout` | — |
- **Player positioning.** Anchor each of 22 at its `FORMATION_POSITIONS` slot
  (away mirrored). Shift the whole block up when attacking / compress when
  defending (driven by momentum & possession). Add small per-beat noise so dots
  "breathe." The **involved players** (scorer, assister, fouler, keeper) tween to
  the ball for their beat, then ease back.
- **Honours fields we already compute:** `momentum` (attacking-third tint / push
  direction), `homeXG/awayXG` (chance danger), `weather` (rain/snow overlay),
  `displayMinute` ("45+2"), red cards (remove a dot).

This reads as a believable, flowing match while being arithmetic over a fixed
list — no engine changes, no per-frame randomness, cheap on a phone.

---

## Phases

Each phase is independently shippable and leaves `main` green. Stop after any
phase if the value/effort stops paying off.

### Phase 0 — De-risking spike (≈0.5–1 day, throwaway)
**Goal:** prove the event→motion mapping *reads as football* before investing.
- Build a minimal `MatchChoreographer` + a throwaway `<canvas>` on a dev-only
  route, fed one canned `Match`.
- Watch 5–10 simulated fixtures. Does the ball flow look right? Do goals land?
- **Decision gate:** if the synthesis looks convincing → proceed. If not, the
  whole premise is wrong and we've spent a day, not a month.
- Output: throwaway code + a go/no-go note. Nothing merged to `main` except
  maybe the choreographer skeleton.

### Phase 1 — Spatial synthesis layer (`MatchChoreographer`)
**The hardest and most valuable phase. Pure logic, no rendering.**
- New module `src/engine/match/choreography.ts` (pure, no React, no DOM).
- New types in `src/types/game.ts` (single source of truth): `MatchTimeline`,
  `MatchBeat`, `PitchPoint`, `PlayerDot`. Runtime-only — **not** added to
  persisted state (no `saveMigration` bump).
- New config `src/config/pitchChoreography.ts` for all tunables (block-shift
  magnitudes, jitter, easing, beat durations, zone coordinates) — no hardcoded
  values in logic, per project convention.
- Deterministic seed from hashing `events` (small util) so output is stable.
- **Tests** (`src/test/`): determinism (same match → same timeline), every event
  type produces a valid beat, ball stays in `[0,100]²`, 22 dots always present
  minus red cards, no NaN, handles 0–0, high-scoring, extra time, abandoned
  edge cases. Follows existing Vitest patterns.
- Ship value: even with no renderer, this is a tested, reusable engine.

### Phase 2 — Canvas renderer + MatchDay integration
- `src/components/game/pitch/PitchCanvas.tsx` — Canvas 2D: pitch markings,
  centre circle, boxes, light iso tilt (vertical squash + perspective gradient),
  22 dots in team colours (`club.primaryColor` etc.), ball, names/numbers on
  zoom. `requestAnimationFrame` interpolation between beats.
- Hook into MatchDay's **existing** `setInterval` minute clock + `MATCH_SPEEDS`
  tiers (`config/matchSpeed.ts`) — pitch and commentary advance off the same
  cursor, so they never desync. Pause on key moments, half-time, penalties
  (hand off to `PenaltyShootout`), extra time.
- **View toggle** in MatchDay: `Pitch | Commentary | Split`, always a toggle and
  never a forced default (locked decision). Commentary is the initial default
  for a first-time user; thereafter persist the user's last choice via the
  settings/persistence helpers (new `STORAGE_KEYS` entry — no direct
  `localStorage`).
- **Lazy-load** the whole pitch subtree (`React.lazy` / dynamic `import()`) so
  the eager bundle and `size:check` budget are untouched. Verify with
  `npm run size:check`.
- Ship value: a real animated pitch, everywhere, no new deps.

### Phase 3 — Feel & polish
- Ball trail, goal celebration choreography (converge + scatter), camera
  nudge/zoom on goals & big chances, set-piece staging (wall, corner crowd),
  red-card dot removal, momentum-driven attacking-third tint, weather overlay
  (uses `Match.weather`), `xG`-scaled "danger" pulses on shots.
- **Haptics** on goals (Capacitor haptics already in the stack) + optional
  crowd-roar SFX (gate behind a sound setting; many will play muted).
- **Accessibility & perf fallback:** `prefers-reduced-motion` and a low-power
  toggle collapse the animation to a static positional snapshot + commentary
  (the renderer must degrade, never block). Cap DPR/Canvas resolution on
  low-end devices; target 60fps mid-tier, graceful 30fps floor.
- Sentry breadcrumbs around renderer init/teardown to catch device-specific
  failures; a render error must fall back to commentary, never crash MatchDay
  (wrap in an ErrorBoundary scope like the rest of the app).

### Phase 4 — OPTIONAL 2.5D upgrade (PixiJS, lazy chunk)
Only if Phases 1–3 land well and we want to push further.
- Swap the Canvas renderer for **PixiJS** (WebGL + automatic Canvas fallback,
  excellent low-end performance, ~its own lazy chunk). Same `MatchTimeline`
  interface — the choreographer doesn't change.
- Adds: textured pitch + stripes, player *chips* with kit colours/numbers,
  stronger iso tilt, crowd/stadium ambience, dynamic lighting, smoother
  sprites. **Tie into the existing "stadium atmosphere" cosmetic pack** as a
  visual upsell (cosmetic only — never touches sim, fully within invariants).
- **Bundle discipline:** Pixi loads only on MatchDay entry, manual chunk in
  `vite.config.ts` (respect its existing comments), gated by `size:check`.
- **Explicitly rejected:** Three.js / full 3D / 3D models — documented here so
  it isn't relitigated.

### Phase 5 — QA, rollout, ship
- Device matrix (old iPhone/Android via the Capacitor builds), battery/thermals
  on a long match, `preflight` green, `size:check` green.
- Ship behind a **feature flag** for safe rollback; watch crash-free rate. No
  staged-default flip needed since the pitch is a toggle, never forced.
- TestFlight per the documented workflow (manual `iOS TestFlight Deploy`); add a
  `## What's New` bullet (`type:highlight`).

---

## Cross-cutting concerns

- **Monetization:** the pitch view ships **free to everyone** as the new
  baseline match experience — gating the core view would make free users feel
  *downgraded* from today's commentary. Reserve **cosmetic** polish (stadium
  packs, kit chips, premium camera) for the existing cosmetic/Pro surfaces.
  Visualization is cosmetic and never alters outcomes, so this respects the
  "monetization must never touch sim" invariant.
- **Performance budget is the hard constraint:** eager gz hard limit ~560 KB
  (`.github/bundle-budget.json`). Everything pitch-related is lazy. `size:check`
  gates every PR.
- **No save-schema impact** expected (timeline is derived at runtime). If any
  pitch *preference* lands in persisted game state, bump `CURRENT_VERSION` +
  migration; if it lands in settings/flags storage, it doesn't.
- **Fallback is sacred:** commentary log must always work. The pitch is additive.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Synthesised motion looks fake/random | Phase 0 spike gates the whole project before real investment |
| Perf/battery on old phones | Canvas-first, lazy, DPR caps, reduced-motion fallback, 30fps floor |
| Bundle budget blown | Everything lazy-loaded; `size:check` in CI; Pixi deferred to optional Phase 4 |
| Desync between pitch and commentary | Single shared minute-cursor clock, not two timers |
| Engine instability | Engine is never touched; motion is a pure downstream derivation |
| Scope creep toward full 3D | Three.js explicitly rejected and documented here |

## Effort estimate (rough, engineering-days)

- Phase 0: 0.5–1 · Phase 1: 3–5 · Phase 2: 4–6 · Phase 3: 3–5 ·
  Phase 4 (optional): 5–8 · Phase 5: 2–3.
- **Free-tier 2.5D pitch (Phases 0–3 + 5): ~13–20 days.** Pixi upgrade adds ~5–8.

## Decisions made (locked 2026-06-15)

1. **Ambition tier — 2.5D, Canvas → optional Pixi.** Confirmed. Full 3D
   (Three.js) is rejected. Minimal-only 2D is the floor we exceed.
2. **View model — always a toggle, never forced.** `Pitch | Commentary | Split`
   persists the user's last choice; the pitch never becomes a forced default.
   This *removes* the "staged default flip" from Phase 5 — no dark-launch gate
   needed for a non-default view, though we still ship behind a feature flag for
   safe rollback and watch crash-free rate.

## Still open (product steer when we reach Phase 4)

- **Pixi/cosmetic upsell** — pursue Phase 4 + stadium-pack tie-in, or stop at
  the free Canvas pitch? Defer this call until Phases 1–3 are live and we can
  judge the Canvas version's reception.
