// Pure frame helpers for the 2.5D pitch renderer.
//
// The MatchChoreographer produces a discrete MatchTimeline of beats. The
// renderer needs (a) the active beat for the current match minute and (b) smooth
// interpolation between the displayed frame and the target beat. Both are pure
// and DOM-free so they can be unit-tested and reused by any renderer (Canvas
// today, Pixi later).

import type { MatchTimeline, MatchBeat, ChoreoPlayer, PitchPoint, MatchEvent } from '@/types/game';

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

/** Seed a playhead at the first beat on/after `minute` (used by goal replays to
 *  start mid-timeline instead of from kickoff). */
export function seekPlayback(beats: MatchBeat[], minute: number): PlaybackState {
  if (!beats.length) return createPlayback();
  const i = beats.findIndex((b) => b.minute >= minute);
  return { index: i < 0 ? beats.length - 1 : i, t: 0 };
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

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
  t += (dtMs * scale) / Math.max(1, opts.beatMs);
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
