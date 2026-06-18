// Tunables for the 2.5D pitch choreography (src/engine/match/choreography.ts).
// All positional magnitudes are in normalized pitch units (0-100). Keep balance/
// feel values here, never hardcoded in the synthesis logic.

import type { PitchMotionKind, TacticalInstructions, Mentality } from '@/types/game';

/** Neutral tactics used when a side's instructions aren't supplied. */
export const DEFAULT_PITCH_TACTICS: TacticalInstructions = {
  mentality: 'balanced', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50,
};

/** How far forward the possessing team pushes, by mentality (multiplies ATTACK_SHIFT). */
export const MENTALITY_PUSH: Record<Mentality, number> = {
  defensive: 0.55, cautious: 0.8, balanced: 1, attacking: 1.3, 'all-out-attack': 1.6,
};

export const PITCH_CHOREO = {
  /** Formation-slot y (0-100, own-goal→forward) is scaled into the team's own
   *  half before the per-beat attack/defend shift is applied. */
  HALF_SCALE: 0.5,
  /** Forward push (pitch units) applied to the team in possession. */
  ATTACK_SHIFT: 24,
  /** Smaller shift applied to the defending team (they drop toward their goal). */
  DEFEND_SHIFT: 8,
  /** Goalkeepers only inherit a fraction of the block shift. */
  GK_SHIFT_FACTOR: 0.15,
  /** Extra forward push for wide attackers/full-backs making runs when attacking. */
  RUN_PUSH: 12,
  /** Touchline push (±x) applied to wide players under a 'wide' width (negated for 'narrow'). */
  WIDTH_PUSH: 7,
  /** Defensive-line base-y shift (own-half units) for 'high' (+) / 'deep' (−). */
  LINE_HIGH: 6,
  LINE_DEEP: 5,
  /** Passes per possession by tempo (sets beats-per-minute, paced by the sequencer). */
  PASSES_BY_TEMPO: { slow: 1, normal: 2, fast: 3 },
  /** Extra forward push added to the attacking block per pass, so the team
   *  visibly advances up the pitch as it keeps the ball. */
  POSSESSION_ADVANCE: 5,
  /** Cap on the cumulative possession advance. */
  POSSESSION_ADVANCE_MAX: 16,

  // ── Positional play (team simulation) ──
  /** How far forward the ball-carrier drives from their resting depth. */
  CARRIER_PUSH: 14,
  /** How hard a pressing defender closes on the ball (0-1). */
  PRESS_PULL: 0.6,
  /** Lateral compactness: how far off-ball defenders slide toward the ball's lane (0-1). */
  COMPACT_X: 0.28,
  /** Pull applied to the nearest support player toward the ball (passing option). */
  SUPPORT_PULL: 0.32,
  /** The defensive line sits this far in front of the ball's depth… */
  LINE_BALL_OFFSET: 8,
  /** …but never closer than this to its own goal (so it never stacks on the keeper)… */
  LINE_MIN_DEPTH: 14,
  /** …nor higher up than this. */
  LINE_MAX_DEPTH: 52,
  /** Resting depth of the back line, used to anchor the line shift. */
  BACKLINE_BASE: 10,
  /** Below this ball depth (ball near their own goal) a 2nd defender presses. */
  PRESS_NEAR_THRESHOLD: 38,
  /** Amplitude of the smooth deterministic idle sway (replaces random jitter,
   *  so players glide instead of vibrate). */
  SWAY_AMP: 1.5,
  /** How fast the idle sway evolves per beat. */
  SWAY_FREQ: 0.55,
  /** Keeper sway is a fraction of the outfield amplitude (reads as anchored). */
  GK_SWAY_FACTOR: 0.3,
  /** How strongly a highlighted player is pulled toward the ball (0-1). */
  HIGHLIGHT_PULL_X: 0.6,
  HIGHLIGHT_PULL_Y: 0.55,
  /** Reference pitch zones (home perspective; away mirrors via 100 - y). */
  MIDFIELD_Y: 50,
  ATTACK_THIRD_Y: 74,
  BOX_Y: 88,
  /** Camera zoom levels. */
  ZOOM_WIDE: 1,
  ZOOM_ATTACK: 1.25,
  ZOOM_GOAL: 1.5,
  /** Default + special beat durations (ms); the renderer rescales by match speed. */
  BEAT_MS: 600,
  GOAL_BEAT_MS: 1400,
  /** Ball arc height per motion kind (0 = ground pass). */
  ARC: {
    idle: 0,
    pass: 1.5,
    dribble: 0,
    shot: 4,
    cross: 7,
    clearance: 9,
    longball: 8,
    restart: 2,
  } satisfies Record<PitchMotionKind, number>,
} as const;

/** Renderer-only feel constants (PitchCanvas). Separate from choreography so the
 *  pure synthesis layer stays free of draw concerns. */
export const PITCH_RENDER = {
  /** Camera follow/zoom easing time constant (ms). Smaller = snappier. */
  CAM_TAU: 220,
  /** Player/ball position easing time constant (ms). */
  MOTION_TAU: 130,
  /** Clamp on broadcast zoom so we never crop too tight. */
  ZOOM_MIN: 1,
  ZOOM_MAX: 1.55,
  /** Number of recent ball samples kept for the motion trail. */
  TRAIL_LEN: 14,
  /** Peak ball lift (as a fraction of field height per unit of beat ballArc). */
  ARC_LIFT_SCALE: 0.7,
  /** Wall-clock time the renderer spends easing through one beat (ms). Tuned so
   *  a minute's worth of pass/run beats fits the pitch-view tick. */
  BEAT_PLAY_MS: 520,
  /** If the played beat lags the revealed minute by more than this, speed up. */
  CATCHUP_LAG_MIN: 2,
  /** dt multiplier applied while catching up. */
  CATCHUP_SCALE: 3,
  /** Camera zoom at/above which *all* player names show; below it only the
   *  ball-carrier + highlighted players are labelled (declutters at 375px). */
  NAME_ZOOM: 1.3,

  // ── Phase 1: motion physics ──
  /** Player spring inertia (ms) — how long a chip takes to settle on its target. */
  PLAYER_TAU: 130,
  /** Velocity (pitch units/sec) treated as a "full sprint" for visual effects. */
  SPEED_REF: 60,
  /** Max chip swell at full sprint (fraction). */
  SPRINT_SCALE_MAX: 0.1,
  /** Max chip elongation along the travel axis at full sprint (fraction). */
  LEAN_MAX: 0.28,
  /** Max vertical bob for a sprinting chip, as a fraction of chip radius. */
  BOB_MAX: 0.35,
  /** Bob oscillation frequency (rad/ms of wall-clock). */
  BOB_FREQ: 0.018,
  /** Camera looks this many seconds ahead along the ball's velocity. */
  CAM_LEAD_S: 0.2,
  /** Clamp on the camera lead (pitch units) so it never runs off the pitch. */
  CAM_LEAD_MAX: 16,
  /** Goal impact (slow-mo + zoom punch + shake) duration (ms). */
  GOAL_IMPACT_MS: 750,
  /** dt multiplier at the peak of the goal slow-mo. */
  GOAL_SLOWMO: 0.4,
  /** Extra zoom added at the peak of the goal punch. */
  GOAL_ZOOM_PUNCH: 0.28,
  /** Screen-shake amplitude (px) at goal impact. */
  GOAL_SHAKE_PX: 6,
} as const;
