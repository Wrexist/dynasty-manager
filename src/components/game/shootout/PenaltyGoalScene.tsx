import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * PenaltyGoalScene v2 — the broadcast-style goal view for the interactive
 * shootout, matching the "modern, immersive, mobile-first" design frame:
 * tiered night stadium, a goal that fills the frame, five colored target
 * zones with snap-aim, swipe-anywhere aiming, a curved trajectory line and
 * a power-scaled ball flight.
 *
 * Pure presentation: the parent decides outcomes and feeds a `shot`; cards,
 * scoreboard and the power bar are parent overlays on top of this scene.
 * Aim coordinates are normalized goal-mouth space (x −1..1 left→right,
 * y 0..1 ground→bar) — the same space the sim resolves in.
 */

export interface SceneShot {
  /** Unique per kick — remounts the animation chain. */
  id: number;
  aimX: number;
  aimY: number;
  diveX: number;
  diveY: number;
  outcome: 'goal' | 'saved' | 'off_target';
  /** Shot power 0–1; scales flight speed. */
  power?: number;
}

interface PenaltyGoalSceneProps {
  keeperColor: string;
  keeperColor2?: string;
  /** Shooter jersey colors (the side taking the current kick). */
  shooterColor?: string;
  shooterColor2?: string;
  /** Aim reticle position while the player is lining up (normalized). */
  aim: { x: number; y: number } | null;
  /** Aim handler — absent means the scene is watch-only (opponent kicks).
   *  Fired continuously while swiping and once per tap. */
  onAim?: (x: number, y: number) => void;
  shot: SceneShot | null;
  onShotComplete?: () => void;
  /** Atmosphere flourishes (camera flashes, ball trail). */
  lively?: boolean;
  /** Decisive-kick drama: slower flight + longer hold. */
  slowMo?: boolean;
  /** Keeper mind games — exaggerated line-dance while the shooter aims. */
  keeperTaunt?: boolean;
  /** End-of-shootout beat: teammates flood in (win) or the lights die (loss). */
  celebration?: 'win' | 'loss' | null;
  celebrationColor?: string;
}

// Scene geometry (fractions of the container box). The scene is 400×300.
const GOAL = {
  centerX: 0.5,
  halfWidth: 0.38,   // inner post to center
  barTop: 0.30,      // underside of the bar
  groundY: 0.76,     // goal line
};
const BALL_START = { x: 0.5, y: 0.885 };

/** The five broadcast target zones (normalized aim space + design tokens). */
export const AIM_ZONES = [
  { id: 'tl', x: -0.72, y: 0.80, color: '#F59E0B' },
  { id: 'tr', x: 0.72, y: 0.80, color: '#EF4444' },
  { id: 'bl', x: -0.72, y: 0.18, color: '#3B82F6' },
  { id: 'br', x: 0.72, y: 0.18, color: '#3B82F6' },
  { id: 'c', x: 0, y: 0.50, color: '#22C55E' },
] as const;
const ZONE_SNAP_DIST = 0.22;

/** Snap a raw aim to the nearest target zone when close enough. */
export function snapAimToZone(x: number, y: number): { x: number; y: number; zoneId: string | null } {
  for (const z of AIM_ZONES) {
    const d = Math.hypot((x - z.x) * 0.55, y - z.y);
    if (d < ZONE_SNAP_DIST) return { x: z.x, y: z.y, zoneId: z.id };
  }
  return { x, y, zoneId: null };
}

/** One clock for scene, haptics and sound: run-up → strike → arrival → done.
 *  Power shortens the flight; slow-mo overrides everything for drama. */
export function shotTimings(slowMo: boolean, power = 0.6) {
  const runupMs = 320;
  const flightMs = slowMo ? 920 : Math.round(460 - 180 * Math.max(0, Math.min(1, power)));
  const arriveMs = runupMs + flightMs + 60;
  const completeMs = arriveMs + (slowMo ? 1750 : 1400);
  return { runupMs, flightMs, arriveMs, completeMs };
}

function aimToPos(aimX: number, aimY: number) {
  return {
    x: GOAL.centerX + aimX * GOAL.halfWidth,
    y: GOAL.groundY - aimY * (GOAL.groundY - GOAL.barTop),
  };
}

function offTargetPos(aimX: number, aimY: number) {
  if (aimY > 0.72) return { x: GOAL.centerX + aimX * GOAL.halfWidth, y: GOAL.barTop - 0.12 };
  const side = aimX >= 0 ? 1 : -1;
  return { x: GOAL.centerX + side * (GOAL.halfWidth + 0.11), y: GOAL.groundY - aimY * (GOAL.groundY - GOAL.barTop) };
}

/** Tournament match ball — white with the World Cup ball's red/green/blue
 *  curved panels and a specular highlight. */
function WorldCupBall() {
  return (
    <svg viewBox="0 0 24 24" className="w-full h-full" aria-hidden="true"
      style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.45))' }}>
      <defs>
        <radialGradient id="pgs-ballbase" cx="34%" cy="30%" r="85%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="62%" stopColor="#f2f0ea" />
          <stop offset="100%" stopColor="#b9bcc4" />
        </radialGradient>
        <clipPath id="pgs-ballclip"><circle cx="12" cy="12" r="11" /></clipPath>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#pgs-ballbase)" />
      <g clipPath="url(#pgs-ballclip)">
        <path d="M2 4 Q9 6 11 12 Q7 15 0.5 13 Q0 7 2 4 Z" fill="#c8102e" opacity="0.92" />
        <path d="M20 2.5 Q23.5 7 23 12.5 Q17 13.5 13.5 10 Q15.5 4.5 20 2.5 Z" fill="#1467b3" opacity="0.92" />
        <path d="M6 22.5 Q12 23.8 17.5 21.5 Q17 16 12 14.5 Q7.5 16.5 6 22.5 Z" fill="#0a8f4e" opacity="0.92" />
        <path d="M11 12 Q7 15 0.5 13 M11 12 Q9 6 2 4 M13.5 10 Q15.5 4.5 20 2.5 M13.5 10 Q17 13.5 23 12.5 M12 14.5 Q7.5 16.5 6 22.5 M12 14.5 Q17 16 17.5 21.5"
          fill="none" stroke="#d4a017" strokeWidth="0.55" opacity="0.8" />
      </g>
      <ellipse cx="8.4" cy="7" rx="4" ry="2.6" fill="#ffffff" opacity="0.55" transform="rotate(-25 8.4 7)" />
    </svg>
  );
}

/** Stylized keeper — jersey-colored torso/arms, dark shorts, gloves. */
function KeeperFigure({ color, color2 }: { color: string; color2?: string }) {
  const trim = color2 || '#ffffff';
  return (
    <svg viewBox="0 0 60 84" className="w-full h-full" aria-hidden="true">
      <path d="M12 34 Q6 24 10 16" stroke={color} strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M48 34 Q54 24 50 16" stroke={color} strokeWidth="7" strokeLinecap="round" fill="none" />
      <circle cx="9.5" cy="14" r="4.5" fill={trim} stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />
      <circle cx="50.5" cy="14" r="4.5" fill={trim} stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />
      <path d="M18 30 Q30 24 42 30 L40 52 Q30 56 20 52 Z" fill={color} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
      <path d="M18 30 Q30 24 42 30 L41.4 36 Q30 31 18.6 36 Z" fill={trim} opacity="0.35" />
      <circle cx="30" cy="17" r="7.5" fill="#d9b38c" stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
      <path d="M20.5 52 L39.5 52 L38 62 L22 62 Z" fill="#1f2430" />
      <path d="M24 62 L23 76 M36 62 L37 76" stroke="#d9b38c" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M20.5 78 L25.5 78 M34.5 78 L39.5 78" stroke="#141821" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/** The taker, seen from behind — jersey, shorts, socks. */
function ShooterFigure({ color, color2 }: { color: string; color2?: string }) {
  const trim = color2 || '#ffffff';
  return (
    <svg viewBox="0 0 44 82" className="w-full h-full" aria-hidden="true">
      <circle cx="22" cy="12" r="7" fill="#d9b38c" />
      <path d="M15 10.5 Q22 3.5 29 10.5 Q26 6.5 22 6.5 Q18 6.5 15 10.5 Z" fill="#2b2019" />
      <path d="M12 22 Q22 17 32 22 L30.5 44 Q22 47 13.5 44 Z" fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
      <rect x="17.5" y="26" width="9" height="10" rx="1.5" fill={trim} opacity="0.35" />
      <path d="M12.5 24 Q7 31 9 38" stroke={color} strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <path d="M31.5 24 Q37 31 35 38" stroke={color} strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <path d="M14 44 L30 44 L28.5 54 L15.5 54 Z" fill="#1f2430" />
      <path d="M18 54 L17 70 M26 54 L27 70" stroke="#d9b38c" strokeWidth="5" strokeLinecap="round" />
      <path d="M15.5 72.5 L19.5 74.5 M28.5 72.5 L24.5 74.5" stroke="#141821" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M17.2 64 L16.6 70 M26.8 64 L27.4 70" stroke={trim} strokeWidth="5" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

/** Deterministic camera-flash constellation across the crowd tiers. */
const CAMERA_FLASHES = [
  { x: 6, y: 10, delay: 0.4 }, { x: 20, y: 17, delay: 1.7 }, { x: 34, y: 8, delay: 2.9 },
  { x: 49, y: 15, delay: 0.9 }, { x: 62, y: 7, delay: 2.2 }, { x: 75, y: 16, delay: 1.3 },
  { x: 90, y: 9, delay: 3.4 }, { x: 43, y: 21, delay: 4.1 }, { x: 13, y: 22, delay: 3.0 },
  { x: 83, y: 20, delay: 4.6 },
];

function CameraFlashes() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {CAMERA_FLASHES.map((f, i) => (
        <motion.span
          key={i}
          className="absolute w-[3px] h-[3px] rounded-full bg-white"
          style={{ left: `${f.x}%`, top: `${f.y}%`, boxShadow: '0 0 6px 2px rgba(255,255,255,0.75)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.95, 0] }}
          transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 3.4 + (i % 5) * 0.9, delay: f.delay }}
        />
      ))}
    </div>
  );
}

/** Night stadium backdrop: two crowd tiers with a corner curve, floodlight
 *  glows, hoardings, pitch with converging mow stripes, goal frame + net. */
function SceneBackdrop() {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id="pgs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(222 45% 4%)" />
          <stop offset="100%" stopColor="hsl(222 34% 10%)" />
        </linearGradient>
        <linearGradient id="pgs-tier" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(226 26% 13%)" />
          <stop offset="100%" stopColor="hsl(224 28% 9%)" />
        </linearGradient>
        <linearGradient id="pgs-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(140 40% 21%)" />
          <stop offset="100%" stopColor="hsl(142 46% 14%)" />
        </linearGradient>
        <radialGradient id="pgs-flood" cx="50%" cy="0%" r="95%">
          <stop offset="0%" stopColor="rgba(255,246,214,0.20)" />
          <stop offset="55%" stopColor="rgba(255,246,214,0.05)" />
          <stop offset="100%" stopColor="rgba(255,246,214,0)" />
        </radialGradient>
        <radialGradient id="pgs-spot" cx="50%" cy="72%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,240,0.10)" />
          <stop offset="100%" stopColor="rgba(255,255,240,0)" />
        </radialGradient>
      </defs>

      {/* sky */}
      <rect x="0" y="0" width="400" height="200" fill="url(#pgs-sky)" />

      {/* upper tier (curved) */}
      <path d="M0 12 Q200 -6 400 12 L400 42 Q200 26 0 42 Z" fill="url(#pgs-tier)" />
      {[0, 1].map(row => (
        <g key={`u${row}`} opacity={0.4 - row * 0.1}>
          {Array.from({ length: 50 }, (_, i) => (
            <circle key={i} cx={4 + i * 8 + (row % 2) * 4} cy={20 + row * 9 - Math.sin((i / 50) * Math.PI) * 7} r={1.7}
              fill={`hsl(${(i * 53 + row * 97) % 360} 32% ${50 - row * 6}%)`} />
          ))}
        </g>
      ))}
      {/* tier divider with light strip */}
      <path d="M0 44 Q200 28 400 44 L400 48 Q200 32 0 48 Z" fill="hsl(224 24% 16%)" />
      <path d="M0 45.5 Q200 29.5 400 45.5" stroke="rgba(255,246,214,0.25)" strokeWidth="1" fill="none" />

      {/* lower tier (deeper, larger crowd) */}
      <path d="M0 48 Q200 32 400 48 L400 92 Q200 80 0 92 Z" fill="url(#pgs-tier)" />
      {[0, 1, 2].map(row => (
        <g key={`l${row}`} opacity={0.55 - row * 0.12}>
          {Array.from({ length: 46 }, (_, i) => (
            <circle key={i} cx={4 + i * 8.7 + (row % 2) * 4} cy={56 + row * 11 - Math.sin((i / 46) * Math.PI) * 9} r={2}
              fill={`hsl(${(i * 71 + row * 53) % 360} 30% ${52 - row * 7}%)`} />
          ))}
        </g>
      ))}

      {/* floodlight wash over the stands */}
      <rect x="0" y="0" width="400" height="120" fill="url(#pgs-flood)" />
      {/* floodlight glows */}
      <circle cx="52" cy="6" r="18" fill="rgba(255,250,225,0.20)" />
      <circle cx="348" cy="6" r="18" fill="rgba(255,250,225,0.20)" />

      {/* hoardings */}
      <rect x="0" y="92" width="400" height="11" fill="hsl(222 26% 13%)" />
      <rect x="0" y="92" width="400" height="11" fill="url(#pgs-flood)" opacity="0.45" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={8 + i * 50} y={95.5} width={30} height={4} rx={1} fill="rgba(255,255,255,0.09)" />
      ))}

      {/* pitch */}
      <rect x="0" y="103" width="400" height="197" fill="url(#pgs-grass)" />
      {[0, 1, 2, 3, 4].map(i => (
        <polygon key={i}
          points={`${30 + i * 72},103 ${66 + i * 72},103 ${88 + i * 76},300 ${6 + i * 76},300`}
          fill="rgba(255,255,255,0.028)" />
      ))}
      {/* penalty-spot spotlight */}
      <rect x="0" y="103" width="400" height="197" fill="url(#pgs-spot)" />

      {/* net — perspective grid to a back plane */}
      <g stroke="rgba(255,255,255,0.28)" strokeWidth="0.8">
        <rect x="72" y="104" width="256" height="118" fill="rgba(230,240,255,0.05)" stroke="none" />
        {Array.from({ length: 15 }, (_, i) => (
          <line key={`v${i}`} x1={48 + i * 21.7} y1={92} x2={72 + i * 18.3} y2={104} opacity="0.5" />
        ))}
        {Array.from({ length: 15 }, (_, i) => (
          <line key={`vb${i}`} x1={72 + i * 18.3} y1={104} x2={72 + i * 18.3} y2={222} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <line key={`h${i}`} x1={72} y1={104 + i * 16.9} x2={328} y2={104 + i * 16.9} />
        ))}
        <line x1={48} y1={92} x2={72} y2={104} />
        <line x1={352} y1={92} x2={328} y2={104} />
        <line x1={48} y1={228} x2={72} y2={222} />
        <line x1={352} y1={228} x2={328} y2={222} />
        <line x1={72} y1={104} x2={72} y2={222} strokeWidth="1.1" />
        <line x1={328} y1={104} x2={328} y2={222} strokeWidth="1.1" />
      </g>

      {/* goal frame */}
      <g>
        <rect x="44" y="88" width="7" height="142" rx="3" fill="#f4f6fb" />
        <rect x="349" y="88" width="7" height="142" rx="3" fill="#f4f6fb" />
        <rect x="44" y="85" width="312" height="7" rx="3" fill="#f4f6fb" />
        <rect x="44" y="88" width="2.4" height="142" fill="rgba(0,0,0,0.18)" />
        <rect x="349" y="88" width="2.4" height="142" fill="rgba(0,0,0,0.18)" />
      </g>

      {/* goal line + penalty spot */}
      <rect x="0" y="228" width="400" height="3" fill="rgba(255,255,255,0.5)" />
      <ellipse cx="200" cy="269" rx="7" ry="2.5" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}

export const PenaltyGoalScene = memo(function PenaltyGoalScene({
  keeperColor, keeperColor2, shooterColor, shooterColor2,
  aim, onAim, shot, onShotComplete, lively = true,
  slowMo = false, keeperTaunt = false, celebration = null, celebrationColor,
}: PenaltyGoalSceneProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [stamp, setStamp] = useState<null | 'goal' | 'saved' | 'off_target'>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const stampTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const draggingRef = useRef(false);
  const t = shotTimings(slowMo, shot?.power ?? 0.6);
  const runupS = t.runupMs / 1000;
  const flightS = t.flightMs / 1000;

  // Play out a shot: run-up → flight → stamp → completion callback.
  useEffect(() => {
    if (!shot) { setStamp(null); return; }
    setStamp(null);
    stampTimerRef.current = setTimeout(() => setStamp(shot.outcome), t.arriveMs);
    completeTimerRef.current = setTimeout(() => onShotComplete?.(), t.completeMs);
    return () => { clearTimeout(stampTimerRef.current); clearTimeout(completeTimerRef.current); };
    // onShotComplete/timings are intentionally captured per shot id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot?.id]);

  const emitAim = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onAim || shot) return;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const rawX = Math.max(-1, Math.min(1, (fx - GOAL.centerX) / GOAL.halfWidth));
    const rawY = Math.max(0, Math.min(1, (GOAL.groundY - fy) / (GOAL.groundY - GOAL.barTop)));
    const snapped = snapAimToZone(rawX, rawY);
    onAim(snapped.x, snapped.y);
  };

  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onAim || shot) return;
    draggingRef.current = true;
    try { boxRef.current?.setPointerCapture(e.pointerId); } catch { /* unsupported */ }
    emitAim(e);
  };
  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) emitAim(e);
  };
  const handleUp = () => { draggingRef.current = false; };

  const w = boxRef.current?.clientWidth ?? 360;
  const h = boxRef.current?.clientHeight ?? (360 * 0.75);

  const target = shot
    ? (shot.outcome === 'off_target' ? offTargetPos(shot.aimX, shot.aimY) : aimToPos(shot.aimX, shot.aimY))
    : null;
  const reticle = aim && !shot ? aimToPos(aim.x, aim.y) : null;
  const activeZone = aim && !shot ? AIM_ZONES.find(z => z.x === aim.x && z.y === aim.y) ?? null : null;

  // Keeper dive geometry.
  const divePx = shot ? shot.diveX * GOAL.halfWidth * 0.82 * w : 0;
  const diveLift = shot ? -(shot.diveY * 0.14 * h) : 0;
  const diveRotate = shot ? Math.sign(shot.diveX || 0.001) * (18 + Math.abs(shot.diveX) * 52) : 0;

  // Curved trajectory (quadratic): control point pulled up and against the
  // shot side so the flight reads as a curling strike, like a broadcast arc.
  const trajectory = shot && target ? (() => {
    const sx = BALL_START.x * w, sy = BALL_START.y * h;
    const tx = target.x * w, ty = target.y * h;
    const cx = (sx + tx) / 2 - shot.aimX * 0.10 * w;
    const cy = Math.min(sy, ty) - 0.16 * h;
    return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
  })() : null;

  return (
    <div
      ref={boxRef}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      className={cn(
        'relative w-full aspect-[400/300] rounded-2xl overflow-hidden select-none touch-none',
        'border border-border/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_-12px_rgba(0,0,0,0.7)]',
        onAim && !shot && 'cursor-crosshair',
      )}
      role={onAim ? 'button' : undefined}
      aria-label={onAim ? 'Swipe or tap inside the goal to place your shot' : 'Penalty view'}
    >
      <SceneBackdrop />
      {lively && <CameraFlashes />}

      {/* Target zones — visible while aiming */}
      <AnimatePresence>
        {onAim && !shot && (
          <motion.div key="zones" className="absolute inset-0 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {AIM_ZONES.map(z => {
              const p = aimToPos(z.x, z.y);
              const active = activeZone?.id === z.id;
              return (
                <div key={z.id} className="absolute" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
                  <motion.div
                    className="relative -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                    style={{
                      width: active ? 46 : 34,
                      height: active ? 46 : 34,
                      borderColor: z.color,
                      boxShadow: active ? `0 0 22px -2px ${z.color}` : `0 0 10px -4px ${z.color}`,
                      opacity: active ? 1 : 0.62,
                    }}
                    animate={active ? { scale: [1, 1.12, 1] } : {}}
                    transition={{ duration: 0.9, repeat: active ? Infinity : 0 }}
                  >
                    <span className="absolute left-1/2 top-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ backgroundColor: z.color }} />
                    {active && (
                      <motion.span
                        className="absolute -inset-2 rounded-full border"
                        style={{ borderColor: z.color }}
                        initial={{ opacity: 0.8, scale: 0.8 }}
                        animate={{ opacity: 0, scale: 1.5 }}
                        transition={{ duration: 1.0, repeat: Infinity }}
                      />
                    )}
                  </motion.div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keeper */}
      <motion.div
        key={`keeper-${shot?.id ?? 'idle'}`}
        className="absolute"
        style={{ left: '50%', top: '47%', width: '13%', height: '30%', marginLeft: '-6.5%' }}
        initial={{ x: 0, y: 0, rotate: 0 }}
        animate={shot
          ? { x: divePx, y: diveLift, rotate: diveRotate, transition: { duration: flightS + 0.08, ease: [0.3, 0.7, 0.4, 1], delay: runupS } }
          : keeperTaunt
            ? { x: [0, -14, 14, 0], y: [0, -6, 0, -6], transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } }
            : { x: [0, -6, 6, 0], transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } }}
      >
        <KeeperFigure color={keeperColor} color2={keeperColor2} />
      </motion.div>

      {/* Aim reticle (free aim, outside a zone) */}
      <AnimatePresence>
        {reticle && !activeZone && (
          <motion.div
            key="reticle"
            className="absolute pointer-events-none"
            style={{ left: `${reticle.x * 100}%`, top: `${reticle.y * 100}%` }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="relative -translate-x-1/2 -translate-y-1/2">
              <motion.div
                className="w-9 h-9 rounded-full border-2 border-primary/90 shadow-[0_0_16px_-2px_hsl(43_96%_46%/0.8)]"
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="absolute left-1/2 top-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shooter — waits over the ball, run-up on the kick */}
      {shooterColor && !celebration && (
        <motion.div
          key={`shooter-${shot?.id ?? 'idle'}`}
          className="absolute pointer-events-none"
          style={{ left: '40%', top: '69%', width: '9%', height: '25%' }}
          initial={{ x: 0, y: 0, rotate: 0 }}
          animate={shot
            ? { x: w * 0.07, y: h * 0.04, rotate: [0, -7, 9, 3], transition: { duration: runupS, ease: 'easeIn' } }
            : { y: [0, -2.5, 0], transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } }}
        >
          <ShooterFigure color={shooterColor} color2={shooterColor2} />
        </motion.div>
      )}

      {/* Trajectory arc — draws in with the flight */}
      {trajectory && (
        <svg key={`traj-${shot?.id}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
          <motion.path
            d={trajectory}
            fill="none"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="1 7"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 0.9, 0.9, 0] }}
            transition={{
              pathLength: { duration: flightS, ease: 'easeOut', delay: runupS },
              opacity: { duration: flightS + 1.0, times: [0, 0.2, 0.7, 1], delay: runupS },
            }}
          />
        </svg>
      )}

      {/* Ball trail ghost */}
      {lively && shot && target && (
        <motion.div
          key={`trail-${shot.id}`}
          className="absolute pointer-events-none"
          style={{ left: 0, top: 0 }}
          initial={{ x: BALL_START.x * w, y: BALL_START.y * h, scale: 0.9, opacity: 0.3 }}
          animate={{
            x: target.x * w,
            y: [BALL_START.y * h, (target.y - 0.10) * h, target.y * h],
            scale: 0.5,
            opacity: 0,
            transition: { duration: flightS + 0.1, ease: 'easeOut', delay: runupS + 0.05 },
          }}
        >
          <div className="w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 blur-[2px]" />
        </motion.div>
      )}

      {/* Ball */}
      <motion.div
        key={`ball-${shot?.id ?? 'idle'}`}
        className="absolute pointer-events-none"
        style={{ left: 0, top: 0 }}
        initial={{ x: BALL_START.x * w, y: BALL_START.y * h, scale: 1 }}
        animate={shot && target ? {
          x: target.x * w,
          y: [BALL_START.y * h, (target.y - 0.10) * h, target.y * h],
          scale: 0.6,
          rotate: shot.aimX * 220,
          transition: { duration: flightS, ease: 'easeOut', delay: runupS },
        } : { x: BALL_START.x * w, y: BALL_START.y * h, scale: 1 }}
      >
        <div className="w-[22px] h-[22px] -translate-x-1/2 -translate-y-1/2">
          <WorldCupBall />
        </div>
      </motion.div>

      {/* Impact FX */}
      <AnimatePresence>
        {stamp === 'goal' && target && (
          <motion.div
            key="netripple"
            className="absolute pointer-events-none rounded-full"
            style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%`, width: 14, height: 14, marginLeft: -7, marginTop: -7, background: 'radial-gradient(circle, rgba(255,255,255,0.9), rgba(255,255,255,0))' }}
            initial={{ opacity: 0.9, scale: 0.4 }}
            animate={{ opacity: 0, scale: 5.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        )}
        {stamp === 'goal' && (
          <motion.div
            key="goalflash"
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 50% 40%, hsl(43 96% 60% / 0.30), rgba(0,0,0,0) 65%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          />
        )}
        {stamp === 'saved' && (
          <motion.div
            key="saveflash"
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 50% 45%, rgba(255,120,90,0.16), rgba(0,0,0,0))' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>

      {/* End-of-shootout beat */}
      <AnimatePresence>
        {celebration === 'win' && (
          <motion.div key="celebrate" className="absolute inset-0 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
              <motion.div
                key={i}
                className="absolute w-3.5 h-3.5 rounded-full border border-white/70"
                style={{
                  backgroundColor: celebrationColor ?? '#fbbf24',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.4)',
                  left: `${8 + (i % 2) * 78}%`,
                  top: '96%',
                }}
                initial={{ x: 0, y: 0, opacity: 0 }}
                animate={{
                  x: (w * (0.42 + (i % 4) * 0.05)) - (w * (0.08 + (i % 2) * 0.78)),
                  y: -(h * (0.30 + (i % 3) * 0.07)),
                  opacity: 1,
                }}
                transition={{ duration: 0.9 + i * 0.12, ease: 'easeOut', delay: 0.15 + i * 0.09 }}
              />
            ))}
            <motion.div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(circle at 50% 45%, hsl(43 96% 60% / 0.22), rgba(0,0,0,0) 70%)' }}
              animate={{ opacity: [0, 1, 0.5, 1, 0.6] }}
              transition={{ duration: 2.4 }}
            />
          </motion.div>
        )}
        {celebration === 'loss' && (
          <motion.div
            key="loss"
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(8,10,16,0.55), rgba(8,10,16,0.75))' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4 }}
          />
        )}
      </AnimatePresence>

      {/* Result stamp */}
      <AnimatePresence>
        {stamp && (
          <motion.div
            key={`stamp-${shot?.id}`}
            className="absolute inset-x-0 top-[36%] flex justify-center pointer-events-none"
            initial={{ opacity: 0, scale: 1.7, rotate: stamp === 'goal' ? -5 : 4 }}
            animate={{ opacity: 1, scale: 1, rotate: stamp === 'goal' ? -3 : 2 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
          >
            <span
              className={cn(
                'font-display font-black italic tracking-wider text-4xl px-4 py-1 rounded-xl backdrop-blur-[2px]',
                stamp === 'goal' && 'text-emerald-300 bg-emerald-500/15 [text-shadow:0_0_24px_rgba(16,185,129,0.9)]',
                stamp === 'saved' && 'text-red-300 bg-red-500/15 [text-shadow:0_0_24px_rgba(239,68,68,0.8)]',
                stamp === 'off_target' && 'text-amber-300 bg-amber-500/15 [text-shadow:0_0_24px_rgba(245,158,11,0.8)]',
              )}
            >
              {stamp === 'goal' ? 'GOAL!' : stamp === 'saved' ? 'SAVED!' : 'OFF TARGET!'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
