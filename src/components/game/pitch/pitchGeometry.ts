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
import type { PitchHitTarget } from './PitchCanvas';

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

// ── Cards mode ──

/** Where a pitch card stands for one published player position: the layout
 *  box's top-left (card + name label), its scale, and the card body's own
 *  screen centre and size. The one geometry PitchCardLayer draws with, the
 *  tap test hits against and the goal celebration flies from. */
export interface PitchCardBox {
  /** Top-left of the whole token (card + label), screen px. */
  x: number; y: number;
  /** Scale applied to the CARD_TOKEN_BASE_W layout. */
  scale: number;
  /** The card body (art only): centre and size on screen. */
  cx: number; cy: number; w: number; h: number;
}

export function pitchCardBox(t: PitchHitTarget): PitchCardBox {
  const w = t.r * PITCH_RENDER.CARD_TOKEN_R_SCALE;
  const scale = w / PITCH_RENDER.CARD_TOKEN_BASE_W;
  const h = w * 1.5;
  const labelH = PITCH_RENDER.CARD_TOKEN_LABEL_H * scale;
  const bottom = t.y - t.r * PITCH_RENDER.CARD_TOKEN_LIFT_R; // label's bottom edge
  const y = bottom - labelH - h;
  return { x: t.x - w / 2, y, scale, cx: t.x, cy: y + h / 2, w, h };
}

// ── Your-goal card celebration ──

/** Where a celebration card sits: its top-left corner and its scale about its
 *  centre (CardGoalCelebration). */
export interface CardPose { x: number; y: number; scale: number }

/** The pose (top-left + scale about the centre) that puts a `cardW` card
 *  exactly over the pitch card standing on `t` — see PitchCardLayer. */
export function pitchCardPose(t: PitchHitTarget | undefined, cardW: number, width: number, height: number): CardPose {
  const cardH = cardW * 1.5;
  if (!t) return { x: width / 2 - cardW / 2, y: height - cardH / 2, scale: 0.15 };
  const b = pitchCardBox(t);
  return { x: b.cx - cardW / 2, y: b.cy - cardH / 2, scale: b.w / cardW };
}

/** Big card width: a share of the pitch width, capped so the GOAL! line and
 *  the lower third still fit above and below it. */
export function celebrationCardWidth(width: number, height: number): number {
  const byWidth = width * PITCH_RENDER.CARD_GOAL_W_FRAC;
  const byHeight = Math.max(0, height - PITCH_RENDER.CARD_GOAL_TEXT_ROOM) / 1.5;
  return Math.round(Math.max(80, Math.min(byWidth, byHeight, 240)));
}

// ── Cards mode: name-label declutter ──

/** A name label's screen rectangle, centred on `cx`, sitting on `bottom`. */
export interface PitchLabel {
  id: string;
  cx: number; bottom: number; w: number; h: number;
  /** Spotlit (on the ball, the scorer): always keeps its name. */
  lit?: boolean;
}

/**
 * Which name labels to hide so no two overlap when players bunch together.
 * Greedy, in priority order: spotlit players first, then labels shown last
 * frame (hysteresis — a name doesn't flicker off and on as two players cross),
 * then the player lower on screen (drawn on top). Returns the hidden ids.
 */
export function declutterLabels(labels: PitchLabel[], shownBefore: ReadonlySet<string>): Set<string> {
  const order = [...labels].sort((a, b) =>
    Number(!!b.lit) - Number(!!a.lit)
    || Number(shownBefore.has(b.id)) - Number(shownBefore.has(a.id))
    || b.bottom - a.bottom);
  const kept: PitchLabel[] = [];
  const hidden = new Set<string>();
  // A sliver of overlap (the rounded corners) is fine; a name over a name is not.
  const slack = 1;
  for (const l of order) {
    const clash = !l.lit && kept.some(k =>
      Math.abs(k.cx - l.cx) < (k.w + l.w) / 2 - slack
      && Math.abs(k.bottom - l.bottom) < (k.h + l.h) / 2 - slack);
    if (clash) hidden.add(l.id);
    else kept.push(l);
  }
  return hidden;
}
