import { memo } from 'react';
import { cn } from '@/lib/utils';
import { getStatBarColor } from '@/utils/uiHelpers';

interface StatBarProps {
  label: string;
  value: number;
  max?: number;
  size?: 'sm' | 'md';
  change?: number;
}

export const StatBar = memo(function StatBar({ label, value, max = 99, size = 'md', change }: StatBarProps) {
  const pct = Math.min(100, (value / max) * 100);
  const color = getStatBarColor(pct);

  return (
    <div className={cn('flex items-center gap-2', size === 'sm' ? 'text-xs' : 'text-sm')}>
      <span className="text-muted-foreground w-16 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono font-bold text-foreground w-7 text-right">{value}</span>
      {change != null && change !== 0 && (
        <span className={cn(
          'text-[10px] font-bold w-7 shrink-0',
          change > 0 ? 'text-emerald-400' : 'text-destructive'
        )}>
          {change > 0 ? `▲+${change}` : `▼${change}`}
        </span>
      )}
    </div>
  );
});
