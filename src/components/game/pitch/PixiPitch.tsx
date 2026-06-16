import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { MatchTimeline, PitchQuality } from '@/types/game';
import { createPlayback, advancePlayback, samplePlayback, type PlaybackState } from '@/engine/match/pitchFrame';
import { PITCH_RENDER } from '@/config/pitchChoreography';

// The "Stunning" WebGL pitch tier. Consumes the exact same MatchTimeline as the
// Canvas renderer, so the pure choreography is shared. WebGL buys crisp scaling,
// additive bloom on the ball-carrier ring + ball, and a GPU-cheap camera (we
// just transform a world Container). Any init/runtime failure calls onError so
// PitchView can drop back to the Canvas tier — Pixi ticker throws happen outside
// React's render path, so this callback is the real safety net.

interface PixiPitchProps {
  timeline: MatchTimeline;
  minute: number;
  quality: PitchQuality;
  homeColor: string;
  awayColor: string;
  flip?: boolean;
  reducedMotion?: boolean;
  className?: string;
  onError?: () => void;
}

const TURF_DARK = 0x16361f;
const TURF_LIGHT = 0x1c4327;
const LINE = 0xffffff;
const GOLD = '#f5b915';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface View { zoom: number; cx: number; cy: number }

export default function PixiPitch({
  timeline, minute, quality, homeColor, awayColor, flip = false, reducedMotion = false, className, onError,
}: PixiPitchProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef(minute);
  minuteRef.current = minute;

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
      onError?.();
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
        const fieldG = new Graphics();
        const glowG = new Graphics();
        glowG.blendMode = 'add';
        const trailG = new Graphics();
        const chipsG = new Graphics();
        const numbers = new Container();
        const ballG = new Graphics();
        world.addChild(fieldG, glowG, trailG, chipsG, numbers, ballG);
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
          const n = new Text({ text: '', style: { fontFamily: 'DM Sans, sans-serif', fontSize: 12, fill: '#ffffff', fontWeight: '600', stroke: { color: '#000000', width: 3 } } });
          n.anchor.set(0.5, 1);
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

        const drawField = () => {
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
        };

        app.ticker.add((ticker) => {
          try {
            if (!app) return;
            const dt = Math.min(ticker.deltaMS, 64);
            const playMs = reducedMotion ? 60 : PITCH_RENDER.BEAT_PLAY_MS;
            const adv = advancePlayback(timeline.beats, playback, dt, minuteRef.current, {
              beatMs: playMs,
              catchupLagMinutes: PITCH_RENDER.CATCHUP_LAG_MIN,
              catchupScale: PITCH_RENDER.CATCHUP_SCALE,
            });
            playback = adv.state;
            const sample = samplePlayback(timeline.beats, playback, minuteRef.current);
            if (!sample) return;
            const frame = sample.frame;
            const beat = sample.beat;
            const liftArc = sample.next ? sample.next.ballArc : 0;
            const liftT = sample.t;

            if (quality.trailLen > 0) {
              trail.push({ x: frame.ball.x, y: frame.ball.y });
              if (trail.length > quality.trailLen) trail.shift();
            } else {
              trail.length = 0;
            }

            const { w, h, fw, fh, mapX, mapY, fx, fy } = geom();

            // Camera (world container transform).
            const targetZoom = reducedMotion ? 1 : clamp(beat.camera.zoom, PITCH_RENDER.ZOOM_MIN, PITCH_RENDER.ZOOM_MAX);
            const targetCx = reducedMotion ? 50 : frame.ball.x;
            const targetCy = reducedMotion ? 50 : frame.ball.y;
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
            world.scale.set(z);
            world.pivot.set(fsx, fsy);
            world.position.set(w / 2, h / 2);

            drawField();

            // Trail.
            trailG.clear();
            if (quality.trailLen > 0 && trail.length > 1) {
              const col = beat.possession === 'home' ? homeColor : awayColor;
              const base = Math.max(1, fw * 0.01);
              for (let i = 1; i < trail.length; i++) {
                const a = i / trail.length;
                trailG.moveTo(mapX(trail[i - 1].x), mapY(trail[i - 1].y))
                  .lineTo(mapX(trail[i].x), mapY(trail[i].y))
                  .stroke({ width: base * a, color: col, alpha: a * 0.4 });
              }
            }

            // Chips + glow + numbers.
            const chipR = Math.max(5, fw * 0.028);
            chipsG.clear();
            glowG.clear();
            let li = 0;
            for (const p of frame.players) {
              const cx = mapX(p.point.x);
              const cy = mapY(p.point.y);
              const color = p.team === 'home' ? homeColor : awayColor;
              chipsG.ellipse(cx, cy + chipR * 0.55, chipR * 0.9, chipR * 0.4).fill({ color: 0x000000, alpha: 0.35 });
              if (p.highlighted) {
                // Additive bloom ring.
                glowG.circle(cx, cy, chipR + chipR * 0.7).fill({ color: GOLD, alpha: 0.18 });
                glowG.circle(cx, cy, chipR + chipR * 0.35).fill({ color: GOLD, alpha: 0.22 });
              }
              chipsG.circle(cx, cy, chipR).fill(color || '#888888').stroke({ width: Math.max(1, chipR * 0.14), color: 0x000000, alpha: 0.55 });
              const t = labels[li];
              if (t) {
                t.visible = true;
                t.text = String(p.number);
                t.style.fontSize = Math.round(chipR * 1.1);
                t.position.set(cx, cy);
              }
              const nm = nameLabels[li];
              if (nm) {
                if (p.name) {
                  nm.visible = true;
                  nm.text = p.name;
                  nm.style.fontSize = Math.round(chipR * 0.8);
                  nm.position.set(cx, cy - chipR * 1.15);
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
            const bx = mapX(frame.ball.x);
            const by = mapY(frame.ball.y);
            ballG.clear();
            ballG.ellipse(bx, by + ballR * 0.7, ballR * (0.9 + liftPx / (fh || 1)), ballR * 0.4).fill({ color: 0x000000, alpha: 0.4 });
            glowG.circle(bx, by - liftPx, ballR * 2).fill({ color: 0xffffff, alpha: 0.1 });
            ballG.circle(bx, by - liftPx, ballR).fill(0xffffff).stroke({ width: Math.max(1, ballR * 0.25), color: 0x000000, alpha: 0.5 });
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
  }, [timeline, quality, homeColor, awayColor, flip, reducedMotion, onError]);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
