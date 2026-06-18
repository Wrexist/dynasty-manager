# 2.5D Match View — Full Audit & Roadmap

> Audit of the entire pitch-visualization stack and its integration, as of the
> `pitch-positional-play` branch (positional-play model + 1x≈5min speed). Grounded
> in the code, with file references. Severity tags: 🔴 bug/wrong · 🟠 unfinished ·
> 🟡 realism gap · 🔵 UX/graphics · ⚙️ perf/robustness · 🧪 testing/housekeeping.

## Surface area
```
src/engine/match/choreography.ts   ← positional-play synthesis (the brain)
src/engine/match/pitchFrame.ts     ← sequencer (advance/sample/seek), lerp, latestGoal
src/config/pitchChoreography.ts    ← all feel/positional constants
src/config/matchSpeed.ts           ← speed ladder (1x≈5min)
src/components/game/pitch/
  PitchCanvas.tsx                  ← Canvas renderer (portrait + landscape)
  PixiPitch.tsx                    ← WebGL "Stunning" tier (portrait only)
  PitchView.tsx                    ← orchestrator: timeline, overlays, replay, cue
  GoalCelebration.tsx · WeatherOverlay.tsx · ReplayOverlay.tsx
src/pages/MatchDay.tsx             ← toggle, clock, tactics/players wiring
src/types/game.ts                  ← MatchTimeline/MatchBeat/ChoreoPlayer/PitchQuality
```

---

## Part 1 — Bugs / wrong / unfinished

1. 🟠 **Pitch only renders during live play.** `PitchView` is mounted only inside
   the `isLive` block in `MatchDay`. Pre-match, **half-time**, extra-time break,
   **penalties**, and post-match show no pitch even in Pitch mode — a hard cut to
   text UI. Half-time especially wants a static tactical board.
2. 🟠 **Penalty shootout isn't on the pitch.** Handed entirely to
   `PenaltyShootout`; no taker/keeper/run-up staging.
3. 🔴/🟡 **Possession is binary by momentum sign.** Filler minutes give the ball to
   whoever has `momentum >= 0` (`choreography.ts` filler branch), so one team can
   "own" the pitch for long stretches even at 50/50 possession. The engine already
   computes real `homePossession`/`awayPossession` (`game.ts:356`) — unused. Real
   matches alternate; this doesn't.
4. 🟡 **Ball teleports on turnovers.** When possession flips between
   filler/events the ball jumps across the pitch in one eased transition — no
   tackle/interception beat. Reads as a cut, not a turnover.
5. 🟠 **Corners never staged.** The engine tracks corner *counts* in stats but emits
   no corner events with minutes, so corners are invisible. Same for throw-ins and
   goal kicks.
6. 🟡 **Mid-match AI tactical changes ignored.** `homeTactics`/`awayTactics` are
   resolved once and frozen; `ai_tactical_change` events don't reshape the block
   (`choreography.ts` has no handler). A side that switches to all-out attack looks
   identical.
7. 🟡 **Set pieces are minimal.** Free kicks render as a plain shot beat — no wall,
   no taker run-up, no spot kick staging for penalties.
8. 🔵 **`showOverallOnPitch` setting ignored.** A real setting
   (`game.ts:850`, toggled in `SettingsPage.tsx:327`) drives OVR badges on the
   *lineup* pitch but the match pitch shows only shirt numbers — inconsistent;
   players may expect OVR here too.
9. 🟡 **No post-goal centre restart.** After a goal's strike beat, the next beat
   jumps to momentum-driven possession instead of a kickoff from the centre by the
   conceding team.
10. 🔵 **Goal celebration vs on-pitch goal timing.** The "GOAL!" overlay fires from
    `PitchView`'s event watch the instant the goal is revealed, but the sequencer
    may still be easing the ball toward the net — overlay can precede the on-pitch
    finish by a beat.
11. 🔵 **Long surnames can overflow / overlap** chips; no truncation in either
    renderer's name drawing.
12. 🟡 **Injured-but-unsubbed players** move normally (injury event is cosmetic
    until a substitution follows).
13. 🔵 **Replay caveats.** Replay always uses the Canvas renderer (even on Pixi
    devices); the live match advances underneath, so a key-moment card can appear
    behind the replay overlay.
14. 🧪 **`frameForMinute` is dead in the renderers** (the sequencer replaced it);
    only tests use it now (`pitchFrame.ts:41`). Keep as a utility or remove.
15. 🔵 **Foul possession side may be wrong.** The duel beat sets `possession` to
    `ev.clubId`; if that's the fouling team, the "in-possession" framing is
    inverted for the brief foul beat.

---

## Part 2 — Realism improvements (fit the game better)

- 🟡 **Possession share driven by real stats** — alternate possession between/within
  minutes weighted by `momentum` magnitude and `homePossession`, with more
  back-and-forth, so the pitch reflects an even game as even.
- 🟡 **Turnover beats** — insert a short interception/tackle beat when the ball
  changes teams (a defender steps onto the ball, then their team builds).
- 🟡 **Set-piece staging** — corner crowd in the six-yard box, free-kick wall +
  taker, penalty spot + keeper on the line.
- 🟡 **Live tactics** — re-resolve team shape on `ai_tactical_change` so mentality
  swings visibly change the block.
- 🟡 **Counter-attacks** — `counter_attack_goal` should stage a fast end-to-end
  break (few players, long forward beats) rather than a normal build-up.
- 🟡 **Player facing/lean & ball spin** — orient chips toward travel; curve on
  crosses/free kicks.
- 🟡 **Keeper actions** — keeper comes off the line / dives on shots and crosses.
- 🟡 **Throw-ins & goal kicks** — restart staging at the touchline/six-yard box.

---

## Part 3 — UX / graphics

- 🔵 **Half-time tactical board** + **pre-match walkout** + **full-time** beat.
- 🔵 **Penalty shootout on the pitch.**
- 🔵 **Net ripple on goals** (currently a static net + HTML celebration).
- 🔵 **Crowd / stands** in the Pixi tier; floodlight bloom is in, stadium isn't.
- 🔵 **Weather/pitch condition visuals** — wet sheen, snow accumulation, churned
  turf for `poor`/`waterlogged` (`PitchCondition` is unused by the renderer).
- 🔵 **OVR badges** on chips (honor `showOverallOnPitch`).
- 🔵 **Tap-a-player to inspect** (name/OVR/role tooltip).
- 🔵 **Momentum tint** on the attacking third; possession bar already exists in the
  header but not on the pitch.
- 🔵 **Pixi landscape** so split view gets WebGL on capable devices.
- 🔵 **Audio (opt-in)** — crowd swell with momentum, goal roar, whistle (needs a
  sound setting + assets).
- 🔵 **Camera polish** — gentle broadcast cuts, slow-mo on goals, calmer follow on
  turnovers (avoid hard swings when the ball jumps).

---

## Part 4 — Performance / robustness

- ⚙️ **Full timeline rebuild on every revealed event.** `PitchView` memoizes the
  timeline on `events.length`, so each new event triggers a full O(n) rebuild
  (~200+ beats) — dozens of rebuilds per match. Consider an incremental/segmented
  build or throttling; profile on a low-end device.
- ⚙️ **Beat count for long/extra-time matches** is unbounded-ish (≥1–2 beats/min ×
  120+). Fine today; watch memory on stress.
- ⚙️ **Pixi redraws all Graphics each frame.** Acceptable at 22 chips, but sprite
  reuse would cut GPU churn on weak devices.
- ⚙️ **Confirm no Pixi leaks** across mount/unmount (destroy path exists; verify on
  rapid toggle).

---

## Part 5 — Testing / housekeeping

- 🧪 Renderers are untested (canvas/WebGL) — keep logic in the pure layer; add
  tests there as features land (possession alternation, turnovers, set pieces).
- 🧪 No integration test that `MatchDay` passes the right tactics/players.
- 🧪 Decide `frameForMinute`'s fate (keep utility + test, or remove both).
- 🧪 Add a substitution name/number test once chip numbering is finalized.

---

## Roadmap (phased)

Ordered by value-per-effort and risk. Each phase is independently shippable.

### Phase A — Correctness & continuity (fixes the jarring gaps) — ✅ DONE
1. ✅ Pitch stays on screen at **half-time** as a tactical board (Pitch/Split).
   *(pre/post states still text — minor follow-up.)*
2. ✅ **Possession realism**: momentum-biased ebb and flow (50/50 at neutral) +
   **turnover beats** on every change of hands (fixes #3, #4).
3. ✅ **Post-goal centre restart** by the conceding side (#9); shots hand the ball
   to the other team.
4. ✅ Fixed **foul/card possession side** (free kick to the non-offending team, #15).
   `frameForMinute` kept as a tested utility (#14).
5. ✅ Tests for possession bias, alternation, and the post-goal restart.

### Phase B — Set pieces & live tactics (realism core) — ✅ DONE (shootout deferred)
1. ✅ **Corners** after defended shots (attackers crowd the box, defenders pack
   the goal) and **free-kick** setup + curl.
2. ✅ **Penalty tableau** (taker on the spot, keeper on the line, box clear).
   ⏭️ **Penalty shootout on the pitch** still deferred (interactive phase — needs a
   visual pass).
3. ✅ **Live tactics** re-resolved from `ai_tactical_change` (mentality reshapes
   the block).
4. ✅ **Counter-attacks** staged as fast vertical long-ball breaks.
5. ✅ Tests for corner, penalty, counter, and the live-tactics reshape.

### Phase C — Graphics polish — ✅ PARTIAL
0. ✅ 🔴 **CRITICAL FIX**: the renderers had `timeline` (and Pixi's `onError`) in
   their effect deps, so every revealed event reset the playhead to minute 0 and
   catch-up raced forward at 3× — the "very fast" chaotic playback that also
   stomped goals. Present since the first pitch PR (so in the live build). Fixed
   by reading timeline/colours/showOverall/onError via refs (renderer built once).
1. ✅ **Clearer names** — dark rounded name-plate + bold text + truncation (#11).
2. ✅ **OVR on chip** honoring `showOverallOnPitch` (#8).
3. ✅ **Attacking-third tint** for the team in possession.
4. ⏭️ **Net ripple** on goals + celebration↔finish sync (#10) — deferred.
5. ⏭️ **Weather/pitch-condition** turf visuals; wind — deferred.
6. ⏭️ **Keeper actions**, chip facing/lean, ball spin — deferred (need velocity +
   on-device tuning).

### Phase D — Premium tier & interactivity
1. **Pixi landscape** for split view.
2. **Crowd / stands / stadium** in Pixi; broadcast camera cuts + slow-mo.
3. **Tap-a-player to inspect.**
4. **Audio** (opt-in sound setting + assets).

### Phase E — Performance & scale
1. **Incremental/throttled timeline build** (#Part 4.1).
2. Pixi **sprite reuse**; adaptive 30fps floor verification on battery tier.
3. Long-match memory/thermal stress pass on a real device.

### Cross-cutting
- Everything stays behind the lazy chunk; `size:check` gates each PR.
- Engine untouched; choreography stays pure & deterministic; no save migration
  unless a new persisted setting (e.g., audio) is added — prefer flags storage.
- **On-device tuning pass** after Phase A/B: sway, press intensity, line height,
  camera, pace — all constants live in `config/pitchChoreography.ts` + `matchSpeed.ts`.
```
```
