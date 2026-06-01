import { memo, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X, Star } from 'lucide-react';
import type { Player, PlayerAttributes } from '@/types/game';
import { FlagIcon } from '@/components/game/FlagIcon';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';
import { getPlayerCardArt, getFitnessHexColor } from '@/utils/uiHelpers';
import { getPersonalityLabel } from '@/utils/personality';

const ATTR_LABELS: Record<keyof PlayerAttributes, string> = {
  pace: 'PAC',
  shooting: 'SHO',
  passing: 'PAS',
  mental: 'DRI',
  defending: 'DEF',
  physical: 'PHY',
};

function getTopThreeStats(attrs: PlayerAttributes): Array<{ label: string; value: number }> {
  return (Object.keys(ATTR_LABELS) as Array<keyof PlayerAttributes>)
    .map((k) => ({ label: ATTR_LABELS[k], value: attrs[k] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
}

export type PlayerCardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type PlayerCardInteraction = 'cycle' | 'detail' | 'none';
export type PositionTone = 'natural' | 'compatible' | 'wrong';

type StatView = 0 | 1 | 2;

interface PlayerCardProps {
  player: Player;
  /**
   * Visual size. Canonical assignments (see {@link PLAYER_CARD_SIZE_PX}):
   *  - `xs` (52) — tactics pitch tile
   *  - `sm` (64) — bench strip
   *  - `md` (110) — reserved; not currently used
   *  - `lg` (150) — squad grid, youth academy, transfer market,
   *                 player detail hero, pack reveal (the main app card)
   *  - `xl` (220) — pack walkout hero only
   */
  size?: PlayerCardSize;
  /**
   * Tap behaviour:
   *  - 'cycle'  → cycles stats → profile → (condition) → stats
   *  - 'detail' → calls onDetailClick (e.g. open player page)
   *  - 'none'   → static, no click affordance
   */
  interactive?: PlayerCardInteraction;
  onDetailClick?: (player: Player) => void;
  /** When false, the condition view (FIT/MOR/FRM) is omitted from the cycle. */
  showConditionView?: boolean;
  /**
   * Compact mode — used at sm or in tight list contexts. Drops the stat
   * panel (stats / profile / condition views) and the view indicator
   * entirely, leaving just OVR + position + name + flag on the shield.
   * `interactive='cycle'` is treated as `'none'` when compact because
   * there's nothing left to cycle.
   */
  compact?: boolean;
  /**
   * When set, colors the position label to signal how well the player fits
   * the slot they're in (tactics pitch only): natural → green, compatible →
   * amber, wrong → red. Omit for neutral white.
   */
  positionTone?: PositionTone | null;
  /** Optional quick-release × on the face (pack summary context). */
  onDismiss?: () => void;
  /** Optional override for the tooltip / aria-label on the dismiss button. */
  dismissLabel?: string;
  className?: string;
}

const POSITION_TONE_COLORS: Record<PositionTone, string> = {
  natural: '#34d399',
  compatible: '#fbbf24',
  wrong: '#f87171',
};

/**
 * Fixed external size tokens → single source of truth for the card preset
 * widths. xs is the tightest tier (tactics pitch, 11 shields across a
 * half-pitch); lg is the main app card used nearly everywhere; xl is only
 * the walkout hero. Exported so layout code that sits next to a card (dev
 * bars under youth prospects, pack container sizing, etc.) can align to
 * the same number without hardcoding `w-[150px]` in parallel.
 */
export const PLAYER_CARD_SIZE_PX: Record<PlayerCardSize, number> = { xs: 52, sm: 64, md: 110, lg: 150, xl: 220 };
const SIZE_PX = PLAYER_CARD_SIZE_PX;

/**
 * Derived pixel tokens, proportional to card width. Everything inside the
 * face scales from these so the design reads the same at 64 and 220.
 * Ratios were calibrated from the lg (150px) reference:
 *   ovr 36, name 16, statVal 12, statLabel 9, pos 10, flag 18×13.
 */
function sizeTokens(size: PlayerCardSize) {
  const w = SIZE_PX[size];
  // xs runs a tighter typographic scale: the tactics tile needs to fit a
  // longer surname on a single line (no inline flag), so namePx drops
  // and flag shrinks to a top-right corner badge instead of a sibling.
  const isXs = size === 'xs';
  return {
    widthPx: w,
    ovrPx: Math.round(w * 0.24),
    ovrTopPx: Math.round(w * 0.093),
    ovrLeftPx: Math.round(w * 0.12),
    posPx: Math.max(7, Math.round(w * 0.067)),
    namePx: isXs ? Math.max(7, Math.round(w * 0.09)) : Math.max(8, Math.round(w * 0.107)),
    firstNamePx: Math.max(6, Math.round(w * 0.073)),
    statLabelPx: Math.max(6, Math.round(w * 0.06)),
    statValPx: Math.max(8, Math.round(w * 0.08)),
    profileLabelPx: Math.max(6, Math.round(w * 0.053)),
    profileValPx: Math.max(7, Math.round(w * 0.067)),
    flagWPx: isXs ? Math.max(9, Math.round(w * 0.18)) : Math.max(10, Math.round(w * 0.12)),
    flagHPx: isXs ? Math.max(6, Math.round(w * 0.13)) : Math.max(7, Math.round(w * 0.087)),
    statRowGapPx: Math.max(1, Math.round(w * 0.01)),
    outerRadiusPx: Math.max(8, Math.round(w * 0.107)),
    paddingXPx: Math.max(8, Math.round(w * 0.093)),
    dismissPx: Math.max(16, Math.round(w * 0.16)),
  };
}

/**
 * Shared "shield" player card visual. Same look used across packs, squad,
 * transfer market and player detail — only size + tap behaviour change.
 *
 * Packs wrap this in `PackCard` to add the face-down back + 3D flip.
 */
export const PlayerCard = memo(function PlayerCard({
  player,
  size = 'lg',
  interactive = 'cycle',
  onDetailClick,
  showConditionView = true,
  compact = false,
  positionTone = null,
  onDismiss,
  dismissLabel,
  className,
}: PlayerCardProps) {
  const tk = sizeTokens(size);
  const cardArt = getPlayerCardArt(player.overall, {
    ballonDorTop10: typeof player.ballonDOrTop10HoldSeason === 'number',
  });
  const prefersReducedMotion = useReducedMotion();
  const [statView, setStatView] = useState<StatView>(0);

  // Compact cards have no cycle target — treat 'cycle' as 'none'.
  const effectiveInteractive: PlayerCardInteraction =
    compact && interactive === 'cycle' ? 'none' : interactive;

  // Clamp cycle length to the views we actually render.
  const viewCount = showConditionView ? 3 : 2;
  useEffect(() => {
    if (statView >= viewCount) setStatView(0);
  }, [viewCount, statView]);

  const handleClick = () => {
    if (effectiveInteractive === 'cycle') {
      hapticLight();
      setStatView((v) => ((v + 1) % viewCount) as StatView);
      return;
    }
    if (effectiveInteractive === 'detail') {
      if (!onDetailClick) return;
      hapticLight();
      onDetailClick(player);
    }
  };

  const clickable = effectiveInteractive !== 'none';

  const handleDismiss = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!onDismiss) return;
    onDismiss();
  };

  const viewLabel = statView === 0 ? 'stats' : statView === 1 ? 'profile' : 'condition';
  const ariaLabel =
    effectiveInteractive === 'cycle'
      ? `${player.firstName} ${player.lastName}, ${player.overall} overall. Showing ${viewLabel}. Tap to cycle stat views.`
      : effectiveInteractive === 'detail'
        ? `${player.firstName} ${player.lastName}, ${player.overall} overall. Open details.`
        : `${player.firstName} ${player.lastName}, ${player.overall} overall.`;

  return (
    <div
      onClick={clickable ? handleClick : undefined}
      onKeyDown={(e) => {
        if (!clickable) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        'relative block aspect-[3/4] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        // The big drop-shadow looks like a dark halo behind the tactics-pitch
        // tiles on a green pitch; keep it only at sm+ where the card sits on
        // a dark UI surface and the cast shadow reads as depth.
        size !== 'xs' && 'shadow-[0_18px_36px_rgba(0,0,0,0.55)]',
        clickable && 'cursor-pointer',
        className,
      )}
      style={{ width: tk.widthPx, borderRadius: tk.outerRadiusPx }}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={ariaLabel}
    >
      {/* Shield artwork — full-bleed background. */}
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

      {/* Targeted darkening for legibility on the larger shields where the
          stat panel sits on top of the gray band. The xs pitch tile leaves
          the artwork clean — text already has heavy text-shadows for
          readability, and the gradient overlay reads as a dark halo on the
          crowded tactics view. */}
      {size !== 'xs' && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 42% 32% at 18% 17%, rgba(0,0,0,0.65), transparent 75%),' +
              'linear-gradient(to bottom, transparent 48%, rgba(0,0,0,0.32) 58%, rgba(0,0,0,0.18) 62%, transparent 64%),' +
              'linear-gradient(to bottom, transparent 63%, rgba(0,0,0,0.4) 72%, rgba(0,0,0,0.55) 86%, rgba(0,0,0,0.65) 100%)',
          }}
        />
      )}

      <div className="relative h-full text-white">
        {/* Quick-release × */}
        {onDismiss && (
          <button
            type="button"
            onClick={handleDismiss}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDismiss(e); } }}
            className="absolute rounded-full bg-black/55 hover:bg-black/80 border border-white/25 flex items-center justify-center z-10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            style={{ top: 6, right: 6, width: tk.dismissPx, height: tk.dismissPx }}
            aria-label={dismissLabel ?? `Release ${player.firstName} ${player.lastName}`}
            title={dismissLabel}
          >
            <X style={{ width: tk.dismissPx * 0.5, height: tk.dismissPx * 0.5 }} className="text-white/90" />
          </button>
        )}

        {/* OVR + position stacked at top-left (FUT-style). Keeping the pos
            label on the left frees the entire top-right corner for the
            caller-overlaid status pills (XI / SUB / LIST / contract /
            injured) without colliding with the shield artwork. The pos
            label optionally takes on a compat tone on the pitch: green =
            natural slot (primary or alt), amber = compatible, red = wrong. */}
        <div
          className="absolute leading-none"
          style={{ top: tk.ovrTopPx, left: tk.ovrLeftPx }}
        >
          <div
            className="font-display font-black tabular-nums tracking-tight"
            style={{
              fontSize: tk.ovrPx,
              textShadow: '0 2px 6px rgba(0,0,0,0.85), 0 0 12px rgba(0,0,0,0.45)',
            }}
          >
            {player.overall}
          </div>
          <div
            className="font-display font-black tracking-[0.08em]"
            style={{
              fontSize: Math.round(tk.ovrPx * 0.55),
              marginTop: Math.max(1, Math.round(tk.ovrPx * 0.05)),
              color: positionTone ? POSITION_TONE_COLORS[positionTone] : 'rgba(255,255,255,0.95)',
              textShadow: positionTone
                ? '0 2px 6px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.55)'
                : '0 2px 6px rgba(0,0,0,0.85), 0 0 12px rgba(0,0,0,0.45)',
            }}
          >
            {player.position}
          </div>
        </div>

        {/* Identity block — flag sits above the surname on the small
            tactics/bench tiles (xs / sm) so the same stack reads at a
            glance regardless of name length. Larger cards keep the flag
            inline with the surname (squad-page / pack look). */}
        {(() => {
          const flagOverName = size === 'xs' || size === 'sm';
          // Mononym players (Savinho, Rodri, Ederson, …) come through with
          // identical firstName / lastName from the FC26-sourced templates.
          // Showing both lines as the same word reads as a duplicate, so
          // suppress the secondary first-name row in that case.
          const isMononym =
            !!player.firstName &&
            !!player.lastName &&
            player.firstName.trim().toLowerCase() === player.lastName.trim().toLowerCase();
          const showFirstName =
            !isMononym && (size === 'xs' ? compact : size === 'sm' ? true : !compact);
          return (
            <div
              className="absolute text-center"
              style={{
                left: tk.paddingXPx,
                right: tk.paddingXPx,
                bottom: flagOverName ? '44%' : '39%',
              }}
            >
              {flagOverName && (
                <div
                  aria-hidden
                  className="mx-auto mb-0.5 rounded-[2px] overflow-hidden border border-white/50 shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                  style={{ width: tk.flagWPx, height: tk.flagHPx }}
                >
                  <FlagIcon nationality={player.nationality} fill />
                </div>
              )}
              <div className="flex items-center justify-center gap-1.5 min-w-0 max-w-full">
                <p
                  className="min-w-0 font-display font-black leading-none truncate uppercase tracking-[0.02em]"
                  style={{ fontSize: tk.namePx, textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.5)' }}
                >
                  {player.lastName}
                </p>
                {!flagOverName && (
                  <div
                    className="rounded-[2px] overflow-hidden border border-white/40 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                    style={{ width: tk.flagWPx, height: tk.flagHPx }}
                  >
                    <FlagIcon nationality={player.nationality} fill />
                  </div>
                )}
              </div>
              {showFirstName && (
                <p
                  className="mt-0.5 font-medium text-white/80 leading-none truncate"
                  style={{ fontSize: tk.firstNamePx, textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}
                >
                  {player.firstName}
                </p>
              )}
            </div>
          );
        })()}

        {/* Tactics-tile bottom band: fitness sits on the card's natural
            divider (gradient line around ~60% from top, between the name
            and the gray band), with the player's top 3 attributes below
            it in the stat strip. Only renders for the xs compact variant
            used on the formation pitch. */}
        {size === 'xs' && compact && (() => {
          const fitnessColor = getFitnessHexColor(player.fitness);
          const topStats = getTopThreeStats(player.attributes);
          const statValPx = Math.max(7, Math.round(tk.widthPx * 0.14));
          const statLabelPx = Math.max(5, Math.round(tk.widthPx * 0.09));
          return (
            <>
              {/* Fitness bar — sits right over the card's divider line. */}
              <div
                className="absolute left-0 right-0 pointer-events-none"
                style={{ top: '61%', paddingLeft: tk.paddingXPx * 0.4, paddingRight: tk.paddingXPx * 0.4 }}
              >
                <div
                  className="h-[2px] w-full rounded-full bg-black/65 overflow-hidden shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.06),0_0_2px_rgba(0,0,0,0.8)]"
                  aria-label={`Fitness ${player.fitness}%`}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, player.fitness))}%`,
                      background: `linear-gradient(180deg, color-mix(in srgb, ${fitnessColor} 55%, white) 0%, ${fitnessColor} 60%, color-mix(in srgb, ${fitnessColor} 75%, black) 100%)`,
                      boxShadow: `0 0 4px ${fitnessColor}99, inset 0 1px 0 rgba(255,255,255,0.35)`,
                    }}
                  />
                </div>
              </div>

              {/* Top-3 stats — each cell stacks its label above the value
                  so the tactics pitch reads PAC/SHO/DEF etc. at a glance. */}
              <div
                className="absolute left-0 right-0 flex items-start justify-around gap-[2px] leading-none pointer-events-none"
                style={{
                  top: '68%',
                  paddingLeft: tk.paddingXPx * 0.25,
                  paddingRight: tk.paddingXPx * 0.25,
                }}
              >
                {topStats.map((s) => (
                  <div key={s.label} className="flex flex-col items-center leading-none">
                    <span
                      className="font-semibold tracking-[0.08em] text-white/75"
                      style={{ fontSize: statLabelPx, textShadow: '0 1px 2px rgba(0,0,0,0.95)' }}
                    >
                      {s.label}
                    </span>
                    <span
                      className="font-display font-black tabular-nums text-white"
                      style={{ fontSize: statValPx, marginTop: 1, textShadow: '0 1px 2px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.7)' }}
                    >
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          );
        })()}

        {/* Stat panel — top-aligned inside the shield's lower gray band.
            Omitted in compact mode (sm / dense list contexts). Kept inset
            from the ornate bottom frame on rare/gold cards so stats don't
            sit on top of the border artwork. On sm (bench tile) each cell
            stacks its label above the value so the tiny shield still reads
            at a glance. */}
        {!compact && (
        <div
          className={cn('absolute', size === 'sm' ? 'top-[60%] bottom-[4%]' : 'top-[68%] bottom-[9%]')}
          style={{ left: tk.paddingXPx * 0.9, right: tk.paddingXPx * 0.9 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {statView === 0 && (
              <motion.div
                key="stats"
                {...viewMotion(prefersReducedMotion)}
                className="grid grid-cols-3 gap-x-2"
                style={{ rowGap: tk.statRowGapPx + 1 }}
              >
                {([
                  ['PAC', player.attributes.pace],
                  ['SHO', player.attributes.shooting],
                  ['PAS', player.attributes.passing],
                  ['DRI', player.attributes.mental],
                  ['DEF', player.attributes.defending],
                  ['PHY', player.attributes.physical],
                ] as const).map(([label, value]) => (
                  size === 'sm' ? (
                    <div key={label} className="flex flex-col items-center leading-none">
                      <span
                        className="font-semibold tracking-[0.08em] text-white/75"
                        style={{ fontSize: tk.statLabelPx, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                      >
                        {label}
                      </span>
                      <span
                        className="font-display font-black tabular-nums text-white"
                        style={{ fontSize: tk.statValPx, marginTop: 1, textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}
                      >
                        {value}
                      </span>
                    </div>
                  ) : (
                    <div key={label} className="flex items-baseline justify-between gap-1">
                      <span
                        className="font-semibold tracking-[0.12em] text-white/75 leading-none"
                        style={{ fontSize: tk.statLabelPx, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                      >
                        {label}
                      </span>
                      <span
                        className="font-display font-black tabular-nums leading-none text-white"
                        style={{ fontSize: tk.statValPx, textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}
                      >
                        {value}
                      </span>
                    </div>
                  )
                ))}
              </motion.div>
            )}
            {statView === 1 && (
              <motion.div
                key="profile"
                {...viewMotion(prefersReducedMotion)}
                className="space-y-[5px]"
              >
                <ProfileRow label="SKL" tk={tk}>
                  <SkillStars value={player.skillMoves ?? 3} tk={tk} />
                </ProfileRow>
                <PotentialRow current={player.overall} potential={player.potential ?? player.overall} tk={tk} />
                <ProfileRow label="POS" tk={tk}>
                  <span className="truncate font-semibold text-white/90">
                    {[player.position, ...(player.alternatePositions ?? [])].join(' · ')}
                  </span>
                </ProfileRow>
                {player.personality && (
                  <ProfileRow label="PER" tk={tk}>
                    <span className="truncate font-semibold text-white/90">
                      {getPersonalityLabel(player.personality)}
                    </span>
                  </ProfileRow>
                )}
              </motion.div>
            )}
            {statView === 2 && showConditionView && (
              <motion.div
                key="condition"
                {...viewMotion(prefersReducedMotion)}
                className="space-y-[7px] pt-1"
              >
                <LiquidGlassBar label="FIT" value={player.fitness} tk={tk} />
                <LiquidGlassBar label="MOR" value={player.morale} tk={tk} />
                <LiquidGlassBar label="FRM" value={player.form} tk={tk} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}

        {/* View indicator — only for the cycle interaction, where discovery matters. */}
        {!compact && effectiveInteractive === 'cycle' && viewCount > 1 && (
          <div
            aria-hidden
            className="absolute bottom-[1.5%] left-1/2 -translate-x-1/2 flex items-center gap-1 z-10"
          >
            {Array.from({ length: viewCount }).map((_, i) => (
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
  );
});

// ── Stat-view sub-pieces ─────────────────────────────────────────────

type SizeTokens = ReturnType<typeof sizeTokens>;

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

function ProfileRow({ label, tk, children }: { label: string; tk: SizeTokens; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-1.5 leading-none" style={{ fontSize: tk.profileValPx }}>
      <span
        className="font-semibold tracking-[0.12em] text-white/60 shrink-0"
        style={{ fontSize: tk.profileLabelPx, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
      >
        {label}
      </span>
      <span className="min-w-0 text-right" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}>
        {children}
      </span>
    </div>
  );
}

function SkillStars({ value, tk }: { value: number; tk: SizeTokens }) {
  const v = Math.max(1, Math.min(5, Math.round(value)));
  const starPx = Math.max(8, Math.round(tk.widthPx * 0.067));
  return (
    <span className="inline-flex items-center gap-[1.5px]" aria-label={`Skill moves: ${v} of 5`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < v;
        return (
          <Star
            key={i}
            aria-hidden
            className={cn(filled ? 'text-white fill-white' : 'text-white/35 fill-transparent')}
            style={{
              width: starPx,
              height: starPx,
              filter: filled
                ? 'drop-shadow(0 0 3px rgba(251,191,36,0.85)) drop-shadow(0 1px 2px rgba(0,0,0,0.7))'
                : 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))',
            }}
            strokeWidth={filled ? 0 : 2}
          />
        );
      })}
    </span>
  );
}

function PotentialRow({ current, potential, tk }: { current: number; potential: number; tk: SizeTokens }) {
  const maxed = current >= potential;

  if (maxed) {
    return (
      <div className="flex items-center justify-between gap-1.5 leading-none">
        <span
          className="font-semibold tracking-[0.12em] text-white/60 shrink-0"
          style={{ fontSize: tk.profileLabelPx, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
        >
          POT
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className="font-display font-black tabular-nums text-white"
            style={{ fontSize: tk.profileValPx + 1, textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}
          >
            {current}
          </span>
          <span
            className="px-1.5 py-[1px] rounded-full font-black tracking-[0.15em] uppercase bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950"
            style={{
              fontSize: tk.profileLabelPx,
              boxShadow:
                '0 0 6px rgba(251,191,36,0.55), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.25)',
            }}
          >
            MAX
          </span>
        </div>
      </div>
    );
  }

  const pct = Math.min(100, (current / potential) * 100);
  return (
    <div className="flex items-center gap-1.5 leading-none">
      <span
        className="font-semibold tracking-[0.12em] text-white/60 shrink-0"
        style={{ fontSize: tk.profileLabelPx, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
      >
        POT
      </span>
      <span
        className="font-display font-black tabular-nums text-white/80 shrink-0"
        style={{ fontSize: tk.profileLabelPx, textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}
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
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-b from-amber-300 to-amber-500"
          style={{
            width: `${pct}%`,
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
        className="font-display font-black tabular-nums text-white shrink-0"
        style={{ fontSize: tk.profileValPx + 1, textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}
      >
        {potential}
      </span>
    </div>
  );
}

function LiquidGlassBar({ label, value, tk }: { label: string; value: number; tk: SizeTokens }) {
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
        className="font-semibold tracking-[0.12em] text-white/70 leading-none shrink-0"
        style={{ width: 28, fontSize: tk.profileLabelPx, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
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
        className="font-display font-black tabular-nums text-white text-right leading-none shrink-0"
        style={{ width: 20, fontSize: tk.profileValPx, textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}
      >
        {Math.round(value)}
      </span>
    </div>
  );
}
