import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { PackPlayerPlacement, Player } from '@/types/game';
import { FlagIcon } from '@/components/game/FlagIcon';
import { cn } from '@/lib/utils';
import { tierForOvr, tierGradient } from './packHelpers';
import { PACK_ANIM } from '@/config/packs';
import { hapticMedium } from '@/utils/haptics';

interface PackCardProps {
  player: Player;
  /** When true, the card is face-up; when false, it shows the tier-coloured back. */
  revealed: boolean;
  onReveal?: () => void;
  /** Staggered entrance delay (seconds). */
  entranceDelay?: number;
  /** When provided, renders a small × on the face to quick-release. */
  onDismiss?: () => void;
  /** Where this pull landed in the squad after auto-place. */
  placement?: PackPlayerPlacement;
}

const PLACEMENT_STYLES: Record<PackPlayerPlacement, { label: string; className: string }> = {
  starter: { label: 'Starter', className: 'bg-emerald-500/90 text-white border-emerald-300/60' },
  bench: { label: 'Bench', className: 'bg-sky-500/90 text-white border-sky-300/60' },
  squad: { label: 'Squad', className: 'bg-black/60 text-white/90 border-white/30' },
};

/**
 * A single revealable player card. Slides up from below face-down, then
 * flips on tap. The flip itself is a 3D rotateY with perspective on the
 * parent.
 */
export const PackCard = memo(function PackCard({ player, revealed, onReveal, entranceDelay = 0, onDismiss, placement }: PackCardProps) {
  const tier = tierForOvr(player.overall);
  const [hovered, setHovered] = useState(false);
  const placementStyle = placement ? PLACEMENT_STYLES[placement] : null;

  const handleClick = () => {
    if (revealed || !onReveal) return;
    hapticMedium();
    onReveal();
  };

  const handleDismiss = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!onDismiss) return;
    onDismiss();
  };

  return (
    <motion.div
      onClick={handleClick}
      onKeyDown={(e) => { if (!revealed && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleClick(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative block w-[150px] aspect-[3/4] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-2xl',
        !revealed && onReveal && 'cursor-pointer',
      )}
      role={!revealed && onReveal ? 'button' : undefined}
      tabIndex={!revealed && onReveal ? 0 : undefined}
      style={{ perspective: 1100 }}
      initial={{ opacity: 0, y: 120, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: entranceDelay, type: 'spring', stiffness: 240, damping: 22 }}
      aria-label={revealed ? `${player.firstName} ${player.lastName}, ${player.overall} overall` : 'Tap to reveal'}
    >
      <motion.div
        className="relative w-full h-full rounded-2xl"
        style={{ transformStyle: 'preserve-3d' }}
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
          {/* Diagonal shimmer */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)' }}
            initial={{ x: '-100%' }}
            animate={{ x: '120%' }}
            transition={{ repeat: Infinity, repeatDelay: 2.4, duration: 1.4, ease: 'easeInOut' }}
          />
        </div>

        {/* Face */}
        <div
          className={cn(
            'absolute inset-0 rounded-2xl overflow-hidden border shadow-[0_18px_36px_rgba(0,0,0,0.55)]',
            'border-white/15',
          )}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: tierGradient(tier) }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/50" />
          <div className="relative h-full flex flex-col px-3 py-3 text-white">
            {/* Placement badge — tells the user where this pull landed */}
            {revealed && placementStyle && (
              <div
                className={cn(
                  'absolute top-1 left-1 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border backdrop-blur z-10',
                  placementStyle.className,
                )}
                aria-label={`Placed as ${placementStyle.label}`}
              >
                {placementStyle.label}
              </div>
            )}

            {/* Quick-release × (summary only) */}
            {revealed && onDismiss && (
              <button
                type="button"
                onClick={handleDismiss}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/55 hover:bg-black/80 border border-white/25 flex items-center justify-center z-10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                aria-label={`Release ${player.firstName} ${player.lastName}`}
                title="Release (1 week severance)"
              >
                <X className="w-3 h-3 text-white/90" />
              </button>
            )}

            {/* Top row */}
            <div className="flex items-start justify-between">
              <div className="flex flex-col leading-none">
                <span className="text-4xl font-display font-black drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">{player.overall}</span>
                <span className="mt-0.5 text-[11px] font-semibold tracking-wider opacity-90">{player.position}</span>
              </div>
              <div className="w-7 h-5 rounded-sm overflow-hidden border border-white/30 bg-black/30">
                <FlagIcon nationality={player.nationality} size={28} fill />
              </div>
            </div>

            {/* Body — placeholder for AI-art slot */}
            <div className="flex-1 flex items-center justify-center my-1">
              <div className="w-16 h-16 rounded-full bg-black/25 border border-white/15 flex items-center justify-center">
                <span className="text-xl font-bold text-white/70">{player.firstName[0]}{player.lastName[0]}</span>
              </div>
            </div>

            {/* Name */}
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80 truncate">{player.firstName}</p>
              <p className="text-base font-display font-bold leading-tight truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{player.lastName}</p>
            </div>

            {/* Footer stat strip */}
            <div className="mt-2 grid grid-cols-3 gap-1 text-[9px] font-semibold uppercase">
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
                <span className="opacity-70">DEF</span>
                <span className="ml-1">{player.attributes.defending}</span>
              </div>
              <div className="rounded-sm bg-black/30 px-1.5 py-0.5 text-center">
                <span className="opacity-70">PHY</span>
                <span className="ml-1">{player.attributes.physical}</span>
              </div>
              <div className="rounded-sm bg-black/30 px-1.5 py-0.5 text-center">
                <span className="opacity-70">AGE</span>
                <span className="ml-1">{player.age}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});
