import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { Player } from '@/types/game';
import { PlayerCard } from '@/components/game/PlayerCard';
import { PACK_ANIM, LEGENDARY_OVR_THRESHOLD } from '@/config/packs';
import { tierForOvr } from './packHelpers';
import { PackConfetti } from './PackConfetti';
import { WalkoutStadium } from './WalkoutStadium';
import { useTypewriter } from './useTypewriter';
import { hapticHeavy, hapticLight, hapticMedium } from '@/utils/haptics';

interface WalkoutRevealProps {
  player: Player;
  /** Called when the walkout finishes and the card should fall back into the grid. */
  onComplete: () => void;
}

// Walkout hero card width. xl PlayerCard is 220px natural — we scale to
// this width so the card reads bigger than any other card in the app
// without leaving the reusable PlayerCard visual behind.
const WALKOUT_CARD_W = 244;
const PLAYER_CARD_XL_W = 220;
const CARD_SCALE = WALKOUT_CARD_W / PLAYER_CARD_XL_W;

/**
 * 84+ hero reveal. The walkout card IS the real {@link PlayerCard} under a
 * cinematic frame — no bespoke card visual, so the walkout matches every
 * other card surface in the app pixel for pixel.
 *
 * Beats:
 *   enter → card scales in face-down (tier back, holo ring, halo)
 *   name  → typewriter name + tier label under the card
 *   flip  → 3D Y-flip reveals the real PlayerCard; flash + shockwave
 *   hold  → potential bar + subtle bob; hold ~2.2s
 *   done  → onComplete()
 */
export function WalkoutReveal({ player, onComplete }: WalkoutRevealProps) {
  const tier = tierForOvr(player.overall);
  const isLegendary = player.overall >= LEGENDARY_OVR_THRESHOLD;
  const prefersReducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<'enter' | 'name' | 'flip' | 'hold' | 'done'>('enter');

  const name = `${player.firstName} ${player.lastName}`.toUpperCase();
  const typed = useTypewriter(
    name,
    PACK_ANIM.walkout.typewriterPerCharMs,
    phase === 'name' || phase === 'flip' || phase === 'hold',
    !!prefersReducedMotion,
  );

  useEffect(() => {
    hapticLight();
    const enterMs = 520;
    const nameMs = Math.max(520, name.length * PACK_ANIM.walkout.typewriterPerCharMs + 120);
    const flipMs = 720;

    const t1 = window.setTimeout(() => { setPhase('name'); hapticMedium(); }, enterMs);
    const t2 = window.setTimeout(() => { setPhase('flip'); hapticHeavy(); }, enterMs + nameMs);
    const t3 = window.setTimeout(() => { setPhase('hold'); }, enterMs + nameMs + flipMs);
    const t4 = window.setTimeout(() => { setPhase('done'); onComplete(); },
      enterMs + nameMs + flipMs + PACK_ANIM.walkout.holdMs);

    return () => { [t1, t2, t3, t4].forEach(window.clearTimeout); };
  }, [name.length, onComplete]);

  const skip = () => {
    if (phase === 'done') return;
    setPhase('done');
    onComplete();
  };

  const revealed = phase === 'flip' || phase === 'hold';
  const tierGradient = `linear-gradient(135deg, ${tier.gradientFrom} 0%, ${tier.gradientVia} 45%, ${tier.gradientTo} 100%)`;

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0, scale: 1 }}
      // Slow cinematic camera push-in across the walkout.
      animate={{ opacity: 1, scale: prefersReducedMotion ? 1 : 1.05 }}
      exit={{ opacity: 0 }}
      transition={{ opacity: { duration: 0.25 }, scale: { duration: 6.5, ease: 'easeOut' } }}
      onClick={skip}
    >
      {/* Deep tier vignette — darker than the overlay behind it so the grid
          of reveal cards visually recedes even further during the walkout. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 46%, ${tier.gradientFrom}26 0%, rgba(0,0,0,0.82) 52%, #000 85%)`,
        }}
      />

      {/* Legendary stadium dressing — spotlight, igniting floodlights, fog,
          a hero silhouette behind the card, and a crowd flecked with
          camera flashes. Only the very top tier earns the full walkout. */}
      {isLegendary && <WalkoutStadium accent={tier.gradientVia} revealed={revealed} />}

      {/* Legendary rotating sun rays — tempo slowed; blur dropped so rays
          stay on the compositor fast path. */}
      {isLegendary && !prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ willChange: 'transform' }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 32, ease: 'linear' }}
        >
          <div
            className="w-[160vw] h-[160vw] max-w-none rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, rgba(253,224,71,0.0) 0deg, rgba(253,224,71,0.16) 6deg, rgba(253,224,71,0.0) 14deg, rgba(253,224,71,0.0) 45deg, rgba(253,224,71,0.12) 52deg, rgba(253,224,71,0.0) 60deg, rgba(253,224,71,0.0) 90deg, rgba(253,224,71,0.16) 98deg, rgba(253,224,71,0.0) 106deg, rgba(253,224,71,0.0) 135deg, rgba(253,224,71,0.12) 142deg, rgba(253,224,71,0.0) 150deg, rgba(253,224,71,0.0) 180deg, rgba(253,224,71,0.16) 188deg, rgba(253,224,71,0.0) 196deg, rgba(253,224,71,0.0) 225deg, rgba(253,224,71,0.12) 232deg, rgba(253,224,71,0.0) 240deg, rgba(253,224,71,0.0) 270deg, rgba(253,224,71,0.16) 278deg, rgba(253,224,71,0.0) 286deg, rgba(253,224,71,0.0) 315deg, rgba(253,224,71,0.12) 322deg, rgba(253,224,71,0.0) 330deg, rgba(253,224,71,0.0) 360deg)',
            }}
          />
        </motion.div>
      )}

      {/* Tier halo behind the card */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[54%] rounded-full pointer-events-none"
        style={{
          width: 460,
          height: 460,
          background: `radial-gradient(circle, ${tier.gradientVia}44 0%, ${tier.gradientTo}1a 38%, transparent 72%)`,
          filter: 'blur(30px)',
        }}
      />

      {/* Legendary breathing aura */}
      {isLegendary && !prefersReducedMotion && (
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[54%] rounded-full pointer-events-none"
          style={{
            width: '80vw',
            maxWidth: 520,
            height: 520,
            background: `radial-gradient(ellipse at center, ${tier.gradientVia}33 0%, ${tier.gradientTo}1a 45%, transparent 72%)`,
            willChange: 'transform, opacity',
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: [0.55, 0.9, 0.55], scale: [0.96, 1.05, 0.96] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Floor glow disc */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-[64%] rounded-full pointer-events-none"
        style={{
          width: 280,
          height: 64,
          background: `radial-gradient(ellipse at center, ${tier.gradientTo}aa 0%, transparent 70%)`,
          filter: 'blur(8px)',
        }}
      />

      {/* Flip-beat flash — short bright overlay on card flip. */}
      <AnimatePresence>
        {phase === 'flip' && !prefersReducedMotion && (
          <motion.div
            key="flash"
            className="absolute inset-0 bg-white pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.22, 0] }}
            transition={{ duration: 0.35, times: [0, 0.35, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Floor shockwave rings on flip — expand outward at the reveal
          moment for weight. Three staggered rings over ~1.3s each. */}
      {revealed && [0, 0.18, 0.36].map((d, i) => (
        <motion.div
          key={`ring-${i}`}
          className="absolute left-1/2 -translate-x-1/2 top-[66%] rounded-full pointer-events-none"
          style={{
            border: `2px solid ${tier.gradientVia}`,
            boxShadow: `0 0 24px ${tier.gradientVia}`,
          }}
          initial={{ width: 40, height: 14, opacity: 0.9 }}
          animate={{ width: 560, height: 200, opacity: 0 }}
          transition={{ duration: 1.3, delay: d, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}

      {/* Hero card — 3D flip wrapper around the face-down back and a real
          PlayerCard on the face. Scales the xl PlayerCard (220px) up to
          244px so the walkout reads larger than any other card surface
          without introducing a bespoke visual. */}
      <motion.div
        className="relative"
        style={{
          width: WALKOUT_CARD_W,
          aspectRatio: '3 / 4',
          perspective: 1400,
          willChange: 'transform, opacity',
        }}
        initial={{ opacity: 0, scale: 0.45, y: 40 }}
        animate={{
          opacity: 1,
          scale: phase === 'hold' && !prefersReducedMotion ? [1, 1.015, 1] : 1,
          y: phase === 'hold' && !prefersReducedMotion ? [0, -4, 0] : 0,
        }}
        transition={
          phase === 'hold' && !prefersReducedMotion
            ? { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }
            : { type: 'spring', stiffness: 220, damping: 22 }
        }
      >
        {/* Holographic rotating ring just outside the card edge */}
        <div className="absolute -inset-[4px] rounded-[22px] holo-ring pointer-events-none" aria-hidden />

        {/* Tier-tinted inner glow — static under reduced motion. */}
        <motion.div
          className="absolute -inset-[2px] rounded-[20px] pointer-events-none"
          style={{ background: tierGradient, filter: 'blur(12px)', opacity: 0.55 }}
          animate={prefersReducedMotion ? undefined : { opacity: [0.42, 0.72, 0.42] }}
          transition={prefersReducedMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Flip card wrapper */}
        <motion.div
          className="absolute inset-0"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: revealed ? 180 : 0 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Back — tier-gradient with marble specular, monogram crest,
              Dynasty Pack / tier typography, shimmer sweep. */}
          <div
            className="absolute inset-0 rounded-2xl overflow-hidden border border-white/15 shadow-[0_24px_56px_rgba(0,0,0,0.65)]"
            style={{ backfaceVisibility: 'hidden', background: tierGradient }}
          >
            {/* Specular sheen — top-left bright, bottom-right dark — gives
                the back an inherent light direction. */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(160deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 40%),' +
                  'radial-gradient(circle at 50% 118%, rgba(0,0,0,0.55), transparent 60%)',
              }}
            />
            {/* Inset rule for the framed ornate feel */}
            <div className="absolute inset-[10px] rounded-[14px] border border-white/25 pointer-events-none" />

            {/* Monogram crest — simple crown silhouette in a glass disc. */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white text-center px-6 pointer-events-none">
              <div className="w-[72px] h-[72px] rounded-full bg-black/35 border border-white/30 flex items-center justify-center backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_8px_24px_rgba(0,0,0,0.5)]">
                <svg viewBox="0 0 24 24" className="w-9 h-9 text-white/95" aria-hidden>
                  <path
                    d="M3 16 L5 8 L9 12 L12 5.5 L15 12 L19 8 L21 16 L21 19 L3 19 Z"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="0.75"
                    strokeLinejoin="round"
                  />
                  <circle cx="5" cy="7" r="1.1" fill="currentColor" />
                  <circle cx="12" cy="4.2" r="1.2" fill="currentColor" />
                  <circle cx="19" cy="7" r="1.1" fill="currentColor" />
                </svg>
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.42em] font-semibold text-white/85"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
                >
                  Dynasty Pack
                </p>
                <p
                  className="mt-1 text-xl font-display font-black tracking-[0.08em] uppercase"
                  style={{ textShadow: '0 2px 6px rgba(0,0,0,0.55)' }}
                >
                  {tier.label}
                </p>
              </div>
            </div>

            {/* Shimmer sweep — only before the flip, keeps the back alive. */}
            {!prefersReducedMotion && !revealed && (
              <motion.div
                className="absolute inset-0 pointer-events-none overflow-hidden"
                style={{
                  background: 'linear-gradient(115deg, transparent 32%, rgba(255,255,255,0.32) 50%, transparent 68%)',
                  mixBlendMode: 'overlay',
                }}
                initial={{ x: '-100%' }}
                animate={{ x: '120%' }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              />
            )}
          </div>

          {/* Face — the real PlayerCard, reused across the app. Scaled up to
              244px from its natural xl (220px) so the walkout hero reads
              larger than any other card in the app. */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            aria-hidden={!revealed}
          >
            <div style={{ transform: `scale(${CARD_SCALE})`, transformOrigin: 'center' }}>
              <PlayerCard
                player={player}
                size="xl"
                interactive="none"
                showConditionView={false}
              />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Nameplate + potential below the card */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[10%] text-center max-w-[90vw] px-4 pointer-events-none">
        <motion.p
          className="text-[10px] uppercase tracking-[0.4em] font-semibold mb-1.5"
          style={{ color: tier.gradientVia, textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'enter' ? 0 : 1 }}
          transition={{ duration: 0.3 }}
        >
          {tier.label}
        </motion.p>

        <h1
          className="font-display font-black leading-none tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]"
          style={{
            fontSize: 'clamp(22px, 6.5vw, 36px)',
            backgroundImage: `linear-gradient(90deg, ${tier.gradientFrom}, ${tier.gradientVia}, ${tier.gradientTo})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            minHeight: '1.1em',
          }}
        >
          {typed || ' '}
          {phase === 'name' && !prefersReducedMotion && (
            <motion.span
              className="inline-block ml-0.5"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              style={{ color: tier.gradientVia }}
            >
              |
            </motion.span>
          )}
        </h1>

        {/* Potential bar — slides in at hold. */}
        <motion.div
          className="mt-3 mx-auto max-w-[240px]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: phase === 'hold' ? 1 : 0, y: phase === 'hold' ? 0 : 10 }}
          transition={{ duration: 0.4, delay: phase === 'hold' ? 0.2 : 0 }}
        >
          <div
            className="flex items-center justify-between text-[10px] uppercase tracking-widest mb-1"
            style={{ color: tier.gradientVia }}
          >
            <span>Potential</span>
            <span>{player.potential}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${tier.gradientFrom}, ${tier.gradientTo})` }}
              initial={{ width: 0 }}
              animate={{ width: phase === 'hold' ? `${player.potential}%` : '0%' }}
              transition={{ duration: 0.7, delay: phase === 'hold' ? 0.3 : 0, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      </div>

      {/* Skip hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-white/40 pointer-events-none">
        Tap to skip
      </div>

      {/* SR announcement at reveal. */}
      {revealed && (
        <div className="sr-only" aria-live="polite" role="status">
          {`${tier.label} pull — ${player.firstName} ${player.lastName}, ${player.overall} overall, ${player.position}, ${player.nationality}.`}
        </div>
      )}

      {/* Legendary-only confetti accent on flip. */}
      {revealed && isLegendary && !prefersReducedMotion && (
        <PackConfetti count={20} hueBase={48} hueRange={24} />
      )}
    </motion.div>
  );
}
