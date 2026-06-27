import { useEffect, useRef } from 'react';
import type { MatchTimeline, PitchQuality } from '@/types/game';
import { createPlayback, seekPlayback, advancePlayback, samplePlayback, createDisplay, stepDisplay, countBeatsInMinute, type PlaybackState, type DisplayState } from '@/engine/match/pitchFrame';
import { PITCH_RENDER } from '@/config/pitchChoreography';
import { shade, keeperKit } from './pitchColors';

// Art-directed pitch renderer with a broadcast follow-cam, parabolic ball arcs
// and a motion trail. Consumes a MatchTimeline + current minute; eases the
// displayed frame and camera toward the active beat each animation frame.
// Supports portrait (goals top/bottom) and landscape (goals left/right) via a
// coordinate-transpose so the split view can show a short, wide pitch.

/** A tappable player, published each frame in CSS px relative to the canvas so
 *  the React layer (PitchView) can hit-test taps without knowing the camera. */
export interface PitchHitTarget { id: string; x: number; y: number; r: number }

interface PitchCanvasProps {
  timeline: MatchTimeline;
  minute: number;
  quality: PitchQuality;
  homeColor: string;
  awayColor: string;
  /** Show player overall on the chip instead of the shirt number. */
  showOverall?: boolean;
  /** Seed the playhead at this minute instead of kickoff (used by goal replays). */
  startMinute?: number;
  /** 'portrait' = goals top/bottom; 'landscape' = goals left/right (sideways). */
  orientation?: 'portrait' | 'landscape';
  /** Render the player's own team attacking toward the far goal (up / right). */
  flip?: boolean;
  /** Snap + hold a static wide view (reduced-motion / performance mode). */
  reducedMotion?: boolean;
  /** Wall-clock ms per match minute (the live match speed). Lets the renderer
   *  pace a minute's beats across the minute so motion is continuous at any
   *  speed. Omit to fall back to the fixed BEAT_PLAY_MS. */
  msPerMinute?: number;
  /** Renderer writes the current frame's tappable chips here (for tap-to-inspect). */
  hitTargetsRef?: React.MutableRefObject<PitchHitTarget[] | null>;
  /** When the ref reads true, hold a wide tactical view (pause the follow-cam). */
  tacticalWideRef?: React.MutableRefObject<boolean>;
  className?: string;
}

const TURF_DARK = '#16361f';
const TURF_LIGHT = '#1c4327';
const LINE = 'rgba(255,255,255,0.55)';
const GOLD = '#f5b915';

const GOAL_RENDER_EVENTS = new Set<string>([
  'goal', 'own_goal', 'penalty_scored', 'header_goal', 'solo_goal', 'long_range_goal',
  'counter_attack_goal', 'free_kick_goal', 'extra_time_goal', 'goalkeeper_error',
]);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface View { zoom: number; cx: number; cy: number }
interface Pt { sx: number; sy: number }

export function PitchCanvas({ timeline, minute, quality, homeColor, awayColor, showOverall = false, startMinute, orientation = 'portrait', flip = false, reducedMotion = false, msPerMinute, hitTargetsRef, tacticalWideRef, className }: PitchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minuteRef = useRef(minute);
  const msPerMinuteRef = useRef(msPerMinute);
  msPerMinuteRef.current = msPerMinute;
  const playbackRef = useRef<PlaybackState>(createPlayback());
  const viewRef = useRef<View | null>(null);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  const goalRippleRef = useRef<{ seq: number; t: number; end: number }>({ seq: -1, t: 1, end: 100 });
  const goalImpactRef = useRef<{ seq: number; t: number }>({ seq: -1, t: 1e9 });
  const displayRef = useRef<DisplayState>(createDisplay());

  minuteRef.current = minute;
  // Live values read inside the rAF loop via refs, so the effect does NOT re-run
  // (and the playhead does NOT reset) when the timeline grows as events reveal.
  const timelineRef = useRef(timeline);
  const homeColorRef = useRef(homeColor);
  const awayColorRef = useRef(awayColor);
  const showOverallRef = useRef(showOverall);
  timelineRef.current = timeline;
  homeColorRef.current = homeColor;
  awayColorRef.current = awayColor;
  showOverallRef.current = showOverall;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, quality.dprCap);
    const land = orientation === 'landscape';
    // Replays seed the playhead mid-timeline; live view starts at kickoff.
    playbackRef.current = startMinute != null ? seekPlayback(timelineRef.current.beats, startMinute) : createPlayback();

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

    const drawField = (ripple: { end: number; bulge: number } | null) => {
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
      if (quality.gradient) {
        // Floodlight pool: a warm lit centre falling off to the darker corners.
        const fc = project(50, 50);
        const pool = ctx.createRadialGradient(fc.sx, fc.sy, 0, fc.sx, fc.sy, Math.max(innerW, innerH) * 0.62);
        pool.addColorStop(0, 'rgba(255,250,235,0.1)');
        pool.addColorStop(0.6, 'rgba(255,250,235,0.03)');
        pool.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pool;
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
        // Penalty arc — only the "D" beyond the 18-yard line. The circle is
        // centred on the spot (inside the box), so clip the penalty area out
        // (even-odd against the field rect) and the inner half never renders.
        // Orientation-agnostic: works for either goal in portrait or landscape.
        ctx.save();
        ctx.beginPath();
        ctx.rect(pad, pad, innerW, innerH);
        ctx.rect(pa.x, pa.y, pa.w, pa.h);
        ctx.clip('evenodd');
        ctx.beginPath();
        ctx.arc(spot.sx, spot.sy, (7 / 100) * unit, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      };
      box(0, 1);
      box(100, -1);

      // Goal frame + net mesh sticking out behind each byline.
      const goal = (lineY: number, dir: 1 | -1) => {
        // Net ripples (bulges) briefly when a goal goes in at this end.
        const bulge = ripple && ripple.end === lineY ? ripple.bulge : 0;
        const depth = 4 * dir * (1 + bulge);
        const m = rect(43, lineY, 57, lineY + depth);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(m.x, m.y, m.w, m.h);
        ctx.lineWidth = Math.max(1.5, unit * 0.008);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.strokeRect(m.x, m.y, m.w, m.h);
        ctx.lineWidth = Math.max(0.5, unit * 0.003);
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        for (let i = 1; i < 4; i++) {
          const gx = 43 + ((57 - 43) * i) / 4;
          const a = project(gx, lineY);
          const b = project(gx, lineY + depth);
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }
        for (let j = 1; j < 3; j++) {
          const gy = lineY + (depth * j) / 3;
          const a = project(43, gy);
          const b = project(57, gy);
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }
      };
      goal(0, -1);
      goal(100, 1);
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

    // Faint tint over the attacking third of the team in possession — shows the
    // pressure direction at a glance.
    const drawTint = (possession: 'home' | 'away') => {
      const { project } = geom();
      const yLo = possession === 'home' ? 72 : 0;
      const yHi = possession === 'home' ? 100 : 28;
      const a = project(0, yLo);
      const b = project(100, yHi);
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = possession === 'home' ? homeColorRef.current : awayColorRef.current;
      ctx.fillRect(Math.min(a.sx, b.sx), Math.min(a.sy, b.sy), Math.abs(b.sx - a.sx), Math.abs(b.sy - a.sy));
      ctx.restore();
    };

    const drawFrame = (display: DisplayState, liftPx: number, showAllNames: boolean, ts: number) => {
      const { innerH, project, unit } = geom();
      const chipR = Math.max(5, unit * 0.028);
      const ballR = Math.max(3, unit * 0.016);

      for (const p of display.players.values()) {
        const base = project(p.x, p.y);
        // Velocity → run feel: swell + lean along travel + a little bob.
        const speed = Math.hypot(p.vx, p.vy);
        const sp = Math.min(1, speed / PITCH_RENDER.SPEED_REF);
        // Continuous idle micro-motion: near-stationary players keep shuffling on
        // their own phase (fades out as they sprint) so nobody is ever frozen.
        const idleAmp = reducedMotion ? 0 : (1 - sp) * chipR * PITCH_RENDER.IDLE_WANDER * (p.pos === 'GK' ? PITCH_RENDER.IDLE_GK_FACTOR : 1);
        const cx = base.sx + Math.sin(ts * PITCH_RENDER.IDLE_FREQ_X + p.number * 1.7) * idleAmp;
        const groundY = base.sy + Math.cos(ts * PITCH_RENDER.IDLE_FREQ_Y + p.number * 2.3) * idleAmp * 0.7;
        const r = chipR * (1 + sp * PITCH_RENDER.SPRINT_SCALE_MAX);
        const ax = Math.abs(p.vx);
        const ay = Math.abs(p.vy);
        const dirH = ax + ay > 0.01 ? ax / (ax + ay) : 0.5;
        const e = sp * PITCH_RENDER.LEAN_MAX * (2 * dirH - 1);
        const rx = r * (1 + e);
        const ry = r * (1 - e);
        const cy = groundY - sp * chipR * PITCH_RENDER.BOB_MAX * Math.sin(ts * PITCH_RENDER.BOB_FREQ + p.number);
        const teamColor = p.team === 'home' ? homeColorRef.current : awayColorRef.current;
        const color = p.pos === 'GK' ? keeperKit(teamColor) : (teamColor || '#888');
        // Planted contact shadow (doesn't bob).
        ctx.fillStyle = 'rgba(0,0,0,0.42)';
        ctx.beginPath();
        ctx.ellipse(cx, groundY + chipR * 0.48, chipR * 0.78, chipR * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        if (p.highlighted) {
          ctx.strokeStyle = GOLD;
          ctx.lineWidth = Math.max(2, chipR * 0.28);
          ctx.beginPath();
          ctx.arc(cx, cy, r + chipR * 0.35, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Lit kit: radial gradient (top-left light → base → dark rim) + specular.
        const maxR = Math.max(rx, ry);
        const grad = ctx.createRadialGradient(cx - rx * 0.4, cy - ry * 0.4, Math.max(0.5, maxR * 0.12), cx, cy, maxR);
        grad.addColorStop(0, shade(color, 0.42));
        grad.addColorStop(0.55, color);
        grad.addColorStop(1, shade(color, -0.3));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = Math.max(1, chipR * 0.12);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.ellipse(cx - rx * 0.32, cy - ry * 0.34, rx * 0.2, ry * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Chip glyph: overall (when enabled) or shirt number.
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${Math.round(chipR * 1.02)}px Oswald, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(showOverallRef.current && p.overall ? String(p.overall) : String(p.number), cx, cy + 0.5);
        // Name plate: dark rounded pill + bold white text for legibility on turf.
        if (p.name && (showAllNames || p.highlighted)) {
          const label = p.name.length > 11 ? `${p.name.slice(0, 10)}…` : p.name;
          const fs = Math.max(8, chipR * 0.82);
          ctx.font = `700 ${Math.round(fs)}px 'DM Sans', system-ui, sans-serif`;
          ctx.textBaseline = 'middle';
          const tw = ctx.measureText(label).width;
          const padX = fs * 0.42;
          const ph = fs * 1.5;
          const py = cy - chipR - ph * 0.62;
          const bx = cx - tw / 2 - padX;
          const bw = tw + padX * 2;
          ctx.fillStyle = 'rgba(8,12,20,0.84)';
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(bx, py - ph / 2, bw, ph, ph * 0.42);
            ctx.fill();
            ctx.lineWidth = Math.max(1, fs * 0.08);
            ctx.strokeStyle = p.highlighted ? GOLD : 'rgba(255,255,255,0.18)';
            ctx.stroke();
          } else {
            ctx.fillRect(bx, py - ph / 2, bw, ph);
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, cx, py);
        }
      }

      // Ball: ground shadow stays planted, ball lifts by the arc offset.
      const { sx: bx, sy: by } = project(display.ballX, display.ballY);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(bx, by + ballR * 0.7, ballR * (0.9 + liftPx / (innerH || 1)), ballR * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ball as a lit sphere: white hotspot top-left → soft grey.
      const byy = by - liftPx;
      const bg = ctx.createRadialGradient(bx - ballR * 0.35, byy - ballR * 0.35, ballR * 0.1, bx, byy, ballR);
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(1, '#c6ccd6');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bx, byy, ballR, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1, ballR * 0.22);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.stroke();
    };

    const tick = (ts: number) => {
      const dt = lastTsRef.current ? Math.min(ts - lastTsRef.current, 64) : 16;
      lastTsRef.current = ts;

      // Goal impact: slow-mo + zoom punch + screen shake, decaying.
      const gi = goalImpactRef.current;
      let slowmo = 1;
      let punch = 0;
      let shake = 0;
      if (!reducedMotion && gi.t < PITCH_RENDER.GOAL_IMPACT_MS) {
        gi.t += dt;
        const u = Math.min(1, gi.t / PITCH_RENDER.GOAL_IMPACT_MS);
        slowmo = lerp(PITCH_RENDER.GOAL_SLOWMO, 1, u);
        punch = PITCH_RENDER.GOAL_ZOOM_PUNCH * (1 - u);
        shake = PITCH_RENDER.GOAL_SHAKE_PX * (1 - u);
      }
      // Play *through* the beats (so passes/runs animate), bounded by the
      // revealed minute. Reduced motion snaps near-instantly. When the live
      // match speed is known, pace each beat so the current minute's beats fill
      // the minute's wall-clock — continuous motion with no freeze/lurch at any
      // speed. Otherwise fall back to the fixed BEAT_PLAY_MS.
      let playMs: number = PITCH_RENDER.BEAT_PLAY_MS;
      if (reducedMotion) {
        playMs = 60;
      } else if (msPerMinuteRef.current && msPerMinuteRef.current > 0) {
        const inMin = countBeatsInMinute(timelineRef.current.beats, playbackRef.current.index);
        playMs = clamp((msPerMinuteRef.current * PITCH_RENDER.LIVE_LAG) / inMin, PITCH_RENDER.BEAT_MS_MIN, PITCH_RENDER.BEAT_MS_MAX);
      }
      const adv = advancePlayback(timelineRef.current.beats, playbackRef.current, dt * slowmo, minuteRef.current, {
        beatMs: playMs,
        catchupLagMinutes: PITCH_RENDER.CATCHUP_LAG_MIN,
        catchupScale: PITCH_RENDER.CATCHUP_SCALE,
      });
      playbackRef.current = adv.state;
      const sample = samplePlayback(timelineRef.current.beats, playbackRef.current, minuteRef.current);
      if (!sample) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const beat = sample.beat;
      const liftArc = sample.next ? sample.next.ballArc : 0;
      const liftT = sample.t;

      // Trigger the net ripple + goal impact when a goal beat first becomes active.
      if (beat.eventType && GOAL_RENDER_EVENTS.has(beat.eventType) && beat.seq !== goalRippleRef.current.seq) {
        goalRippleRef.current = { seq: beat.seq, t: 0, end: beat.possession === 'home' ? 100 : 0 };
        if (!reducedMotion) goalImpactRef.current = { seq: beat.seq, t: 0 };
      }
      const rip = goalRippleRef.current;
      if (rip.t < 1) rip.t = Math.min(1, rip.t + dt / 700);
      const ripple = !reducedMotion && rip.t < 1 ? { end: rip.end, bulge: (1 - rip.t) * Math.sin(rip.t * 28) * 0.6 } : null;

      // Spring the display toward the sampled target (inertia + velocity).
      stepDisplay(displayRef.current, sample.frame, dt, reducedMotion ? 1 : PITCH_RENDER.PLAYER_TAU);
      const display = displayRef.current;

      if (quality.trailLen > 0) {
        trailRef.current.push({ x: display.ballX, y: display.ballY });
        if (trailRef.current.length > quality.trailLen) trailRef.current.shift();
      } else {
        trailRef.current.length = 0;
      }

      // Camera follow + zoom, with a lead in the ball's direction of travel.
      const leadX = clamp(display.ballVX * PITCH_RENDER.CAM_LEAD_S, -PITCH_RENDER.CAM_LEAD_MAX, PITCH_RENDER.CAM_LEAD_MAX);
      const leadY = clamp(display.ballVY * PITCH_RENDER.CAM_LEAD_S, -PITCH_RENDER.CAM_LEAD_MAX, PITCH_RENDER.CAM_LEAD_MAX);
      // Tactical-wide lock pulls back to the whole pitch and pauses the follow.
      const wide = tacticalWideRef?.current && !reducedMotion;
      const targetZoom = reducedMotion || wide ? PITCH_RENDER.ZOOM_MIN : clamp(beat.camera.zoom + punch, PITCH_RENDER.ZOOM_MIN, PITCH_RENDER.ZOOM_MAX + PITCH_RENDER.GOAL_ZOOM_PUNCH);
      const targetCx = reducedMotion || wide ? 50 : clamp(display.ballX + leadX, 2, 98);
      const targetCy = reducedMotion || wide ? 50 : clamp(display.ballY + leadY, 2, 98);
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
      const shakeX = shake ? Math.sin(ts * 0.08) * shake : 0;
      const shakeY = shake ? Math.cos(ts * 0.07) * shake : 0;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = TURF_DARK;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
      ctx.scale(z, z);
      ctx.translate(-fsx, -fsy);

      drawField(ripple);
      if (!reducedMotion) drawTint(beat.possession);
      if (quality.trailLen > 0) drawTrail(beat.possession === 'home' ? homeColorRef.current : awayColorRef.current);
      const liftPx = liftArc > 0 && !reducedMotion ? liftArc * (innerH / 100) * PITCH_RENDER.ARC_LIFT_SCALE * Math.sin(Math.PI * liftT) : 0;
      drawFrame(display, liftPx, view.zoom >= PITCH_RENDER.NAME_ZOOM, ts);

      // Publish tappable chips in CSS px (same camera transform the draw uses),
      // so PitchView can hit-test a tap back to a player without the transform.
      if (hitTargetsRef) {
        const chipR = Math.max(5, Math.min(innerW, innerH) * 0.028);
        const targets: PitchHitTarget[] = [];
        for (const p of display.players.values()) {
          if (!p.id) continue;
          const { sx, sy } = project(p.x, p.y);
          targets.push({ id: p.id, x: (sx - fsx) * z + w / 2, y: (sy - fsy) * z + h / 2, r: chipR * z * 1.4 });
        }
        hitTargetsRef.current = targets;
      }

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
      displayRef.current = createDisplay();
      goalImpactRef.current = { seq: -1, t: 1e9 };
      if (hitTargetsRef) hitTargetsRef.current = null;
    };
    // hitTargetsRef is a stable ref object; omitted from deps so the playhead
    // doesn't reset when the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, startMinute, orientation, flip, reducedMotion]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
