/**
 * The face-down side of a player card.
 *
 * One universal back for every pack. The tier tell lives in the glow and the
 * holographic ring the callers draw OUTSIDE the card edge, not in the artwork,
 * so a single asset serves Champions through Legends.
 *
 * Geometry is not decorative here. The front is a `PlayerCard` whose ALPHA is
 * the card's edge (a scalloped shield, `aspect-[2/3]`, 1024x1536 art). The
 * back it flips out of must be the same aspect and the same silhouette, or the
 * card changes shape mid-flip — the walkout back used to be a rounded 3:4
 * rectangle, 41px shorter than the face it turned into.
 *
 * The shimmer is therefore masked to the artwork's own alpha, the same way
 * PlayerCard masks its legibility scrim: an unmasked sweep would draw a
 * rectangle across the transparent corners the card does not have.
 */
import { motion } from 'framer-motion';
import { CARD_BACK_SRC } from '@/config/packs';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { cn } from '@/lib/utils';

interface CardBackProps {
  /** Suppress the shimmer sweep once the card has turned. */
  revealed?: boolean;
  className?: string;
}

export function CardBack({ revealed = false, className }: CardBackProps) {
  const prefersReducedMotion = useReducedMotionPref();
  const mask = {
    WebkitMaskImage: `url(${CARD_BACK_SRC})`,
    maskImage: `url(${CARD_BACK_SRC})`,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  } as const;

  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      <img
        src={CARD_BACK_SRC}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain select-none"
      />
      {!prefersReducedMotion && !revealed && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            ...mask,
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
