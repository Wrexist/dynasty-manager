import { useState } from 'react';
import { Player } from '@/types/game';
import { cn } from '@/lib/utils';
import { getRatingColor, getFitnessColor } from '@/utils/uiHelpers';
import { getFlag } from '@/utils/nationality';
import { ChevronDown, HeartPulse, Sparkles } from 'lucide-react';

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
    <div className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
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

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} />
      )}

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-full left-0 bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl overflow-hidden shadow-2xl"
        >
          {/* Auto option */}
          <button
            type="button"
            role="option"
            aria-selected={!selectedId}
            onClick={() => { onChange(undefined); setOpen(false); }}
            className={cn(
              'flex items-center gap-2 w-full px-3 py-2.5 text-sm transition-colors',
              !selectedId ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/30'
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{placeholder}</span>
            {!selectedId && <span className="ml-auto text-xs text-primary/70">Active</span>}
          </button>

          <div className="h-px bg-border/30" />

          {/* Player list */}
          <div className="max-h-60 overflow-y-auto">
            {players.map(p => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={selectedId === p.id}
                onClick={() => { onChange(p.id); setOpen(false); }}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 transition-colors',
                  selectedId === p.id ? 'bg-primary/10' : 'hover:bg-muted/30'
                )}
              >
                <PlayerRow player={p} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
