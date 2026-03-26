import { cn } from '@/lib/utils';
import { MENTALITIES, TEMPOS, WIDTHS, DEFENSIVE_LINES, PRESSING_OPTIONS } from '@/config/tactics';
import type { TacticalInstructions } from '@/types/game';

interface TacticalPanelProps {
  tactics: TacticalInstructions;
  setTactics: (partial: Partial<TacticalInstructions>) => void;
  variant: 'compact' | 'full';
}

const isPressingActive = (current: number, value: number) =>
  Math.abs(current - value) <= 12;

export function TacticalPanel({ tactics, setTactics, variant }: TacticalPanelProps) {
  const isCompact = variant === 'compact';
  const labelClass = cn(
    'text-muted-foreground uppercase tracking-wider',
    isCompact ? 'text-[10px] mb-1.5' : 'text-xs mb-2'
  );
  const btnText = isCompact ? 'text-[9px]' : 'text-[10px]';
  const btnPy = isCompact ? 'py-1.5' : 'py-2';

  const activeClass = 'bg-primary/20 text-primary border border-primary/30';
  const inactiveClass = 'bg-muted/30 text-muted-foreground hover:bg-muted/50';

  const btnBase = cn('flex-1 rounded-lg font-semibold capitalize transition-all', btnText, btnPy);

  return (
    <div className={isCompact ? 'space-y-2' : 'space-y-3'}>
      {/* Mentality — always full row (5 items) */}
      <div>
        <p className={labelClass}>Mentality</p>
        <div className={cn('flex', isCompact ? 'gap-1' : 'gap-1.5')}>
          {MENTALITIES.map(m => (
            <button
              key={m.value}
              onClick={() => setTactics({ mentality: m.value })}
              className={cn(btnBase, tactics.mentality === m.value ? activeClass : inactiveClass)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Compact: Tempo + Pressing side by side */}
      {isCompact ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className={labelClass}>Tempo</p>
            <div className="flex gap-1">
              {TEMPOS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTactics({ tempo: t.value })}
                  className={cn(btnBase, tactics.tempo === t.value ? activeClass : inactiveClass)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={labelClass}>Pressing</p>
            <div className="flex gap-1">
              {PRESSING_OPTIONS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setTactics({ pressingIntensity: p.value })}
                  className={cn(btnBase, isPressingActive(tactics.pressingIntensity, p.value) ? activeClass : inactiveClass)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className={labelClass}>Tempo</p>
            <div className="flex gap-1.5">
              {TEMPOS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTactics({ tempo: t.value })}
                  className={cn(btnBase, tactics.tempo === t.value ? activeClass : inactiveClass)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={labelClass}>Pressing</p>
            <div className="flex gap-1.5">
              {PRESSING_OPTIONS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setTactics({ pressingIntensity: p.value })}
                  className={cn(btnBase, isPressingActive(tactics.pressingIntensity, p.value) ? activeClass : inactiveClass)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Compact: Width + Defensive Line side by side */}
      {isCompact ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className={labelClass}>Width</p>
            <div className="flex gap-1">
              {WIDTHS.map(w => (
                <button
                  key={w.value}
                  onClick={() => setTactics({ width: w.value })}
                  className={cn(btnBase, tactics.width === w.value ? activeClass : inactiveClass)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={labelClass}>Def. Line</p>
            <div className="flex gap-1">
              {DEFENSIVE_LINES.map(d => (
                <button
                  key={d.value}
                  onClick={() => setTactics({ defensiveLine: d.value })}
                  className={cn(btnBase, tactics.defensiveLine === d.value ? activeClass : inactiveClass)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className={labelClass}>Width</p>
            <div className="flex gap-1.5">
              {WIDTHS.map(w => (
                <button
                  key={w.value}
                  onClick={() => setTactics({ width: w.value })}
                  className={cn(btnBase, tactics.width === w.value ? activeClass : inactiveClass)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={labelClass}>Defensive Line</p>
            <div className="flex gap-1.5">
              {DEFENSIVE_LINES.map(d => (
                <button
                  key={d.value}
                  onClick={() => setTactics({ defensiveLine: d.value })}
                  className={cn(btnBase, tactics.defensiveLine === d.value ? activeClass : inactiveClass)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
