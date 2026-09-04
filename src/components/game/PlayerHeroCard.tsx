/**
 * PlayerHeroCard — compact hero banner for the Player Detail page.
 *
 * Lays the shared {@link PlayerCard} (size="lg", interactive="cycle")
 * side-by-side with a meta column: tier label, growth arrow, potential,
 * age / nationality, skill stars, real-player badge, and club identity.
 * The card art already carries tier colours, so the panel stays neutral
 * — no gradient halo or club tint behind it — and keeps the data-tier
 * attribute for test / style hooks.
 */

import { memo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { TrendingUp, TrendingDown, Star } from 'lucide-react';
import type { Player, Club } from '@/types/game';
import { GlassPanel } from './GlassPanel';
import { PlayerCard } from './PlayerCard';
import { PlayerStatusBadges } from './PlayerStatusBadges';
import { cn } from '@/lib/utils';
import { getPlayerTier } from '@/utils/uiHelpers';
import { derivePlayerStanding } from '@/utils/playerStanding';
import { useGameStore } from '@/store/gameStore';

interface PlayerHeroCardProps {
  player: Player;
  club?: Club;
  /** Current season — enables contract-urgency badge when provided. */
  season?: number;
  /** Current week — enables suspension badge when provided. */
  week?: number;
}

export const PlayerHeroCard = memo(function PlayerHeroCard({
  player,
  club,
  season,
  week,
}: PlayerHeroCardProps) {
  const { t } = useTranslation();
  const clubColor = club?.color || '#888';
  const showPotential = player.potential > player.overall;
  const potentialGap = Math.max(0, player.potential - player.overall);
  const skillMoves = player.skillMoves ?? 0;
  const growth = player.growthDelta;
  // Season-cumulative growth. The tracker has always held this — the growth cap
  // maintains it per player and it is saved with the game — but nothing ever
  // read it, so the one number that says "this player is becoming someone"
  // never reached the screen. `growthDelta` above is only THIS WEEK's tick.
  const seasonGrowth = useGameStore(s => s.seasonGrowthTracker?.[player.id] ?? 0);
  const standing = season != null
    ? derivePlayerStanding(player, { season, seasonGrowth })
    : null;
  const tier = getPlayerTier(player.overall);

  const ariaLabel = [
    `${player.firstName} ${player.lastName}`,
    player.position,
    `overall ${player.overall}`,
    `tier ${tier.label}`,
    showPotential ? `potential ${player.potential}` : null,
    `age ${player.age}`,
    club?.name,
  ].filter(Boolean).join(', ');

  return (
    <GlassPanel
      className="relative p-3"
      aria-label={ariaLabel}
    >
      <div data-tier={tier.key} className="relative flex items-stretch gap-3">
        {/* Card (smaller hero size, self-contained tier art) */}
        <div className="relative shrink-0">
          <PlayerCard
            player={player}
            size="lg"
            interactive="cycle"
            showConditionView
          />
          {season != null && (
            <div className="absolute top-1.5 right-1.5 z-10 pointer-events-none">
              <PlayerStatusBadges player={player} season={season} week={week} />
            </div>
          )}
        </div>

        {/* Meta column — hugs the right of the card */}
        <div className="flex-1 min-w-0 flex flex-col py-0.5">
          {/* Tier pill + growth trend */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide shrink-0',
                tier.badgeClass,
              )}
              aria-label={`tier ${tier.label}`}
            >
              {tier.label}
            </span>
            {growth != null && growth > 0 && (
              <span className="inline-flex items-center gap-0.5 text-emerald-400 text-[10px] font-semibold tabular-nums">
                <TrendingUp className="w-3 h-3" aria-label={`growing +${growth}`} />
                +{growth}
              </span>
            )}
            {growth != null && growth < 0 && (
              <span className="inline-flex items-center gap-0.5 text-destructive text-[10px] font-semibold tabular-nums">
                <TrendingDown className="w-3 h-3" aria-label={`declining ${growth}`} />
                {growth}
              </span>
            )}
          </div>

          {/* Potential — prominent when there's room to grow */}
          {showPotential && (
            <div className="mt-2 flex items-baseline gap-1.5">
              <p className="font-display text-2xl font-black text-primary tabular-nums leading-none tracking-tight">
                {`Pot ${player.potential}`}
              </p>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] text-emerald-300 font-semibold tabular-nums bg-emerald-500/10 border border-emerald-500/30">
                +{potentialGap}
              </span>
            </div>
          )}
          {!showPotential && (
            <div className="mt-2">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide text-amber-200 bg-amber-500/10 border border-amber-400/40">
                Maxed out
              </span>
            </div>
          )}

          {/* Standing — the one thing worth saying about this player, or
              nothing at all. Most of the squad, most of the time, has no
              headline, and that restraint is what makes the ones that do
              land. Derived, never persisted. */}
          {standing?.headline && (
            <p className="mt-2 text-[11px] font-semibold text-primary/90 leading-snug">
              {standing.headline}
            </p>
          )}

          {/* Meta rows — age, nationality, body, skill moves */}
          <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="tabular-nums">{player.age}y</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="truncate">{player.nationality}</span>
            </div>
            {player.source === 'real' && player.heightCm && player.weightKg && (
              <div className="tabular-nums">
                {player.heightCm}cm · {player.weightKg}kg
              </div>
            )}
            {skillMoves >= 3 && (
              <div className="flex items-center gap-0.5 text-amber-400" aria-label={`${skillMoves}-star skill moves`}>
                {Array.from({ length: skillMoves }).map((_, i) => (
                  <Star key={i} className="w-2.5 h-2.5 fill-current" aria-hidden />
                ))}
              </div>
            )}
          </div>

          {/* Club identity */}
          <div className="mt-2 pt-2 border-t border-border/30 flex items-center gap-1.5 min-w-0">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/40"
              style={{ backgroundColor: clubColor }}
            />
            <span className="text-[11px] text-foreground/90 truncate">
              {club?.name || 'Unknown'}
            </span>
            {player.source === 'real' && (
              <span
                className="ml-auto px-1.5 py-0.5 rounded text-[8px] font-medium uppercase tracking-wider text-muted-foreground bg-muted/40 border border-border/40 shrink-0"
                aria-label={t('playerHeroCard.realPlayer')}
              >
                Real
              </span>
            )}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
});
