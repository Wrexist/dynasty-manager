/**
 * PlayerHeroCard — premium hero banner for the Player Detail page.
 *
 * Club-tinted gradient panel with a large jersey avatar, big inline rating,
 * growth trajectory arrow, and tier-glow halo. Derives a stable jersey
 * number from the player id so the shirt never renders empty.
 */

import { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Player, Club } from '@/types/game';
import { GlassPanel } from './GlassPanel';
import { PlayerAvatar } from './PlayerAvatar';
import { FlagIcon } from './FlagIcon';
import { cn } from '@/lib/utils';
import { getRatingColor, getTierGlowClass, getStableJerseyNumber } from '@/utils/uiHelpers';
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
  const jerseyNumber = useMemo(() => getStableJerseyNumber(player.id), [player.id]);
  const backdropColor = useMemo(() => getBackdropColor(clubColor), [clubColor]);

  const ariaLabel = [
    `${player.firstName} ${player.lastName}`,
    player.position,
    `overall ${player.overall}`,
    showPotential ? `potential ${player.potential}` : null,
    `age ${player.age}`,
    club?.name,
  ].filter(Boolean).join(', ');

  return (
    <GlassPanel
      className={cn('relative overflow-hidden p-5', getTierGlowClass(player.overall))}
      aria-label={ariaLabel}
    >
      {/* Club-color radial gradient backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 15% 0%, ${backdropColor}33, transparent 55%)`,
        }}
      />

      <div className="relative flex items-start gap-4">
        {/* Jersey avatar — stable derived number keeps the shirt from looking empty */}
        <div className="shrink-0">
          <PlayerAvatar
            jerseyColor={clubColor}
            secondaryColor={club?.secondaryColor}
            jerseyNumber={jerseyNumber}
            overall={player.overall}
            position={player.position}
            size={80}
          />
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          {/* Rating + name row */}
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'text-3xl font-black font-display tabular-nums leading-none',
                getRatingColor(player.overall),
              )}
            >
              {player.overall}
            </span>
            {growth != null && growth > 0 && (
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" aria-label={`growing +${growth}`} />
            )}
            {growth != null && growth < 0 && (
              <TrendingDown className="w-4 h-4 text-destructive shrink-0" aria-label={`declining ${growth}`} />
            )}
            <p className="text-lg font-black text-foreground leading-tight truncate flex-1 min-w-0">
              {player.firstName} {player.lastName}
            </p>
          </div>

          {/* Meta row */}
          <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap mt-1.5">
            <span className="font-semibold text-foreground/80">{player.position}</span>
            <span>·</span>
            <span>{player.age}</span>
            <span>·</span>
            <FlagIcon nationality={player.nationality} size={14} />
            <span>{player.nationality}</span>
            {showPotential && (
              <>
                <span>·</span>
                <span className="text-primary font-semibold">Pot {player.potential}</span>
              </>
            )}
            {skillMoves >= 3 && (
              <>
                <span>·</span>
                <span className="text-amber-400">{'★'.repeat(skillMoves)} Skills</span>
              </>
            )}
          </p>

          {/* Club row */}
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: clubColor }} />
            <span className="text-xs text-muted-foreground truncate">
              {club?.name || 'Unknown'}
            </span>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
});
