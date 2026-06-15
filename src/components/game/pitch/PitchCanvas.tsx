import { useEffect, useRef } from 'react';
import type { MatchTimeline } from '@/types/game';
import { frameForMinute, lerpFrames, type RenderFrame } from '@/engine/match/pitchFrame';

// Art-directed top-down pitch renderer. Consumes a MatchTimeline and the current
// match minute; eases the displayed frame toward the active beat each animation
// frame for fluid motion. DOM/Canvas only — all positional logic lives in the
// pure choreographer + pitchFrame helpers.

interface PitchCanvasProps {
  timeline: MatchTimeline;
  minute: number;
  /** Render the player's own team attacking upward (defending the bottom goal). */
  flip?: boolean;
  /** Snap instead of ease (reduced-motion / performance mode). */
  reducedMotion?: boolean;
  className?: string;
}

const TURF_DARK = '#16361f';
const TURF_LIGHT = '#1c4327';
const LINE = 'rgba(255,255,255,0.55)';
const GOLD = '#f5b915';
const SMOOTH_TAU = 130; // ms; smaller = snappier chase

export function PitchCanvas({ timeline, minute, flip = false, reducedMotion = false, className }: PitchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minuteRef = useRef(minute);
  const frameRef = useRef<RenderFrame | null>(null);
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Pitch geometry: vertical pitch with a small margin all round.
    const geom = () => {
      const pad = Math.min(w, h) * 0.06;
      const fx = pad;
      const fy = pad;
      const fw = w - pad * 2;
      const fh = h - pad * 2;
      // pitch coords (0-100) -> screen. y=0 is the home goal (bottom) unless flipped.
      const mapX = (px: number) => fx + (px / 100) * fw;
      const mapY = (py: number) => (flip ? fy + (py / 100) * fh : fy + (1 - py / 100) * fh);
      return { fx, fy, fw, fh, mapX, mapY };
    };

    const drawPitch = () => {
      const { fx, fy, fw, fh, mapX, mapY } = geom();
      // Turf base + mowing stripes.
      ctx.fillStyle = TURF_DARK;
      ctx.fillRect(0, 0, w, h);
      const stripes = 9;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? TURF_LIGHT : TURF_DARK;
        ctx.fillRect(fx, fy + (i / stripes) * fh, fw, fh / stripes + 1);
      }
      // Depth lighting: brighter toward the near (bottom) edge.
      const lg = ctx.createLinearGradient(0, fy, 0, fy + fh);
      lg.addColorStop(0, 'rgba(0,0,0,0.28)');
      lg.addColorStop(0.55, 'rgba(0,0,0,0)');
      lg.addColorStop(1, 'rgba(255,255,255,0.06)');
      ctx.fillStyle = lg;
      ctx.fillRect(fx, fy, fw, fh);

      ctx.lineWidth = Math.max(1, fw * 0.006);
      ctx.strokeStyle = LINE;
      // Outer boundary.
      ctx.strokeRect(fx, fy, fw, fh);
      // Halfway line.
      ctx.beginPath();
      ctx.moveTo(mapX(0), mapY(50));
      ctx.lineTo(mapX(100), mapY(50));
      ctx.stroke();
      // Centre circle + spot.
      const r = (9 / 100) * fw;
      ctx.beginPath();
      ctx.arc(mapX(50), mapY(50), r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = LINE;
      ctx.beginPath();
      ctx.arc(mapX(50), mapY(50), Math.max(1.5, fw * 0.008), 0, Math.PI * 2);
      ctx.fill();

      // Penalty + 6-yard boxes, both ends (home at y=0, away at y=100).
      const box = (goalY: number, dir: 1 | -1) => {
        const pY = goalY + dir * 16;
        const sY = goalY + dir * 6;
        ctx.strokeRect(mapX(21), Math.min(mapY(goalY), mapY(pY)), mapX(79) - mapX(21), Math.abs(mapY(pY) - mapY(goalY)));
        ctx.strokeRect(mapX(37), Math.min(mapY(goalY), mapY(sY)), mapX(63) - mapX(37), Math.abs(mapY(sY) - mapY(goalY)));
        // Penalty spot + arc.
        ctx.fillStyle = LINE;
        ctx.beginPath();
        ctx.arc(mapX(50), mapY(goalY + dir * 11), Math.max(1.2, fw * 0.006), 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mapX(50), mapY(goalY + dir * 11), (7 / 100) * fw, 0, Math.PI * 2);
        ctx.stroke();
        // Goal mouth.
        ctx.strokeRect(mapX(43), mapY(goalY) - (dir === 1 ? 0 : 0), mapX(57) - mapX(43), dir * Math.max(2, fh * 0.01));
      };
      box(0, 1);
      box(100, -1);

      // Vignette.
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    };

    const drawFrame = (frame: RenderFrame) => {
      const { fw, mapX, mapY } = geom();
      const chipR = Math.max(5, fw * 0.028);
      const ballR = Math.max(3, fw * 0.016);

      // Players.
      for (const p of frame.players) {
        const cx = mapX(p.point.x);
        const cy = mapY(p.point.y);
        const color = p.team === 'home' ? timeline.homeColor : timeline.awayColor;
        // Ground shadow.
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + chipR * 0.55, chipR * 0.9, chipR * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Highlight glow ring for spotlighted players.
        if (p.highlighted) {
          ctx.strokeStyle = GOLD;
          ctx.lineWidth = Math.max(2, chipR * 0.28);
          ctx.beginPath();
          ctx.arc(cx, cy, chipR + chipR * 0.35, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Chip.
        ctx.fillStyle = color || '#888';
        ctx.beginPath();
        ctx.arc(cx, cy, chipR, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = Math.max(1, chipR * 0.14);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.stroke();
        // Number.
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${Math.round(chipR * 1.05)}px Oswald, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(p.number), cx, cy + 0.5);
      }

      // Ball (drawn last, on top).
      const bx = mapX(frame.ball.x);
      const by = mapY(frame.ball.y);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(bx, by + ballR * 0.7, ballR * 0.9, ballR * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bx, by, ballR, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1, ballR * 0.25);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.stroke();
    };

    const tick = (ts: number) => {
      const dt = lastTsRef.current ? ts - lastTsRef.current : 16;
      lastTsRef.current = ts;

      const beat = frameForMinute(timeline, minuteRef.current);
      if (beat) {
        const target: RenderFrame = { ball: beat.ball, players: beat.players };
        if (!frameRef.current) {
          frameRef.current = target;
        } else {
          const alpha = reducedMotion ? 1 : 1 - Math.exp(-dt / SMOOTH_TAU);
          frameRef.current = lerpFrames(frameRef.current, target, alpha);
        }
        drawPitch();
        drawFrame(frameRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      lastTsRef.current = 0;
    };
  }, [timeline, flip, reducedMotion]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
