# Immersive Match View (2.5D Pitch) — Implementation Plan

> Status: **planning only, no production code yet.** A sequenced, scoped plan to
> react to — not a committed design. Today the live match is text-only:
> `MatchDay.tsx` (1,725 LOC) renders a scrolling commentary log + score header +
> momentum bar + stats. There is no on-pitch visual.
>
> Goal of this revision: make the match-day experience **beautiful and
> best-in-class for UX**, not just functional. Visual quality and feel are
> treated as first-class requirements, not a deferred "nice to have."

## TL;DR — what to build, and what NOT to build

**Build a beautiful 2.5D broadcast-style pitch** — an art-directed top-down/iso
view with kit-coloured player chips, a physically-arcing ball with motion trail,
stadium lighting, mowing stripes, weather, broadcast lower-thirds, and
choreographed goal celebrations — that plays *in sync with the commentary log*,
on the existing minute-tick clock. It ships as a **toggleable view inside
MatchDay** (`Pitch | Commentary | Split`), always a toggle and never forced
(locked decision), with commentary as the always-available fallback.

**Visual quality is reached in two tiers, adaptively:**
- **"Great" tier — art-directed Canvas 2D** (zero new deps, ships everywhere).
  Gradients, soft shadows, turf stripes, vignette, ball trails, particle goals,
  spring easing. This already looks premium — beautiful is **not** deferred.
- **"Stunning" tier — PixiJS / WebGL** (lazy chunk, auto-enabled on capable
  devices). Adds bloom/floodlight lighting, displacement turf, rich particles,
  crowd shimmer, depth-of-field. Same data, same choreography — just a prettier
  renderer.

**Do NOT build true polygonal 3D** (Three.js, 3D character models, mocap). That
is Football Manager / Unity territory — months of asset work, 500 KB–2 MB+ of
engine + models that would shatter the eager-bundle budget, plus GPU/battery
cost on phones. For a *management* sim the player watches for **information and
emotional beats**, not character fidelity. A craft-led 2.5D view delivers ~90%
of the immersion for ~10% of the cost and risk — and, done with this art
direction, looks gorgeous.

### The one hard fact that dictates everything

**The match engine produces zero spatial data and is non-deterministic.**

- `MatchEvent` is `{ minute, type, playerId, assistPlayerId, goalkeeperId,
  clubId, description, momentum?, homeXG?, awayXG?, displayMinute? }`
  (`src/types/game.ts:287`). **No x/y, no ball position, no pitch zones, no
  attacking direction.**
- The sim is a per-minute loop driven by `Math.random()`
  (`src/engine/match.ts:1022`), heavily covered by balance/longevity/adversarial
  test suites. It is the source of truth for *outcomes*.

So "render the match in 3D" is really **"synthesise a beautiful motion layer
that does not exist."** That synthesis — not the renderer — is the bulk of the
work, and it is identical whether we draw with Canvas, Pixi, or Three. **We solve
the data problem first; the pretty pixels sit on top of it.**

We do **not** modify the match engine. Adding coordinates into a 2,000-LOC,
balance-critical, randomised engine is high-risk and unnecessary. Motion is a
*pure presentation-layer derivation* from the already-finished event list. This
also keeps us clear of the invariant that visual/monetization code must never
touch sim parameters.

---

## Art direction — what "beautiful" means here

The match view must feel like a **premium broadcast** rendered in the app's own
design language. Concretely, it inherits the existing tokens
(`src/index.css`) so it never looks bolted-on:

- **Palette:** dark premium base (`--background 222 30% 7%`, `--card 222 25%
  11%`), **gold** accents (`--gold 43 96% 46%`) for highlights/HUD, in-game green
  (`--primary 160 84% 39%`) for positive beats, `--accent 215 60% 50%` for
  info/VAR. Team identity comes from **`club.color` + `club.secondaryColor`**
  (hex) — kits, chips, trails and goal flashes are tinted per club.
- **Typography:** Oswald (headings) for the broadcast scoreline/"GOAL" lower
  third; DM Sans (body) for captions — the fonts already self-hosted.
- **Surfaces:** HUD uses the established glass formula (`bg-card/60
  backdrop-blur-xl border border-border/50 rounded-xl`) so scoreline, minute,
  and event captions match the rest of the app. (Glass collapses to solid under
  `performanceMode`.)

### The pitch
- **Perspective:** gentle 2.5D — vertical foreshortening + a perspective gradient
  (near touchline larger/brighter, far touchline smaller/dimmer) reads as depth
  without a 3D camera. Subtle, not a gimmick.
- **Turf:** mowing **stripes**, penalty arcs, centre circle, accurate line
  weights, a faint procedural noise for texture, darkened corners (vignette).
  Turf tone + wetness shift with **`Match.weather`** and **`PitchCondition`**
  (`clear/rain/snow/wind`, `excellent…waterlogged`).
- **Lighting:** stadium **rim light** + a soft floodlight bloom; day/night/weather
  palettes. (Bloom is real in the WebGL tier; faked with gradients in Canvas.)

### The players
- **Not flat dots — kit chips:** rounded chips in club kit colours, jersey number,
  a soft **drop shadow** for grounding, and a directional "lean" when sprinting.
- **Ball-carrier** wears a **gold glow ring** so the eye always knows where the
  action is. Off-ball players show subtle idle "breathing" so the pitch is never
  static.
- **Roster awareness:** anchored at their `FORMATION_POSITIONS` slot, coloured by
  role tone consistent with the app's rating colours (>=80 emerald, etc. — reuse
  `PITCH_COLORS`/rating palette where it fits).

### The ball
- **Physical arc:** shots and crosses follow a **parabola** with a height shadow
  on the turf; passes are flat, fast hops; clearances loft. A **motion-blur
  trail** in the possessing team's colour. Spin/curve on free kicks.

### The moments (this is where immersion is won or lost)
- **Goal:** ball ripples the net → **screen flash** in scorer's club colour →
  **particle burst** (confetti/spark) → scorer sprints, teammates converge →
  brief **slow-mo** beat → broadcast **"GOAL" lower-third** (Oswald, gold) with
  scorer + assist → crowd brightness pulse → `hapticSuccess`. ~2.5s, skippable.
- **Near miss / big chance:** camera nudge-zoom, danger pulse scaled by `xG`,
  crowd "ooh".
- **Cards/fouls:** ref beat, card flash, momentum tick.
- **Momentum:** the team in control gets a faint **attacking-third tint** and the
  whole block pushes up — momentum is *shown on the pitch*, not just a bar.

### Camera & motion feel
- **Broadcast follow-cam:** smoothly tracks the ball with intentional lag and
  ease (never snaps), subtle parallax, gentle zoom-in on box entries and goals,
  zoom-out at restarts. All motion uses **spring/eased curves with anticipation &
  overshoot** — the difference between "cheap" and "expensive" is entirely in the
  easing.

---

## UX & match-day flow

The pitch must *absorb* everything MatchDay already does and lose none of the
information the commentary gives. Full match arc, choreographed:

1. **Pre-match:** teams "walk out" / formation reveal (chips slide into slots),
   crest + kit colours, weather establishing shot. Sets the stage; skippable.
2. **Kickoff → live play:** continuous fluid motion (see possession sub-beats
   below). Commentary scrolls in lockstep; the **active event caption** also
   appears as a broadcast lower-third on the pitch so pitch-only users get the
   same narrative.
3. **Interactive systems stay first-class on the pitch:**
   - **Key-moment decisions** (goal conceded, injury, red card, comeback): the
     pitch **dims + slow-pulses**, the glass decision card rises — drama, not a
     modal interrupt.
   - **Substitutions:** chips swap at the halfway line with an up/down arrow
     flourish (mirrors `SubstitutionSheet`).
   - **Team talks / tactical shouts:** a brief banner + a visible shift in the
     block's shape (push up on "PUSH FORWARD", compress on "HOLD THE LINE").
   - **Penalties:** hand off to the existing `PenaltyShootout` component, themed
     to match.
4. **Half-time:** pitch eases into a **tactical-board** look (top-down, static)
   behind the existing formation/team-talk UI — continuity, not a context switch.
5. **Full-time:** celebration or dejection beat sized to the result; final
   broadcast card.
6. **Goal replays (key UX/marketing win):** after each goal, a **"⟲ Replay"**
   chip re-plays that goal's choreography. Because the timeline is deterministic,
   replays are free. This doubles as **shareable/marketing footage** and dovetails
   with the dormant `CinematicCapturePage` and the `marketing/` kit.

### Controls & legibility
- **View toggle** `Pitch | Commentary | Split` — frictionless, persists last
  choice (settings/persistence helper, new `STORAGE_KEYS` entry; **no direct
  `localStorage`**). First-time default = Commentary; a one-time subtle coach-mark
  introduces the pitch.
- **Tap a player** → name/stat tooltip; **pinch/double-tap** → zoom. Speed tiers
  (`MATCH_SPEEDS`) drive playback; at **Turbo/Instant** the pitch gracefully
  **summarises** (key beats only, no per-frame churn) rather than stuttering.
- **Mobile-first**: designed at 375px; HUD never crowds the pitch; safe-area
  aware.

### Accessibility & inclusivity
- **Colourblind safety:** when two clubs' kits clash, auto-apply a pattern/shade
  differentiator + a "you are home/away" anchor; never rely on hue alone.
- **`reducedMotion` / `performanceMode`:** both already exist
  (`settings.reducedMotion`, `settings.performanceMode`, `App.tsx:43`). They
  collapse the view to a **static positional snapshot + lower-third captions** —
  the renderer must *degrade*, never block or crash.
- **Captions always available** so the pitch is never less informative than the
  log.

### Audio (new, opt-in) — a major immersion lever
- Crowd ambience that **swells with momentum**, goal roar, whistle, near-miss
  "ooh". Audio is **off by default**, behind a **new sound setting** (most play
  muted; respect that). Small, compressed, lazily loaded; never blocks render.
  *Note: no audio setting exists today — adding one touches `settings` shape;
  decide whether it lives in persisted game state (→ `saveMigration` bump) or in
  flags storage (→ no bump). Prefer flags/settings storage to avoid a schema
  bump.*

---

## Architecture

```
Match.events[]              (fixed once the half is simulated — engine output)
      │
      ▼
MatchChoreographer          PURE, DETERMINISTIC transform (new, fully unit-tested)
  events + lineups + ──►     derives a seed from the event list, then maps the
  formations + momentum      match to a stream of BEATS and SUB-BEATS, each with
  + weather/pitch            position targets AND motion curves (pass/dribble/
      │                      shot/cross/clearance, arc, speed, easing).
      ▼
MatchTimeline               keyframes + transitions: ball + 22 players + event
      │                      tags + camera hints. Runtime-only, NOT persisted.
      ▼
PitchRenderer (tiered)      Canvas 2D ("Great") or Pixi/WebGL ("Stunning"),
  interpolates beats, ──►    auto-selected by device capability. Driven by
  applies art direction,     MatchDay's EXISTING minute-tick clock + speed tiers.
  camera, particles          Commentary scrolls off the same cursor → no desync.
```

### Why this shape
- **Engine untouched** → no balance regressions, no save-schema bump (timeline is
  derived at view time, never stored — confirm in review).
- **Determinism where it matters.** Engine stays random; the timeline is a *pure
  function of the finished event list* (seed = hash of events), so the same match
  always animates identically — replays, pause/scrub, key-moment re-entry are all
  stable. No engine reseeding.
- **Renderer is swappable behind one interface.** Canvas and Pixi consume the
  same `MatchTimeline`. Three.js stays explicitly off the table.
- **Reuses the existing coordinate system.** `FORMATION_POSITIONS`
  (`src/types/game.ts:666`) gives normalized `{x,y}` (0–100, y=5 = own goal,
  y=82 = striker) per formation. Home plays bottom→top, away mirrored. Lineup
  view and pitch view share one coordinate space.

### The choreography model — fluid, not "dots waiting"
We do **not** simulate physics. We model the match as a sequence of **beats**
(one per event) connected by **possession sub-beats** so motion is *always*
flowing:

- **Possession sub-beats** fill the gaps between events: the team in possession
  (from `momentum` sign + next event owner) strings short passes/dribbles among
  its players, drifting toward the attacking third. The pitch is never static.
- **Motion curves, not just targets.** Each transition carries a *type* (pass /
  dribble / shot / cross / clearance / long-ball), an **arc height**, a
  **duration**, and an **easing** — so the renderer produces *beautiful*
  interpolation (a lofted cross looks different from a daisy-cutter) rather than
  flat lerps.
- **Event → staged location** (semantic, no coordinates needed):
  | Event | Ball motion | Staging |
  |---|---|---|
  | `goal` / `header_goal` / `solo_goal` … | drive into net → centre-circle restart | scorer + assister converge, net ripple, celebration |
  | `shot_saved` / `hit_woodwork` | arc to keeper / post | keeper dives to ball |
  | `free_kick_goal` | curling set-piece → net | wall forms, taker steps up |
  | corners (from stats) | flag → crowded box | bodies crowd the 6-yard box |
  | `foul` / cards | midfield/def third | fouler + victim near ball, ref beat |
  | `injury` / `substitution` | play pauses near touchline | chip swap at halfway |
  | penalties | → existing `PenaltyShootout` | — |
- **Player positioning.** Anchor each of 22 at its `FORMATION_POSITIONS` slot
  (away mirrored). The whole block shifts up when attacking / compresses when
  defending (momentum + possession). Small per-beat noise = "breathing." Involved
  players tween to the ball, then ease back. Red cards remove a chip.
- **Camera hints** are emitted per beat (follow target, zoom level) so the
  renderer's broadcast cam is data-driven and deterministic.

This reads as a believable, *flowing* match while being arithmetic over a fixed
list — no engine changes, no per-frame randomness, cheap on a phone.

### Adaptive quality (how "beautiful" stays smooth)
A capability probe (WebGL availability, DPR, rough device class) plus the user's
`performanceMode`/`reducedMotion` selects a tier at runtime:

| Tier | Renderer | Effects | Target |
|---|---|---|---|
| **Ultra** | Pixi/WebGL | bloom, lighting, rich particles, DoF, crowd shimmer | capable devices, 60fps |
| **High** | Canvas 2D | gradients, shadows, stripes, trails, particle goals | mid-tier, 60fps |
| **Balanced** | Canvas 2D | core motion, lighter particles, capped DPR | older devices, ~45fps |
| **Battery / Reduced** | Canvas 2D | static snapshot + captions, minimal motion | `performanceMode`/`reducedMotion`, low draw |

Any render error → automatic fall-back one tier down, ultimately to the
commentary log. The pitch is **additive and never load-bearing**.

---

## Phases

Each phase is independently shippable and leaves `main` green. Stop after any
phase if value/effort stops paying off. **Visual quality is front-loaded** — the
Canvas "High" tier already looks premium in Phase 2/3; Pixi is a ceiling-raiser,
not the only path to beautiful.

### Phase 0 — De-risking spike (≈0.5–1 day, throwaway)
Prove the event→motion mapping *reads as football* before investing. Minimal
`MatchChoreographer` + throwaway `<canvas>` on a dev route, one canned `Match`.
Watch 5–10 fixtures. **Go/no-go gate.** Output: a note + maybe the choreographer
skeleton. Nothing committed to `main` beyond that.

### Phase 1 — Spatial synthesis layer (`MatchChoreographer`)
The hardest, most valuable phase. Pure logic, no rendering.
- `src/engine/match/choreography.ts` — pure, no React/DOM.
- New types in `src/types/game.ts` (single source of truth): `MatchTimeline`,
  `MatchBeat`, `SubBeat`, `MotionTransition`, `PitchPoint`, `PlayerDot`,
  `CameraHint`. Runtime-only — **not** persisted (no `saveMigration` bump).
- `src/config/pitchChoreography.ts` for all tunables (block-shift, jitter,
  easing, arc heights, beat durations, zone coordinates) — no hardcoded values.
- Deterministic seed (hash of `events`).
- **Tests** (`src/test/`): determinism; every event type → valid beat; ball &
  players stay in `[0,100]²`; 22 chips minus red cards; no NaN; 0–0,
  high-scoring, extra time, abandoned edge cases. Existing Vitest patterns.

### Phase 2 — Canvas renderer ("High" tier) + MatchDay integration
- `src/components/game/pitch/PitchCanvas.tsx` — art-directed Canvas 2D per the
  art-direction section: 2.5D perspective, mowing stripes, vignette, kit chips
  with shadows + numbers, gold ball-carrier ring, parabolic ball + trail,
  broadcast follow-cam, `requestAnimationFrame` interpolation.
- Hook into MatchDay's **existing** minute clock + `MATCH_SPEEDS` (single shared
  cursor → pitch and commentary never desync). Pause on key moments, half-time,
  penalties (handoff), extra time.
- **View toggle** `Pitch | Commentary | Split` (always a toggle, never forced).
  Persist choice via persistence helper + new `STORAGE_KEYS` entry.
- **Lazy-load** the whole pitch subtree (`React.lazy` / dynamic `import()`);
  verify `npm run size:check` budget untouched.
- ErrorBoundary scope around the renderer; failure → commentary fallback.

### Phase 3 — Feel, moments & polish (gets us to "beautiful")
- Goal celebration choreography (converge/scatter, slow-mo, lower-third,
  particle burst, club-colour screen flash), camera nudge-zoom on chances,
  set-piece staging (wall, corner crowd), red-card removal, momentum
  attacking-third tint, weather/pitch overlays, `xG`-scaled danger pulses.
- **Goal replays** ("⟲ Replay" chip) — free given determinism.
- **Haptics** (`hapticSuccess`/`hapticHeavy` on goals — already in stack).
- **Audio** (opt-in, new sound setting; crowd swell + goal roar; lazy, muted by
  default).
- Adaptive-quality tiers (High/Balanced/Battery) + `reducedMotion`/`performanceMode`
  static fallback. DPR caps; 30fps floor. Sentry breadcrumbs around init/teardown.
- Pre-match walkout, half-time tactical-board transition, full-time beat.

### Phase 4 — "Stunning" tier: PixiJS / WebGL (lazy chunk)
Raises the ceiling on capable devices; choreographer unchanged (same
`MatchTimeline`).
- Pixi (WebGL + automatic Canvas fallback): floodlight bloom, displacement turf,
  dynamic lighting, rich GPU particles, crowd shimmer, depth-of-field, smoother
  sprites/kit chips.
- **Cosmetic upsell hook:** tie premium stadiums/atmosphere to the existing
  **"stadium atmosphere" cosmetic pack** and optional premium camera/celebration
  cosmetics — **cosmetic only, never touches sim** (within invariants).
- **Bundle discipline:** Pixi loads only on MatchDay entry; manual chunk in
  `vite.config.ts` (respect its comments); gated by `size:check`.
- **Explicitly rejected:** Three.js / full 3D / 3D character models — documented
  so it isn't relitigated.

### Phase 5 — QA, rollout, ship
- Device matrix (old iPhone/Android via Capacitor builds), battery/thermals on a
  long match, `preflight` green, `size:check` green, crash-free monitoring.
- Ship behind a **feature flag** for safe rollback (no staged-default flip needed
  — the pitch is a toggle, never forced).
- TestFlight per the documented manual workflow; add a `## What's New` bullet
  (`type:highlight`).

---

## Cross-cutting concerns

- **Monetization:** the core pitch view ships **free to everyone** as the new
  baseline — gating it would make free users feel *downgraded* from today's
  commentary. Reserve **cosmetic** polish (stadium packs, premium camera, kit/
  celebration cosmetics) for the existing cosmetic/Pro surfaces. Visualization is
  cosmetic and never alters outcomes → respects "monetization must never touch
  sim."
- **Performance budget is the hard constraint:** eager gz hard limit ~560 KB
  (`.github/bundle-budget.json`). Everything pitch-related is lazy; `size:check`
  gates every PR; Pixi deferred to Phase 4 as its own chunk.
- **Save-schema:** the timeline is runtime-derived → no bump. The **only** risk
  is the new **audio/pitch settings** — keep them in flags/settings storage to
  avoid a `CURRENT_VERSION` bump; if any pitch preference lands in *persisted game
  state*, bump `CURRENT_VERSION` + add a migration step.
- **Fallback is sacred:** commentary log always works; the pitch is additive and
  degrades gracefully under every failure/perf path.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Synthesised motion looks fake/random | Phase 0 spike gates the project; motion *curves* + possession sub-beats sell fluidity; easing is the quality lever |
| "Beautiful" not actually achieved on Canvas | Art-direction section is concrete and tied to real tokens; High tier ships premium before Pixi; design review each phase |
| Perf/battery on old phones | Adaptive tiers, Canvas-first, lazy, DPR caps, reduced-motion/perf static fallback, 30fps floor |
| Bundle budget blown | Everything lazy; `size:check` in CI; Pixi isolated to Phase 4 chunk |
| Pitch/commentary desync | Single shared minute-cursor clock, not two timers |
| Engine instability | Engine never touched; motion is a pure downstream derivation |
| New audio/settings forces a save migration | Keep settings in flags storage; bump + migrate only if persisted-state shape changes |
| Scope creep toward full 3D | Three.js explicitly rejected and documented |

## Effort estimate (rough, engineering-days)

- Phase 0: 0.5–1 · Phase 1: 3–5 · Phase 2: 5–7 · Phase 3: 5–8 (art/feel
  polish costs more, intentionally) · Phase 4 (Pixi): 5–8 · Phase 5: 2–3.
- **Free beautiful 2.5D pitch (Phases 0–3 + 5): ~16–24 days.** Pixi "Stunning"
  tier adds ~5–8.

---

## Build status

- ✅ **Phase 1 — `MatchChoreographer`** (`src/engine/match/choreography.ts`,
  `src/config/pitchChoreography.ts`, types in `game.ts`). Pure, deterministic,
  id-seeded; 8 tests.
- ✅ **Phase 2 — Canvas pitch view**. Pure frame core
  (`src/engine/match/pitchFrame.ts`, 10 tests) + `PitchCanvas`/`PitchView`
  (`src/components/game/pitch/`) wired into `MatchDay` behind a persisted
  `Pitch | Split | Log` toggle. Lazy-loaded, ErrorBoundary-wrapped, honours
  reduced-motion/perf. Eager bundle unchanged (494.7 kB gz).
- ✅ **Phase 3 (feel & moments).** Broadcast follow-cam with eased zoom,
  parabolic ball arcs + planted shadow, possession-coloured ball trail (3a);
  goal celebration (flash + confetti + GOAL! lower-third) with success haptics,
  and rain/snow weather ambience (3b); adaptive quality tiers
  (high/balanced/battery, auto-detected) + kit-clash legibility (3c). All
  collapse under reduced-motion/perf. `latestGoalAt` + `resolvePitchQuality`
  covered by tests.
- ⛔ **Phase 4 (Pixi "Stunning" tier) — BLOCKED on a decision.** Adding PixiJS
  is a new npm dependency (~its own lazy chunk); per project rules deps must be
  discussed before adding. Needs explicit go-ahead + a bundle-budget check.
- ⛔ **Audio — BLOCKED.** Needs a new sound setting (settings-shape change →
  decide flags-storage vs `CURRENT_VERSION` bump) and compressed crowd/whistle
  assets we don't yet have.
- ⏭️ **Optional remaining polish (no deps):** pre-match walkout / half-time
  tactical board / full-time beat (needs MatchDay phase wiring + a visual pass);
  continuous beat-sequencer playback so intra-minute set-piece sub-beats surface
  (changes timing semantics — best validated visually).

> **Recommendation:** the free Canvas pitch (Phases 1–3) is shippable and is the
> right point to get real eyes on it before investing in Pixi or audio. Run
> `npm run dev`, watch a match on the Pitch tab, and feed visual notes back.

## Decisions made (locked 2026-06-15)

1. **Ambition tier — 2.5D, Canvas ("Great/High") → optional Pixi/WebGL
   ("Stunning").** Confirmed. Full 3D (Three.js) rejected.
2. **View model — always a toggle, never forced.** `Pitch | Commentary | Split`
   persists last choice; pitch never becomes a forced default. No dark-launch
   default-flip; still ships behind a feature flag for safe rollback.
3. **Visual quality is a first-class requirement** (this revision) — beautiful is
   delivered in the free Canvas tier, not deferred to Pixi.

## Still open (product steer when we reach Phase 4)

- **Pixi/cosmetic upsell** — pursue Phase 4 + stadium-pack tie-in and premium
  camera/celebration cosmetics, or stop at the free Canvas pitch? Defer until
  Phases 1–3 are live and we can judge the Canvas version's reception.
- **Audio scope** — ship crowd ambience + goal roar in Phase 3, or treat audio as
  its own later slice? (Leaning: minimal crowd + goal roar in Phase 3, opt-in.)
