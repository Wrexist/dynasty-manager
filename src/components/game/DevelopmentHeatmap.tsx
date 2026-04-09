/**
 * Player development heatmap — grid of players x attributes colored by growth rate.
 * Shows which attributes are growing (green) or declining (red) for each player.
 */
import { cn } from '@/lib/utils';
import type { Player, PlayerAttributes } from '@/types/game';

interface DevelopmentHeatmapProps {
  players: Player[];
  maxRows?: number;
}

const ATTRS: (keyof PlayerAttributes)[] = ['pace', 'shooting', 'passing', 'defending', 'physical', 'mental'];
const ATTR_LABELS: Record<string, string> = {
  pace: 'PAC', shooting: 'SHO', passing: 'PAS', defending: 'DEF', physical: 'PHY', mental: 'MEN',
};

function getGrowthColor(delta: number): string {
  if (delta >= 3) return 'bg-emerald-400';
  if (delta >= 2) return 'bg-emerald-500/80';
  if (delta >= 1) return 'bg-emerald-600/60';
  if (delta > 0) return 'bg-emerald-700/40';
  if (delta === 0) return 'bg-muted/20';
  if (delta >= -1) return 'bg-red-700/40';
  return 'bg-red-500/60';
}

function getGrowthText(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return '·';
}

export function DevelopmentHeatmap({ players, maxRows = 10 }: DevelopmentHeatmapProps) {
  // Filter to players with any growth data and sort by total growth descending
  const withGrowth = players
    .filter(p => p.lastTrainingGains || p.lastAttributeChanges)
    .map(p => {
      const gains: Partial<Record<keyof PlayerAttributes, number>> = {};
      let total = 0;
      for (const attr of ATTRS) {
        const delta = (p.lastAttributeChanges?.[attr] ?? 0) + (p.lastTrainingGains?.[attr] ?? 0);
        gains[attr] = delta;
        total += delta;
      }
      return { player: p, gains, total };
    })
    .filter(entry => entry.total !== 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, maxRows);

  if (withGrowth.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground text-center py-4">
        No development data yet. Advance a week to see player growth.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-[9px] text-muted-foreground text-left font-normal py-1 pr-2 sticky left-0 bg-card">Player</th>
            {ATTRS.map(attr => (
              <th key={attr} className="text-[9px] text-muted-foreground text-center font-normal py-1 px-0.5 w-8">
                {ATTR_LABELS[attr]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {withGrowth.map(({ player, gains }) => (
            <tr key={player.id} className="border-t border-border/20">
              <td className="text-[10px] text-foreground py-1 pr-2 sticky left-0 bg-card truncate max-w-[80px]">
                {player.lastName}
                <span className="text-muted-foreground ml-1 text-[8px]">{player.position}</span>
              </td>
              {ATTRS.map(attr => {
                const delta = gains[attr] || 0;
                return (
                  <td key={attr} className="text-center py-1 px-0.5">
                    <div className={cn(
                      'w-7 h-5 rounded-sm flex items-center justify-center mx-auto',
                      getGrowthColor(delta),
                    )}>
                      <span className={cn(
                        'text-[8px] font-mono tabular-nums',
                        delta > 0 ? 'text-white' : delta < 0 ? 'text-red-200' : 'text-muted-foreground/50'
                      )}>
                        {getGrowthText(delta)}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
