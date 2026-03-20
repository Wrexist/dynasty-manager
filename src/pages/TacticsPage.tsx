import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PitchView } from '@/components/game/PitchView';
import { FormationType, Mentality, TeamWidth, Tempo, DefensiveLine, TacticalInstructions } from '@/types/game';
import { cn } from '@/lib/utils';
import { getChemistryBonus, getChemistryLabel, calculateChemistryLinks } from '@/utils/chemistry';
import { getRatingColor } from '@/utils/uiHelpers';
import { Users } from 'lucide-react';

const FORMATIONS: FormationType[] = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '4-1-4-1', '3-4-3', '5-3-2'];

const MENTALITIES: { value: Mentality; label: string }[] = [
  { value: 'defensive', label: 'Defensive' },
  { value: 'cautious', label: 'Cautious' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'attacking', label: 'Attacking' },
  { value: 'all-out-attack', label: 'All-Out' },
];

const WIDTHS: { value: TeamWidth; label: string }[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Wide' },
];

const TEMPOS: { value: Tempo; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
];

const DEFENSIVE_LINES: { value: DefensiveLine; label: string }[] = [
  { value: 'deep', label: 'Deep' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

const PRESSING_OPTIONS: { label: string; value: number }[] = [
  { label: 'Low', value: 25 },
  { label: 'Medium', value: 50 },
  { label: 'High', value: 75 },
];

interface StylePreset {
  label: string;
  values: Partial<TacticalInstructions>;
}

const STYLE_PRESETS: StylePreset[] = [
  { label: 'Park the Bus', values: { mentality: 'defensive', width: 'narrow', tempo: 'slow', defensiveLine: 'deep', pressingIntensity: 25 } },
  { label: 'Balanced', values: { mentality: 'balanced', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50 } },
  { label: 'All-Out Attack', values: { mentality: 'all-out-attack', width: 'wide', tempo: 'fast', defensiveLine: 'high', pressingIntensity: 75 } },
  { label: 'Counter-Attack', values: { mentality: 'cautious', width: 'narrow', tempo: 'fast', defensiveLine: 'deep', pressingIntensity: 40 } },
];

function pressingLabel(v: number): string {
  if (v <= 30) return 'Low';
  if (v <= 60) return 'Medium';
  return 'High';
}

const TacticsPage = () => {
  const { playerClubId, clubs, players, setFormation, setDefensiveFormation, tactics, setTactics } = useGameStore();
  const club = clubs[playerClubId];
  if (!club) return null;

  const lineupPlayers = club.lineup.map(id => players[id]).filter(Boolean);
  const labels = lineupPlayers.map(p => p.lastName.slice(0, 3).toUpperCase());
  const chemBonus = getChemistryBonus(lineupPlayers);
  const chemLabel = getChemistryLabel(chemBonus);
  const chemLinks = calculateChemistryLinks(lineupPlayers);

  const isPresetActive = (preset: StylePreset): boolean => {
    return (
      tactics.mentality === preset.values.mentality &&
      tactics.width === preset.values.width &&
      tactics.tempo === preset.values.tempo &&
      tactics.defensiveLine === preset.values.defensiveLine &&
      tactics.pressingIntensity === preset.values.pressingIntensity
    );
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <h2 className="text-lg font-bold text-foreground font-display">Tactics</h2>

      {/* Formation Selection */}
      <GlassPanel className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Formation</p>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {FORMATIONS.map(f => (
            <button
              key={f}
              onClick={() => setFormation(f)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-mono font-bold transition-all shrink-0',
                club.formation === f ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </GlassPanel>

      {/* Defensive Formation (Out of Possession) */}
      <GlassPanel className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
          Defensive Shape <span className="text-[10px] normal-case">(out of possession)</span>
        </p>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setDefensiveFormation(null)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-mono font-bold transition-all shrink-0',
              !club.defensiveFormation ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            Same
          </button>
          {FORMATIONS.filter(f => f !== club.formation).map(f => (
            <button
              key={f}
              onClick={() => setDefensiveFormation(f)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-mono font-bold transition-all shrink-0',
                club.defensiveFormation === f ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              {f}
            </button>
          ))}
        </div>
        {club.defensiveFormation && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Attack: {club.formation} → Defend: {club.defensiveFormation}
          </p>
        )}
      </GlassPanel>

      {/* Pitch */}
      <GlassPanel className="p-4">
        <PitchView
          formation={club.formation}
          homeColor={club.color}
          labels={labels}
        />
      </GlassPanel>

      {/* Squad Chemistry */}
      <GlassPanel className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Squad Chemistry</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-bold', chemLabel.color)}>{chemLabel.label}</span>
            <span className="text-[10px] text-muted-foreground">+{(chemBonus * 100).toFixed(1)}%</span>
          </div>
        </div>
        {chemLinks.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {chemLinks.slice(0, 6).map((link, i) => {
              const a = players[link.playerIdA];
              const b = players[link.playerIdB];
              const typeIcon = link.type === 'nationality' ? '🌍' : link.type === 'mentor' ? '📚' : '🤝';
              return (
                <span key={i} className="text-[9px] bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded">
                  {typeIcon} {a?.lastName?.slice(0, 3) || '?'}-{b?.lastName?.slice(0, 3) || '?'} {'★'.repeat(link.strength)}
                </span>
              );
            })}
            {chemLinks.length > 6 && (
              <span className="text-[9px] text-muted-foreground px-1.5 py-0.5">+{chemLinks.length - 6} more</span>
            )}
          </div>
        )}
      </GlassPanel>

      {/* Style Presets */}
      <GlassPanel className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Style Presets</p>
        <div className="grid grid-cols-2 gap-2">
          {STYLE_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => setTactics(preset.values)}
              className={cn(
                'px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isPresetActive(preset)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </GlassPanel>

      {/* Tactical Instructions */}
      <GlassPanel className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Tactical Instructions</p>

        {/* Mentality */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Mentality</p>
          <div className="flex flex-wrap gap-1.5">
            {MENTALITIES.map(m => (
              <button
                key={m.value}
                onClick={() => setTactics({ mentality: m.value })}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  tactics.mentality === m.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Team Width */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Team Width</p>
          <div className="flex flex-wrap gap-1.5">
            {WIDTHS.map(w => (
              <button
                key={w.value}
                onClick={() => setTactics({ width: w.value })}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  tactics.width === w.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tempo */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Tempo</p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPOS.map(t => (
              <button
                key={t.value}
                onClick={() => setTactics({ tempo: t.value })}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  tactics.tempo === t.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Defensive Line */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Defensive Line</p>
          <div className="flex flex-wrap gap-1.5">
            {DEFENSIVE_LINES.map(d => (
              <button
                key={d.value}
                onClick={() => setTactics({ defensiveLine: d.value })}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  tactics.defensiveLine === d.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pressing */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Pressing</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESSING_OPTIONS.map(p => (
              <button
                key={p.value}
                onClick={() => setTactics({ pressingIntensity: p.value })}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  tactics.pressingIntensity === p.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </GlassPanel>

      {/* Team Instructions Summary */}
      <GlassPanel className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Current Instructions</p>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20">
            {tactics.mentality.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20">
            {tactics.width.charAt(0).toUpperCase() + tactics.width.slice(1)} Width
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20">
            {tactics.tempo.charAt(0).toUpperCase() + tactics.tempo.slice(1)} Tempo
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20">
            {tactics.defensiveLine.charAt(0).toUpperCase() + tactics.defensiveLine.slice(1)} Line
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20">
            {pressingLabel(tactics.pressingIntensity)} Press
          </span>
        </div>
      </GlassPanel>

      {/* Lineup List */}
      <GlassPanel className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Starting XI</p>
        <div className="space-y-1">
          {lineupPlayers.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 py-1">
              <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
              <span className="text-xs font-mono text-primary w-8">{p.position}</span>
              <span className="text-sm text-foreground flex-1">{p.firstName[0]}. {p.lastName}</span>
              <span className={cn(
                'text-xs font-mono',
                getRatingColor(p.overall)
              )}>{p.overall}</span>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Subs */}
      <GlassPanel className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Substitutes</p>
        <div className="space-y-1">
          {club.subs.map(id => players[id]).filter(Boolean).map(p => (
            <div key={p.id} className="flex items-center gap-2 py-1">
              <span className="text-xs font-mono text-muted-foreground w-8">{p.position}</span>
              <span className="text-sm text-foreground/70 flex-1">{p.firstName[0]}. {p.lastName}</span>
              <span className={cn(
                'text-xs font-mono',
                getRatingColor(p.overall)
              )}>{p.overall}</span>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
};

export default TacticsPage;
