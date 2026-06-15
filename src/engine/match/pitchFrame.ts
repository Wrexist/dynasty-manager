// Pure frame helpers for the 2.5D pitch renderer.
//
// The MatchChoreographer produces a discrete MatchTimeline of beats. The
// renderer needs (a) the active beat for the current match minute and (b) smooth
// interpolation between the displayed frame and the target beat. Both are pure
// and DOM-free so they can be unit-tested and reused by any renderer (Canvas
// today, Pixi later).

import type { MatchTimeline, MatchBeat, ChoreoPlayer, PitchPoint } from '@/types/game';

export interface RenderFrame {
  ball: PitchPoint;
  players: ChoreoPlayer[];
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
