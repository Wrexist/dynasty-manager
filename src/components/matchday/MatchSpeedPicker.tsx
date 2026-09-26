/**
 * MatchSpeedPicker — extracted from `pages/MatchDay.tsx` where this same
 * speed-selector strip appears in three places (pre-match, half-time,
 * before extra time). Pro-locked speeds route to the shop screen.
 */
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MATCH_SPEEDS } from '@/config/matchSpeed';

interface MatchSpeedPickerProps {
  speed: number;
  userIsPro: boolean;
  onSelect: (value: number) => void;
  onLockedSelect: () => void;
  /** Optional label prefix shown to the left of the strip. */
  label?: string;
  className?: string;
}

export function MatchSpeedPicker({
  speed,
  userIsPro,
  onSelect,
  onLockedSelect,
  label = 'Speed:',
  className,
}: MatchSpeedPickerProps) {
  return (
    <div className={cn('flex items-center justify-center gap-1.5', className)}>
      {label && <span className="text-micro text-muted-foreground mr-1">{label}</span>}
      <div className="flex bg-muted/20 rounded-lg border border-border/30 p-0.5">
        {MATCH_SPEEDS.map(s => {
          const locked = s.pro && !userIsPro;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => locked ? onLockedSelect() : onSelect(s.value)}
              className={cn(
                // 44px tall (they measured 23px at 390x844): a speed change is
                // made mid-match, one-handed, so the chip must be hittable.
                'min-h-11 min-w-11 px-2 rounded-md text-micro font-medium transition-all flex items-center justify-center gap-0.5',
                locked
                  ? 'text-muted-foreground/40 cursor-default'
                  : speed === s.value
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {locked && <Crown className="w-2.5 h-2.5" />}
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
