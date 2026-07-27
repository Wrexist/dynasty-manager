import { memo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { getStatBarStyle } from '@/utils/uiHelpers';

interface StatBarProps {
  label: string;
  value: number;
  max?: number;
  size?: 'sm' | 'md';
  change?: number;
}

export const StatBar = memo(function StatBar({ label, value, max = 99, size = 'md', change }: StatBarProps) {
  const pct = Math.min(100, (value / max) * 100);

  return (
    <div className={cn('flex items-center gap-2', size === 'sm' ? 'text-xs' : 'text-sm')}>
      <span className="text-muted-foreground w-16 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-black/30 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, ...getStatBarStyle(pct) }}
        />
      </div>
      <span className="tabular-nums font-bold text-foreground w-7 text-right">{value}</span>
      {change != null && change !== 0 && (
        <span
          className={cn(
            'text-micro font-bold w-7 shrink-0 tabular-nums',
            change > 0 ? 'text-emerald-400' : 'text-destructive'
          )}
          aria-label={change > 0 ? `Increased by ${change}` : `Decreased by ${Math.abs(change)}`}
        >
          {change > 0 ? <><ChevronUp className="w-2.5 h-2.5 inline-block align-text-top" />+{change}</> : <><ChevronDown className="w-2.5 h-2.5 inline-block align-text-top" />{change}</>}
        </span>
      )}
    </div>
  );
});
