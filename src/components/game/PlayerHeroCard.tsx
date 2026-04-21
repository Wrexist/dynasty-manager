/**
 * PlayerHeroCard — premium hero banner for the Player Detail page.
 *
 * Club-tinted tier-art panel pairing a scaled-up tactics-style player
 * card with the full meta row (rating, tier, position, age, nationality,
 * club). A dark side scrim keeps the name and stats legible against the
 * tier artwork backdrop.
 */

import { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Player, Club } from '@/types/game';
import { GlassPanel } from './GlassPanel';
import { PlayerBadge } from './PlayerBadge';
import { FlagIcon } from './FlagIcon';
import { TierBorderFrame } from './TierBorderFrame';
import { CardArtBackground } from './CardArtBackground';
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
        className="relative overflow-hidden p-5 rounded-[14px]"
        aria-label={ariaLabel}
      >
      {/* Tier shield artwork sits under the club tint */}
      <CardArtBackground overall={player.overall} overlayStrength={0.55} />

      {/* Club-color radial gradient backdrop layered on top of the shield */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 15% 0%, ${backdropColor}55, transparent 55%)`,
        }}
      />

      {/* Dark scrim over the text column so the name stays readable
          against busy tier artwork regardless of club color. */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 left-1/3 pointer-events-none"
        style={{
          background: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.65) 100%)',
        }}
      />

      <div className="relative flex items-start gap-4">
        {/* Player card — tactics-style tier badge with position + rating */}
        <PlayerBadge
          clubColor={clubColor}
          overall={player.overall}
          position={player.position}
          size="xl"
          growthDelta={growth}
          noGlow
        />

        <div className="flex-1 min-w-0 pt-0.5">
          {/* Tier + growth row (rating already shown on the card badge) */}
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
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" aria-label={`growing +${growth}`} />
            )}
            {growth != null && growth < 0 && (
              <TrendingDown className="w-4 h-4 text-destructive shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" aria-label={`declining ${growth}`} />
            )}
          </div>

          <p className="text-lg font-black text-white leading-tight truncate mt-1.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
            {player.firstName} {player.lastName}
          </p>

          {/* Meta row */}
          <p className="text-xs text-white/90 flex items-center gap-1 flex-wrap mt-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            <span className="font-semibold">{player.position}</span>
            <span className="text-white/60">·</span>
            <span>{player.age}</span>
            <span className="text-white/60">·</span>
            <FlagIcon nationality={player.nationality} size={14} />
            <span>{player.nationality}</span>
            {player.source === 'real' && player.heightCm && player.weightKg && (
              <>
                <span className="text-white/60">·</span>
                <span className="tabular-nums">{player.heightCm}cm · {player.weightKg}kg</span>
              </>
            )}
            {showPotential && (
              <>
                <span className="text-white/60">·</span>
                <span className="text-primary font-semibold">Pot {player.potential}</span>
              </>
            )}
            {skillMoves >= 3 && (
              <>
                <span className="text-white/60">·</span>
                <span className="text-amber-400">{'★'.repeat(skillMoves)} Skills</span>
              </>
            )}
          </p>

          {player.source === 'real' && (
            <span
              className="inline-block mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider text-white/80 bg-black/40 border border-white/10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
              aria-label="Real player"
            >
              Real Player
            </span>
          )}

          {/* Club row */}
          <div className="flex items-center gap-1.5 mt-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            <div className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/50" style={{ backgroundColor: clubColor }} />
            <span className="text-xs text-white/85 truncate">
              {club?.name || 'Unknown'}
            </span>
          </div>
        </div>
      </div>
      </GlassPanel>
    </TierBorderFrame>
  );
});
