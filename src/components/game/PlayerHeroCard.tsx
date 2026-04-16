/**
 * PlayerHeroCard — premium hero banner for the Player Detail page.
 *
 * Replaces the flat header block with a club-tinted gradient panel,
 * a large jersey avatar, and a tier-glowing rating badge accent.
 */

import { memo } from 'react';
import type { Player, Club } from '@/types/game';
import { GlassPanel } from './GlassPanel';
import { PlayerAvatar } from './PlayerAvatar';
import { PlayerBadge, getTierGlowClass } from './PlayerBadge';
import { FlagIcon } from './FlagIcon';
import { cn } from '@/lib/utils';

interface PlayerHeroCardProps {
  player: Player;
  club?: Club;
  jerseyNumber?: number;
}

export const PlayerHeroCard = memo(function PlayerHeroCard({
  player,
  club,
  jerseyNumber,
}: PlayerHeroCardProps) {
  const clubColor = club?.color || '#888';
  const showPotential = player.potential > player.overall;
  const skillMoves = player.skillMoves ?? 0;

  return (
    <GlassPanel
      className={cn(
        'relative overflow-hidden p-5',
        getTierGlowClass(player.overall),
      )}
    >
      {/* Club-color radial gradient backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 15% 0%, ${clubColor}33, transparent 55%)`,
        }}
      />

      <div className="relative flex items-start gap-4">
        {/* Large jersey avatar */}
        <div className="shrink-0">
          <PlayerAvatar
            jerseyColor={clubColor}
            jerseyNumber={jerseyNumber}
            overall={player.overall}
            position={player.position}
            size={88}
          />
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0 pt-1">
          <p className="text-xl font-black text-foreground leading-tight truncate">
            {player.firstName} {player.lastName}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap mt-0.5">
            <span>{player.position}</span>
            <span>·</span>
            <span>{player.age}</span>
            <span>·</span>
            <FlagIcon nationality={player.nationality} size={16} />
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
          <div className="flex items-center gap-1.5 mt-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: clubColor }}
            />
            <span className="text-xs text-muted-foreground truncate">
              {club?.name || 'Unknown'}
            </span>
          </div>
        </div>

        {/* Corner rating badge */}
        <PlayerBadge
          clubColor={clubColor}
          overall={player.overall}
          position={player.position}
          jerseyNumber={jerseyNumber}
          size="md"
          growthDelta={player.growthDelta}
        />
      </div>
    </GlassPanel>
  );
});
