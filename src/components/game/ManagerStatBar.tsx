import { cn } from '@/lib/utils';

interface ManagerStatBarProps {
  label: string;
  value: number;
  max?: number;
  bonus?: number;
  className?: string;
}

export function ManagerStatBar({ label, value, max = 20, bonus, className }: ManagerStatBarProps) {
  const display = Math.floor(value);
  const pct = (display / max) * 100;
  const color = display >= 15 ? 'bg-emerald-500' : display >= 10 ? 'bg-sky-500' : display >= 6 ? 'bg-amber-500' : 'bg-muted-foreground';

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-bold text-foreground">
          {display}
          {bonus != null && bonus > 0 && (
            <span className="text-emerald-400 ml-1 font-semibold">(+{bonus})</span>
          )}
        </span>
      </div>
      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
