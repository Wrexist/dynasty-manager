import { memo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface StatBarProps {
  label: string;
  value: number;
  max?: number;
  size?: 'sm' | 'md';
  change?: number;
}

// Premium gradient + tinted glow per tier. Inline so the stat bar stays
// lightweight (this renders dozens at a time on PlayerDetail).
function statBarStyle(pct: number): React.CSSProperties {
  if (pct >= 80) {
    return {
      background: 'linear-gradient(180deg, #6EE7B7 0%, #10B981 60%, #047857 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.2), 0 0 5px rgba(16,185,129,0.4)',
    };
  }
  if (pct >= 60) {
    return {
      background: 'linear-gradient(180deg, #7DD3FC 0%, #0284C7 60%, #075985 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.2), 0 0 5px rgba(56,189,248,0.4)',
    };
  }
  if (pct >= 40) {
    return {
      background: 'linear-gradient(180deg, #FDE68A 0%, #F59E0B 60%, #B45309 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.2), 0 0 5px rgba(245,158,11,0.4)',
    };
  }
  return {
    background: 'linear-gradient(180deg, #FCA5A5 0%, #E11D48 60%, #9F1239 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.2), 0 0 5px rgba(225,29,72,0.4)',
  };
}

export const StatBar = memo(function StatBar({ label, value, max = 99, size = 'md', change }: StatBarProps) {
  const pct = Math.min(100, (value / max) * 100);

  return (
    <div className={cn('flex items-center gap-2', size === 'sm' ? 'text-xs' : 'text-sm')}>
      <span className="text-muted-foreground w-16 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-black/30 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, ...statBarStyle(pct) }}
        />
      </div>
      <span className="font-mono font-bold text-foreground w-7 text-right">{value}</span>
      {change != null && change !== 0 && (
        <span
          className={cn(
            'text-[10px] font-bold w-7 shrink-0',
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
