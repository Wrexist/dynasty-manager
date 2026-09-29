import { describe, it, expect } from 'vitest';
import { centreCirclePoints, frameCamera, penaltyArcPoints, stepTint, tintSpan } from '@/components/game/pitch/pitchGeometry';
import { withAlpha } from '@/components/game/pitch/pitchColors';
import { PITCH_RENDER } from '@/config/pitchChoreography';

const { PITCH_LENGTH_M, PITCH_WIDTH_M, CENTRE_CIRCLE_M, PENALTY_SPOT_Y, PENALTY_BOX_Y } = PITCH_RENDER;

/** Distance in metres between two pitch-unit points. */
const metres = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(((a.x - b.x) * PITCH_WIDTH_M) / 100, ((a.y - b.y) * PITCH_LENGTH_M) / 100);

describe('pitch markings', () => {
  it('draws the centre circle at 9.15 m and closes it', () => {
    const pts = centreCirclePoints();
    for (const p of pts) expect(metres(p, { x: 50, y: 50 })).toBeCloseTo(CENTRE_CIRCLE_M, 6);
    expect(metres(pts[0], pts[pts.length - 1])).toBeLessThan(1e-9);
  });

  for (const [goalY, dir] of [[0, 1], [100, -1]] as const) {
    describe(`penalty arc at the goal on y=${goalY}`, () => {
      const pts = penaltyArcPoints(goalY, dir);
      const spot = { x: 50, y: goalY + dir * PENALTY_SPOT_Y };
      const boxEdge = goalY + dir * PENALTY_BOX_Y;

      it('is 9.15 m from the penalty spot everywhere', () => {
        for (const p of pts) expect(metres(p, spot)).toBeCloseTo(CENTRE_CIRCLE_M, 6);
      });

      it('starts and ends on the front edge of the penalty area', () => {
        expect(pts[0].y).toBeCloseTo(boxEdge, 6);
        expect(pts[pts.length - 1].y).toBeCloseTo(boxEdge, 6);
      });

      it('lies entirely outside the box, bulging toward halfway', () => {
        for (const p of pts) expect((p.y - boxEdge) * dir).toBeGreaterThanOrEqual(-1e-9);
        const apex = pts[Math.floor(pts.length / 2)];
        expect(apex.x).toBeCloseTo(50, 6);
        expect(apex.y).toBeCloseTo(spot.y + (dir * CENTRE_CIRCLE_M * 100) / PITCH_LENGTH_M, 6);
      });

      it('stays within the width of the penalty area', () => {
        for (const p of pts) {
          expect(p.x).toBeGreaterThan(21);
          expect(p.x).toBeLessThan(79);
        }
      });
    });
  }
});

describe('frameCamera', () => {
  // A 358x548 portrait pitch (390px phone): field inset by a 21px margin.
  const w = 358;
  const h = 548;
  const pad = 21;
  const fieldH = h - 2 * pad;
  const base = { w, h, fieldH, zoom: 1.4, safeTop: 44, safeBottom: 50, fit: false };
  const toScreenY = (y: number, c: ReturnType<typeof frameCamera>) => (y - c.pivotY) * c.zoom + c.anchorY;

  it('can bring the top goal line fully below the score bug when following play there', () => {
    const cam = frameCamera({ ...base, focusX: w / 2, focusY: pad });
    expect(toScreenY(pad, cam)).toBeGreaterThanOrEqual(base.safeTop);
  });

  it('can bring the bottom goal line fully above the caption', () => {
    const cam = frameCamera({ ...base, focusX: w / 2, focusY: h - pad });
    expect(toScreenY(h - pad, cam)).toBeLessThanOrEqual(h - base.safeBottom);
  });

  it('never shows past the drawn world while following', () => {
    for (const focusY of [0, pad, h / 2, h - pad, h]) {
      const cam = frameCamera({ ...base, focusX: w / 2, focusY });
      expect(toScreenY(0, cam)).toBeLessThanOrEqual(base.safeTop + 1e-9);
      expect(toScreenY(h, cam)).toBeGreaterThanOrEqual(h - base.safeBottom - 1e-9);
    }
  });

  it('fit frames the whole field, nets included, between the HUD strips', () => {
    const cam = frameCamera({ ...base, zoom: 1, fit: true, focusX: 0, focusY: 0 });
    const net = fieldH * PITCH_RENDER.FIT_NET_MARGIN;
    expect(toScreenY(pad - net, cam)).toBeGreaterThanOrEqual(base.safeTop - 1e-9);
    expect(toScreenY(h - pad + net, cam)).toBeLessThanOrEqual(h - base.safeBottom + 1e-9);
    expect(cam.zoom).toBeLessThanOrEqual(1);
  });

  it('with no HUD it is the old centred camera', () => {
    const cam = frameCamera({ ...base, zoom: 1, safeTop: 0, safeBottom: 0, focusX: 10, focusY: 10 });
    expect(cam).toEqual({ zoom: 1, pivotX: w / 2, pivotY: h / 2, anchorX: w / 2, anchorY: h / 2 });
  });
});

describe('possession tint', () => {
  it('eases toward the side in possession instead of snapping', () => {
    const one = stepTint({ home: 0, away: 1 }, 'home', 16, PITCH_RENDER.TINT_TAU);
    expect(one.home).toBeGreaterThan(0);
    expect(one.home).toBeLessThan(0.1);
    expect(one.away).toBeLessThan(1);
    expect(one.away).toBeGreaterThan(0.9);
    let s = one;
    for (let i = 0; i < 300; i++) s = stepTint(s, 'home', 16, PITCH_RENDER.TINT_TAU);
    expect(s.home).toBeCloseTo(1, 3);
    expect(s.away).toBeCloseTo(0, 3);
  });

  it('is a straight switch with no time constant and ignores negative time', () => {
    expect(stepTint({ home: 0, away: 1 }, 'away', 16, 0)).toEqual({ home: 0, away: 1 });
    expect(stepTint({ home: 0.5, away: 0.5 }, 'home', -20, 450)).toEqual({ home: 0.5, away: 0.5 });
  });

  it('fades up from the goal line each side attacks', () => {
    expect(tintSpan('home')).toEqual({ from: 100, to: 100 - PITCH_RENDER.TINT_DEPTH });
    expect(tintSpan('away')).toEqual({ from: 0, to: PITCH_RENDER.TINT_DEPTH });
  });

  it('fades to the same hue, not to transparent black', () => {
    expect(withAlpha('#ff8000', 0)).toBe('rgba(255,128,0,0)');
    expect(withAlpha('#f80', 0.5)).toBe('rgba(255,136,0,0.5)');
    expect(withAlpha('not-a-colour', 2)).toBe('rgba(136,136,136,1)');
  });
});
