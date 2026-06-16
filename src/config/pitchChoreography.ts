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
  /** Max off-ball positional jitter for "breathing" (outfield players). */
  JITTER: 2.2,
  /** Keeper jitter (kept small so the GK reads as anchored). */
  GK_JITTER: 0.4,
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
} as const;
