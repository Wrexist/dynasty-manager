import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';
import { CHEMISTRY_BONUS_MAX } from '@/config/chemistry';

interface ChemistryBarProps {
  bonus: number;
  label: string;
  labelColor: string;
}

export function ChemistryBar({ bonus, label, labelColor }: ChemistryBarProps) {
  const pct = Math.min(100, (bonus / CHEMISTRY_BONUS_MAX) * 100);

  return (
    <div className="flex items-center gap-2 px-1">
      <Users className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="text-[9px] text-muted-foreground shrink-0">Chemistry</span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            bonus >= 0.08 ? 'bg-emerald-500' :
            bonus >= 0.05 ? 'bg-primary' :
            bonus >= 0.02 ? 'bg-amber-500' :
            'bg-muted-foreground'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('text-[9px] font-bold shrink-0', labelColor)}>{label}</span>
      <span className="text-[8px] text-muted-foreground tabular-nums shrink-0">
        +{(bonus * 100).toFixed(1)}%
      </span>
    </div>
  );
}
