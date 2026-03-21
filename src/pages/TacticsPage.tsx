import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LineupEditor } from '@/components/game/LineupEditor';
import { cn } from '@/lib/utils';
import { getChemistryBonus, getChemistryLabel, calculateChemistryLinks } from '@/utils/chemistry';
import { getRatingColor } from '@/utils/uiHelpers';
import { FORMATIONS, MENTALITIES, WIDTHS, TEMPOS, DEFENSIVE_LINES, PRESSING_OPTIONS } from '@/config/tactics';
import type { StylePreset } from '@/config/tactics';
import { Users, Globe, BookOpen, Handshake, Star, ArrowRightLeft, Wand2 } from 'lucide-react';
import { getFlag } from '@/utils/nationality';
import { useState } from 'react';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS } from '@/config/ui';

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
  const { playerClubId, clubs, players, setFormation, setDefensiveFormation, tactics, setTactics, updateLineup, autoFillTeam } = useGameStore();
  const club = clubs[playerClubId];
  const [swapSubId, setSwapSubId] = useState<string | null>(null);
  if (!club) return null;

  const lineupPlayers = club.lineup.map(id => players[id]).filter(Boolean);
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
      <PageHint screen="tactics" title={PAGE_HINTS.tactics.title} body={PAGE_HINTS.tactics.body} />
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

      {/* Smart Auto Fill */}
      <button
        onClick={autoFillTeam}
        className="w-full py-2.5 rounded-xl bg-primary/90 hover:bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
      >
        <Wand2 className="w-4 h-4" />
        Smart Auto Fill
      </button>

      {/* Lineup Editor with Drag & Drop */}
      <GlassPanel className="p-4">
        <LineupEditor />
      </GlassPanel>

      {/* Squad Chemistry */}
      {(() => {
        const natLinks = chemLinks.filter(l => l.type === 'nationality');
        const mentorLinks = chemLinks.filter(l => l.type === 'mentor');
        const partnershipLinks = chemLinks.filter(l => l.type === 'partnership');
        return (
          <GlassPanel className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Squad Chemistry</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-bold', chemLabel.color)}>{chemLabel.label}</span>
                <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">+{(chemBonus * 100).toFixed(1)}%</span>
              </div>
            </div>

            {chemLinks.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No chemistry links detected. Try players with shared nationality or compatible positions.</p>
            )}

            <div className="space-y-3 max-h-[40vh] overflow-y-auto">
              {/* Nationality Links */}
              {natLinks.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Globe className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Nationality ({natLinks.length})</span>
                  </div>
                  <div className="space-y-1">
                    {natLinks.map((link, i) => {
                      const a = players[link.playerIdA];
                      const b = players[link.playerIdB];
                      if (!a || !b) return null;
                      return (
                        <div key={`nat-${i}`} className="flex items-center gap-2 bg-muted/20 rounded-lg px-2.5 py-1.5">
                          <span className="text-sm">{getFlag(a.nationality)}</span>
                          <span className="text-[11px] text-foreground flex-1">{a.lastName} & {b.lastName}</span>
                          <div className="flex gap-0.5">
                            {Array.from({ length: link.strength }).map((_, si) => (
                              <Star key={si} className="w-2.5 h-2.5 text-primary fill-primary" />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mentor Links */}
              {mentorLinks.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Mentor ({mentorLinks.length})</span>
                  </div>
                  <div className="space-y-1">
                    {mentorLinks.map((link, i) => {
                      const a = players[link.playerIdA];
                      const b = players[link.playerIdB];
                      if (!a || !b) return null;
                      const senior = a.age >= 28 ? a : b;
                      const junior = senior === a ? b : a;
                      return (
                        <div key={`men-${i}`} className="flex items-center gap-2 bg-muted/20 rounded-lg px-2.5 py-1.5">
                          <BookOpen className="w-3 h-3 text-emerald-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] text-foreground">{senior.lastName} mentoring {junior.lastName}</span>
                            <span className="text-[9px] text-muted-foreground ml-1">({junior.position})</span>
                          </div>
                          <div className="flex gap-0.5">
                            {Array.from({ length: link.strength }).map((_, si) => (
                              <Star key={si} className="w-2.5 h-2.5 text-emerald-400 fill-emerald-400" />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Partnership Links */}
              {partnershipLinks.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Handshake className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Partnership ({partnershipLinks.length})</span>
                  </div>
                  <div className="space-y-1">
                    {partnershipLinks.map((link, i) => {
                      const a = players[link.playerIdA];
                      const b = players[link.playerIdB];
                      if (!a || !b) return null;
                      return (
                        <div key={`part-${i}`} className="flex items-center gap-2 bg-muted/20 rounded-lg px-2.5 py-1.5">
                          <Handshake className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="text-[11px] text-foreground flex-1">{a.lastName} & {b.lastName}</span>
                          <div className="flex gap-0.5">
                            {Array.from({ length: link.strength }).map((_, si) => (
                              <Star key={si} className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </GlassPanel>
        );
      })()}

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

      {/* Subs — tap a sub to swap with a starting player */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Substitutes</p>
          {swapSubId && (
            <button onClick={() => setSwapSubId(null)} className="text-[10px] text-primary font-semibold">Cancel</button>
          )}
        </div>

        {/* When a sub is selected, show starters to swap with */}
        {swapSubId && (
          <div className="mb-3 p-2 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-[10px] text-primary mb-1.5">Tap a starter to swap with {players[swapSubId]?.lastName}:</p>
            <div className="space-y-1">
              {club.lineup.map(id => players[id]).filter(Boolean).map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    const newLineup = club.lineup.map(id => id === p.id ? swapSubId : id);
                    const newSubs = club.subs.map(id => id === swapSubId ? p.id : id);
                    updateLineup(newLineup, newSubs);
                    setSwapSubId(null);
                  }}
                  className="flex items-center gap-2 py-1 w-full hover:bg-muted/30 rounded px-1 transition-colors"
                >
                  <ArrowRightLeft className="w-3 h-3 text-primary" />
                  <span className="text-xs font-mono text-muted-foreground w-8">{p.position}</span>
                  <span className="text-sm text-foreground flex-1 text-left">{p.firstName[0]}. {p.lastName}</span>
                  <span className={cn('text-xs font-mono', getRatingColor(p.overall))}>{p.overall}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1">
          {club.subs.map(id => players[id]).filter(Boolean).map(p => (
            <button
              key={p.id}
              onClick={() => setSwapSubId(swapSubId === p.id ? null : p.id)}
              className={cn(
                'flex items-center gap-2 py-1 w-full rounded px-1 transition-colors',
                swapSubId === p.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/30'
              )}
            >
              <span className="text-xs font-mono text-muted-foreground w-8">{p.position}</span>
              <span className="text-sm text-foreground/70 flex-1 text-left">{p.firstName[0]}. {p.lastName}</span>
              <span className={cn('text-xs font-mono', getRatingColor(p.overall))}>{p.overall}</span>
            </button>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
};

export default TacticsPage;
