import { useEffect, useRef } from 'react';
import type { MatchTimeline, PitchQuality } from '@/types/game';
import { createPlayback, advancePlayback, samplePlayback, type PlaybackState, type RenderFrame } from '@/engine/match/pitchFrame';
import { PITCH_RENDER } from '@/config/pitchChoreography';

// Art-directed pitch renderer with a broadcast follow-cam, parabolic ball arcs
// and a motion trail. Consumes a MatchTimeline + current minute; eases the
// displayed frame and camera toward the active beat each animation frame.
// Supports portrait (goals top/bottom) and landscape (goals left/right) via a
// coordinate-transpose so the split view can show a short, wide pitch.

interface PitchCanvasProps {
  timeline: MatchTimeline;
  minute: number;
  quality: PitchQuality;
  homeColor: string;
  awayColor: string;
  /** 'portrait' = goals top/bottom; 'landscape' = goals left/right (sideways). */
  orientation?: 'portrait' | 'landscape';
  /** Render the player's own team attacking toward the far goal (up / right). */
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
interface Pt { sx: number; sy: number }

export function PitchCanvas({ timeline, minute, quality, homeColor, awayColor, orientation = 'portrait', flip = false, reducedMotion = false, className }: PitchCanvasProps) {
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
    const land = orientation === 'landscape';

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

    // Project a pitch point (px = width 0-100, py = length 0-100) to screen.
    // Portrait: width→x, length→y (home goal at bottom unless flipped).
    // Landscape: length→x, width→y (home goal at left unless flipped).
    const geom = () => {
      const pad = Math.min(w, h) * 0.06;
      const innerW = w - pad * 2;
      const innerH = h - pad * 2;
      const project = (px: number, py: number): Pt => {
        if (land) {
          const lx = flip ? 1 - py / 100 : py / 100;
          return { sx: pad + lx * innerW, sy: pad + (px / 100) * innerH };
        }
        const ly = flip ? py / 100 : 1 - py / 100;
        return { sx: pad + (px / 100) * innerW, sy: pad + ly * innerH };
      };
      // Line widths / radii scale with the short axis so they look consistent
      // in either orientation.
      const unit = Math.min(innerW, innerH);
      return { pad, innerW, innerH, project, unit };
    };

    const drawField = () => {
      const { pad, innerW, innerH, project, unit } = geom();
      const rect = (ax: number, ay: number, bx: number, by: number) => {
        const a = project(ax, ay);
        const b = project(bx, by);
        return { x: Math.min(a.sx, b.sx), y: Math.min(a.sy, b.sy), w: Math.abs(b.sx - a.sx), h: Math.abs(b.sy - a.sy) };
      };
      ctx.fillStyle = TURF_DARK;
      ctx.fillRect(pad, pad, innerW, innerH);
      // Mowing stripes run across the pitch length.
      const stripes = 9;
      for (let i = 0; i < stripes; i++) {
        const band = rect(0, (i / stripes) * 100, 100, ((i + 1) / stripes) * 100);
        ctx.fillStyle = i % 2 === 0 ? TURF_LIGHT : TURF_DARK;
        ctx.fillRect(band.x, band.y, band.w + 1, band.h + 1);
      }
      if (quality.gradient) {
        const lg = ctx.createLinearGradient(0, pad, 0, pad + innerH);
        lg.addColorStop(0, 'rgba(0,0,0,0.26)');
        lg.addColorStop(0.55, 'rgba(0,0,0,0)');
        lg.addColorStop(1, 'rgba(255,255,255,0.06)');
        ctx.fillStyle = lg;
        ctx.fillRect(pad, pad, innerW, innerH);
      }

      ctx.lineWidth = Math.max(1, unit * 0.006);
      ctx.strokeStyle = LINE;
      ctx.strokeRect(pad, pad, innerW, innerH);
      const seg = (ax: number, ay: number, bx: number, by: number) => {
        const a = project(ax, ay);
        const b = project(bx, by);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      };
      seg(0, 50, 100, 50); // halfway
      const c = project(50, 50);
      ctx.beginPath();
      ctx.arc(c.sx, c.sy, (9 / 100) * unit, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = LINE;
      ctx.beginPath();
      ctx.arc(c.sx, c.sy, Math.max(1.5, unit * 0.008), 0, Math.PI * 2);
      ctx.fill();

      const box = (goalY: number, dir: 1 | -1) => {
        const pa = rect(21, goalY, 79, goalY + dir * 16);
        ctx.strokeRect(pa.x, pa.y, pa.w, pa.h);
        const sa = rect(37, goalY, 63, goalY + dir * 6);
        ctx.strokeRect(sa.x, sa.y, sa.w, sa.h);
        const spot = project(50, goalY + dir * 11);
        ctx.fillStyle = LINE;
        ctx.beginPath();
        ctx.arc(spot.sx, spot.sy, Math.max(1.2, unit * 0.006), 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(spot.sx, spot.sy, (7 / 100) * unit, 0, Math.PI * 2);
        ctx.stroke();
      };
      box(0, 1);
      box(100, -1);
    };

    const drawTrail = (color: string) => {
      const { project, unit } = geom();
      const pts = trailRef.current;
      if (pts.length < 2) return;
      const baseWidth = Math.max(1, unit * 0.01);
      for (let i = 1; i < pts.length; i++) {
        const a = i / pts.length;
        const p0 = project(pts[i - 1].x, pts[i - 1].y);
        const p1 = project(pts[i].x, pts[i].y);
        ctx.strokeStyle = color;
        ctx.globalAlpha = a * 0.4;
        ctx.lineWidth = baseWidth * a;
        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        ctx.lineTo(p1.sx, p1.sy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const drawFrame = (frame: RenderFrame, liftPx: number) => {
      const { innerH, project, unit } = geom();
      const chipR = Math.max(5, unit * 0.028);
      const ballR = Math.max(3, unit * 0.016);

      for (const p of frame.players) {
        const { sx: cx, sy: cy } = project(p.point.x, p.point.y);
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
        if (p.name) {
          ctx.font = `600 ${Math.round(chipR * 0.78)}px 'DM Sans', system-ui, sans-serif`;
          ctx.textBaseline = 'bottom';
          ctx.lineWidth = Math.max(2, chipR * 0.3);
          ctx.strokeStyle = 'rgba(0,0,0,0.75)';
          ctx.strokeText(p.name, cx, cy - chipR * 1.15);
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.fillText(p.name, cx, cy - chipR * 1.15);
        }
      }

      // Ball: ground shadow stays planted, ball lifts by the arc offset.
      const { sx: bx, sy: by } = project(frame.ball.x, frame.ball.y);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(bx, by + ballR * 0.7, ballR * (0.9 + liftPx / (innerH || 1)), ballR * 0.4, 0, 0, Math.PI * 2);
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
      const liftArc = sample.next ? sample.next.ballArc : 0;
      const liftT = sample.t;

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

      const { pad, innerW, innerH, project } = geom();
      const focus = project(view.cx, view.cy);
      const z = view.zoom;
      const halfW = (w / 2) / z;
      const halfH = (h / 2) / z;
      const fsx = innerW >= 2 * halfW ? clamp(focus.sx, pad + halfW, pad + innerW - halfW) : pad + innerW / 2;
      const fsy = innerH >= 2 * halfH ? clamp(focus.sy, pad + halfH, pad + innerH - halfH) : pad + innerH / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = TURF_DARK;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(z, z);
      ctx.translate(-fsx, -fsy);

      drawField();
      if (quality.trailLen > 0) drawTrail(beat.possession === 'home' ? homeColor : awayColor);
      const liftPx = liftArc > 0 && !reducedMotion ? liftArc * (innerH / 100) * PITCH_RENDER.ARC_LIFT_SCALE * Math.sin(Math.PI * liftT) : 0;
      drawFrame(frame, liftPx);

      ctx.restore();
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
  }, [timeline, quality, homeColor, awayColor, orientation, flip, reducedMotion]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
