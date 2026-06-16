import { useEffect, useRef } from 'react';
import type { MatchTimeline, PitchQuality } from '@/types/game';
import { createPlayback, advancePlayback, samplePlayback, type PlaybackState, type RenderFrame } from '@/engine/match/pitchFrame';
import { PITCH_RENDER } from '@/config/pitchChoreography';

// Art-directed top-down pitch renderer with a broadcast follow-cam, parabolic
// ball arcs and a motion trail. Consumes a MatchTimeline + current minute; eases
// the displayed frame and camera toward the active beat each animation frame.
// DOM/Canvas only — positional logic lives in the pure choreographer + helpers.

interface PitchCanvasProps {
  timeline: MatchTimeline;
  minute: number;
  quality: PitchQuality;
  /** Effective team colours (kit-clash-adjusted by the caller). */
  homeColor: string;
  awayColor: string;
  /** Render the player's own team attacking upward (defending the bottom goal). */
  flip?: boolean;
  /** Snap + hold a static wide view (reduced-motion / performance mode). */
  reducedMotion?: boolean;
  className?: string;
}

const TURF_DARK = '#16361f';
const TURF_LIGHT = '#1c4327';
const LINE = 'rgba(255,255,255,0.55)';
const GOLD = '#f5b915';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface View { zoom: number; cx: number; cy: number }

export function PitchCanvas({ timeline, minute, quality, homeColor, awayColor, flip = false, reducedMotion = false, className }: PitchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minuteRef = useRef(minute);
  const playbackRef = useRef<PlaybackState>(createPlayback());
  const viewRef = useRef<View | null>(null);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);

  minuteRef.current = minute;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, quality.dprCap);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Base geometry (zoom = 1). The camera transform scales around the focus.
    const geom = () => {
      const pad = Math.min(w, h) * 0.06;
      const fw = w - pad * 2;
      const fh = h - pad * 2;
      const mapX = (px: number) => pad + (px / 100) * fw;
      const mapY = (py: number) => (flip ? pad + (py / 100) * fh : pad + (1 - py / 100) * fh);
      return { fx: pad, fy: pad, fw, fh, mapX, mapY };
    };

    const drawField = () => {
      const { fx, fy, fw, fh, mapX, mapY } = geom();
      ctx.fillStyle = TURF_DARK;
      ctx.fillRect(fx, fy, fw, fh);
      const stripes = 9;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? TURF_LIGHT : TURF_DARK;
        ctx.fillRect(fx, fy + (i / stripes) * fh, fw, fh / stripes + 1);
      }
      if (quality.gradient) {
        const lg = ctx.createLinearGradient(0, fy, 0, fy + fh);
        lg.addColorStop(0, 'rgba(0,0,0,0.26)');
        lg.addColorStop(0.55, 'rgba(0,0,0,0)');
        lg.addColorStop(1, 'rgba(255,255,255,0.06)');
        ctx.fillStyle = lg;
        ctx.fillRect(fx, fy, fw, fh);
      }

      ctx.lineWidth = Math.max(1, fw * 0.006);
      ctx.strokeStyle = LINE;
      ctx.strokeRect(fx, fy, fw, fh);
      ctx.beginPath();
      ctx.moveTo(mapX(0), mapY(50));
      ctx.lineTo(mapX(100), mapY(50));
      ctx.stroke();
      const r = (9 / 100) * fw;
      ctx.beginPath();
      ctx.arc(mapX(50), mapY(50), r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = LINE;
      ctx.beginPath();
      ctx.arc(mapX(50), mapY(50), Math.max(1.5, fw * 0.008), 0, Math.PI * 2);
      ctx.fill();

      const box = (goalY: number, dir: 1 | -1) => {
        const pY = goalY + dir * 16;
        const sY = goalY + dir * 6;
        ctx.strokeRect(mapX(21), Math.min(mapY(goalY), mapY(pY)), mapX(79) - mapX(21), Math.abs(mapY(pY) - mapY(goalY)));
        ctx.strokeRect(mapX(37), Math.min(mapY(goalY), mapY(sY)), mapX(63) - mapX(37), Math.abs(mapY(sY) - mapY(goalY)));
        ctx.fillStyle = LINE;
        ctx.beginPath();
        ctx.arc(mapX(50), mapY(goalY + dir * 11), Math.max(1.2, fw * 0.006), 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mapX(50), mapY(goalY + dir * 11), (7 / 100) * fw, 0, Math.PI * 2);
        ctx.stroke();
      };
      box(0, 1);
      box(100, -1);
    };

    const drawTrail = (color: string) => {
      const { fw, mapX, mapY } = geom();
      const pts = trailRef.current;
      if (pts.length < 2) return;
      const baseWidth = Math.max(1, fw * 0.01);
      for (let i = 1; i < pts.length; i++) {
        const a = i / pts.length;
        ctx.strokeStyle = color;
        ctx.globalAlpha = a * 0.4;
        ctx.lineWidth = baseWidth * a;
        ctx.beginPath();
        ctx.moveTo(mapX(pts[i - 1].x), mapY(pts[i - 1].y));
        ctx.lineTo(mapX(pts[i].x), mapY(pts[i].y));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const drawFrame = (frame: RenderFrame, liftPx: number) => {
      const { fw, fh, mapX, mapY } = geom();
      const chipR = Math.max(5, fw * 0.028);
      const ballR = Math.max(3, fw * 0.016);

      for (const p of frame.players) {
        const cx = mapX(p.point.x);
        const cy = mapY(p.point.y);
        const color = p.team === 'home' ? homeColor : awayColor;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + chipR * 0.55, chipR * 0.9, chipR * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        if (p.highlighted) {
          ctx.strokeStyle = GOLD;
          ctx.lineWidth = Math.max(2, chipR * 0.28);
          ctx.beginPath();
          ctx.arc(cx, cy, chipR + chipR * 0.35, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = color || '#888';
        ctx.beginPath();
        ctx.arc(cx, cy, chipR, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = Math.max(1, chipR * 0.14);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${Math.round(chipR * 1.05)}px Oswald, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(p.number), cx, cy + 0.5);
      }

      // Ball: ground shadow stays planted, ball lifts by the arc offset.
      const bx = mapX(frame.ball.x);
      const by = mapY(frame.ball.y);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(bx, by + ballR * 0.7, ballR * (0.9 + liftPx / (fh || 1)), ballR * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bx, by - liftPx, ballR, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1, ballR * 0.25);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.stroke();
    };

    const tick = (ts: number) => {
      const dt = lastTsRef.current ? Math.min(ts - lastTsRef.current, 64) : 16;
      lastTsRef.current = ts;

      // Play *through* the beats (so passes/runs animate), bounded by the
      // revealed minute. Reduced motion snaps near-instantly.
      const playMs = reducedMotion ? 60 : PITCH_RENDER.BEAT_PLAY_MS;
      const adv = advancePlayback(timeline.beats, playbackRef.current, dt, minuteRef.current, {
        beatMs: playMs,
        catchupLagMinutes: PITCH_RENDER.CATCHUP_LAG_MIN,
        catchupScale: PITCH_RENDER.CATCHUP_SCALE,
      });
      playbackRef.current = adv.state;
      const sample = samplePlayback(timeline.beats, playbackRef.current, minuteRef.current);
      if (!sample) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const frame = sample.frame;
      const beat = sample.beat;
      // Ball arc is a function of the in-flight transition toward `next`.
      const liftArc = sample.next ? sample.next.ballArc : 0;
      const liftT = sample.t;

      // Trail (most-recent-last).
      if (quality.trailLen > 0) {
        trailRef.current.push({ x: frame.ball.x, y: frame.ball.y });
        if (trailRef.current.length > quality.trailLen) trailRef.current.shift();
      } else {
        trailRef.current.length = 0;
      }

      // Camera follow + zoom.
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

      // Compose camera transform: scale around the focus, clamped so the field
      // always fills the viewport.
      const { fx, fy, fw, fh, mapX, mapY } = geom();
      const z = view.zoom;
      const halfW = (w / 2) / z;
      const halfH = (h / 2) / z;
      const fsx = fw >= 2 * halfW ? clamp(mapX(view.cx), fx + halfW, fx + fw - halfW) : fx + fw / 2;
      const fsy = fh >= 2 * halfH ? clamp(mapY(view.cy), fy + halfH, fy + fh - halfH) : fy + fh / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = TURF_DARK;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(z, z);
      ctx.translate(-fsx, -fsy);

      drawField();
      if (quality.trailLen > 0) drawTrail(beat.possession === 'home' ? homeColor : awayColor);
      const liftPx = liftArc > 0 && !reducedMotion ? liftArc * (fh / 100) * PITCH_RENDER.ARC_LIFT_SCALE * Math.sin(Math.PI * liftT) : 0;
      drawFrame(frame, liftPx);

      ctx.restore();
      // Vignette in screen space (outside the camera transform).
      if (quality.vignette) {
        const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      lastTsRef.current = 0;
      viewRef.current = null;
      trailRef.current = [];
      playbackRef.current = createPlayback();
    };
  }, [timeline, quality, homeColor, awayColor, flip, reducedMotion]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
