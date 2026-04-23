import { memo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Player } from '@/types/game';
import { FlagIcon } from '@/components/game/FlagIcon';
import { cn } from '@/lib/utils';
import { tierForOvr, tierGradient } from './packHelpers';
import { PACK_ANIM } from '@/config/packs';
import { hapticMedium } from '@/utils/haptics';
import { getPlayerCardArt } from '@/utils/uiHelpers';

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
  const cardArt = getPlayerCardArt(player.overall);
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

        {/* Face — shield artwork is the background; numbers, name, flag
            and stats sit inside the shield's natural panels (top-left
            crest, mid divider band, bottom panel). */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-[0_18px_36px_rgba(0,0,0,0.55)]"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {/* Shield artwork — full-bleed, eager-loaded for the reveal. */}
          <img
            src={cardArt.src}
            alt=""
            aria-hidden
            draggable={false}
            loading="eager"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
            style={cardArt.filter ? { filter: cardArt.filter } : undefined}
          />

          {/* Targeted darkening for legibility — does not flatten the art:
              · radial vignette top-left so the OVR pops on bright shields
                (icon's white marble especially)
              · soft band just above the divider so the name reads on the
                bright fan-sweep
              · stronger fade starting right at the divider so stats stay
                crisp across every tier */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                // OVR vignette (top-left)
                'radial-gradient(ellipse 42% 32% at 18% 17%, rgba(0,0,0,0.65), transparent 75%),' +
                // Name band (sits just above the shield divider at ~62%)
                'linear-gradient(to bottom, transparent 48%, rgba(0,0,0,0.32) 58%, rgba(0,0,0,0.18) 62%, transparent 64%),' +
                // Bottom panel for stats (starts at divider ~63%)
                'linear-gradient(to bottom, transparent 63%, rgba(0,0,0,0.4) 72%, rgba(0,0,0,0.55) 86%, rgba(0,0,0,0.65) 100%)',
            }}
          />

          <div className="relative h-full text-white">
            {/* Quick-release × (summary only) */}
            {revealed && onDismiss && (
              <button
                type="button"
                onClick={handleDismiss}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/55 hover:bg-black/80 border border-white/25 flex items-center justify-center z-10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                aria-label={`Release ${player.firstName} ${player.lastName}`}
                title="Release (1 week severance)"
              >
                <X className="w-3 h-3 text-white/90" />
              </button>
            )}

            {/* OVR + position — inset from the shield's top-left curve so
                the digits sit inside the crest, not on its edge. */}
            <div
              className="absolute top-[14px] left-[18px] leading-none"
              style={{ textShadow: '0 2px 6px rgba(0,0,0,0.85), 0 0 12px rgba(0,0,0,0.45)' }}
            >
              <div className="text-[36px] font-display font-black tabular-nums tracking-tight">
                {player.overall}
              </div>
              <div
                className="mt-0.5 text-[10px] font-bold tracking-[0.22em] text-white/90"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}
              >
                {player.position}
              </div>
            </div>

            {/* Identity block — sits ABOVE the shield divider, snug against
                it. Shows "First Last" when short enough; falls back to
                last name only to avoid spilling past the shield edges. */}
            {(() => {
              const combinedLen = player.firstName.length + player.lastName.length + 1;
              const displayName = combinedLen > 14 ? player.lastName : `${player.firstName} ${player.lastName}`;
              return (
                <div className="absolute left-3 right-3 bottom-[38%] text-center">
                  <div className="flex items-center justify-center gap-1.5 min-w-0 max-w-full">
                    <p
                      className="text-[16px] font-display font-black leading-none truncate"
                      style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.5)' }}
                    >
                      {displayName}
                    </p>
                    <div className="w-[18px] h-[13px] rounded-[2px] overflow-hidden border border-white/40 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                      <FlagIcon nationality={player.nationality} fill />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Stats — top-aligned inside the shield's lower gray panel,
                just under the divider. Inline label/value pairs keep the
                whole grid compact while still filling the panel width. */}
            <div className="absolute left-3.5 right-3.5 top-[64%]">
              <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
                {([
                  ['PAC', player.attributes.pace],
                  ['SHO', player.attributes.shooting],
                  ['PAS', player.attributes.passing],
                  ['DRI', player.attributes.mental],
                  ['DEF', player.attributes.defending],
                  ['PHY', player.attributes.physical],
                ] as const).map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-1">
                    <span
                      className="text-[9px] font-semibold tracking-[0.12em] text-white/75 leading-none"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                    >
                      {label}
                    </span>
                    <span
                      className="text-[12px] font-display font-black tabular-nums leading-none text-white"
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});
