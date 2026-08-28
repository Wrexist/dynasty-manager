/**
 * The face-down side of a player card.
 *
 * One universal FULL-BLEED artwork (`CARD_BACK_SRC`, 1024x1536, no alpha),
 * masked at render time to the silhouette of the card it is about to flip
 * into. The mask is not decorative: card fronts do NOT share one outline —
 * gold/silver are plain shields, icon carries an inner cut-out ring, and each
 * pack frame is notched differently. A back baked to any single silhouette
 * (the first cut used the Legends outline) pokes out past or falls short of
 * every other card's edge, and the pre-baked cut also sliced through the
 * artwork's own border. Masking with the SAME art url the front renders makes
 * back and front geometrically identical for every card, by construction.
 *
 * The shimmer sweep rides inside the same mask, the way PlayerCard masks its
 * legibility scrim — unmasked it would draw a rectangle across transparent
 * corners the card does not have.
 */
import { motion } from 'framer-motion';
import { CARD_BACK_SRC } from '@/config/packs';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { cn } from '@/lib/utils';

interface CardBackProps {
  /**
   * URL of the artwork the card's FACE renders (from `getPlayerCardArt`).
   * Its alpha channel becomes this back's outline, so the flip is
   * shape-perfect whatever tier shield or pack frame the player carries.
   */
  maskSrc: string;
  /** Suppress the shimmer sweep once the card has turned. */
  revealed?: boolean;
  className?: string;
}

export function CardBack({ maskSrc, revealed = false, className }: CardBackProps) {
  const prefersReducedMotion = useReducedMotionPref();
  return (
    <div
      className={cn('absolute inset-0 overflow-hidden', className)}
      style={{
        WebkitMaskImage: `url(${maskSrc})`,
        maskImage: `url(${maskSrc})`,
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
      }}
    >
      <img
        src={CARD_BACK_SRC}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 w-full h-full object-fill select-none"
      />
      {!prefersReducedMotion && !revealed && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.18) 50%, transparent 62%)',
          }}
          initial={{ x: '-100%' }}
          animate={{ x: '120%' }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}
