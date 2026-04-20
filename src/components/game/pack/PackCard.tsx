import { memo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Player } from '@/types/game';
import { FlagIcon } from '@/components/game/FlagIcon';
import { CardArtBackground } from '@/components/game/CardArtBackground';
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
}

/**
 * A single revealable player card. Slides up from below face-down, then
 * flips on tap. The flip itself is a 3D rotateY with perspective on the
 * parent.
 */
export const PackCard = memo(function PackCard({ player, revealed, onReveal, entranceDelay = 0, onDismiss }: PackCardProps) {
  const tier = tierForOvr(player.overall);
  const prefersReducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);

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
      transition={{ delay: entranceDelay, type: 'spring', stiffness: 180, damping: 24 }}
      aria-label={revealed ? `${player.firstName} ${player.lastName}, ${player.overall} overall` : 'Tap to reveal'}
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
          {/* Diagonal shimmer — only runs while face-down and when motion
              isn't reduced. repeatDelay widened so idle-time GPU cost is
              halved compared to the original 2.4s cadence. */}
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

        {/* Face */}
        <div
          className={cn(
            'absolute inset-0 rounded-2xl overflow-hidden border shadow-[0_18px_36px_rgba(0,0,0,0.55)]',
            'border-white/15',
          )}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: tierGradient(tier) }}
        >
          <CardArtBackground overall={player.overall} eager overlayStrength={0.55} />
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/40 pointer-events-none" />
          <div className="relative h-full flex flex-col px-3 py-2.5 text-white">
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

            {/* Top row — OVR on the left, flag on the right. Position now
                lives on the centre disc, so this row stays clean. */}
            <div className="flex items-start justify-between">
              <span className="text-4xl font-display font-black leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                {player.overall}
              </span>
              <div className="w-7 h-5 rounded-sm overflow-hidden border border-white/30 bg-black/30">
                <FlagIcon nationality={player.nationality} size={28} fill />
              </div>
            </div>

            {/* Hero disc — radial highlight + inset shadow for depth,
                initials over a position kicker. Tier gradient below
                bleeds through the translucent fill. */}
            <div className="flex-1 flex items-center justify-center my-0.5 min-h-0">
              <div
                className={cn(
                  'relative w-16 h-16 rounded-full flex items-center justify-center',
                  'border border-white/25',
                  'shadow-[inset_0_2px_4px_rgba(255,255,255,0.25),inset_0_-3px_6px_rgba(0,0,0,0.35),0_6px_16px_-4px_rgba(0,0,0,0.55)]',
                )}
                style={{
                  background:
                    'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 35%, rgba(0,0,0,0.35) 100%)',
                }}
              >
                <div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(ellipse 60% 40% at 50% 15%, rgba(255,255,255,0.45), transparent 70%)',
                  }}
                />
                <div className="relative flex flex-col items-center leading-none">
                  <span className="text-xl font-display font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
                    {player.firstName[0]}{player.lastName[0]}
                  </span>
                  <span className="mt-0.5 text-[8px] font-bold tracking-[0.2em] text-white/85">
                    {player.position}
                  </span>
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80 truncate">{player.firstName}</p>
              <p className="text-base font-display font-bold leading-tight truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{player.lastName}</p>
            </div>

            {/* Age / potential kicker — demoted from the stat grid so the
                six main attributes get equal weight below. */}
            <div className="flex items-center justify-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] opacity-75 mt-1">
              <span>Age {player.age}</span>
              <span className="opacity-40">•</span>
              <span>Pot {player.potential}</span>
            </div>

            {/* Footer stat strip — stacked label/value, tabular numerals
                keep 99 and 8 centred identically. Soft frosted chips. */}
            <div className="mt-1.5 grid grid-cols-3 gap-1">
              {([
                ['PAC', player.attributes.pace],
                ['SHO', player.attributes.shooting],
                ['PAS', player.attributes.passing],
                ['DRI', player.attributes.mental],
                ['DEF', player.attributes.defending],
                ['PHY', player.attributes.physical],
              ] as const).map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-col items-center rounded-md bg-black/35 border border-white/10 px-1 py-0.5 backdrop-blur-sm"
                >
                  <span className="text-[8px] font-bold tracking-[0.15em] opacity-65 leading-tight">{label}</span>
                  <span className="text-[11px] font-display font-black tabular-nums leading-none mt-0.5">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});
