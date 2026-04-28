/**
 * BoardObjectivesCard — extracted from `pages/Dashboard.tsx`.
 *
 * Shows progress on board-set objectives with a header progress bar and a
 * checklist below. Tapping anywhere on the card navigates to the Board page.
 */
import { ChevronRight } from 'lucide-react';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PremiumCheck } from '@/components/game/icons/PremiumCheck';
import { PremiumProgress } from '@/components/game/PremiumProgress';
import { cn } from '@/lib/utils';
import type { BoardObjective } from '@/types/game';

interface BoardObjectivesCardProps {
  boardObjectives: BoardObjective[];
  onClick: () => void;
}

export function BoardObjectivesCard({ boardObjectives, onClick }: BoardObjectivesCardProps) {
  const completedCount = boardObjectives.filter(o => o.completed).length;
  const totalCount = boardObjectives.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <GlassPanel className="p-4" onClick={onClick}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Board Objectives</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {completedCount}/{totalCount} completed
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
      <PremiumProgress className="mb-3" size="sm" value={progressPct} />
      <div className="space-y-2">
        {boardObjectives.map(obj => (
          <div key={obj.id} className="flex items-center gap-2">
            <div className={cn(
              'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
              obj.completed
                ? 'bg-emerald-500 border-emerald-500'
                : obj.priority === 'critical' ? 'border-destructive' : obj.priority === 'important' ? 'border-primary' : 'border-muted-foreground'
            )}>
              {obj.completed && <PremiumCheck className="w-2.5 h-2.5 text-white" />}
            </div>
            <span className={cn(
              'text-sm',
              obj.completed ? 'text-muted-foreground line-through' : 'text-foreground'
            )}>{obj.description}</span>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
