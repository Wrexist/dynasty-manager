/**
 * Visual drill card showing attribute bars, gain range, and injury risk badge.
 * Replaces text-only drill display in training page.
 */
import { cn } from '@/lib/utils';
import type { TrainingDrill } from '@/types/game';

interface DrillCardProps {
  drill: TrainingDrill;
  selected: boolean;
  onSelect: () => void;
  injuryRisk?: number; // 0-1 percentage
}

const ATTR_LABELS: Record<string, { label: string; color: string }> = {
  pace: { label: 'PAC', color: 'bg-cyan-500' },
  shooting: { label: 'SHO', color: 'bg-red-500' },
  passing: { label: 'PAS', color: 'bg-emerald-500' },
  defending: { label: 'DEF', color: 'bg-blue-500' },
  physical: { label: 'PHY', color: 'bg-amber-500' },
  mental: { label: 'MEN', color: 'bg-purple-500' },
};

export function DrillCard({ drill, selected, onSelect, injuryRisk }: DrillCardProps) {
  const weights = Object.entries(drill.attrWeights).sort(([, a], [, b]) => (b || 0) - (a || 0));

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-lg p-2.5 transition-all border',
        selected
          ? 'bg-primary/15 border-primary/50 shadow-[0_0_8px_hsl(var(--primary)/0.15)]'
          : 'bg-muted/30 border-border/30 hover:bg-muted/50'
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={cn('text-xs font-semibold', selected ? 'text-primary' : 'text-foreground')}>
          {drill.name}
        </span>
        {injuryRisk !== undefined && injuryRisk > 0.02 && (
          <span className={cn(
            'text-[9px] px-1.5 py-0.5 rounded-full font-medium',
            injuryRisk >= 0.04 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
          )}>
            {(injuryRisk * 100).toFixed(1)}% risk
          </span>
        )}
      </div>

      {/* Attribute bars */}
      <div className="space-y-1">
        {weights.map(([attr, weight]) => {
          const info = ATTR_LABELS[attr];
          if (!info || !weight) return null;
          return (
            <div key={attr} className="flex items-center gap-1.5">
              <span className="text-[9px] text-muted-foreground w-6 font-mono">{info.label}</span>
              <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', info.color)}
                  style={{ width: `${Math.round(weight * 100)}%`, opacity: selected ? 1 : 0.7 }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground w-6 text-right tabular-nums">{Math.round(weight * 100)}%</span>
            </div>
          );
        })}
      </div>

      {drill.description && (
        <p className="text-[9px] text-muted-foreground/60 mt-1 leading-tight">{drill.description}</p>
      )}
    </button>
  );
}
