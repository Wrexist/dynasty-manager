import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import type { Player } from '@/types/game';
import { cn } from '@/lib/utils';
import { tierForOvr } from './packHelpers';
import { PACK_ANIM } from '@/config/packs';
import { hapticMedium } from '@/utils/haptics';
import { CardBack } from '@/components/game/pack/CardBack';
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
        {/* Back — the shared universal card back. Same asset the walkout
            uses, so the grid reveal and the hero reveal are one language. */}
        <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
          <CardBack revealed={revealed} />
        </div>

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
