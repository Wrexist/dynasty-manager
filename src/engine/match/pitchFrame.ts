// Pure frame helpers for the 2.5D pitch renderer.
//
// The MatchChoreographer produces a discrete MatchTimeline of beats. The
// renderer needs (a) the active beat for the current match minute and (b) smooth
// interpolation between the displayed frame and the target beat. Both are pure
// and DOM-free so they can be unit-tested and reused by any renderer (Canvas
// today, Pixi later).

import type { MatchTimeline, MatchBeat, ChoreoPlayer, PitchPoint, MatchEvent, PitchMotionKind } from '@/types/game';

export interface RenderFrame {
  ball: PitchPoint;
  players: ChoreoPlayer[];
}

/** Event types that put the ball in the net (own goals + keeper errors included;
 *  misses not) — mirrors the engine's scoring set so the celebration fires. */
const GOAL_TYPES = new Set<MatchEvent['type']>([
  'goal', 'own_goal', 'penalty_scored', 'header_goal', 'solo_goal',
  'long_range_goal', 'counter_attack_goal', 'free_kick_goal', 'extra_time_goal',
  'goalkeeper_error',
]);

/** Most recent goal at or before `minute`, used to trigger the celebration
 *  overlay + haptics. Pure: scans the revealed event prefix backwards. */
export function latestGoalAt(events: MatchEvent[], minute: number): MatchEvent | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.minute <= minute && GOAL_TYPES.has(e.type)) return e;
  }
  return null;
}

/** Stable identity for a chip: real player id, else a team+number placeholder. */
const keyOf = (p: ChoreoPlayer): string => p.id ?? `${p.team}#${p.number}`;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Active beat for a match minute: the last beat whose minute <= `minute`.
 * Beats are emitted in non-decreasing minute order, so this is a binary search.
 * Returns the first beat if `minute` precedes the timeline, or null if empty.
 */
export function frameForMinute(timeline: MatchTimeline, minute: number): MatchBeat | null {
  const beats = timeline.beats;
  if (!beats.length) return null;
  let lo = 0;
  let hi = beats.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid].minute <= minute) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? beats[ans] : beats[0];
}

// ── Continuous beat sequencer ─────────────────────────────────────────────
// The renderer plays *through* every beat over wall-clock time (so passes/runs
// are visible) rather than snapping to the last beat of the current minute. The
// playhead is bounded by the revealed match minute and catches up if it lags.

export interface PlaybackState {
  index: number;
  /** Progress 0..1 toward the next beat. */
  t: number;
}

export interface PlaybackOpts {
  beatMs: number;
  catchupLagMinutes: number;
  catchupScale: number;
}

export interface PlaybackSample {
  frame: RenderFrame;
  /** The beat currently being eased *from* (drives possession/caption/camera). */
  beat: MatchBeat;
  /** The beat being eased *toward*, or null when holding at the live edge/end. */
  next: MatchBeat | null;
  /** Raw linear progress toward `next` (for ball-arc timing). */
  t: number;
}

export const createPlayback = (): PlaybackState => ({ index: 0, t: 0 });

/** How many beats share the minute of `beats[index]`. Beats are emitted in
 *  non-decreasing minute order, so same-minute beats are contiguous — a cheap
 *  local scan. Used to pace a minute's beats across its wall-clock duration. */
export function countBeatsInMinute(beats: MatchBeat[], index: number): number {
  if (!beats.length) return 1;
  const i = Math.min(Math.max(0, index), beats.length - 1);
  const m = beats[i].minute;
  let count = 1;
  for (let j = i - 1; j >= 0 && beats[j].minute === m; j--) count++;
  for (let j = i + 1; j < beats.length && beats[j].minute === m; j++) count++;
  return count;
}

/** Seed a playhead at the first beat on/after `minute` (used by goal replays to
 *  start mid-timeline instead of from kickoff). */
export function seekPlayback(beats: MatchBeat[], minute: number): PlaybackState {
  if (!beats.length) return createPlayback();
  const i = beats.findIndex((b) => b.minute >= minute);
  return { index: i < 0 ? beats.length - 1 : i, t: 0 };
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t);

/** Reference beat duration the renderer's BEAT_PLAY_MS is calibrated against. */
const REF_BEAT_MS = 600;

// Ball travels with weight: a pass leaves the foot fast and rolls to a stop, a
// shot is fast and near-linear, a lofted cross/long ball settles with a touch of
// follow-through. (Players keep the symmetric smoothstep.)
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
const easeOutBack = (t: number) => {
  const c = 1.45;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};
export function ballEase(kind: PitchMotionKind, t: number): number {
  const c = clamp01(t);
  switch (kind) {
    case 'shot':
      return Math.pow(c, 0.7); // leaves fast
    case 'cross':
    case 'longball':
      return easeOutBack(c); // settles with slight overshoot
    case 'pass':
    case 'dribble':
    case 'clearance':
      return easeOutQuad(c); // friction roll
    default:
      return smoothstep(c); // idle / restart
  }
}

/**
 * Advance the playhead by `dtMs`. Moves to the next beat once the transition
 * completes, but never past a beat whose minute exceeds `maxMinute` (can't show
 * unrevealed play) — it holds at the live edge instead. Speeds up when lagging.
 */
export function advancePlayback(
  beats: MatchBeat[],
  state: PlaybackState,
  dtMs: number,
  maxMinute: number,
  opts: PlaybackOpts,
): { state: PlaybackState; justAdvanced: boolean } {
  if (!beats.length) return { state, justAdvanced: false };
  let index = Math.min(Math.max(0, state.index), beats.length - 1);
  let t = state.t;
  const scale = beats[index].minute < maxMinute - opts.catchupLagMinutes ? opts.catchupScale : 1;
  // Honor each beat's own duration so the match has rhythm: build-up beats play
  // at the reference pace, goal/strike beats dwell longer.
  const beatMs = ((beats[index].durationMs || REF_BEAT_MS) / REF_BEAT_MS) * opts.beatMs;
  t += (dtMs * scale) / Math.max(1, beatMs);
  let justAdvanced = false;
  while (t >= 1) {
    const nxt = index + 1;
    if (nxt < beats.length && beats[nxt].minute <= maxMinute) {
      index = nxt;
      t -= 1;
      justAdvanced = true;
    } else {
      t = 1;
      break;
    }
  }
  return { state: { index, t }, justAdvanced };
}

/** Sample the interpolated frame for the current playhead. */
export function samplePlayback(beats: MatchBeat[], state: PlaybackState, maxMinute: number): PlaybackSample | null {
  if (!beats.length) return null;
  const index = Math.min(Math.max(0, state.index), beats.length - 1);
  const from = beats[index];
  const nextIdx = index + 1;
  const hasNext = nextIdx < beats.length && beats[nextIdx].minute <= maxMinute;
  const to = hasNext ? beats[nextIdx] : null;
  const frame = to ? lerpFrames(from, to, smoothstep(state.t)) : { ball: from.ball, players: from.players };
  // The ball gets its own weighted easing per motion kind (independent of the
  // players' smoothstep) so passes roll, shots fizz, crosses settle.
  if (to) {
    const bt = ballEase(to.ballMotion, state.t);
    frame.ball = { x: lerp(from.ball.x, to.ball.x, bt), y: lerp(from.ball.y, to.ball.y, bt) };
  }
  return { frame, beat: from, next: to, t: state.t };
}

/**
 * Interpolate between two frames. Players are matched by stable key, so:
 *  - shared players ease from→to,
 *  - players only in `to` snap in (appear),
 *  - players only in `from` are dropped (e.g. a red card removed in `to`).
 * `t` is clamped to [0,1].
 */
export function lerpFrames(from: RenderFrame, to: RenderFrame, t: number): RenderFrame {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const fromMap = new Map<string, ChoreoPlayer>();
  for (const p of from.players) fromMap.set(keyOf(p), p);
  const players = to.players.map((tp) => {
    const fp = fromMap.get(keyOf(tp));
    if (!fp) return tp;
    return {
      ...tp,
      point: { x: lerp(fp.point.x, tp.point.x, k), y: lerp(fp.point.y, tp.point.y, k) },
    };
  });
  return {
    ball: { x: lerp(from.ball.x, to.ball.x, k), y: lerp(from.ball.y, to.ball.y, k) },
    players,
  };
}

// ── Display layer: springs + velocity ─────────────────────────────────────
// The sampled frame is the *target*. The renderer keeps a persistent display
// state that springs toward it with inertia, so players accelerate, decelerate
// and settle (rather than rigidly tracking the interpolated target), and exposes
// per-player velocity so the renderer can lean/scale/bob fast movers and lead the
// camera. Pure (mutates the passed state, no DOM) so both renderers + tests share it.

export interface DisplayPlayer {
  id: string | null;
  team: 'home' | 'away';
  pos: ChoreoPlayer['pos'];
  number: number;
  name?: string;
  overall?: number;
  highlighted: boolean;
  x: number;
  y: number;
  /** Velocity in pitch units per second. */
  vx: number;
  vy: number;
}

export interface DisplayState {
  players: Map<string, DisplayPlayer>;
  ballX: number;
  ballY: number;
  ballVX: number;
  ballVY: number;
  init: boolean;
}

export const createDisplay = (): DisplayState => ({ players: new Map(), ballX: 50, ballY: 50, ballVX: 0, ballVY: 0, init: false });

/** Advance the display toward the sampled frame by `dtMs`, easing players with
 *  inertia (`tauMs`) and tracking velocity. The ball follows the (already
 *  weighted-eased) target exactly but its velocity is tracked for camera lead. */
export function stepDisplay(display: DisplayState, frame: RenderFrame, dtMs: number, tauMs: number): void {
  const dt = Math.max(1, Math.min(dtMs, 64));
  const k = 1 - Math.exp(-dt / Math.max(1, tauMs));
  const invDt = 1000 / dt;

  const seen = new Set<string>();
  for (const tp of frame.players) {
    const key = tp.id ?? `${tp.team}#${tp.number}`;
    seen.add(key);
    let d = display.players.get(key);
    if (!d) {
      d = { id: tp.id, team: tp.team, pos: tp.pos, number: tp.number, name: tp.name, overall: tp.overall, highlighted: tp.highlighted, x: tp.point.x, y: tp.point.y, vx: 0, vy: 0 };
      display.players.set(key, d);
      continue;
    }
    d.id = tp.id; d.team = tp.team; d.pos = tp.pos; d.number = tp.number;
    d.name = tp.name; d.overall = tp.overall; d.highlighted = tp.highlighted;
    const nx = d.x + (tp.point.x - d.x) * k;
    const ny = d.y + (tp.point.y - d.y) * k;
    d.vx = (nx - d.x) * invDt;
    d.vy = (ny - d.y) * invDt;
    d.x = nx; d.y = ny;
  }
  for (const key of display.players.keys()) if (!seen.has(key)) display.players.delete(key);

  if (!display.init) {
    display.ballX = frame.ball.x; display.ballY = frame.ball.y; display.init = true;
  } else {
    display.ballVX = (frame.ball.x - display.ballX) * invDt;
    display.ballVY = (frame.ball.y - display.ballY) * invDt;
    display.ballX = frame.ball.x; display.ballY = frame.ball.y;
  }
}
