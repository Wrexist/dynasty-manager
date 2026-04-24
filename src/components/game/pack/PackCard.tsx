import { memo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Player } from '@/types/game';
import { cn } from '@/lib/utils';
import { tierForOvr, tierGradient } from './packHelpers';
import { PACK_ANIM } from '@/config/packs';
import { hapticMedium } from '@/utils/haptics';
import { PlayerCard } from '@/components/game/PlayerCard';

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
  const prefersReducedMotion = useReducedMotion();
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
        'relative block w-[150px] aspect-[3/4] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-2xl',
        canReveal && 'cursor-pointer',
      )}
      role={canReveal ? 'button' : undefined}
      tabIndex={canReveal ? 0 : undefined}
      style={{ perspective: 1100 }}
      initial={{ opacity: 0, y: 120, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: entranceDelay, type: 'spring', stiffness: 180, damping: 24 }}
      aria-label={revealed ? undefined : 'Tap to reveal'}
    >
      <motion.div
        className="relative w-full h-full rounded-2xl"
        style={{
          transformStyle: 'preserve-3d',
          // Narrow the GPU layer hint to moments the card is actually
          // about to animate — hover primes the hidden face, revealed
          // keeps the face composited while on screen.
          willChange: hovered || revealed ? 'transform' : 'auto',
        }}
        animate={{ rotateY: revealed ? 180 : 0, scale: hovered && !revealed ? 1.03 : 1 }}
        transition={{ duration: PACK_ANIM.flipMs / 1000, type: 'spring', stiffness: 180, damping: 18 }}
      >
        {/* Back */}
        <div
          className="absolute inset-0 rounded-2xl border border-border/60 overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.6)]"
          style={{ backfaceVisibility: 'hidden', background: tierGradient(tier) }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/40" />
          <div className="absolute inset-[6px] rounded-[10px] border border-white/15 pointer-events-none" />
          <div className="relative h-full flex flex-col items-center justify-center gap-2 text-center px-3">
            <div className="w-10 h-10 rounded-full bg-black/30 backdrop-blur flex items-center justify-center">
              <span className="text-white text-lg font-display font-black">?</span>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-white/80 font-semibold">Tap to reveal</span>
          </div>
          {!revealed && !prefersReducedMotion && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)' }}
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
