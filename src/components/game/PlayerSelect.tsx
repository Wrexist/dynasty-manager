import { useState } from 'react';
import { Player } from '@/types/game';
import { cn } from '@/lib/utils';
import { getRatingColor, getFitnessColor } from '@/utils/uiHelpers';
import { getFlag } from '@/utils/nationality';
import { ChevronDown, HeartPulse, Sparkles, X } from 'lucide-react';

interface PlayerSelectProps {
  players: Player[];
  selectedId: string | undefined;
  onChange: (playerId: string | undefined) => void;
  placeholder: string;
}

function PlayerRow({ player }: { player: Player }) {
  return (
    <>
      <span className={cn('font-mono font-black text-sm w-7 text-right shrink-0', getRatingColor(player.overall))}>
        {player.overall}
      </span>
      <span className="text-sm shrink-0">{getFlag(player.nationality)}</span>
      <span className="text-sm text-foreground truncate flex-1">
        {player.firstName[0]}. {player.lastName}
      </span>
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground shrink-0">
        {player.position}
      </span>
      {player.injured && <HeartPulse className="w-3.5 h-3.5 text-destructive shrink-0" />}
      <span className={cn('w-2 h-2 rounded-full shrink-0', getFitnessColor(player.fitness))} />
    </>
  );
}

export function PlayerSelect({ players, selectedId, onChange, placeholder }: PlayerSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedPlayer = selectedId ? players.find(p => p.id === selectedId) : undefined;

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground',
          'flex items-center gap-2 transition-colors',
          open && 'border-primary/50 bg-muted/40'
        )}
      >
        {selectedPlayer ? (
          <PlayerRow player={selectedPlayer} />
        ) : (
          <span className="flex items-center gap-1.5 text-muted-foreground flex-1">
            <Sparkles className="w-3.5 h-3.5" />
            {placeholder}
          </span>
        )}
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Bottom Sheet Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" />

          {/* Sheet */}
          <div
            role="listbox"
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-lg bg-card border-t border-border/50 rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-200"
          >
            {/* Handle + Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/30">
              <span className="text-sm font-semibold text-foreground">{placeholder}</span>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-muted/40">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Auto option */}
            <button
              type="button"
              role="option"
              aria-selected={!selectedId}
              onClick={() => { onChange(undefined); setOpen(false); }}
              className={cn(
                'flex items-center gap-2 w-full px-4 py-3 text-sm transition-colors',
                !selectedId ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/30'
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{placeholder}</span>
              {!selectedId && <span className="ml-auto text-xs text-primary/70">Active</span>}
            </button>

            <div className="h-px bg-border/30" />

            {/* Player list — scrollable, max 60% viewport height */}
            <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: '60vh' }}>
              {players.map(p => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={selectedId === p.id}
                  onClick={() => { onChange(p.id); setOpen(false); }}
                  className={cn(
                    'flex items-center gap-2 w-full px-4 py-2.5 transition-colors',
                    selectedId === p.id ? 'bg-primary/10' : 'hover:bg-muted/30'
                  )}
                >
                  <PlayerRow player={p} />
                </button>
              ))}
            </div>

            {/* Safe area padding for phones with home indicator */}
            <div className="pb-safe" />
          </div>
        </div>
      )}
    </>
  );
}
