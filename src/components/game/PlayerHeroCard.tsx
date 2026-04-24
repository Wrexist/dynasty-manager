/**
 * PlayerHeroCard — premium hero banner for the Player Detail page.
 *
 * Wraps the shared {@link PlayerCard} (size="xl", interactive="cycle")
 * with a tier-glow frame and a supplementary info column: tier label,
 * growth arrow, full nationality name, height/weight, potential, skill
 * stars, real-player badge, and club identity. Copies of data already
 * shown on the card face (OVR, position, name, flag, stats) are
 * deliberately omitted so the banner doesn't read as duplicated.
 */

import { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Player, Club } from '@/types/game';
import { GlassPanel } from './GlassPanel';
import { PlayerCard } from './PlayerCard';
import { TierBorderFrame } from './TierBorderFrame';
import { cn } from '@/lib/utils';
import { getPlayerTier } from '@/utils/uiHelpers';
import { lighten, darken } from '@/utils/colorUtils';

interface PlayerHeroCardProps {
  player: Player;
  club?: Club;
}

/** Return a club color safe for use as a subtle backdrop tint. */
function getBackdropColor(hex: string): string {
  const num = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(num)) return hex;
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  if (luminance < 0.2) return lighten(hex, 0.5);
  if (luminance > 0.85) return darken(hex, 0.3);
  return hex;
}

export const PlayerHeroCard = memo(function PlayerHeroCard({
  player,
  club,
}: PlayerHeroCardProps) {
  const clubColor = club?.color || '#888';
  const showPotential = player.potential > player.overall;
  const skillMoves = player.skillMoves ?? 0;
  const growth = player.growthDelta;
  const backdropColor = useMemo(() => getBackdropColor(clubColor), [clubColor]);
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
    <TierBorderFrame
      tier={tier}
      glow
      outerRadiusClass="rounded-2xl"
      innerRadiusClass="rounded-[14px]"
      paddingClass="p-[2px]"
    >
      <GlassPanel
        className="relative overflow-hidden p-4 rounded-[14px]"
        aria-label={ariaLabel}
      >
        {/* Subtle club-color radial tint to anchor the hero to the team identity */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 85% 0%, ${backdropColor}33, transparent 60%)`,
          }}
        />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <PlayerCard
            player={player}
            size="xl"
            interactive="cycle"
            showConditionView
            className="shrink-0"
          />

          <div className="flex-1 min-w-0 pt-1 space-y-2">
            {/* Tier + growth row */}
            <div className="flex items-center gap-2">
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
                <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" aria-label={`growing +${growth}`} />
              )}
              {growth != null && growth < 0 && (
                <TrendingDown className="w-4 h-4 text-destructive shrink-0" aria-label={`declining ${growth}`} />
              )}
            </div>

            {/* Meta — only fields the card doesn't already show */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{player.age}y</span>
              <span className="text-muted-foreground/50">·</span>
              <span>{player.nationality}</span>
              {player.source === 'real' && player.heightCm && player.weightKg && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="tabular-nums">{player.heightCm}cm · {player.weightKg}kg</span>
                </>
              )}
              {showPotential && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="text-primary font-semibold">Pot {player.potential}</span>
                </>
              )}
              {skillMoves >= 3 && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="text-amber-400">{'★'.repeat(skillMoves)}</span>
                </>
              )}
            </div>

            {player.source === 'real' && (
              <span
                className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider text-muted-foreground bg-muted/40 border border-border/40"
                aria-label="Real player"
              >
                Real Player
              </span>
            )}

            {/* Club row */}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/40" style={{ backgroundColor: clubColor }} />
              <span className="text-xs text-foreground/90 truncate">
                {club?.name || 'Unknown'}
              </span>
            </div>
          </div>
        </div>
      </GlassPanel>
    </TierBorderFrame>
  );
});
