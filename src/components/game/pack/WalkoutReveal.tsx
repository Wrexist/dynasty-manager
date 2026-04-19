import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import type { Player } from '@/types/game';
import { FlagIcon } from '@/components/game/FlagIcon';
import { PACK_ANIM, LEGENDARY_OVR_THRESHOLD } from '@/config/packs';
import { tierForOvr } from './packHelpers';
import { PackConfetti } from './PackConfetti';
import { useTypewriter } from './useTypewriter';
import { hapticHeavy, hapticLight, hapticMedium } from '@/utils/haptics';

interface WalkoutRevealProps {
  player: Player;
  /** Called when the walkout finishes and the card should fall back into the grid. */
  onComplete: () => void;
}

/**
 * The 84+ walkout. A full-screen takeover inside the pack overlay:
 *   1. Backlight beam rises from below.
 *   2. Player silhouette fades in and floats up on the beam.
 *   3. Lens flare pulses at beam top.
 *   4. Name types character-by-character.
 *   5. OVR counter rolls from 1 to the real value, then locks with a shake.
 *   6. Tier-tinted confetti retriggers.
 *   7. Legendary tier adds rotating laurel rays and a pulsing outer glow.
 *
 * Totally self-contained — parent just mounts us, awaits onComplete, and
 * unmounts. All animations are transform/opacity only for GPU smoothness.
 */
export function WalkoutReveal({ player, onComplete }: WalkoutRevealProps) {
  const tier = tierForOvr(player.overall);
  const isLegendary = player.overall >= LEGENDARY_OVR_THRESHOLD;

  const [phase, setPhase] = useState<'beam' | 'silhouette' | 'name' | 'ovr' | 'hold' | 'done'>('beam');

  const ovrMV = useMotionValue(1);
  const ovrDisplay = useTransform(ovrMV, (v) => Math.round(v).toString());

  const name = `${player.firstName} ${player.lastName}`.toUpperCase();
  const typed = useTypewriter(name, PACK_ANIM.walkout.typewriterPerCharMs, phase === 'name' || phase === 'ovr' || phase === 'hold');

  // Orchestrate the beats.
  useEffect(() => {
    hapticLight();
    const t1 = window.setTimeout(() => { setPhase('silhouette'); hapticMedium(); }, PACK_ANIM.walkout.slitMs);
    const t2 = window.setTimeout(() => { setPhase('name'); }, PACK_ANIM.walkout.slitMs + PACK_ANIM.walkout.silhouetteMs);
    const t3 = window.setTimeout(() => {
      setPhase('ovr');
      hapticHeavy();
      animate(ovrMV, player.overall, {
        duration: PACK_ANIM.walkout.ovrRollMs / 1000,
        ease: [0.16, 1, 0.3, 1],
      });
    }, PACK_ANIM.walkout.slitMs + PACK_ANIM.walkout.silhouetteMs + name.length * PACK_ANIM.walkout.typewriterPerCharMs + 120);
    const t4 = window.setTimeout(() => {
      setPhase('hold');
    }, PACK_ANIM.walkout.slitMs + PACK_ANIM.walkout.silhouetteMs + name.length * PACK_ANIM.walkout.typewriterPerCharMs + 120 + PACK_ANIM.walkout.ovrRollMs + 180);
    const t5 = window.setTimeout(() => {
      setPhase('done');
      onComplete();
    }, PACK_ANIM.walkout.slitMs + PACK_ANIM.walkout.silhouetteMs + name.length * PACK_ANIM.walkout.typewriterPerCharMs + 120 + PACK_ANIM.walkout.ovrRollMs + 180 + PACK_ANIM.walkout.holdMs);

    return () => { [t1, t2, t3, t4, t5].forEach(window.clearTimeout); };
  }, [player.overall, ovrMV, name.length, onComplete]);

  const skip = () => {
    if (phase === 'done') return;
    setPhase('done');
    onComplete();
  };

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={skip}
    >
      {/* Dark tier vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 60%, ${tier.gradientFrom}22 0%, #000 70%)`,
        }}
      />

      {/* Legendary rotating laurel rays */}
      {isLegendary && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 22, ease: 'linear' }}
        >
          <div
            className="w-[160vw] h-[160vw] max-w-none"
            style={{
              background:
                'conic-gradient(from 0deg, rgba(253,224,71,0.0) 0deg, rgba(253,224,71,0.18) 8deg, rgba(253,224,71,0.0) 18deg, rgba(253,224,71,0.0) 45deg, rgba(253,224,71,0.14) 52deg, rgba(253,224,71,0.0) 62deg, rgba(253,224,71,0.0) 90deg, rgba(253,224,71,0.18) 98deg, rgba(253,224,71,0.0) 108deg, rgba(253,224,71,0.0) 135deg, rgba(253,224,71,0.14) 142deg, rgba(253,224,71,0.0) 152deg, rgba(253,224,71,0.0) 180deg, rgba(253,224,71,0.18) 188deg, rgba(253,224,71,0.0) 198deg, rgba(253,224,71,0.0) 225deg, rgba(253,224,71,0.14) 232deg, rgba(253,224,71,0.0) 242deg, rgba(253,224,71,0.0) 270deg, rgba(253,224,71,0.18) 278deg, rgba(253,224,71,0.0) 288deg, rgba(253,224,71,0.0) 315deg, rgba(253,224,71,0.14) 322deg, rgba(253,224,71,0.0) 332deg, rgba(253,224,71,0.0) 360deg)',
              borderRadius: '50%',
              filter: 'blur(4px)',
            }}
          />
        </motion.div>
      )}

      {/* Backlight beam rising from below */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[340px] max-w-[80vw]"
        style={{
          height: '120%',
          transformOrigin: '50% 100%',
          background: `linear-gradient(to top, ${tier.gradientFrom}cc 0%, ${tier.gradientVia}77 45%, ${tier.gradientTo}11 85%, transparent 100%)`,
          filter: 'blur(1px)',
        }}
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ duration: PACK_ANIM.walkout.slitMs / 1000, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Secondary sharper beam */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[90px]"
        style={{
          height: '110%',
          transformOrigin: '50% 100%',
          background: `linear-gradient(to top, ${tier.gradientTo} 0%, ${tier.gradientVia}88 50%, transparent 100%)`,
          filter: 'blur(3px)',
          mixBlendMode: 'screen',
        }}
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: [0, 0.9, 0.6] }}
        transition={{ duration: PACK_ANIM.walkout.slitMs / 1000, ease: 'easeOut' }}
      />

      {/* Floor glow disc */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 bottom-[22%] rounded-full"
        style={{
          width: 260,
          height: 60,
          background: `radial-gradient(ellipse at center, ${tier.gradientTo}aa 0%, transparent 70%)`,
          filter: 'blur(6px)',
        }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: PACK_ANIM.walkout.slitMs / 1000, duration: 0.5 }}
      />

      {/* Floor shockwave rings — expand outward at OVR lock-in for weight */}
      {(phase === 'ovr' || phase === 'hold') && [0, 0.15].map((d, i) => (
        <motion.div
          key={`ring-${i}`}
          className="absolute left-1/2 -translate-x-1/2 bottom-[20%] rounded-full pointer-events-none"
          style={{
            border: `2px solid ${tier.gradientTo}`,
            boxShadow: `0 0 24px ${tier.gradientTo}`,
          }}
          initial={{ width: 40, height: 14, opacity: 0.9 }}
          animate={{ width: 520, height: 180, opacity: 0 }}
          transition={{ duration: 1.1, delay: d, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}

      {/* Lens flare at beam top */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
        style={{
          top: '22%',
          width: 260,
          height: 260,
          background: `radial-gradient(circle, ${tier.gradientTo}dd 0%, ${tier.gradientVia}55 30%, transparent 65%)`,
          filter: 'blur(10px)',
        }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 1, 0.6], scale: [0, 2, 1.6] }}
        transition={{ delay: (PACK_ANIM.walkout.slitMs + 100) / 1000, duration: 1.2, ease: 'easeOut' }}
      />

      {/* Silhouette — stylized tall outline */}
      <motion.svg
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ bottom: '18%' }}
        width={180}
        height={320}
        viewBox="0 0 180 320"
        initial={{ opacity: 0, y: 240 }}
        animate={{
          opacity: phase === 'beam' ? 0 : 1,
          y: phase === 'beam' ? 240 : 0,
        }}
        transition={{ duration: PACK_ANIM.walkout.silhouetteMs / 1000, ease: [0.22, 1, 0.36, 1] }}
      >
        <defs>
          <linearGradient id="silGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tier.gradientFrom} stopOpacity="0.95" />
            <stop offset="55%" stopColor={tier.gradientVia} stopOpacity="0.95" />
            <stop offset="100%" stopColor={tier.gradientTo} stopOpacity="0.85" />
          </linearGradient>
          <filter id="silBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>
        <g fill="url(#silGrad)" filter="url(#silBlur)">
          {/* Head */}
          <ellipse cx="90" cy="46" rx="26" ry="30" />
          {/* Neck */}
          <rect x="82" y="70" width="16" height="14" />
          {/* Torso */}
          <path d="M 40 88 Q 90 76 140 88 L 152 200 L 28 200 Z" />
          {/* Left arm */}
          <path d="M 40 92 Q 22 130 28 208 L 44 208 Q 52 150 60 100 Z" />
          {/* Right arm raised triumphantly */}
          <path d="M 140 92 Q 168 58 172 18 L 156 14 Q 144 56 124 98 Z" />
          {/* Legs */}
          <path d="M 60 200 L 86 200 L 80 310 L 62 310 Z" />
          <path d="M 94 200 L 120 200 L 118 310 L 100 310 Z" />
        </g>
      </motion.svg>

      {/* Legendary breathing outer aura behind the name block */}
      {isLegendary && (phase === 'name' || phase === 'ovr' || phase === 'hold') && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 top-[14%] rounded-full pointer-events-none"
          style={{
            width: '72vw',
            maxWidth: 460,
            height: 260,
            background: `radial-gradient(ellipse at center, ${tier.gradientTo}55 0%, ${tier.gradientVia}22 40%, transparent 70%)`,
            filter: 'blur(8px)',
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: [0.7, 1, 0.7], scale: [0.95, 1.06, 0.95] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Name */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[12%] text-center max-w-[90vw] px-4 pointer-events-none">
        <motion.div
          className="text-[11px] tracking-[0.35em] uppercase font-semibold"
          style={{ color: tier.gradientTo }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: phase === 'beam' || phase === 'silhouette' ? 0 : 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {tier.label}
        </motion.div>
        <h1
          className="font-display font-black leading-none tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]"
          style={{
            fontSize: 'clamp(28px, 8vw, 44px)',
            backgroundImage: `linear-gradient(90deg, ${tier.gradientFrom}, ${tier.gradientVia}, ${tier.gradientTo})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            minHeight: '1.1em',
          }}
        >
          {typed || '\u00A0'}
          {phase === 'name' && (
            <motion.span
              className="inline-block ml-0.5"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              style={{ color: tier.gradientTo }}
            >
              |
            </motion.span>
          )}
        </h1>

        {/* OVR + position below name */}
        <motion.div
          className="mt-3 flex items-center justify-center gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: phase === 'ovr' || phase === 'hold' ? 1 : 0, y: phase === 'ovr' || phase === 'hold' ? 0 : 10 }}
          transition={{ duration: 0.25 }}
        >
          <motion.span
            className="font-display font-black leading-none drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]"
            style={{
              fontSize: 'clamp(44px, 14vw, 72px)',
              backgroundImage: `linear-gradient(180deg, ${tier.gradientFrom}, ${tier.gradientTo})`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
            animate={phase === 'hold' ? { x: [-4, 4, -2, 2, 0] } : undefined}
            transition={{ duration: 0.4 }}
          >
            <motion.span>{ovrDisplay}</motion.span>
          </motion.span>
          <div className="flex flex-col items-start gap-1">
            <span
              className="text-sm font-bold px-2 py-0.5 rounded-md"
              style={{ background: tier.gradientFrom, color: '#fff' }}
            >
              {player.position}
            </span>
            <div className="flex items-center gap-1">
              <div className="w-6 h-4 rounded-sm overflow-hidden border border-white/30">
                <FlagIcon nationality={player.nationality} size={24} fill />
              </div>
              <span className="text-[11px] text-white/70">Age {player.age}</span>
            </div>
          </div>
        </motion.div>

        {/* Potential bar slides in at hold */}
        <motion.div
          className="mt-3 mx-auto max-w-[240px]"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: phase === 'hold' ? 1 : 0, x: phase === 'hold' ? 0 : -30 }}
          transition={{ duration: 0.35, delay: phase === 'hold' ? 0.15 : 0 }}
        >
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest mb-1" style={{ color: tier.gradientTo }}>
            <span>Potential</span>
            <span>{player.potential}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${tier.gradientFrom}, ${tier.gradientTo})` }}
              initial={{ width: 0 }}
              animate={{ width: phase === 'hold' ? `${player.potential}%` : '0%' }}
              transition={{ duration: 0.6, delay: phase === 'hold' ? 0.25 : 0, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      </div>

      {/* Skip hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-white/40 pointer-events-none">
        Tap to skip
      </div>

      {/* Screen-reader announcement. Polite so it doesn't clobber the OVR
          roll but still announces the pull clearly. Only rendered on OVR
          lock-in so it fires exactly once per walkout. */}
      {(phase === 'ovr' || phase === 'hold') && (
        <div className="sr-only" aria-live="polite" role="status">
          {`${tier.label} pull — ${player.firstName} ${player.lastName}, ${player.overall} overall, ${player.position}, ${player.nationality}.`}
        </div>
      )}

      {/* Confetti retrigger when name/OVR are up */}
      {(phase === 'ovr' || phase === 'hold') && (
        <PackConfetti
          count={isLegendary ? PACK_ANIM.confetti.icon : PACK_ANIM.confetti.legendary}
          hueBase={isLegendary ? 48 : 38}
          hueRange={24}
        />
      )}
    </motion.div>
  );
}
