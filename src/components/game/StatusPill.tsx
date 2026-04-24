import type { ElementType } from 'react';
import { cn } from '@/lib/utils';

export type StatusPillTone = 'emerald' | 'amber' | 'red' | 'sky' | 'primary';

const PILL_TONE: Record<StatusPillTone, string> = {
  emerald: 'bg-emerald-500/95 text-white border-emerald-300/30',
  amber: 'bg-amber-500/95 text-white border-amber-300/30',
  red: 'bg-red-500/95 text-white border-red-300/30',
  sky: 'bg-sky-500/95 text-white border-sky-300/30',
  primary: 'bg-primary/95 text-primary-foreground border-primary/40',
};

interface StatusPillProps {
  tone: StatusPillTone;
  Icon?: ElementType;
  label?: string;
  title?: string;
}

/**
 * Small glass-style pill used as an at-a-glance overlay on player cards
 * (XI / SUB / INJ / SUS / LOAN / contract urgency). Extracted from
 * SquadPage so every context — squad, youth, market, detail — renders
 * the same pill with the same tone palette.
 */
export function StatusPill({ tone, Icon, label, title }: StatusPillProps) {
  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        'flex items-center gap-0.5 rounded-md text-[9px] font-bold tracking-wide px-1.5 py-[2px] backdrop-blur-sm border shadow-[0_1px_3px_rgba(0,0,0,0.5)] leading-none',
        PILL_TONE[tone],
      )}
    >
      {Icon && <Icon className="w-2.5 h-2.5" aria-hidden />}
      {label && <span className="tabular-nums">{label}</span>}
    </span>
  );
}
