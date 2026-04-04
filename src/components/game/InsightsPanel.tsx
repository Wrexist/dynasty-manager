import { cn } from '@/lib/utils';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import type { SquadInsight } from '@/utils/squadInsights';

interface InsightsPanelProps {
  insights: SquadInsight[];
}

const INSIGHT_STYLES = {
  warning: 'text-amber-400',
  positive: 'text-emerald-400',
  info: 'text-muted-foreground',
} as const;

export function InsightsPanel({ insights }: InsightsPanelProps) {
  if (insights.length === 0) return null;

  return (
    <div className="space-y-1 px-1 mt-2">
      {insights.map((insight) => (
        <div key={`${insight.type}-${insight.icon}`} className="flex items-center gap-1.5">
          <DynamicIcon
            name={insight.icon}
            className={cn('w-3 h-3 shrink-0', INSIGHT_STYLES[insight.type])}
          />
          <span className={cn('text-[9px]', INSIGHT_STYLES[insight.type])}>
            {insight.message}
          </span>
        </div>
      ))}
    </div>
  );
}
