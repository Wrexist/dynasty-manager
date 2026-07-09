import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

interface CommunityPackToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  className?: string;
}

/**
 * Inline community-pack opt-in for the game-setup flows (club / career /
 * World Cup). Replaces the old blocking cold-open `CommunityPackPopup`:
 * defaulted ON (real players), toggleable in-place, and it carries the
 * attribution disclosure the popup used to own — that legal note must survive
 * the popup's removal, so it renders whenever real players are enabled.
 */
export function CommunityPackToggle({ enabled, onChange, className }: CommunityPackToggleProps) {
  return (
    <div className={cn('bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-3.5', className)}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Real Players</p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Real-world squads, names &amp; ratings from community data.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Use real players (community pack)"
          onClick={() => { hapticLight(); onChange(!enabled); }}
          className={cn(
            'relative w-12 h-7 rounded-full border transition-colors shrink-0',
            enabled ? 'bg-primary/90 border-primary/60' : 'bg-white/10 border-white/20',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
              enabled && 'translate-x-5',
            )}
          />
        </button>
      </div>
      {enabled && (
        <p className="text-[10px] text-muted-foreground/70 leading-snug mt-2.5 pt-2.5 border-t border-white/[0.06]">
          Community-sourced data, loaded offline on your device. Not affiliated with or endorsed
          by any league, club, player, or governing body — all names and ratings belong to their
          respective rights holders.
        </p>
      )}
    </div>
  );
}
