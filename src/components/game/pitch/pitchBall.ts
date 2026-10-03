// The match ball: a real football that rolls.
//
// The 12 black pentagons of a classic ball sit on the vertices of an
// icosahedron. The ball keeps a 3-D orientation; each frame it rolls without
// slipping along the way it moved on screen (axis = up × velocity, angle =
// distance / radius), and only the patches facing the camera are drawn —
// foreshortened towards the rim — under a lit-sphere shading. Shared by the
// Canvas tier, the WebGL tier (its patch polygons) and the Cards layer's ball,
// so all three show the same ball turning the same way.
//
// Screen space: x right, y down, z toward the viewer.

import { PITCH_RENDER } from '@/config/pitchChoreography';

/** Row-major 3×3 rotation matrix. */
export type BallOrientation = number[];

export function identityOrientation(): BallOrientation {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

const PHI = (1 + Math.sqrt(5)) / 2;
/** Pentagon centres: the icosahedron's vertices, normalised. */
const CENTRES: [number, number, number][] = (() => {
  const raw: [number, number, number][] = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    raw.push([0, a, b * PHI], [a, b * PHI, 0], [b * PHI, 0, a]);
  }
  return raw.map(([x, y, z]) => { const n = Math.hypot(x, y, z); return [x / n, y / n, z / n]; });
})();

/** Angular radius of a pentagon patch on the unit sphere (a real ball's
 *  pentagons are ~0.35 rad corner to centre). */
const PATCH_RADIUS = 0.36;

/** Pentagon corners for each centre, on the unit sphere, precomputed. */
const PATCHES: [number, number, number][][] = CENTRES.map(c => {
  // A tangent basis at c.
  const ref: [number, number, number] = Math.abs(c[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = cross(c, ref); normalise(u);
  const v = cross(c, u);
  const ca = Math.cos(PATCH_RADIUS);
  const sa = Math.sin(PATCH_RADIUS);
  return [0, 1, 2, 3, 4].map(k => {
    const t = (k * 2 * Math.PI) / 5;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    return [
      ca * c[0] + sa * (ct * u[0] + st * v[0]),
      ca * c[1] + sa * (ct * u[1] + st * v[1]),
      ca * c[2] + sa * (ct * u[2] + st * v[2]),
    ] as [number, number, number];
  });
});

function cross(a: number[], b: number[]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalise(v: number[]) {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  v[0] /= n; v[1] /= n; v[2] /= n;
}
function apply(m: BallOrientation, p: number[]): [number, number, number] {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
    m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
    m[6] * p[0] + m[7] * p[1] + m[8] * p[2],
  ];
}

/**
 * Roll the ball by a screen displacement (dx, dy) at radius r: rotation about
 * up × velocity, i.e. (−dy, dx, 0), through distance / r. A ball moving right
 * turns its top face to the right, as a real one does.
 */
export function rollBall(o: BallOrientation, dx: number, dy: number, r: number): BallOrientation {
  const d = Math.hypot(dx, dy);
  if (d < 1e-6 || r <= 0) return o;
  const ax = -dy / d;
  const ay = dx / d;
  const angle = Math.min(d / r, Math.PI); // one frame never turns it more than half way
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  // Rodrigues with az = 0.
  const R = [
    t * ax * ax + c, t * ax * ay, s * ay,
    t * ax * ay, t * ay * ay + c, -s * ax,
    -s * ay, s * ax, c,
  ];
  const out = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    out[i * 3 + j] = R[i * 3] * o[j] + R[i * 3 + 1] * o[3 + j] + R[i * 3 + 2] * o[6 + j];
  }
  return reorthonormalise(out);
}

/** Keep the matrix a rotation after thousands of frames of float drift. */
function reorthonormalise(m: number[]): BallOrientation {
  const x = [m[0], m[3], m[6]];
  normalise(x);
  const y = [m[1], m[4], m[7]];
  const dot = x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  y[0] -= dot * x[0]; y[1] -= dot * x[1]; y[2] -= dot * x[2];
  normalise(y);
  const z = cross(x, y);
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

export interface BallPatch {
  /** Corners in screen px relative to the ball's centre. */
  pts: [number, number][];
  /** How squarely it faces the camera (0 at the rim, 1 dead centre). */
  facing: number;
}

/** The black patches visible from the camera, at radius r. */
export function visiblePatches(o: BallOrientation, r: number): BallPatch[] {
  const out: BallPatch[] = [];
  for (let i = 0; i < CENTRES.length; i++) {
    const c = apply(o, CENTRES[i]);
    if (c[2] <= -0.05) continue; // round the back
    out.push({
      pts: PATCHES[i].map(p => { const q = apply(o, p); return [q[0] * r, q[1] * r] as [number, number]; }),
      facing: Math.max(0, c[2]),
    });
  }
  return out;
}

/** How much bigger the ball looks as its arc lifts it toward the camera. */
export function liftScale(liftPx: number, r: number): number {
  if (r <= 0 || liftPx <= 0) return 1;
  return 1 + Math.min(PITCH_RENDER.BALL_LIFT_SCALE_MAX, liftPx / (r * PITCH_RENDER.BALL_LIFT_SCALE_DIV));
}

/**
 * Draw the ball at (x, y), radius r (already lift-scaled), on a 2-D context:
 * white leather, the visible patches, lit-sphere shading and a crisp rim.
 */
export function drawFootball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, o: BallOrientation) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#f7f8fa';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  for (const p of visiblePatches(o, r)) {
    ctx.fillStyle = `rgba(20,23,30,${0.55 + 0.45 * p.facing})`;
    ctx.beginPath();
    ctx.moveTo(x + p.pts[0][0], y + p.pts[0][1]);
    for (let k = 1; k < p.pts.length; k++) ctx.lineTo(x + p.pts[k][0], y + p.pts[k][1]);
    ctx.closePath();
    ctx.fill();
  }
  // Lit sphere: a highlight top-left, shade bottom-right.
  const shade = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r * 1.05);
  shade.addColorStop(0, 'rgba(255,255,255,0.55)');
  shade.addColorStop(0.45, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(10,14,22,0.42)');
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.strokeStyle = 'rgba(8,12,20,0.8)';
  ctx.stroke();
}
