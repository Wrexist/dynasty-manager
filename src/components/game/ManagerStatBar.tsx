import { cn } from '@/lib/utils';

interface ManagerStatBarProps {
  label: string;
  value: number;
  max?: number;
  className?: string;
}

export function ManagerStatBar({ label, value, max = 20, className }: ManagerStatBarProps) {
  const pct = (value / max) * 100;
  const color = value >= 15 ? 'bg-emerald-500' : value >= 10 ? 'bg-primary' : value >= 6 ? 'bg-amber-500' : 'bg-muted-foreground';

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-bold text-foreground">{Math.floor(value)}</span>
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
