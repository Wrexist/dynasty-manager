/**
 * The match ball rolls like a real one: moving right turns its top face to the
 * right, it stays a true rotation over a whole match of frames, and the
 * camera sees about half of its 12 patches.
 */
import { describe, it, expect } from 'vitest';
import { identityOrientation, liftScale, rollBall, visiblePatches } from '@/components/game/pitch/pitchBall';
import { PITCH_RENDER } from '@/config/pitchChoreography';

const apply = (m: number[], p: number[]) => [0, 1, 2].map(i => m[i * 3] * p[0] + m[i * 3 + 1] * p[1] + m[i * 3 + 2] * p[2]);

describe('pitchBall', () => {
  it('rolls without slipping: right turns the top face right, a quarter turn per π/2 radii', () => {
    const o = rollBall(identityOrientation(), (Math.PI / 2) * 10, 0, 10);
    const top = apply(o, [0, 0, 1]); // the point facing the camera
    expect(top[0]).toBeCloseTo(1);
    expect(top[2]).toBeCloseTo(0);
    const down = apply(rollBall(identityOrientation(), 0, (Math.PI / 2) * 10, 10), [0, 0, 1]);
    expect(down[1]).toBeCloseTo(1); // moving down the screen turns it down
  });

  it('standing still does not turn it', () => {
    expect(rollBall(identityOrientation(), 0, 0, 10)).toEqual(identityOrientation());
  });

  it('stays a rotation after a whole match of frames', () => {
    let o = identityOrientation();
    for (let i = 0; i < 20000; i++) o = rollBall(o, Math.sin(i * 0.013) * 3, Math.cos(i * 0.007) * 2, 7);
    const cols = [0, 1, 2].map(j => [o[j], o[3 + j], o[6 + j]]);
    for (const c of cols) expect(Math.hypot(c[0], c[1], c[2])).toBeCloseTo(1, 6);
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(dot(cols[0], cols[1])).toBeCloseTo(0, 6);
    expect(dot(cols[0], cols[2])).toBeCloseTo(0, 6);
  });

  it('shows the front half of the 12 patches, inside the ball', () => {
    let o = identityOrientation();
    for (let i = 0; i < 50; i++) {
      o = rollBall(o, 3, 1, 5);
      const v = visiblePatches(o, 10);
      expect(v.length).toBeGreaterThanOrEqual(5);
      expect(v.length).toBeLessThanOrEqual(8);
      for (const p of v) {
        expect(p.pts).toHaveLength(5);
        for (const [x, y] of p.pts) expect(Math.hypot(x, y)).toBeLessThanOrEqual(10.0001);
      }
    }
  });

  it('a ball in the air looks bigger, capped', () => {
    expect(liftScale(0, 6)).toBe(1);
    expect(liftScale(6, 6)).toBeGreaterThan(1);
    expect(liftScale(1e6, 6)).toBeCloseTo(1 + PITCH_RENDER.BALL_LIFT_SCALE_MAX);
  });
});
