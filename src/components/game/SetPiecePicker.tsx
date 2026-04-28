import { useMemo, useState } from 'react';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import type { Player, PlayerAttributes } from '@/types/game';
import { PlayerCard } from './PlayerCard';
import { FlagIcon } from './FlagIcon';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { getRatingColor } from '@/utils/uiHelpers';
import { hapticLight } from '@/utils/haptics';
import {
  PENALTY_TAKER_SHOOTING_WEIGHT,
  PENALTY_TAKER_MENTAL_WEIGHT,
  SET_PIECE_TAKER_PASSING_WEIGHT,
  SET_PIECE_TAKER_SHOOTING_WEIGHT,
  SET_PIECE_TAKER_MENTAL_WEIGHT,
} from '@/config/matchEngine';

export type SetPieceRole = 'setpiece' | 'penalty';

interface SetPiecePickerProps {
  role: SetPieceRole;
  players: Player[];
  selectedId: string | undefined;
  onChange: (id: string | undefined) => void;
}

interface RoleAttr {
  label: string;
  key: keyof PlayerAttributes;
}

// "DRI" is the PlayerCard label for the `mental` attribute (composure /
// technique under pressure) — keeping it consistent with the squad-grid
// card so players see the same shorthand everywhere.
const ROLE_ATTRS: Record<SetPieceRole, RoleAttr[]> = {
  setpiece: [
    { label: 'PAS', key: 'passing' },
    { label: 'SHO', key: 'shooting' },
    { label: 'DRI', key: 'mental' },
  ],
  penalty: [
    { label: 'SHO', key: 'shooting' },
    { label: 'DRI', key: 'mental' },
    { label: 'PHY', key: 'physical' },
  ],
};

const ROLE_TITLE: Record<SetPieceRole, string> = {
  setpiece: 'Pick Corner / Free Kick Taker',
  penalty: 'Pick Penalty Taker',
};

const ROLE_AUTO_LABEL: Record<SetPieceRole, string> = {
  setpiece: 'Auto (best passing + shooting)',
  penalty: 'Auto (best shooting + mental)',
};

function compositeScore(p: Player, role: SetPieceRole): number {
  if (role === 'penalty') {
    return Math.round(
      p.attributes.shooting * PENALTY_TAKER_SHOOTING_WEIGHT +
        p.attributes.mental * PENALTY_TAKER_MENTAL_WEIGHT,
    );
  }
  return Math.round(
    p.attributes.passing * SET_PIECE_TAKER_PASSING_WEIGHT +
      p.attributes.shooting * SET_PIECE_TAKER_SHOOTING_WEIGHT +
      p.attributes.mental * SET_PIECE_TAKER_MENTAL_WEIGHT,
  );
}

/**
 * Squad-card-based picker for set-piece + penalty takers. Trigger collapses
 * to a one-line summary; tap opens a bottom sheet with a 3-column scrollable
 * grid of squad-style PlayerCards, each annotated with the three attributes
 * that drive the role's auto-resolve weighting (PAS/SHO/DRI for set-piece,
 * SHO/DRI/PHY for penalty). Players are pre-sorted by composite score so the
 * best fit lands top-left.
 */
export function SetPiecePicker({ role, players, selectedId, onChange }: SetPiecePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = selectedId ? players.find(p => p.id === selectedId) : undefined;
  const attrs = ROLE_ATTRS[role];

  const sorted = useMemo(
    () => [...players].sort((a, b) => compositeScore(b, role) - compositeScore(a, role)),
    [players, role],
  );

  const handlePick = (id: string | undefined) => {
    hapticLight();
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { hapticLight(); setOpen(true); }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2.5 text-sm text-foreground',
          'flex items-center gap-2 transition-colors',
          open && 'border-primary/50 bg-muted/40',
        )}
      >
        {selected ? (
          <SelectedRow player={selected} role={role} />
        ) : (
          <span className="flex items-center gap-1.5 text-muted-foreground flex-1 text-left">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            {ROLE_AUTO_LABEL[role]}
          </span>
        )}
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="bg-background border-border/50 rounded-t-2xl h-[85vh] max-h-[85vh] flex flex-col p-0"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/30">
            <SheetTitle className="text-foreground">{ROLE_TITLE[role]}</SheetTitle>
          </SheetHeader>

          <button
            type="button"
            onClick={() => handlePick(undefined)}
            className={cn(
              'flex items-center gap-2 w-full px-5 py-3 text-sm transition-colors border-b border-border/30',
              !selectedId ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/30',
            )}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left">{ROLE_AUTO_LABEL[role]}</span>
            {!selectedId && <Check className="w-4 h-4 text-primary shrink-0" />}
          </button>

          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-safe">
            {sorted.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">
                No outfield players in your starting XI.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 justify-items-center">
                {sorted.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePick(p.id)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-1.5 rounded-xl transition-colors',
                      selectedId === p.id
                        ? 'bg-primary/15 ring-2 ring-primary/60'
                        : 'active:bg-muted/40 hover:bg-muted/30',
                    )}
                    aria-label={`Pick ${p.firstName} ${p.lastName}`}
                    aria-pressed={selectedId === p.id}
                  >
                    <PlayerCard
                      player={p}
                      size="md"
                      interactive="none"
                      showConditionView={false}
                    />
                    <div className="flex gap-1 flex-wrap justify-center">
                      {attrs.map(a => (
                        <span
                          key={a.label}
                          className={cn(
                            'text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-muted/40',
                            getRatingColor(p.attributes[a.key]),
                          )}
                        >
                          {a.label}:{p.attributes[a.key]}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SelectedRow({ player, role }: { player: Player; role: SetPieceRole }) {
  const score = compositeScore(player, role);
  return (
    <>
      <span className={cn('font-mono font-black text-sm w-7 text-right shrink-0', getRatingColor(score))}>
        {score}
      </span>
      <FlagIcon nationality={player.nationality} size={16} />
      <span className="text-sm text-foreground truncate flex-1 text-left">
        {player.firstName[0]}. {player.lastName}
      </span>
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground shrink-0">
        {player.position}
      </span>
    </>
  );
}
