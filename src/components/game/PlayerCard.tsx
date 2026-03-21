import { memo } from 'react';
import { Player } from '@/types/game';
import { GlassPanel } from './GlassPanel';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, HeartPulse } from 'lucide-react';
import { getRatingColor, getFitnessColor } from '@/utils/uiHelpers';

interface PlayerCardProps {
  player: Player;
  onClick?: () => void;
  compact?: boolean;
}

export const PlayerCard = memo(function PlayerCard({ player, onClick, compact }: PlayerCardProps) {
  const ratingColor = getRatingColor(player.overall);

  if (compact) {
    return (
      <div onClick={onClick} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors">
        <span className={cn('font-mono font-black text-lg w-8', ratingColor)}>{player.overall}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="font-semibold text-foreground text-sm truncate">{player.firstName[0]}. {player.lastName}</p>
            {player.growthDelta && player.growthDelta > 0 && <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />}
            {player.growthDelta && player.growthDelta < 0 && <TrendingDown className="w-3 h-3 text-destructive shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground">{player.position} • {player.age}y</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {player.listedForSale && <span className="text-primary text-[10px] font-bold">LISTED</span>}
          {player.injured && <HeartPulse className="w-3.5 h-3.5 text-destructive" />}
          <span className={cn('w-2 h-2 rounded-full', getFitnessColor(player.fitness))} />
        </div>
      </div>
    );
  }

  return (
    <GlassPanel className="p-4" onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <span className={cn('font-mono font-black text-xl', ratingColor)}>{player.overall}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="font-bold text-foreground truncate">{player.firstName} {player.lastName}</p>
            {player.growthDelta && player.growthDelta > 0 && <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            {player.growthDelta && player.growthDelta < 0 && <TrendingDown className="w-3.5 h-3.5 text-destructive shrink-0" />}
          </div>
          <p className="text-sm text-muted-foreground">{player.position} • {player.age} • {player.nationality}</p>
        </div>
        <div className="text-right text-xs space-y-1">
          <p className="text-muted-foreground">FIT {player.fitness}%</p>
          <p className="text-muted-foreground">MOR {player.morale}%</p>
        </div>
      </div>
    </GlassPanel>
  );
}, (prev, next) =>
  prev.player.id === next.player.id &&
  prev.player.overall === next.player.overall &&
  prev.player.fitness === next.player.fitness &&
  prev.player.injured === next.player.injured &&
  prev.compact === next.compact
);
