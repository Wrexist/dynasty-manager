import { useEffect, useRef } from 'react';
import { Application, BlurFilter, Container, Graphics, Text } from 'pixi.js';
import type { MatchTimeline, PitchQuality } from '@/types/game';
import { createPlayback, advancePlayback, samplePlayback, createDisplay, stepDisplay, type PlaybackState } from '@/engine/match/pitchFrame';
import { PITCH_RENDER } from '@/config/pitchChoreography';
import { shade, keeperKit } from './pitchColors';

// The "Stunning" WebGL pitch tier. Consumes the exact same MatchTimeline as the
// Canvas renderer, so the pure choreography is shared. WebGL buys crisp scaling,
// a real Gaussian bloom on the ball-carrier ring + ball, a packed crowd/stands
// backdrop, and a GPU-cheap camera (we just transform a world Container). Any
// init/runtime failure calls onError so PitchView can drop back to the Canvas
// tier — Pixi ticker throws happen outside React's render path, so this callback
// is the real safety net.

// Tiny seeded PRNG (mulberry32) so the crowd speckle is deterministic — the
// stands draw identically every mount, never shimmer, and cost nothing at runtime.
const mulberry32 = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Muted crowd palette — neutral greys with a couple of warm/cool flecks. Kept
// kit-independent so the stands never need a redraw when the away kit is
// recoloured for legibility.
const CROWD_TONES = [0x2a3340, 0x353f4e, 0x1f2733, 0x434b59, 0x2f3a30, 0x3a3340];

interface PixiPitchProps {
  timeline: MatchTimeline;
  minute: number;
  quality: PitchQuality;
  homeColor: string;
  awayColor: string;
  showOverall?: boolean;
  flip?: boolean;
  reducedMotion?: boolean;
  className?: string;
  onError?: () => void;
}

const TURF_DARK = 0x16361f;
const TURF_LIGHT = 0x1c4327;
const LINE = 0xffffff;
const GOLD = '#f5b915';

const GOAL_RENDER_EVENTS = new Set<string>([
  'goal', 'own_goal', 'penalty_scored', 'header_goal', 'solo_goal', 'long_range_goal',
  'counter_attack_goal', 'free_kick_goal', 'extra_time_goal', 'goalkeeper_error',
]);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface View { zoom: number; cx: number; cy: number }

export default function PixiPitch({
  timeline, minute, quality, homeColor, awayColor, showOverall = false, flip = false, reducedMotion = false, className, onError,
}: PixiPitchProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef(minute);
  minuteRef.current = minute;
  // Refs so the Pixi app is built ONCE and never torn down + reset when the
  // timeline grows (or onError's identity changes) as events reveal.
  const timelineRef = useRef(timeline);
  const homeColorRef = useRef(homeColor);
  const awayColorRef = useRef(awayColor);
  const showOverallRef = useRef(showOverall);
  const onErrorRef = useRef(onError);
  timelineRef.current = timeline;
  homeColorRef.current = homeColor;
  awayColorRef.current = awayColor;
  showOverallRef.current = showOverall;
  onErrorRef.current = onError;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let app: Application | null = null;
    let destroyed = false;
    let failed = false;
    const fail = (err: unknown) => {
      if (failed) return;
      failed = true;
      console.warn('PixiPitch failed, falling back to Canvas:', err);
      onErrorRef.current?.();
    };

    let playback: PlaybackState = createPlayback();
    const viewRef: { current: View | null } = { current: null };
    const trail: { x: number; y: number }[] = [];

    (async () => {
      try {
        app = new Application();
        await app.init({
          resizeTo: host,
          antialias: true,
          backgroundAlpha: 0,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, quality.dprCap),
        });
        if (destroyed || !app) { app?.destroy(true); return; }
        host.appendChild(app.canvas);

        const world = new Container();
        const standsG = new Graphics();
        const fieldG = new Graphics();
        const glowG = new Graphics();
        glowG.blendMode = 'add';
        // Real Gaussian bloom: the additive glow layer is blurred before it's
        // composited, so the carrier ring + ball read as soft light rather than
        // flat discs. Cheap because glowG only ever covers a small region.
        if (!reducedMotion) {
          glowG.filters = [new BlurFilter({ strength: PITCH_RENDER.BLOOM_STRENGTH, quality: PITCH_RENDER.BLOOM_QUALITY })];
        }
        const tintG = new Graphics();
        const trailG = new Graphics();
        const chipsG = new Graphics();
        const platesG = new Graphics();
        const numbers = new Container();
        const ballG = new Graphics();
        world.addChild(standsG, fieldG, tintG, glowG, trailG, chipsG, platesG, numbers, ballG);
        app.stage.addChild(world);

        // Pools of 22 jersey-number labels + 22 surname labels, updated in place.
        const labels: Text[] = [];
        const nameLabels: Text[] = [];
        for (let i = 0; i < 22; i++) {
          const t = new Text({ text: '', style: { fontFamily: 'Oswald, sans-serif', fontSize: 16, fill: '#ffffff', fontWeight: '700' } });
          t.anchor.set(0.5);
          t.visible = false;
          numbers.addChild(t);
          labels.push(t);
          const n = new Text({ text: '', style: { fontFamily: 'DM Sans, sans-serif', fontSize: 13, fill: '#ffffff', fontWeight: '700' } });
          n.anchor.set(0.5, 0.5);
          n.visible = false;
          numbers.addChild(n);
          nameLabels.push(n);
        }

        const geom = () => {
          const w = app!.screen.width;
          const h = app!.screen.height;
          const pad = Math.min(w, h) * 0.06;
          const fw = w - pad * 2;
          const fh = h - pad * 2;
          const mapX = (px: number) => pad + (px / 100) * fw;
          const mapY = (py: number) => (flip ? pad + (py / 100) * fh : pad + (1 - py / 100) * fh);
          return { w, h, fx: pad, fy: pad, fw, fh, mapX, mapY };
        };

        let goalRipple = { seq: -1, t: 1, end: 100 };
        let goalImpact = { seq: -1, t: 1e9 };
        const display = createDisplay();

        // Crowd/stands backdrop — a dark stadium bowl + seeded speckle in the
        // margins around the pitch, denser behind the two goal-ends. Static, so
        // it's drawn once and only redrawn when the canvas size changes.
        let standsKey = '';
        const drawStands = () => {
          const { fx, fy, fw, fh, w, h } = geom();
          const key = `${Math.round(w)}x${Math.round(h)}`;
          if (key === standsKey) return;
          standsKey = key;
          standsG.clear();
          const depth = Math.max(fx, fh * PITCH_RENDER.STANDS_DEPTH);
          const ox = fx - depth;
          const oy = fy - depth;
          const ow = fw + depth * 2;
          const oh = fh + depth * 2;
          // Bowl: a deep base (extended well past the speckle so a zoomed-in
          // camera pan never reveals the panel background) with a slightly
          // lighter inner lip toward the pitch.
          standsG.rect(ox - depth * 2, oy - depth * 2, ow + depth * 4, oh + depth * 4).fill(0x0a0e15);
          standsG.rect(fx - depth * 0.5, fy - depth * 0.5, fw + depth, fh + depth).fill(0x121826);
          // Speckle: ends (top/bottom in portrait) get the bulk; sides get the rest.
          const rng = mulberry32(0x5eed ^ Math.round(w) * 73856093 ^ Math.round(h) * 19349663);
          const ends = depth;
          const speck = (x: number, y: number) => {
            const r = 0.6 + rng() * 1.4;
            const tone = CROWD_TONES[(rng() * CROWD_TONES.length) | 0];
            standsG.circle(x, y, r).fill({ color: tone, alpha: 0.55 + rng() * 0.4 });
          };
          const total = PITCH_RENDER.STANDS_SPECKLE;
          for (let i = 0; i < total; i++) {
            const band = rng();
            if (band < 0.36) speck(fx + rng() * fw, fy - rng() * ends);              // top end
            else if (band < 0.72) speck(fx + rng() * fw, fy + fh + rng() * ends);    // bottom end
            else if (band < 0.86) speck(fx - rng() * ends, fy + rng() * fh);         // left side
            else speck(fx + fw + rng() * ends, fy + rng() * fh);                     // right side
          }
        };
        const drawField = (ripple: { end: number; bulge: number } | null) => {
          const { fx, fy, fw, fh, mapX, mapY } = geom();
          fieldG.clear();
          fieldG.rect(fx, fy, fw, fh).fill(TURF_DARK);
          const stripes = 9;
          for (let i = 0; i < stripes; i++) {
            fieldG.rect(fx, fy + (i / stripes) * fh, fw, fh / stripes + 1).fill(i % 2 === 0 ? TURF_LIGHT : TURF_DARK);
          }
          const lw = Math.max(1, fw * 0.006);
          const stroke = { width: lw, color: LINE, alpha: 0.55 };
          fieldG.rect(fx, fy, fw, fh).stroke(stroke);
          fieldG.moveTo(mapX(0), mapY(50)).lineTo(mapX(100), mapY(50)).stroke(stroke);
          fieldG.circle(mapX(50), mapY(50), (9 / 100) * fw).stroke(stroke);
          fieldG.circle(mapX(50), mapY(50), Math.max(1.5, fw * 0.008)).fill({ color: LINE, alpha: 0.55 });
          const box = (goalY: number, dir: 1 | -1) => {
            const pY = goalY + dir * 16;
            const sY = goalY + dir * 6;
            fieldG.rect(mapX(21), Math.min(mapY(goalY), mapY(pY)), mapX(79) - mapX(21), Math.abs(mapY(pY) - mapY(goalY))).stroke(stroke);
            fieldG.rect(mapX(37), Math.min(mapY(goalY), mapY(sY)), mapX(63) - mapX(37), Math.abs(mapY(sY) - mapY(goalY))).stroke(stroke);
            fieldG.circle(mapX(50), mapY(goalY + dir * 11), Math.max(1.2, fw * 0.006)).fill({ color: LINE, alpha: 0.55 });
            fieldG.circle(mapX(50), mapY(goalY + dir * 11), (7 / 100) * fw).stroke(stroke);
          };
          box(0, 1);
          box(100, -1);
          // Goal frame + net behind each byline.
          const goal = (lineY: number, dir: 1 | -1) => {
            const bulge = ripple && ripple.end === lineY ? ripple.bulge : 0;
            const depth = 4 * dir * (1 + bulge);
            const x0 = mapX(43);
            const x1 = mapX(57);
            const y0 = mapY(lineY);
            const y1 = mapY(lineY + depth);
            fieldG.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)).fill({ color: 0xffffff, alpha: 0.06 }).stroke({ width: Math.max(1.5, fw * 0.008), color: LINE, alpha: 0.85 });
            const mesh = { width: Math.max(0.5, fw * 0.003), color: LINE, alpha: 0.22 };
            for (let i = 1; i < 4; i++) {
              const gx = mapX(43 + ((57 - 43) * i) / 4);
              fieldG.moveTo(gx, y0).lineTo(gx, y1).stroke(mesh);
            }
            for (let j = 1; j < 3; j++) {
              const gy = mapY(lineY + (depth * j) / 3);
              fieldG.moveTo(x0, gy).lineTo(x1, gy).stroke(mesh);
            }
          };
          goal(0, -1);
          goal(100, 1);
        };

        app.ticker.add((ticker) => {
          try {
            if (!app) return;
            const dt = Math.min(ticker.deltaMS, 64);
            // Goal impact: slow-mo + zoom punch + shake, decaying.
            let slowmo = 1;
            let punch = 0;
            let shake = 0;
            if (!reducedMotion && goalImpact.t < PITCH_RENDER.GOAL_IMPACT_MS) {
              goalImpact.t += dt;
              const u = Math.min(1, goalImpact.t / PITCH_RENDER.GOAL_IMPACT_MS);
              slowmo = lerp(PITCH_RENDER.GOAL_SLOWMO, 1, u);
              punch = PITCH_RENDER.GOAL_ZOOM_PUNCH * (1 - u);
              shake = PITCH_RENDER.GOAL_SHAKE_PX * (1 - u);
            }
            const playMs = reducedMotion ? 60 : PITCH_RENDER.BEAT_PLAY_MS;
            const adv = advancePlayback(timelineRef.current.beats, playback, dt * slowmo, minuteRef.current, {
              beatMs: playMs,
              catchupLagMinutes: PITCH_RENDER.CATCHUP_LAG_MIN,
              catchupScale: PITCH_RENDER.CATCHUP_SCALE,
            });
            playback = adv.state;
            const sample = samplePlayback(timelineRef.current.beats, playback, minuteRef.current);
            if (!sample) return;
            const beat = sample.beat;
            if (beat.eventType && GOAL_RENDER_EVENTS.has(beat.eventType) && beat.seq !== goalRipple.seq) {
              goalRipple = { seq: beat.seq, t: 0, end: beat.possession === 'home' ? 100 : 0 };
              if (!reducedMotion) goalImpact = { seq: beat.seq, t: 0 };
            }
            if (goalRipple.t < 1) goalRipple.t = Math.min(1, goalRipple.t + dt / 700);
            const ripple = !reducedMotion && goalRipple.t < 1 ? { end: goalRipple.end, bulge: (1 - goalRipple.t) * Math.sin(goalRipple.t * 28) * 0.6 } : null;
            const liftArc = sample.next ? sample.next.ballArc : 0;
            const liftT = sample.t;

            // Spring the display toward the sampled target (inertia + velocity).
            stepDisplay(display, sample.frame, dt, reducedMotion ? 1 : PITCH_RENDER.PLAYER_TAU);

            if (quality.trailLen > 0) {
              trail.push({ x: display.ballX, y: display.ballY });
              if (trail.length > quality.trailLen) trail.shift();
            } else {
              trail.length = 0;
            }

            const { w, h, fw, fh, mapX, mapY, fx, fy } = geom();

            // Camera (world container transform) with a lead in the ball's direction.
            const leadX = clamp(display.ballVX * PITCH_RENDER.CAM_LEAD_S, -PITCH_RENDER.CAM_LEAD_MAX, PITCH_RENDER.CAM_LEAD_MAX);
            const leadY = clamp(display.ballVY * PITCH_RENDER.CAM_LEAD_S, -PITCH_RENDER.CAM_LEAD_MAX, PITCH_RENDER.CAM_LEAD_MAX);
            const targetZoom = reducedMotion ? 1 : clamp(beat.camera.zoom + punch, PITCH_RENDER.ZOOM_MIN, PITCH_RENDER.ZOOM_MAX + PITCH_RENDER.GOAL_ZOOM_PUNCH);
            const targetCx = reducedMotion ? 50 : clamp(display.ballX + leadX, 2, 98);
            const targetCy = reducedMotion ? 50 : clamp(display.ballY + leadY, 2, 98);
            if (!viewRef.current) viewRef.current = { zoom: targetZoom, cx: targetCx, cy: targetCy };
            else {
              const ca = reducedMotion ? 1 : 1 - Math.exp(-dt / PITCH_RENDER.CAM_TAU);
              viewRef.current.zoom = lerp(viewRef.current.zoom, targetZoom, ca);
              viewRef.current.cx = lerp(viewRef.current.cx, targetCx, ca);
              viewRef.current.cy = lerp(viewRef.current.cy, targetCy, ca);
            }
            const view = viewRef.current;
            const z = view.zoom;
            const halfW = (w / 2) / z;
            const halfH = (h / 2) / z;
            const fsx = fw >= 2 * halfW ? clamp(mapX(view.cx), fx + halfW, fx + fw - halfW) : fx + fw / 2;
            const fsy = fh >= 2 * halfH ? clamp(mapY(view.cy), fy + halfH, fy + fh - halfH) : fy + fh / 2;
            const shakeX = shake ? Math.sin(performance.now() * 0.08) * shake : 0;
            const shakeY = shake ? Math.cos(performance.now() * 0.07) * shake : 0;
            world.scale.set(z);
            world.pivot.set(fsx, fsy);
            world.position.set(w / 2 + shakeX, h / 2 + shakeY);

            drawStands();
            drawField(ripple);

            // Faint attacking-third tint for the team in possession.
            tintG.clear();
            if (!reducedMotion) {
              const yLo = beat.possession === 'home' ? 72 : 0;
              const yHi = beat.possession === 'home' ? 100 : 28;
              const ty = Math.min(mapY(yLo), mapY(yHi));
              tintG.rect(mapX(0), ty, mapX(100) - mapX(0), Math.abs(mapY(yHi) - mapY(yLo)))
                .fill({ color: beat.possession === 'home' ? homeColorRef.current : awayColorRef.current, alpha: 0.12 });
            }

            // Trail.
            trailG.clear();
            if (quality.trailLen > 0 && trail.length > 1) {
              const col = beat.possession === 'home' ? homeColorRef.current : awayColorRef.current;
              const base = Math.max(1, fw * 0.01);
              for (let i = 1; i < trail.length; i++) {
                const a = i / trail.length;
                trailG.moveTo(mapX(trail[i - 1].x), mapY(trail[i - 1].y))
                  .lineTo(mapX(trail[i].x), mapY(trail[i].y))
                  .stroke({ width: base * a, color: col, alpha: a * 0.4 });
              }
            }

            // Chips + glow + numbers. Names: carrier/highlighted always, the
            // rest only when zoomed in (declutter).
            const showAllNames = z >= PITCH_RENDER.NAME_ZOOM;
            const chipR = Math.max(5, fw * 0.028);
            chipsG.clear();
            glowG.clear();
            platesG.clear();
            let li = 0;
            for (const p of display.players.values()) {
              const cx = mapX(p.x);
              const groundY = mapY(p.y);
              // Velocity → run feel: swell + lean along travel + a little bob.
              const speed = Math.hypot(p.vx, p.vy);
              const sp = Math.min(1, speed / PITCH_RENDER.SPEED_REF);
              const r = chipR * (1 + sp * PITCH_RENDER.SPRINT_SCALE_MAX);
              const aax = Math.abs(p.vx);
              const aay = Math.abs(p.vy);
              const dirH = aax + aay > 0.01 ? aax / (aax + aay) : 0.5;
              const e = sp * PITCH_RENDER.LEAN_MAX * (2 * dirH - 1);
              const rx = r * (1 + e);
              const ry = r * (1 - e);
              const cy = groundY - sp * chipR * PITCH_RENDER.BOB_MAX * Math.sin(performance.now() * PITCH_RENDER.BOB_FREQ + p.number);
              const teamColor = p.team === 'home' ? homeColorRef.current : awayColorRef.current;
              const color = p.pos === 'GK' ? keeperKit(teamColor) : (teamColor || '#888888');
              chipsG.ellipse(cx, groundY + chipR * 0.48, chipR * 0.78, chipR * 0.34).fill({ color: 0x000000, alpha: 0.42 });
              if (p.highlighted) {
                // Additive bloom ring.
                glowG.circle(cx, cy, r + chipR * 0.7).fill({ color: GOLD, alpha: 0.18 });
                glowG.circle(cx, cy, r + chipR * 0.35).fill({ color: GOLD, alpha: 0.22 });
              }
              // Lit kit faked with layers (Pixi Graphics has no gradient fill):
              // dark base + lighter top-left body + a small specular highlight.
              chipsG.ellipse(cx, cy, rx, ry).fill(shade(color, -0.28)).stroke({ width: Math.max(1, chipR * 0.12), color: 0x000000, alpha: 0.5 });
              chipsG.ellipse(cx - rx * 0.16, cy - ry * 0.18, rx * 0.8, ry * 0.8).fill(shade(color, 0.18));
              chipsG.ellipse(cx - rx * 0.32, cy - ry * 0.34, rx * 0.2, ry * 0.2).fill({ color: 0xffffff, alpha: 0.42 });
              const t = labels[li];
              if (t) {
                t.visible = true;
                t.text = showOverallRef.current && p.overall ? String(p.overall) : String(p.number);
                t.style.fontSize = Math.round(chipR * 1.05);
                t.position.set(cx, cy);
              }
              const nm = nameLabels[li];
              if (nm) {
                if (p.name && (showAllNames || p.highlighted)) {
                  nm.visible = true;
                  nm.text = p.name.length > 11 ? `${p.name.slice(0, 10)}…` : p.name;
                  nm.style.fontSize = Math.round(Math.max(8, chipR * 0.82));
                  const ny = cy - chipR * 1.55;
                  nm.position.set(cx, ny);
                  // Dark name plate for legibility.
                  const pw = nm.width + chipR * 0.7;
                  const ph = nm.height + chipR * 0.25;
                  platesG.roundRect(cx - pw / 2, ny - ph / 2, pw, ph, ph * 0.42)
                    .fill({ color: 0x080c14, alpha: 0.84 })
                    .stroke({ width: Math.max(1, chipR * 0.06), color: p.highlighted ? GOLD : 0xffffff, alpha: p.highlighted ? 0.7 : 0.18 });
                } else {
                  nm.visible = false;
                }
              }
              li++;
            }
            for (; li < labels.length; li++) { labels[li].visible = false; nameLabels[li].visible = false; }

            // Ball with additive glow + arc lift.
            const liftPx = liftArc > 0 && !reducedMotion ? liftArc * (fh / 100) * PITCH_RENDER.ARC_LIFT_SCALE * Math.sin(Math.PI * liftT) : 0;
            const ballR = Math.max(3, fw * 0.016);
            const bx = mapX(display.ballX);
            const by = mapY(display.ballY);
            ballG.clear();
            ballG.ellipse(bx, by + ballR * 0.7, ballR * (0.9 + liftPx / (fh || 1)), ballR * 0.4).fill({ color: 0x000000, alpha: 0.4 });
            glowG.circle(bx, by - liftPx, ballR * 2).fill({ color: 0xffffff, alpha: 0.1 });
            // Lit sphere: soft grey base + white hotspot top-left.
            ballG.circle(bx, by - liftPx, ballR).fill('#dfe3ea').stroke({ width: Math.max(1, ballR * 0.22), color: 0x000000, alpha: 0.5 });
            ballG.circle(bx - ballR * 0.3, by - liftPx - ballR * 0.3, ballR * 0.5).fill({ color: 0xffffff, alpha: 0.9 });
          } catch (err) {
            fail(err);
            app?.ticker.stop();
          }
        });
      } catch (err) {
        fail(err);
      }
    })();

    return () => {
      destroyed = true;
      try { app?.destroy(true, { children: true }); } catch { /* already gone */ }
      app = null;
    };
  }, [quality, flip, reducedMotion]);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
