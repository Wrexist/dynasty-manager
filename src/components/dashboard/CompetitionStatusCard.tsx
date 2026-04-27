/**
 * CompetitionStatusCard — used by Dashboard for every cup/competition row
 * (Domestic Cup, League Cup, Champions Cup, Shield Cup, Conference Cup,
 * Super Cup). Same shell, different icon + status text.
 */
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { GlassPanel } from '@/components/game/GlassPanel';
import { cn } from '@/lib/utils';

interface CompetitionStatusCardProps {
  title: string;
  icon: LucideIcon;
  iconClassName?: string;
  status: string;
  onClick: () => void;
}

export function CompetitionStatusCard({
  title,
  icon: Icon,
  iconClassName,
  status,
  onClick,
}: CompetitionStatusCardProps) {
  return (
    <GlassPanel className="p-4" onClick={onClick}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className={cn('w-5 h-5', iconClassName)} />
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{status}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </GlassPanel>
  );
}
