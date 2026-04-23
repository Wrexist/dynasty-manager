import { memo, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Player } from '@/types/game';
import { FlagIcon } from '@/components/game/FlagIcon';
import { cn } from '@/lib/utils';
import { tierForOvr, tierGradient } from './packHelpers';
import { PACK_ANIM } from '@/config/packs';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { getPlayerCardArt } from '@/utils/uiHelpers';
import { getPersonalityLabel } from '@/utils/personality';

type StatView = 0 | 1 | 2;

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
  const [statView, setStatView] = useState<StatView>(0);

  // Snap back to the stats grid if the card is ever flipped back down
  // (future re-pack / preview flows). Today reveal is one-way so this
  // is a defensive guard, not a hot path.
  useEffect(() => {
    if (!revealed) setStatView(0);
  }, [revealed]);

  const handleClick = () => {
    if (!revealed) {
      if (!onReveal) return;
      hapticMedium();
      onReveal();
      return;
    }
    // Revealed — cycle through stats → profile → condition → stats
    hapticLight();
    setStatView((v) => ((v + 1) % 3) as StatView);
  };

  const interactive = !revealed ? !!onReveal : true;

  const handleDismiss = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!onDismiss) return;
    onDismiss();
  };

  return (
    <motion.div
      onClick={handleClick}
      onKeyDown={(e) => { if (interactive && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleClick(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative block w-[150px] aspect-[3/4] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-2xl',
        interactive && 'cursor-pointer',
      )}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={{ perspective: 1100 }}
      initial={{ opacity: 0, y: 120, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: entranceDelay, type: 'spring', stiffness: 180, damping: 24 }}
      aria-label={
        revealed
          ? `${player.firstName} ${player.lastName}, ${player.overall} overall. Showing ${
              statView === 0 ? 'stats' : statView === 1 ? 'profile' : 'condition'
            }. Tap to cycle stat views.`
          : 'Tap to reveal'
      }
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
                      className="min-w-0 text-[16px] font-display font-black leading-none truncate"
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

            {/* Stat panel — top-aligned inside the shield's lower gray
                panel. Tap cycles Stats → Profile → Condition. */}
            <div className="absolute left-3.5 right-3.5 top-[64%] bottom-[6%]">
              <AnimatePresence mode="wait" initial={false}>
                {statView === 0 && (
                  <motion.div
                    key="stats"
                    {...viewMotion(prefersReducedMotion)}
                    className="grid grid-cols-3 gap-x-2 gap-y-1.5"
                  >
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
                  </motion.div>
                )}
                {statView === 1 && (
                  <motion.div
                    key="profile"
                    {...viewMotion(prefersReducedMotion)}
                    className="space-y-[5px]"
                  >
                    <ProfileRow label="SKL">
                      <SkillStars value={player.skillMoves ?? 3} />
                    </ProfileRow>
                    <PotentialRow current={player.overall} potential={player.potential ?? player.overall} />
                    <ProfileRow label="POS">
                      <span className="truncate font-semibold text-white/90">
                        {[player.position, ...(player.alternatePositions ?? [])].join(' · ')}
                      </span>
                    </ProfileRow>
                    {player.personality && (
                      <ProfileRow label="PER">
                        <span className="truncate font-semibold text-white/90">
                          {getPersonalityLabel(player.personality)}
                        </span>
                      </ProfileRow>
                    )}
                  </motion.div>
                )}
                {statView === 2 && (
                  <motion.div
                    key="condition"
                    {...viewMotion(prefersReducedMotion)}
                    className="space-y-[7px] pt-1"
                  >
                    <LiquidGlassBar label="FIT" value={player.fitness} />
                    <LiquidGlassBar label="MOR" value={player.morale} />
                    <LiquidGlassBar label="FRM" value={player.form} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* View indicator — three mini pills, active one widens. Only
                visible when revealed so users discover the tap-cycle. */}
            {revealed && (
              <div
                aria-hidden
                className="absolute bottom-[1.5%] left-1/2 -translate-x-1/2 flex items-center gap-1 z-10"
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-[3px] rounded-full transition-all duration-200',
                      statView === i ? 'w-3 bg-white/85' : 'w-[3px] bg-white/35',
                    )}
                    style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

// ── Stat-view sub-pieces ─────────────────────────────────────────────

/** Slide+fade transition between the three stat views. */
function viewMotion(prefersReducedMotion: boolean | null) {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.12 },
    };
  }
  return {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.18 },
  };
}

interface ProfileRowProps {
  label: string;
  children: React.ReactNode;
}
function ProfileRow({ label, children }: ProfileRowProps) {
  return (
    <div className="flex items-center justify-between gap-1.5 text-[10px] leading-none">
      <span
        className="text-[8px] font-semibold tracking-[0.12em] text-white/60 shrink-0"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
      >
        {label}
      </span>
      <span className="min-w-0 text-right" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}>
        {children}
      </span>
    </div>
  );
}

function SkillStars({ value }: { value: number }) {
  const v = Math.max(1, Math.min(5, Math.round(value)));
  return (
    <span className="tracking-[0.1em] text-amber-300">
      {'★'.repeat(v)}
      <span className="text-white/25">{'★'.repeat(5 - v)}</span>
    </span>
  );
}

function PotentialRow({ current, potential }: { current: number; potential: number }) {
  const cap = Math.max(current, potential);
  const pct = Math.min(100, (current / cap) * 100);
  return (
    <div className="flex items-center gap-1.5 text-[10px] leading-none">
      <span
        className="text-[8px] font-semibold tracking-[0.12em] text-white/60 shrink-0"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
      >
        POT
      </span>
      <span
        className="font-display font-black tabular-nums text-[10px] text-white/80 shrink-0"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}
      >
        {current}
      </span>
      <div
        className="flex-1 relative h-[5px] rounded-full overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.5), rgba(0,0,0,0.65))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(180deg, #fcd34d 0%, #f59e0b 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 0 6px rgba(251,191,36,0.45)',
          }}
        >
          <div
            className="absolute inset-x-0 top-0 h-1/2 rounded-full pointer-events-none"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)' }}
          />
        </div>
      </div>
      <span
        className="font-display font-black tabular-nums text-[11px] text-white shrink-0"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}
      >
        {potential}
      </span>
    </div>
  );
}

/**
 * Liquid-glass progress bar — backdrop-blurred translucent track, filled
 * with a tier-tone gradient plus a specular top highlight. Matches the
 * GlassPanel aesthetic used across the app.
 */
function LiquidGlassBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const tone =
    pct >= 75
      ? { top: '#34d399', bottom: '#059669', glow: 'rgba(52,211,153,0.45)' }
      : pct >= 50
        ? { top: '#fbbf24', bottom: '#d97706', glow: 'rgba(251,191,36,0.45)' }
        : { top: '#f87171', bottom: '#dc2626', glow: 'rgba(248,113,113,0.45)' };

  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-7 text-[8px] font-semibold tracking-[0.12em] text-white/70 leading-none shrink-0"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
      >
        {label}
      </span>
      <div
        className="flex-1 relative h-[7px] rounded-full overflow-hidden backdrop-blur-sm"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.55))',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(180deg, ${tone.top}, ${tone.bottom})`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.45), 0 0 6px ${tone.glow}`,
          }}
        >
          <div
            className="absolute inset-x-0 top-0 h-1/2 rounded-full pointer-events-none"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)' }}
          />
        </div>
      </div>
      <span
        className="w-5 text-[10px] font-display font-black tabular-nums text-white text-right leading-none shrink-0"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}
      >
        {Math.round(value)}
      </span>
    </div>
  );
}
