// Pure pitch-marking geometry shared by PitchCanvas and PixiPitch.
//
// Pitch coordinates are 0-100 on BOTH axes (x = width, y = length, home goal at
// y=0), but a real pitch is 105 x 68 m, so one unit of x and one unit of y are
// different distances. A circle therefore can't be drawn as a screen-space
// `arc(r)` scaled off one axis: it has to be sampled in metres and converted per
// axis. Both renderers project these points through their own camera, which is
// what keeps the circles round and the penalty "D" outside the box in every
// orientation and flip.

import { PITCH_RENDER } from '@/config/pitchChoreography';

export interface MarkPoint {
  x: number;
  y: number;
}

const { PITCH_LENGTH_M, PITCH_WIDTH_M, CENTRE_CIRCLE_M, PENALTY_SPOT_Y, PENALTY_BOX_Y, ARC_STEPS } = PITCH_RENDER;

/** Points on a circle of radius `rM` metres around pitch point (cx, cy), from
 *  angle `from` to `to` (radians; 0 points up the pitch, +y). */
function arcPoints(cx: number, cy: number, rM: number, from: number, to: number, steps: number): MarkPoint[] {
  const pts: MarkPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    pts.push({
      x: cx + (Math.sin(a) * rM * 100) / PITCH_WIDTH_M,
      y: cy + (Math.cos(a) * rM * 100) / PITCH_LENGTH_M,
    });
  }
  return pts;
}

/** The centre circle (9.15 m), closed. */
export function centreCirclePoints(): MarkPoint[] {
  return arcPoints(50, 50, CENTRE_CIRCLE_M, 0, Math.PI * 2, ARC_STEPS * 2);
}

/**
 * The penalty arc ("D") for the goal on `goalY` (0 or 100), where `dir` is +1
 * when the pitch runs +y away from that goal. It is the part of a 9.15 m circle
 * around the penalty spot that lies OUTSIDE the penalty area: both ends sit
 * exactly on the box's front edge.
 */
export function penaltyArcPoints(goalY: number, dir: 1 | -1): MarkPoint[] {
  const spotY = goalY + dir * PENALTY_SPOT_Y;
  const gapM = ((PENALTY_BOX_Y - PENALTY_SPOT_Y) * PITCH_LENGTH_M) / 100;
  const half = Math.acos(Math.min(1, gapM / CENTRE_CIRCLE_M));
  // Angle 0 points toward +y; the arc bulges away from the goal.
  const facing = dir === 1 ? 0 : Math.PI;
  return arcPoints(50, spotY, CENTRE_CIRCLE_M, facing - half, facing + half, ARC_STEPS);
}

// ── Camera framing ────────────────────────────────────────────────────────

export interface CameraFrameInput {
  /** Canvas size (CSS px). The drawn world is this rectangle at zoom 1: the
   *  field plus its margin, where the nets and stands are. */
  w: number;
  h: number;
  /** Height of the drawn field (CSS px, unzoomed) — what `fit` frames. */
  fieldH: number;
  /** Where the camera wants to look (CSS px, unzoomed). */
  focusX: number;
  focusY: number;
  zoom: number;
  /** Screen strips covered by HUD (score bug on top, caption at the bottom). */
  safeTop: number;
  safeBottom: number;
  /** How far toward framing the whole field inside the safe area (Wide /
   *  reduced motion): 0 = follow, 1 = fitted. Renderers ease it, so toggling
   *  Wide glides rather than snapping a goal zoom straight to the fit. */
  fit: number;
}

export interface CameraFrame {
  zoom: number;
  /** World point drawn at the screen anchor. */
  pivotX: number;
  pivotY: number;
  /** Screen point the pivot is drawn at: the centre of the SAFE area. */
  anchorX: number;
  anchorY: number;
}

/**
 * The camera transform both renderers apply:
 * `screen = (world − pivot) · zoom + anchor`.
 *
 * It composes against the part of the canvas NOT covered by HUD, so the
 * follow-cam can bring either goal mouth fully into view below the score bug or
 * above the caption. The player always attacks up the screen, so without this
 * their own chances and goals played out under the score bug. The camera may
 * travel over the whole drawn world, margin included — clamping it to the field
 * cut the nets off exactly when it zoomed onto a goal. `fit` shrinks the field
 * (and its nets) into the safe area instead of cropping it.
 */
export function frameCamera(i: CameraFrameInput): CameraFrame {
  const safeH = Math.max(1, i.h - i.safeTop - i.safeBottom);
  const anchorX = i.w / 2;
  const anchorY = i.safeTop + safeH / 2;
  const fit = Math.max(0, Math.min(1, i.fit));
  const fitZoom = Math.min(i.zoom, safeH / (i.fieldH * (1 + 2 * PITCH_RENDER.FIT_NET_MARGIN)));
  const zoom = i.zoom + (fitZoom - i.zoom) * fit;
  const halfW = i.w / 2 / zoom;
  const halfH = safeH / 2 / zoom;
  // Hold inside the world; when the view is larger than the world, centre it.
  const hold = (half: number, size: number, v: number) => (2 * half >= size ? size / 2 : Math.max(half, Math.min(size - half, v)));
  const followY = hold(halfH, i.h, i.focusY);
  return {
    zoom,
    pivotX: hold(halfW, i.w, i.focusX),
    pivotY: followY + (i.h / 2 - followY) * fit,
    anchorX,
    anchorY,
  };
}

// ── Possession tint ───────────────────────────────────────────────────────

export type TintSide = 'home' | 'away';
export interface TintState {
  home: number;
  away: number;
}

/** Ease each side's attacking-third tint toward on (in possession) or off.
 *  It used to snap between the two ends on every possession flip, which read
 *  as a flickering hard-edged band rather than pressure building. */
export function stepTint(state: TintState, possession: TintSide, dtMs: number, tauMs: number): TintState {
  const k = tauMs <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dtMs) / tauMs);
  return {
    home: state.home + ((possession === 'home' ? 1 : 0) - state.home) * k,
    away: state.away + ((possession === 'away' ? 1 : 0) - state.away) * k,
  };
}

/** The tint's span in pitch-length units: `from` is the goal line the side
 *  attacks (strongest), `to` where it has faded out. Home attacks +y. */
export function tintSpan(side: TintSide): { from: number; to: number } {
  const d = PITCH_RENDER.TINT_DEPTH;
  return side === 'home' ? { from: 100, to: 100 - d } : { from: 0, to: d };
}
