import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * PenaltyGoalScene — the 2.5D goal-mouth view for the interactive shootout.
 *
 * Pure presentation: the parent decides outcomes (store actions) and feeds a
 * `shot` object; this component renders the stadium, goal frame, perspective
 * net, keeper, ball flight, dive, and the GOAL/SAVED/WIDE payoff. Tap-to-aim
 * is surfaced through `onAim` with normalized goal-mouth coordinates
 * (x −1..1 left→right, y 0..1 ground→bar) — the same space the sim uses.
 *
 * All animation is transform/opacity only (GPU-friendly); heavier flourishes
 * (net ripple particles) are skipped under reduced motion via MotionConfig.
 */

export interface SceneShot {
  /** Unique per kick — remounts the animation chain. */
  id: number;
  aimX: number;
  aimY: number;
  diveX: number;
  diveY: number;
  outcome: 'goal' | 'saved' | 'off_target';
}

interface PenaltyGoalSceneProps {
  /** Keeper jersey colors (whoever is defending this kick). */
  keeperColor: string;
  keeperColor2?: string;
  /** Aim reticle position while the player is lining up (normalized). */
  aim: { x: number; y: number } | null;
  /** Tap handler — absent means the scene is watch-only (opponent kicks). */
  onAim?: (x: number, y: number) => void;
  /** The kick to animate; null shows the idle scene. */
  shot: SceneShot | null;
  /** Fired once when the shot animation has fully played out. */
  onShotComplete?: () => void;
}

// Scene geometry (fractions of the container box).
const GOAL = {
  centerX: 0.5,
  halfWidth: 0.34,   // inner post to center
  barTop: 0.20,      // y of the underside of the bar
  groundY: 0.74,     // y of the goal line
};
const BALL_START = { x: 0.5, y: 0.90 };

const FLIGHT_S = 0.38;
const RESULT_HOLD_MS = 1450;

/** Normalized aim → container-fraction position inside the goal mouth. */
function aimToPos(aimX: number, aimY: number) {
  return {
    x: GOAL.centerX + aimX * GOAL.halfWidth,
    y: GOAL.groundY - aimY * (GOAL.groundY - GOAL.barTop),
  };
}

/** Where an off-target ball ends up: past the nearer post / over the bar. */
function offTargetPos(aimX: number, aimY: number) {
  if (aimY > 0.72) return { x: GOAL.centerX + aimX * GOAL.halfWidth, y: GOAL.barTop - 0.14 };
  const side = aimX >= 0 ? 1 : -1;
  return { x: GOAL.centerX + side * (GOAL.halfWidth + 0.13), y: GOAL.groundY - aimY * (GOAL.groundY - GOAL.barTop) };
}

/** Tournament match ball — white with the World Cup ball's red/green/blue
 *  curved panels and a specular highlight. Reads at 20px. */
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
        {/* gold seams */}
        <path d="M11 12 Q7 15 0.5 13 M11 12 Q9 6 2 4 M13.5 10 Q15.5 4.5 20 2.5 M13.5 10 Q17 13.5 23 12.5 M12 14.5 Q7.5 16.5 6 22.5 M12 14.5 Q17 16 17.5 21.5"
          fill="none" stroke="#d4a017" strokeWidth="0.55" opacity="0.8" />
      </g>
      <ellipse cx="8.4" cy="7" rx="4" ry="2.6" fill="#ffffff" opacity="0.55" transform="rotate(-25 8.4 7)" />
    </svg>
  );
}

/** Stylized keeper — jersey-colored torso/arms, dark shorts, gloves. Drawn
 *  facing the shooter; the dive animates the whole group. */
function KeeperFigure({ color, color2 }: { color: string; color2?: string }) {
  const trim = color2 || '#ffffff';
  return (
    <svg viewBox="0 0 60 84" className="w-full h-full" aria-hidden="true">
      {/* arms up-and-out ready stance */}
      <path d="M12 34 Q6 24 10 16" stroke={color} strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M48 34 Q54 24 50 16" stroke={color} strokeWidth="7" strokeLinecap="round" fill="none" />
      {/* gloves */}
      <circle cx="9.5" cy="14" r="4.5" fill={trim} stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />
      <circle cx="50.5" cy="14" r="4.5" fill={trim} stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />
      {/* torso */}
      <path d="M18 30 Q30 24 42 30 L40 52 Q30 56 20 52 Z" fill={color} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
      <path d="M18 30 Q30 24 42 30 L41.4 36 Q30 31 18.6 36 Z" fill={trim} opacity="0.35" />
      {/* head */}
      <circle cx="30" cy="17" r="7.5" fill="#d9b38c" stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
      {/* shorts + legs */}
      <path d="M20.5 52 L39.5 52 L38 62 L22 62 Z" fill="#1f2430" />
      <path d="M24 62 L23 76 M36 62 L37 76" stroke="#d9b38c" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M20.5 78 L25.5 78 M34.5 78 L39.5 78" stroke="#141821" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/** Static SVG backdrop: night stadium, crowd bands, floodlights, pitch, goal
 *  frame and a perspective net. */
function SceneBackdrop() {
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id="pgs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(222 40% 5%)" />
          <stop offset="70%" stopColor="hsl(222 34% 9%)" />
          <stop offset="100%" stopColor="hsl(222 30% 12%)" />
        </linearGradient>
        <linearGradient id="pgs-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(140 42% 22%)" />
          <stop offset="100%" stopColor="hsl(142 46% 15%)" />
        </linearGradient>
        <radialGradient id="pgs-flood" cx="50%" cy="0%" r="90%">
          <stop offset="0%" stopColor="rgba(255,246,214,0.16)" />
          <stop offset="55%" stopColor="rgba(255,246,214,0.05)" />
          <stop offset="100%" stopColor="rgba(255,246,214,0)" />
        </radialGradient>
      </defs>

      {/* sky + crowd */}
      <rect x="0" y="0" width="400" height="196" fill="url(#pgs-sky)" />
      {[0, 1, 2].map(row => (
        <g key={row} opacity={0.5 - row * 0.13}>
          {Array.from({ length: 40 }, (_, i) => (
            <circle key={i} cx={5 + i * 10 + (row % 2) * 5} cy={26 + row * 13} r={2.1} fill={`hsl(${(i * 53 + row * 97) % 360} 30% ${52 - row * 8}%)`} />
          ))}
        </g>
      ))}
      <rect x="0" y="0" width="400" height="196" fill="url(#pgs-flood)" />
      {/* hoarding */}
      <rect x="0" y="64" width="400" height="12" fill="hsl(222 26% 14%)" />
      <rect x="0" y="64" width="400" height="12" fill="url(#pgs-flood)" opacity="0.5" />

      {/* pitch */}
      <rect x="0" y="76" width="400" height="184" fill="url(#pgs-grass)" />
      {/* mow stripes converging slightly for depth */}
      {[0, 1, 2, 3, 4].map(i => (
        <polygon
          key={i}
          points={`${28 + i * 74},76 ${64 + i * 74},76 ${84 + i * 78},260 ${8 + i * 78},260`}
          fill="rgba(255,255,255,0.028)"
        />
      ))}
      {/* net — perspective grid to a vanishing point behind the goal */}
      <g stroke="rgba(255,255,255,0.30)" strokeWidth="0.8">
        {/* back plane */}
        <rect x="88" y="66" width="224" height="112" fill="rgba(230,240,255,0.045)" stroke="none" />
        {Array.from({ length: 13 }, (_, i) => (
          <line key={`v${i}`} x1={64 + i * 22.7} y1={52} x2={88 + i * 18.7} y2={66} opacity="0.5" />
        ))}
        {Array.from({ length: 13 }, (_, i) => (
          <line key={`vb${i}`} x1={88 + i * 18.7} y1={66} x2={88 + i * 18.7} y2={178} />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`h${i}`} x1={88} y1={66 + i * 18.6} x2={312} y2={66 + i * 18.6} />
        ))}
        {/* side nets */}
        <line x1={64} y1={52} x2={88} y2={66} />
        <line x1={336} y1={52} x2={312} y2={66} />
        <line x1={64} y1={192} x2={88} y2={178} />
        <line x1={336} y1={192} x2={312} y2={178} />
        <line x1={88} y1={66} x2={88} y2={178} strokeWidth="1.1" />
        <line x1={312} y1={66} x2={312} y2={178} strokeWidth="1.1" />
      </g>

      {/* goal frame (drawn after net so posts sit in front) */}
      <g>
        <rect x="61" y="49" width="6" height="145" rx="2.5" fill="#f4f6fb" />
        <rect x="333" y="49" width="6" height="145" rx="2.5" fill="#f4f6fb" />
        <rect x="61" y="46" width="278" height="6" rx="2.5" fill="#f4f6fb" />
        <rect x="61" y="49" width="2" height="145" fill="rgba(0,0,0,0.18)" />
        <rect x="333" y="49" width="2" height="145" fill="rgba(0,0,0,0.18)" />
      </g>

      {/* goal line + penalty spot */}
      <rect x="0" y="192" width="400" height="3" fill="rgba(255,255,255,0.5)" />
      <ellipse cx="200" cy="236" rx="7" ry="2.6" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}

export const PenaltyGoalScene = memo(function PenaltyGoalScene({
  keeperColor, keeperColor2, aim, onAim, shot, onShotComplete,
}: PenaltyGoalSceneProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [stamp, setStamp] = useState<null | 'goal' | 'saved' | 'off_target'>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const stampTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Play out a shot: flight → stamp → completion callback.
  useEffect(() => {
    if (!shot) { setStamp(null); return; }
    setStamp(null);
    stampTimerRef.current = setTimeout(() => setStamp(shot.outcome), FLIGHT_S * 1000 + 60);
    completeTimerRef.current = setTimeout(() => onShotComplete?.(), FLIGHT_S * 1000 + RESULT_HOLD_MS);
    return () => { clearTimeout(stampTimerRef.current); clearTimeout(completeTimerRef.current); };
    // onShotComplete is intentionally captured per shot id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot?.id]);

  const handleTap = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onAim || shot) return;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    // Map container fraction → goal-mouth space, clamped to the frame.
    const x = Math.max(-1, Math.min(1, (fx - GOAL.centerX) / GOAL.halfWidth));
    const y = Math.max(0, Math.min(1, (GOAL.groundY - fy) / (GOAL.groundY - GOAL.barTop)));
    onAim(x, y);
  };

  const w = boxRef.current?.clientWidth ?? 360;
  const h = boxRef.current?.clientHeight ?? (360 * 0.65);

  const target = shot
    ? (shot.outcome === 'off_target' ? offTargetPos(shot.aimX, shot.aimY) : aimToPos(shot.aimX, shot.aimY))
    : null;
  const savedPos = shot && shot.outcome === 'saved' ? aimToPos(shot.aimX, shot.aimY) : null;
  const reticle = aim && !shot ? aimToPos(aim.x, aim.y) : null;

  // Keeper dive geometry (px offsets from its idle spot).
  const divePx = shot ? shot.diveX * GOAL.halfWidth * 0.82 * w : 0;
  const diveLift = shot ? -(shot.diveY * 0.16 * h) : 0;
  const diveRotate = shot ? Math.sign(shot.diveX || 0.001) * (18 + Math.abs(shot.diveX) * 52) : 0;

  return (
    <div
      ref={boxRef}
      onPointerDown={handleTap}
      className={cn(
        'relative w-full aspect-[400/260] rounded-2xl overflow-hidden select-none',
        'border border-border/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_-12px_rgba(0,0,0,0.7)]',
        onAim && !shot && 'cursor-crosshair',
      )}
      role={onAim ? 'button' : undefined}
      aria-label={onAim ? 'Tap inside the goal to place your shot' : 'Penalty view'}
    >
      <SceneBackdrop />

      {/* Keeper */}
      <motion.div
        key={`keeper-${shot?.id ?? 'idle'}`}
        className="absolute"
        style={{ left: '50%', top: '38%', width: '13%', height: '34%', marginLeft: '-6.5%' }}
        initial={{ x: 0, y: 0, rotate: 0 }}
        animate={shot
          ? { x: divePx, y: diveLift, rotate: diveRotate, transition: { duration: FLIGHT_S + 0.08, ease: [0.3, 0.7, 0.4, 1] } }
          : { x: [0, -6, 6, 0], transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } }}
      >
        <KeeperFigure color={keeperColor} color2={keeperColor2} />
      </motion.div>

      {/* Aim reticle */}
      <AnimatePresence>
        {reticle && (
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

      {/* Ball */}
      <motion.div
        key={`ball-${shot?.id ?? 'idle'}`}
        className="absolute pointer-events-none"
        style={{ left: 0, top: 0 }}
        initial={{
          x: BALL_START.x * w, y: BALL_START.y * h, scale: 1,
        }}
        animate={shot && target ? {
          x: target.x * w,
          y: [BALL_START.y * h, (target.y - 0.10) * h, target.y * h],
          scale: 0.62,
          rotate: shot.aimX * 220,
          transition: { duration: FLIGHT_S, ease: 'easeOut' },
        } : { x: BALL_START.x * w, y: BALL_START.y * h, scale: 1 }}
      >
        <div className="w-5 h-5 -translate-x-1/2 -translate-y-1/2">
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
        {stamp === 'saved' && savedPos && (
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

      {/* Result stamp */}
      <AnimatePresence>
        {stamp && (
          <motion.div
            key={`stamp-${shot?.id}`}
            className="absolute inset-x-0 top-[30%] flex justify-center pointer-events-none"
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
