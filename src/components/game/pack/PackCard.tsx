import { memo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Player } from '@/types/game';
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

        {/* Face — clean dark surface, tier expressed through a thin
            gradient stroke, a tinted corner glow behind the OVR, and the
            rating digit itself. No more gold slab or hero disc. */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-[0_18px_36px_rgba(0,0,0,0.55)]"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {/* Base: deep glass, not black — matches the app surface token
              so the card sits inside any page without a visual seam. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, hsl(222, 34%, 11%) 0%, hsl(222, 30%, 8%) 100%)',
            }}
          />
          {/* Tier-tinted corner glow — quickly readable tier without a
              full gold wash. Diameter is generous so falloff is gentle. */}
          <div
            aria-hidden
            className="absolute -top-14 -left-10 w-40 h-40 rounded-full blur-[30px] pointer-events-none opacity-45"
            style={{ background: `radial-gradient(circle, ${tier.gradientVia}, transparent 65%)` }}
          />
          {/* Counter-glow in the opposite corner so the surface doesn't
              feel lopsided. Much dimmer. */}
          <div
            aria-hidden
            className="absolute -bottom-16 -right-12 w-40 h-40 rounded-full blur-[36px] pointer-events-none opacity-20"
            style={{ background: `radial-gradient(circle, ${tier.gradientTo}, transparent 70%)` }}
          />
          {/* Thin tier-gradient border stroke (1px) via mask-composite so
              the inside stays crisp and dark. */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              padding: '1px',
              background: tierGradient(tier),
              WebkitMask:
                'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }}
          />

          <div className="relative h-full flex flex-col px-4 pt-4 pb-3 text-white">
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

            {/* OVR + position, inset from the corner so they sit inside
                the frame rather than hugging it. OVR is tier-tinted so
                you can eyeball Gold vs Icon vs Silver at a glance. */}
            <div className="leading-none">
              <div
                className="text-[40px] font-display font-black tabular-nums tracking-tight"
                style={{
                  color: tier.gradientFrom,
                  textShadow: `0 2px 10px ${tier.gradientVia}55`,
                }}
              >
                {player.overall}
              </div>
              <div className="mt-1 text-[10px] font-bold tracking-[0.22em] text-white/55">
                {player.position}
              </div>
            </div>

            {/* Identity block — last name (primary), flag pinned to its
                right, first name as a small dim eyebrow below. The row
                truncates gracefully; flag never collapses. */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-0 text-center">
              <div className="flex items-center justify-center gap-1.5 min-w-0 max-w-full px-1">
                <p className="text-[17px] font-display font-black leading-none truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                  {player.lastName}
                </p>
                <div className="w-[18px] h-[13px] rounded-[2px] overflow-hidden border border-white/15 shrink-0">
                  <FlagIcon nationality={player.nationality} fill />
                </div>
              </div>
              <p className="mt-1 text-[9px] tracking-[0.22em] uppercase font-semibold text-white/35 truncate max-w-full px-1">
                {player.firstName}
              </p>
            </div>

            {/* Stats — compact inline label/value pairs, no chip boxes.
                Label is muted and small, value is bold with tabular
                numerals so columns stay aligned between 9 and 99. */}
            <div className="grid grid-cols-3 gap-x-2.5 gap-y-1.5">
              {([
                ['PAC', player.attributes.pace],
                ['SHO', player.attributes.shooting],
                ['PAS', player.attributes.passing],
                ['DRI', player.attributes.mental],
                ['DEF', player.attributes.defending],
                ['PHY', player.attributes.physical],
              ] as const).map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-1">
                  <span className="text-[9px] font-semibold tracking-[0.12em] text-white/45 leading-none">
                    {label}
                  </span>
                  <span className="text-[12px] font-display font-black tabular-nums leading-none text-white">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});
