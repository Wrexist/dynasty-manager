import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion';
import type { Player } from '@/types/game';
import { FlagIcon } from '@/components/game/FlagIcon';
import { CardArtBackground } from '@/components/game/CardArtBackground';
import { PACK_ANIM, LEGENDARY_OVR_THRESHOLD } from '@/config/packs';
import { tierForOvr, tierGradient } from './packHelpers';
import { PackConfetti } from './PackConfetti';
import { useTypewriter } from './useTypewriter';
import { hapticHeavy, hapticLight, hapticMedium } from '@/utils/haptics';

interface WalkoutRevealProps {
  player: Player;
  /** Called when the walkout finishes and the card should fall back into the grid. */
  onComplete: () => void;
}

/**
 * 84+ hero reveal. A centered FUT-style card scales into frame inside a
 * rotating holographic border, name types in below, OVR rolls inside the
 * card, potential bar slides in. No silhouette figure — the card IS the hero.
 */
export function WalkoutReveal({ player, onComplete }: WalkoutRevealProps) {
  const tier = tierForOvr(player.overall);
  const isLegendary = player.overall >= LEGENDARY_OVR_THRESHOLD;
  const prefersReducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<'enter' | 'name' | 'ovr' | 'hold' | 'done'>('enter');

  const ovrMV = useMotionValue(1);
  const ovrDisplay = useTransform(ovrMV, (v) => Math.round(v).toString());

  const name = `${player.firstName} ${player.lastName}`.toUpperCase();
  const typed = useTypewriter(
    name,
    PACK_ANIM.walkout.typewriterPerCharMs,
    phase === 'name' || phase === 'ovr' || phase === 'hold',
    !!prefersReducedMotion,
  );

  // Beat orchestration — simpler than the old 6-phase machine.
  //   enter → card scales in (500ms settle)
  //   name  → typewriter starts
  //   ovr   → counter rolls + lock-in shake
  //   hold  → potential bar + hold ~2.2s
  //   done  → onComplete()
  useEffect(() => {
    hapticLight();
    const settleMs = 500;
    const t1 = window.setTimeout(() => { setPhase('name'); hapticMedium(); }, settleMs + 200);
    const t2 = window.setTimeout(() => {
      setPhase('ovr');
      hapticHeavy();
      animate(ovrMV, player.overall, {
        duration: PACK_ANIM.walkout.ovrRollMs / 1000,
        ease: [0.16, 1, 0.3, 1],
      });
    }, settleMs + 200 + name.length * PACK_ANIM.walkout.typewriterPerCharMs + 120);
    const t3 = window.setTimeout(() => {
      setPhase('hold');
    }, settleMs + 200 + name.length * PACK_ANIM.walkout.typewriterPerCharMs + 120 + PACK_ANIM.walkout.ovrRollMs + 180);
    const t4 = window.setTimeout(() => {
      setPhase('done');
      onComplete();
    }, settleMs + 200 + name.length * PACK_ANIM.walkout.typewriterPerCharMs + 120 + PACK_ANIM.walkout.ovrRollMs + 180 + PACK_ANIM.walkout.holdMs);

    return () => { [t1, t2, t3, t4].forEach(window.clearTimeout); };
  }, [player.overall, ovrMV, name.length, onComplete]);

  const skip = () => {
    if (phase === 'done') return;
    setPhase('done');
    onComplete();
  };

  const ovrLocked = phase === 'ovr' || phase === 'hold';

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
          background: `radial-gradient(circle at 50% 50%, ${tier.gradientFrom}22 0%, #000 70%)`,
        }}
      />

      {/* Legendary rotating laurel rays — skipped under reduced-motion.
          Blur filter dropped (the conic-gradient alpha stops already feather
          the rays) and size/rotation tempo eased for a cheaper composite. */}
      {isLegendary && !prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ willChange: 'transform' }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 28, ease: 'linear' }}
        >
          <div
            className="w-[140vw] h-[140vw] max-w-none"
            style={{
              background:
                'conic-gradient(from 0deg, rgba(253,224,71,0.0) 0deg, rgba(253,224,71,0.18) 8deg, rgba(253,224,71,0.0) 18deg, rgba(253,224,71,0.0) 45deg, rgba(253,224,71,0.14) 52deg, rgba(253,224,71,0.0) 62deg, rgba(253,224,71,0.0) 90deg, rgba(253,224,71,0.18) 98deg, rgba(253,224,71,0.0) 108deg, rgba(253,224,71,0.0) 135deg, rgba(253,224,71,0.14) 142deg, rgba(253,224,71,0.0) 152deg, rgba(253,224,71,0.0) 180deg, rgba(253,224,71,0.18) 188deg, rgba(253,224,71,0.0) 198deg, rgba(253,224,71,0.0) 225deg, rgba(253,224,71,0.14) 232deg, rgba(253,224,71,0.0) 242deg, rgba(253,224,71,0.0) 270deg, rgba(253,224,71,0.18) 278deg, rgba(253,224,71,0.0) 288deg, rgba(253,224,71,0.0) 315deg, rgba(253,224,71,0.14) 322deg, rgba(253,224,71,0.0) 332deg, rgba(253,224,71,0.0) 360deg)',
              borderRadius: '50%',
            }}
          />
        </motion.div>
      )}

      {/* Soft tier halo behind the card */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{
          width: 420,
          height: 420,
          background: `radial-gradient(circle, ${tier.gradientTo}55 0%, ${tier.gradientVia}22 40%, transparent 70%)`,
          filter: 'blur(24px)',
        }}
      />

      {/* Floor glow disc */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-[22%] rounded-full pointer-events-none"
        style={{
          width: 260,
          height: 60,
          background: `radial-gradient(ellipse at center, ${tier.gradientTo}aa 0%, transparent 70%)`,
          filter: 'blur(6px)',
        }}
      />

      {/* Floor shockwave rings — expand outward at OVR lock-in for weight */}
      {ovrLocked && [0, 0.15].map((d, i) => (
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

      {/* Legendary breathing outer aura — skipped under reduced-motion.
          Blur filter removed (softer radial alpha stops carry the feathering)
          and tempo slowed to reduce per-frame composite work. */}
      {isLegendary && !prefersReducedMotion && (
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            width: '76vw',
            maxWidth: 480,
            height: 480,
            background: `radial-gradient(ellipse at center, ${tier.gradientTo}33 0%, ${tier.gradientVia}1a 45%, transparent 72%)`,
            willChange: 'transform, opacity',
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: [0.55, 0.9, 0.55], scale: [0.96, 1.05, 0.96] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Hero card — the real FUT-style face with a rotating holo border.
          The hold-phase bob is skipped under reduced-motion. */}
      <motion.div
        className="relative"
        style={{ width: 'min(78vw, 240px)', willChange: 'transform, opacity' }}
        initial={{ opacity: 0, scale: 0.4, y: 30 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: phase === 'hold' && !prefersReducedMotion ? [0, -4, 0] : 0,
        }}
        transition={
          phase === 'hold' && !prefersReducedMotion
            ? { y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } }
            : { type: 'spring', stiffness: 220, damping: 20 }
        }
      >
        <div className="relative aspect-[3/4] rounded-2xl">
          {/* Holographic animated ring — a conic rainbow spinning just outside the card edge */}
          <div
            className="absolute -inset-[3px] rounded-[18px] holo-ring pointer-events-none"
            aria-hidden
          />
          {/* Tier-tinted inner glow that pulses subtly. Static under
              reduced-motion (no infinite opacity loop). */}
          <motion.div
            className="absolute -inset-[1px] rounded-[16px] pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${tier.gradientFrom}, ${tier.gradientTo})`,
              filter: 'blur(8px)',
              opacity: 0.55,
            }}
            animate={prefersReducedMotion ? undefined : { opacity: [0.45, 0.7, 0.45] }}
            transition={prefersReducedMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Card face */}
          <div
            className="relative w-full h-full rounded-2xl overflow-hidden border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
            style={{ background: tierGradient(tier) }}
          >
            <CardArtBackground overall={player.overall} eager overlayStrength={0.45} />
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/45 pointer-events-none" />
            <div className="absolute inset-[6px] rounded-[10px] border border-white/20 pointer-events-none" />

            {/* Static diagonal gloss */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.18) 50%, transparent 65%)' }}
            />

            <div className="relative h-full flex flex-col px-4 py-4 text-white">
              {/* Top row: OVR + position on the left, flag on the right */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col leading-none">
                  <motion.span
                    className="text-5xl font-display font-black drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] tabular-nums"
                    animate={phase === 'hold' && !prefersReducedMotion ? { x: [-3, 3, -2, 2, 0] } : undefined}
                    transition={{ duration: 0.4 }}
                  >
                    <motion.span>{ovrLocked ? ovrDisplay : '—'}</motion.span>
                  </motion.span>
                  <span className="mt-1 text-xs font-semibold tracking-wider opacity-90">{player.position}</span>
                </div>
                <div className="w-8 h-6 rounded-sm overflow-hidden border border-white/30 bg-black/30">
                  <FlagIcon nationality={player.nationality} size={32} fill />
                </div>
              </div>

              {/* Body — portrait placeholder. Initials get letter-spacing
                  so pairs like "RI" don't visually collide, and the disc
                  itself is sized so it never crowds the name below. */}
              <div className="flex-1 flex items-center justify-center my-2 min-h-0">
                <div className="w-16 h-16 rounded-full bg-black/25 border border-white/15 flex items-center justify-center">
                  <span className="text-xl font-bold text-white/75 tracking-[0.1em]">{player.firstName[0]}{player.lastName[0]}</span>
                </div>
              </div>

              {/* Tier label + last name. First name is dropped here — the
                  full name is already typewritered in below the card, so
                  duplicating it cramped the layout. */}
              <div className="text-center">
                <p
                  className="text-[10px] uppercase tracking-[0.3em] font-semibold opacity-85"
                  style={{ color: tier.gradientTo }}
                >
                  {tier.label}
                </p>
                <p className="text-lg font-display font-bold leading-tight truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] mt-0.5">
                  {player.lastName}
                </p>
              </div>

              {/* Stat strip — six core attributes, same order as PackCard
                  (PAC/SHO/PAS/DRI/DEF/PHY). Age lives on the potential row
                  below the card so we keep all six attributes on the face. */}
              <div className="mt-2 grid grid-cols-3 gap-1 text-[9px] font-semibold uppercase tabular-nums">
                <div className="rounded-sm bg-black/30 px-1.5 py-0.5 text-center">
                  <span className="opacity-70">PAC</span>
                  <span className="ml-1">{player.attributes.pace}</span>
                </div>
                <div className="rounded-sm bg-black/30 px-1.5 py-0.5 text-center">
                  <span className="opacity-70">SHO</span>
                  <span className="ml-1">{player.attributes.shooting}</span>
                </div>
                <div className="rounded-sm bg-black/30 px-1.5 py-0.5 text-center">
                  <span className="opacity-70">PAS</span>
                  <span className="ml-1">{player.attributes.passing}</span>
                </div>
                <div className="rounded-sm bg-black/30 px-1.5 py-0.5 text-center">
                  <span className="opacity-70">DRI</span>
                  <span className="ml-1">{player.attributes.mental}</span>
                </div>
                <div className="rounded-sm bg-black/30 px-1.5 py-0.5 text-center">
                  <span className="opacity-70">DEF</span>
                  <span className="ml-1">{player.attributes.defending}</span>
                </div>
                <div className="rounded-sm bg-black/30 px-1.5 py-0.5 text-center">
                  <span className="opacity-70">PHY</span>
                  <span className="ml-1">{player.attributes.physical}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Typewriter name below the card — gradient text */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[12%] text-center max-w-[90vw] px-4 pointer-events-none">
        <h1
          className="font-display font-black leading-none tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]"
          style={{
            fontSize: 'clamp(22px, 6vw, 34px)',
            backgroundImage: `linear-gradient(90deg, ${tier.gradientFrom}, ${tier.gradientVia}, ${tier.gradientTo})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            minHeight: '1.1em',
          }}
        >
          {typed || '\u00A0'}
          {phase === 'name' && !prefersReducedMotion && (
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
      {ovrLocked && (
        <div className="sr-only" aria-live="polite" role="status">
          {`${tier.label} pull — ${player.firstName} ${player.lastName}, ${player.overall} overall, ${player.position}, ${player.nationality}.`}
        </div>
      )}

      {/* Confetti retrigger when OVR locks in — only for legendary pulls,
          and skipped entirely under reduced-motion. The explosion beat
          already fired the main burst; this is a small legendary-only
          accent (was 60–80 particles, now ~16) on top of the shockwave
          rings that already carry the impact. */}
      {ovrLocked && isLegendary && !prefersReducedMotion && (
        <PackConfetti
          count={16}
          hueBase={48}
          hueRange={24}
        />
      )}
    </motion.div>
  );
}
