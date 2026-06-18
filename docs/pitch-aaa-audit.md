# Pitch → AAA Premium — Audit & Roadmap

> Three audits (motion/camera, visual fidelity, UX/HUD) of the live merged 2.5D
> match view, plus the bugs they surfaced. Goal: make the pitch look and feel
> like a polished, premium AAA game, with user experience in focus.

## Strategic framing (read first)

The architecture is solid: a shared deterministic `MatchTimeline` feeds two
renderers (Canvas + Pixi/WebGL) through one sequencer. **Almost every upgrade
below lives in the renderer/sequencer layer** (`pitchFrame.ts`, `PitchCanvas.tsx`,
`PixiPitch.tsx`, `pitchChoreography.ts`) — so Canvas and Pixi share the wins, the
pure choreography stays untouched, and there is no save-migration risk.

Where AAA quality is actually won in a 2.5D top-down view, in order of impact:
1. **Motion physics** — weight, acceleration, follow-through. This is the single
   biggest "is it a game or a chess board" lever.
2. **Player materials** — chips currently read as flat checkers; lit/jersey tokens
   read as players.
3. **The moments** — goals, restarts, replays carry the emotion.
4. **Lighting & atmosphere** — floodlight pool, turf texture, crowd, bloom.
5. **Broadcast HUD & UX** — score bug, tap-to-inspect, onboarding, buildup.

The honest ceiling: a dot/token top-down view will never be Unreal-3D. But
**craft on the five levers above closes ~90% of the perceived gap** and keeps the
mobile/bundle/perf budget intact.

---

## 🔴 Bugs found during the audit (fix first — cheap, correctness)

1. **Penalty "D" is a full circle.** `ctx.arc(spot, 7%, 0, 2π)` draws a complete
   circle around the penalty spot (`PitchCanvas.tsx` `box()`, `PixiPitch.tsx`
   `box()`). The real arc is only the segment *outside* the 18-yard box. Football
   fans clock this instantly. Draw the partial arc.
2. **`beat.durationMs` is emitted but ignored.** The choreographer sets per-beat
   durations (`GOAL_BEAT_MS` vs `BEAT_MS`) but `advancePlayback` hardcodes the flat
   `BEAT_PLAY_MS=520` (`pitchFrame.ts`), so the match has no rhythm — patient
   build-up and explosive shots play at identical speed.
3. **`MOTION_TAU=130ms` is dead config.** Defined in `pitchChoreography.ts:101` but
   never used; player/ball easing is done entirely by `lerpFrames`'s single global
   `smoothstep`. Either wire it into a real spring (see Phase 1) or delete it.
4. **"Possession" label is actually momentum.** `MatchDay.tsx` momentum bar is
   captioned "Possession … 78% – 22%" but the value is `liveStats.lastMomentum`
   (and is called "momentum" two lines later). Either compute real possession from
   `MatchStats.homePossession` or rename the label.
5. **GK looks identical to outfielders.** Same kit colour/shape — wrong for
   football and hurts readability. Give the keeper a distinct kit.

---

## Audit 1 — Motion & camera (the biggest "feel" gap)

Root cause: motion is **discrete static targets ("beats") + one global
`smoothstep` lerp**. Players have no velocity, the ball no physics, the camera no
anticipation.

- **M1. Ball travels as a straight, symmetric ease-in-out for every kind.**
  `lerpFrames` lerps ball x/y, wrapped in `smoothstep(t)`; the only verticality is
  `liftPx = arc·sin(πt)`. A 30-yard pass and a tap-in look identical and floaty.
  → **Per-`ballMotion` easing on the ball only**: ease-out (friction roll) for
  pass/dribble/clearance, near-linear fast for shots, ease-out-back for
  cross/longball. ~15 lines, renderer-only.
- **M2. Camera trails the ball — always behind play.** Target is the ball's
  current position smoothed by `CAM_TAU=220`. → **Lead vector**: aim the camera at
  `ball + leadGain·ballVelocity` (velocity = `to.ball − from.ball`, already
  available), biased toward the attacking direction. ~6 lines.
- **M3. Players glide to targets at constant blended speed — no run cycle.** Every
  chip covers its distance in the same time; a sprinting winger and a shuffling CB
  arrive together. → **Per-player critically-damped spring carrying velocity**,
  then drive a **scale-pulse** (sprinting chip swells ~6–10%), a **squash-lean**
  along the velocity vector (chips are already ellipse-capable), and a **bob**
  scaled by speed. This is the #1 change separating "tokens" from "players".
- **M4. No slow-mo / zoom-punch / shake on goals.** The goal beat only ripples the
  net. → On the existing goal trigger: **time-scale dip** (~0.35× for ~600ms),
  **zoom punch** (fast attack/slow release past `ZOOM_GOAL`), **decaying
  screen-shake** impulse. Cheapest emotional win.
- **M5. Beat playback is metronomic.** (Same as Bug #2 — honor `durationMs`.)
- **M6. Idle sway is a per-beat sine offset keyed to `seq`, not wall-clock.** Reads
  as synchronized circular drift. → Move idle micro-motion to the renderer's
  wall-clock, vary per role, bias toward the ball's lane.
- **M7. Zoom is quantized to 3 levels** (`zoomFor`). → Continuous zoom mapped to
  ball advancement + a tighten when a carrier is highlighted.
- **M8. Ball shadow widens slightly instead of detaching on height.** → Shrink +
  offset the shadow as the ball rises (crosses/clearances finally read).

**Phase-1 headline:** M3 + M1 + M2 + M4 together. All renderer/sequencer-layer.

---

## Audit 2 — Visual fidelity (chips, turf, ball, WebGL)

- **V1. Player chips are flat filled circles.** The dominant on-screen element
  reads as checkers. → **Radial kit gradient** (top-left light → base → darker
  rim) + a **small specular dot** + a **tighter, darker contact shadow** (current
  offset/size makes them float). Highest "premium" ROI of any single change.
- **V2. No directional kit shape.** → Slight ellipse squashed along travel/facing
  (toward ball for defenders, toward goal for attackers); optional collar notch.
- **V3. Turf is flat alternating stripe fills.** → **Floodlight radial pool**
  (warm white, low alpha) at centre under the players (opposite of the vignette);
  **subtle tiling noise** at ~5% over stripes; **per-band tone variation** + a
  faint far-end darkening for depth; **line ambient-occlusion** (1px inner shadow).
- **V4. The "Stunning" WebGL tier barely differs from Canvas.** Only additive ring/
  ball glow. → Real **bloom** (`AdvancedBloomFilter`/`BlurFilter` on `glowG`), a
  **crowd/stands backdrop** behind the bylines (dark gradient + speckle reads as a
  packed stadium top-down — huge production value, low cost), optional **depth-of-
  field** blur on players far from the carrier.
- **V5. The ball is a plain white disc.** → Top-left highlight hotspot + a short
  directional motion smear when fast; pentagon hint at high zoom.
- **V6. Name plates only declutter by zoom.** Fine; consider a rating pip /
  position tag on the carrier's plate for broadcast feel.

---

## Audit 3 — The moments (emotion)

- **Mo1. Goal celebration is the weakest moment relative to its importance.**
  Currently a colour flash + ~16 straight-falling CSS confetti + spring "Goal!" +
  caption. → **Broadcast lower-third: SCORER · MINUTE · NEW SCORELINE** (pure data
  we have — highest ROI); **radial stadium-flash bloom** from the scoring end;
  **confetti bursts from centre-bottom** with gravity + club colours; **camera
  punch** synced to the flash (ties to M4).
- **Mo2. Goal replay requires a manual tap** and steps at a flat 650ms/min. Most
  users never see it. → **Auto-replay once** after the celebration (keep the manual
  re-watch button), **slow-mo the shot second**, add **letterbox bars** to read as
  broadcast.
- **Mo3. Kickoff direction cue is a plain 4.2s text pill.** → A one-time animated
  arrow sweeping the pitch (or a brief attacking-half tint).
- **Mo4. No pre-match buildup or full-time beat.** → Lineup reveal / crowd
  ambience at kickoff; a full-time result beat.

---

## Audit 4 — UX, HUD, onboarding, accessibility

- **U1. Broadcast score bug.** The score header is a detached glass panel that
  pushes the pitch down and uses crest-as-flat-colour-circle. → A compact corner
  **score bug** (clock | HOME 2-1 AWAY) overlaid on the pitch during live play;
  keep the big panel for pre/HT/FT; make crests a two-tone split disc.
- **U2. Tap-a-player to inspect.** The canvas is `aria-hidden` and non-interactive.
  → Tap → mini-card (name/pos/rating/fitness — data already in MatchDay). Premium
  feel **and** the only accessibility text path for the pitch.
- **U3. Onboarding/coach-marks.** The Pitch/Split/Log toggle, shouts, and speed-
  cycle are undocumented for first-timers. → One-time coach-mark on first match.
- **U4. Camera/zoom controls.** No pinch-zoom or tap-to-focus. → Pinch + double-tap
  to focus the carrier.
- **U5. Accessibility.** Colourblind kit-clash is handled. Remaining: (a) pitch is
  `aria-hidden` with no text equivalent (U2 helps); (b) cap the goal-flash
  luminance (brief full-screen `opacity 0.55` flash — epilepsy guard beyond
  reduced-motion); (c) momentum conveyed by colour+width only — add text.

---

## Phased roadmap (prioritised by perceived-quality-per-effort)

Each phase is independently shippable, renderer-shared (Canvas+Pixi), lazy, and
`size:check`-gated. New feel constants go in `pitchChoreography.ts`.

### Phase 1 — Motion & physics (the biggest jump) ⭐ — ✅ DONE
- ✅ M3 — per-player spring (`stepDisplay`) with inertia + velocity → swell/lean/bob.
- ✅ M1 — `ballEase()` weights the ball per motion kind (shot/pass/cross/…).
- ✅ M2 — camera leads the ball in its direction of travel.
- ✅ M4 — goal slow-mo + zoom-punch + screen-shake (decaying).
- ✅ M5/#2 — `advancePlayback` honors per-beat `durationMs` (rhythm).
- ✅ #3 — `MOTION_TAU` wired as the player spring (`PLAYER_TAU`).
- ✅ Planted contact shadows; all feel constants in config; reduced-motion safe.
- ⏭️ #1 penalty-arc geometry — deferred (radius is in width-units so it never
  reaches outside the box; needs a distance-correct, orientation-aware arc).
- ⏭️ M6/M7 (wall-clock idle sway, continuous zoom), M8 (ball shadow detach) —
  follow-ups, lower priority than the on-device tuning pass.

### Phase 2 — Materials & turf
V1 (chip gradient + specular + contact shadow), #5/V-GK (distinct keeper kit),
V3 (floodlight pool + turf noise + tone variation + line AO), V5 (ball highlight +
smear), #1 (penalty-arc correctness).

### Phase 3 — The goal moment — ✅ DONE
- ✅ Mo1 — broadcast lower-third: new scoreline (scoring side highlighted) +
  scorer + minute, stadium-flash bloom, centre-burst club-colour confetti.
- ✅ Mo2 — auto-replay once after the celebration, with letterbox bars; the
  Phase-1 goal slow-mo fires inside the replay automatically.
- ⏭️ Mo3 (kickoff arrow) — minor, deferred.

### Phase 4 — WebGL "Stunning" tier earns its name
V4 (real bloom filter + crowd/stands backdrop + optional DoF), V2 (directional
kit shape). Pixi-focused; Canvas keeps the Phase-2 look.

### Phase 5 — Broadcast HUD & interactivity — 🚧 IN PROGRESS
- ✅ U1 — **broadcast score bug**: a compact corner overlay (clock + running
  scoreline + two-tone glossy crest discs + 3-letter team codes) on the live
  pitch. The big score panel stays for pre/HT/FT in MatchDay.
- ✅ #4 — Possession→Momentum label fix (shipped separately on `pitch-hud-fixes`).
- ⏭️ U2 (tap-to-inspect mini-card) + U4 (pinch / double-tap focus) — these change
  the canvas interaction model (currently `aria-hidden`, non-interactive), so
  they ship as a separate follow-up after the score bug.

### Phase 6 — Onboarding, buildup, accessibility, perf
U3 (coach-marks), Mo4 (pre-match buildup / full-time beat), U5 (aria text, flash
luminance cap), perf pass (timeline rebuild throttle, Pixi sprite reuse, thermals).

---

## Notes
- Phase 1 is mostly *feel* — it will want on-device tuning; every magnitude lives
  in `pitchChoreography.ts` so iteration is fast.
- Phases 1–3 are the AAA core; 4–6 are premium depth.
- Engine untouched throughout; choreography only touched for the keeper kit and
  (optionally) richer off-ball runs later.
