import { cn } from '@/lib/utils';
import { MENTALITIES, TEMPOS, WIDTHS, DEFENSIVE_LINES, PRESSING_OPTIONS } from '@/config/tactics';
import type { TacticalInstructions } from '@/types/game';
import { LiquidGlassSlider } from './LiquidGlassSlider';

interface TacticalPanelProps {
  tactics: TacticalInstructions;
  setTactics: (partial: Partial<TacticalInstructions>) => void;
  variant: 'compact' | 'full';
}

/**
 * Tactical instructions panel — shared between half-time, in-match pause,
 * and key-moment screens. Uses the same {@link LiquidGlassSlider} as the
 * Tactics page so controls are consistent app-wide.
 */
export function TacticalPanel({ tactics, setTactics, variant }: TacticalPanelProps) {
  const isCompact = variant === 'compact';
  const labelClass = cn(
    'text-muted-foreground uppercase tracking-wider font-semibold',
    isCompact ? 'text-[10px] mb-1' : 'text-xs mb-1.5',
  );
  const rowGap = isCompact ? 'space-y-3' : 'space-y-4';

  return (
    <div className={rowGap}>
      <div>
        <p className={labelClass}>Mentality</p>
        <LiquidGlassSlider
          ariaLabel="Mentality"
          options={MENTALITIES}
          value={tactics.mentality}
          onChange={v => setTactics({ mentality: v })}
        />
      </div>

      <div>
        <p className={labelClass}>Tempo</p>
        <LiquidGlassSlider
          ariaLabel="Tempo"
          options={TEMPOS}
          value={tactics.tempo}
          onChange={v => setTactics({ tempo: v })}
        />
      </div>

      <div>
        <p className={labelClass}>Pressing</p>
        <LiquidGlassSlider
          ariaLabel="Pressing"
          options={PRESSING_OPTIONS}
          value={tactics.pressingIntensity}
          onChange={v => setTactics({ pressingIntensity: v })}
        />
      </div>

      <div>
        <p className={labelClass}>Width</p>
        <LiquidGlassSlider
          ariaLabel="Team Width"
          options={WIDTHS}
          value={tactics.width}
          onChange={v => setTactics({ width: v })}
        />
      </div>

      <div>
        <p className={labelClass}>Defensive Line</p>
        <LiquidGlassSlider
          ariaLabel="Defensive Line"
          options={DEFENSIVE_LINES}
          value={tactics.defensiveLine}
          onChange={v => setTactics({ defensiveLine: v })}
        />
      </div>
    </div>
  );
}
