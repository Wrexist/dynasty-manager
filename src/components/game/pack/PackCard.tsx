import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import type { Player } from '@/types/game';
import { cn } from '@/lib/utils';
import { tierForOvr, tierGradient } from './packHelpers';
import { PACK_ANIM } from '@/config/packs';
import { hapticMedium } from '@/utils/haptics';
import { PlayerCard, PLAYER_CARD_SIZE_PX } from '@/components/game/PlayerCard';
import { PackCardAura } from './PackCardAura';

// easeInOutCubic + a one-shot scale-compression for the flip. Module-level
// so the keyframe arrays keep a stable reference across renders — otherwise
// Framer Motion would re-fire the compression on every re-render while the
// card stays revealed.
// Typed as a fixed 4-tuple so framer-motion v12 accepts it as a cubic-bezier
// Easing rather than a generic number[] (which it rejects).
const FLIP_EASE: [number, number, number, number] = [0.65, 0, 0.35, 1];
const FLIP_SCALE_KEYFRAMES = [1, 0.9, 1.04, 1];
const FLIP_SCALE_TIMES = [0, 0.42, 0.72, 1];

interface PackCardProps {
  player: Player;
  /** When true, the card is face-up; when false, it shows the tier-coloured back. */
  revealed: boolean;
  onReveal?: () => void;
  /** Staggered entrance delay (seconds). */
  entranceDelay?: number;
  /** When provided, renders a small × on the face to quick-release. */
  onDismiss?: () => void;
}

/**
 * Pack-reveal wrapper around {@link PlayerCard}. Adds the face-down tier
 * back, the slide-up entrance and the 3D flip; the face visual and tap
 * cycle live inside PlayerCard so the rest of the app (squad, market,
 * player detail) can reuse the same card without duplicating code.
 *
 * Click routing:
 *  - face-down → outer wrapper captures click → onReveal
 *  - face-up   → inner PlayerCard (interactive='cycle') handles cycling
 *
 * Condition view is suppressed in pack context — a freshly-pulled player
 * has full FIT/MOR/FRM, so the bars carry no information here.
 */
export const PackCard = memo(function PackCard({ player, revealed, onReveal, entranceDelay = 0, onDismiss }: PackCardProps) {
  const tier = tierForOvr(player.overall);
  const prefersReducedMotion = useReducedMotionPref();
  // The reveal renders PlayerCard at `lg`, which is a 2:3 card whose artwork
  // supplies its own edge. So the wrapper must not put a rounded box or a glow
  // rim around it. The face-DOWN back keeps its rounding — that side really is
  // a rectangle.
  const [hovered, setHovered] = useState(false);

  const canReveal = !revealed && !!onReveal;

  const handleWrapperClick = () => {
    if (!canReveal) return;
    hapticMedium();
    onReveal!();
  };

  return (
    <motion.div
      onClick={canReveal ? handleWrapperClick : undefined}
      onKeyDown={(e) => {
        if (canReveal && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleWrapperClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-2xl',
        // Matches PlayerCard's `lg` box so the flip has no letterboxing.
        'aspect-[2/3]',
        canReveal && 'cursor-pointer',
      )}
      role={canReveal ? 'button' : undefined}
      tabIndex={canReveal ? 0 : undefined}
      style={{ width: PLAYER_CARD_SIZE_PX.lg, perspective: 1100 }}
      initial={{ opacity: 0, y: 120, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: entranceDelay, type: 'spring', stiffness: 180, damping: 24 }}
      aria-label={revealed ? undefined : 'Tap to reveal'}
    >
      {/* Rarity aura — appears the instant the card turns face-up, so the
          pull's tier reads as a glow before the stats register. */}
      {revealed && <PackCardAura tierKey={tier.key} />}

      <motion.div
        className="relative w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          // Narrow the GPU layer hint to moments the card is actually
          // about to animate — hover primes the hidden face, revealed
          // keeps the face composited while on screen.
          willChange: hovered || revealed ? 'transform' : 'auto',
        }}
        animate={{
          rotateY: revealed ? 180 : 0,
          // A brief mid-flip compression + slight overshoot sells the 3D
          // turn. Skipped under reduced motion (rotate only).
          scale: revealed
            ? (prefersReducedMotion ? 1 : FLIP_SCALE_KEYFRAMES)
            : (hovered && !revealed ? 1.03 : 1),
        }}
        transition={{
          rotateY: { duration: PACK_ANIM.flipMs / 1000, ease: FLIP_EASE },
          scale: revealed
            ? { duration: PACK_ANIM.flipMs / 1000, times: FLIP_SCALE_TIMES, ease: 'easeOut' }
            : { duration: 0.18, ease: 'easeOut' },
        }}
      >
        {/* Back — tier-gradient foil with dynasty crown monogram, inset
            rule, specular sheen and a shimmer sweep. Same visual language
            as the walkout back so the reveal feels coherent. */}
        <div
          className="absolute inset-0 rounded-2xl border border-white/15 overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.6)]"
          style={{ backfaceVisibility: 'hidden', background: tierGradient(tier) }}
        >
          {/* Specular sheen — gives the foil a top-left light direction. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(160deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 42%),' +
                'radial-gradient(circle at 50% 120%, rgba(0,0,0,0.5), transparent 60%)',
            }}
          />
          <div className="absolute inset-[6px] rounded-[10px] border border-white/25 pointer-events-none" />

          <div className="relative h-full flex flex-col items-center justify-center gap-2 text-center px-3 text-white">
            <div className="w-11 h-11 rounded-full bg-black/35 border border-white/30 flex items-center justify-center backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_6px_16px_rgba(0,0,0,0.45)]">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-white/95" aria-hidden>
                <path
                  d="M3 16 L5 8 L9 12 L12 5.5 L15 12 L19 8 L21 16 L21 19 L3 19 Z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="0.75"
                  strokeLinejoin="round"
                />
                <circle cx="5" cy="7" r="0.9" fill="currentColor" />
                <circle cx="12" cy="4.4" r="1" fill="currentColor" />
                <circle cx="19" cy="7" r="0.9" fill="currentColor" />
              </svg>
            </div>
            <span
              className="text-[9px] uppercase tracking-[0.35em] text-white/85 font-semibold"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.55)' }}
            >
              Opening
            </span>
            <span
              className="text-[9px] uppercase tracking-widest text-white/60 font-semibold mt-0.5"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.55)' }}
            >
              Tap to reveal
            </span>
          </div>
          {!revealed && !prefersReducedMotion && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.16) 50%, transparent 62%)' }}
              initial={{ x: '-100%' }}
              animate={{ x: '120%' }}
              transition={{ repeat: Infinity, repeatDelay: 4, duration: 1.4, ease: 'easeInOut' }}
            />
          )}
        </div>

        {/* Face — shared PlayerCard handles the shield visual + stat-view
            cycle. Condition view is hidden here (fresh pull = full bars). */}
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          // Block stray pointer hits on the hidden face pre-reveal — some
          // browsers still dispatch clicks through `backfaceVisibility: hidden`.
          aria-hidden={!revealed}
        >
          <PlayerCard
            player={player}
            size="lg"
            interactive={revealed ? 'cycle' : 'none'}
            showConditionView={false}
            onDismiss={revealed ? onDismiss : undefined}
            dismissLabel={`Release ${player.firstName} ${player.lastName} (1 week severance)`}
          />
        </div>
      </motion.div>
    </motion.div>
  );
});
