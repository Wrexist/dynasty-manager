import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LineupEditor } from '@/components/game/LineupEditor';
import { cn } from '@/lib/utils';
import { getChemistryBonus, getChemistryLabel, calculateChemistryLinks } from '@/utils/chemistry';
import { buildChemistryStrengthMap } from '@/utils/formationLines';
import { CHEMISTRY_LINE_COLOR_STRONG, CHEMISTRY_LINE_COLOR_ESTABLISHED, CHEMISTRY_LINE_COLOR_DEVELOPING } from '@/config/chemistry';
import { getRatingColor } from '@/utils/uiHelpers';
import { FORMATIONS, MENTALITIES, WIDTHS, TEMPOS, DEFENSIVE_LINES, PRESSING_OPTIONS } from '@/config/tactics';
import type { StylePreset } from '@/config/tactics';
import { Users, Globe, BookOpen, Handshake, Star, ArrowRightLeft, Wand2, AlertTriangle } from 'lucide-react';
import { getFlag } from '@/utils/nationality';
import { useState, useMemo } from 'react';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS, PRESSING_LOW_THRESHOLD, PRESSING_MED_THRESHOLD, HELP_TEXTS } from '@/config/ui';
import { InfoTip } from '@/components/game/InfoTip';
import { PlayerSelect } from '@/components/game/PlayerSelect';

const STYLE_PRESETS: (StylePreset & { description: string })[] = [
  { label: 'Park the Bus', description: 'Ultra-defensive. Sit deep, absorb pressure, and protect the lead.', values: { mentality: 'defensive', width: 'narrow', tempo: 'slow', defensiveLine: 'deep', pressingIntensity: 25 } },
  { label: 'Balanced', description: 'No extreme risks. A solid default for most matches.', values: { mentality: 'balanced', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50 } },
  { label: 'All-Out Attack', description: 'Maximum attacking intent. High line, fast tempo. Risky but explosive.', values: { mentality: 'all-out-attack', width: 'wide', tempo: 'fast', defensiveLine: 'high', pressingIntensity: 75 } },
  { label: 'Counter-Attack', description: 'Defend deep then strike quickly on fast transitions.', values: { mentality: 'cautious', width: 'narrow', tempo: 'fast', defensiveLine: 'deep', pressingIntensity: 40 } },
];

function pressingLabel(v: number): string {
  if (v <= PRESSING_LOW_THRESHOLD) return 'Low';
  if (v <= PRESSING_MED_THRESHOLD) return 'Medium';
  return 'High';
}

const TacticsPage = () => {
  const { playerClubId, clubs, players, tactics, season, pairFamiliarity, training } = useGameStore(useShallow(s => ({
    playerClubId: s.playerClubId, clubs: s.clubs, players: s.players, tactics: s.tactics,
    season: s.season, pairFamiliarity: s.pairFamiliarity, training: s.training,
  })));
  const setFormation = useGameStore(s => s.setFormation);
  const setDefensiveFormation = useGameStore(s => s.setDefensiveFormation);
  const setTactics = useGameStore(s => s.setTactics);
  const updateLineup = useGameStore(s => s.updateLineup);
  const autoFillTeam = useGameStore(s => s.autoFillTeam);
  const setSetPieceTaker = useGameStore(s => s.setSetPieceTaker);
  const setPenaltyTaker = useGameStore(s => s.setPenaltyTaker);
  const club = clubs[playerClubId];
  const [swapSubId, setSwapSubId] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const { chemBonus, chemLabel, chemLinks, chemStrengthMap } = useMemo(() => {
    if (!club) return { chemBonus: 0, chemLabel: getChemistryLabel(0), chemLinks: [] as ReturnType<typeof calculateChemistryLinks>, chemStrengthMap: new Map<string, number>() };
    const lp = club.lineup.map(id => players[id]).filter(Boolean);
    const chemBonus = getChemistryBonus(lp, club.formation, season);
    const chemLabel = getChemistryLabel(chemBonus);
    const chemLinks = calculateChemistryLinks(lp, club.formation, season);
    const chemStrengthMap = buildChemistryStrengthMap(chemLinks, pairFamiliarity);
    return { chemBonus, chemLabel, chemLinks, chemStrengthMap };
  }, [club, players, season, pairFamiliarity]);
  if (!club) return null;

  const lineupPlayers = club.lineup.map(id => players[id]).filter(Boolean);

  // Helper to get the familiarity-capped strength for a link pair
  const getCappedStrength = (link: { playerIdA: string; playerIdB: string; strength: number }) => {
    const key = link.playerIdA < link.playerIdB
      ? `${link.playerIdA}-${link.playerIdB}`
      : `${link.playerIdB}-${link.playerIdA}`;
    return chemStrengthMap.get(key) ?? link.strength;
  };

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
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Formation</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Familiarity</span>
            <InfoTip text={HELP_TEXTS.tacticalFamiliarity} />
            <span className={cn(
              'text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded',
              training.tacticalFamiliarity >= 80 ? 'text-emerald-400 bg-emerald-400/10' :
              training.tacticalFamiliarity >= 50 ? 'text-amber-400 bg-amber-400/10' :
              'text-destructive bg-destructive/10'
            )}>
              {training.tacticalFamiliarity}%
            </span>
          </div>
        </div>
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
        {training.tacticalFamiliarity < 50 && (
          <p className="text-[10px] text-amber-400 mt-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Low familiarity hurts match performance. Train "Tactical" to improve it, and avoid switching formations frequently.
          </p>
        )}
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
        onClick={() => {
          setAutoFilling(true);
          requestAnimationFrame(() => {
            autoFillTeam();
            setAutoFilling(false);
          });
        }}
        disabled={autoFilling}
        className={cn(
          'w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]',
          autoFilling
            ? 'bg-primary/50 text-primary-foreground/70 cursor-not-allowed'
            : 'bg-primary/90 hover:bg-primary text-primary-foreground'
        )}
      >
        <Wand2 className={cn('w-4 h-4', autoFilling && 'animate-spin')} />
        {autoFilling ? 'Optimizing...' : 'Smart Auto Fill'}
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

            {/* Color legend */}
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center gap-1">
                <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: CHEMISTRY_LINE_COLOR_STRONG }} />
                <span className="text-[9px] text-muted-foreground">Strong</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: CHEMISTRY_LINE_COLOR_ESTABLISHED }} />
                <span className="text-[9px] text-muted-foreground">Established</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: CHEMISTRY_LINE_COLOR_DEVELOPING }} />
                <span className="text-[9px] text-muted-foreground">Developing</span>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground/60 mb-2">
              Chemistry boosts team performance in matches. Links grow stronger as pairs play together. Nationality = same country, Mentor = veteran guiding a youngster, Partnership = compatible positions.
            </p>

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
                      const capped = getCappedStrength(link);
                      return (
                        <div key={`nat-${i}`} className="flex items-center gap-2 bg-muted/20 rounded-lg px-2.5 py-1.5">
                          <span className="text-sm">{getFlag(a.nationality)}</span>
                          <span className="text-[11px] text-foreground flex-1">{a.lastName} & {b.lastName}</span>
                          <div className="flex gap-0.5">
                            {Array.from({ length: link.strength }).map((_, si) => (
                              <Star key={si} className={cn('w-2.5 h-2.5', si < capped ? 'text-primary fill-primary' : 'text-primary/30')} />
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
                      const capped = getCappedStrength(link);
                      return (
                        <div key={`men-${i}`} className="flex items-center gap-2 bg-muted/20 rounded-lg px-2.5 py-1.5">
                          <BookOpen className="w-3 h-3 text-emerald-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] text-foreground">{senior.lastName} mentoring {junior.lastName}</span>
                            <span className="text-[9px] text-muted-foreground ml-1">({junior.position})</span>
                          </div>
                          <div className="flex gap-0.5">
                            {Array.from({ length: link.strength }).map((_, si) => (
                              <Star key={si} className={cn('w-2.5 h-2.5', si < capped ? 'text-emerald-400 fill-emerald-400' : 'text-emerald-400/30')} />
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
                      const capped = getCappedStrength(link);
                      return (
                        <div key={`part-${i}`} className="flex items-center gap-2 bg-muted/20 rounded-lg px-2.5 py-1.5">
                          <Handshake className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="text-[11px] text-foreground flex-1">{a.lastName} & {b.lastName}</span>
                          <div className="flex gap-0.5">
                            {Array.from({ length: link.strength }).map((_, si) => (
                              <Star key={si} className={cn('w-2.5 h-2.5', si < capped ? 'text-amber-400 fill-amber-400' : 'text-amber-400/30')} />
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
          {STYLE_PRESETS.map(preset => {
            const active = isPresetActive(preset);
            return (
              <button
                key={preset.label}
                onClick={() => setTactics(preset.values)}
                className={cn(
                  'px-3 py-2.5 rounded-lg text-left transition-all',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                <span className="text-sm font-medium block">{preset.label}</span>
                <span className={cn('text-[9px] leading-tight block mt-0.5', active ? 'text-primary-foreground/70' : 'text-muted-foreground/60')}>
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
      </GlassPanel>

      {/* Tactical Instructions */}
      <GlassPanel className="p-4 space-y-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Tactical Instructions</p>

        {/* Mentality */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">Mentality <InfoTip text={HELP_TEXTS.mentality} /></p>
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
          <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">Team Width <InfoTip text={HELP_TEXTS.width} /></p>
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
          <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">Tempo <InfoTip text={HELP_TEXTS.tempo} /></p>
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
          <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">Defensive Line <InfoTip text={HELP_TEXTS.defensiveLine} /></p>
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
          <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">Pressing <InfoTip text={HELP_TEXTS.pressingIntensity} /></p>
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
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Starting XI</p>
          {lineupPlayers.length > 0 && (
            <span className={cn('text-xs font-bold', getRatingColor(Math.round(lineupPlayers.reduce((s, p) => s + p.overall, 0) / lineupPlayers.length)))}>
              {Math.round(lineupPlayers.reduce((s, p) => s + p.overall, 0) / lineupPlayers.length)} OVR
            </span>
          )}
        </div>
        <div className="space-y-1">
          {lineupPlayers.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 py-1">
              <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
              <span className="text-xs font-mono text-primary w-8">{p.position}</span>
              <span className="text-sm text-foreground flex-1">{getFlag(p.nationality)} {p.firstName[0]}. {p.lastName}</span>
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
                  <span className="text-sm text-foreground flex-1 text-left">{getFlag(p.nationality)} {p.firstName[0]}. {p.lastName}</span>
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
              <span className="text-sm text-foreground/70 flex-1 text-left">{getFlag(p.nationality)} {p.firstName[0]}. {p.lastName}</span>
              <span className={cn('text-xs font-mono', getRatingColor(p.overall))}>{p.overall}</span>
            </button>
          ))}
        </div>
      </GlassPanel>

      {/* Set-Piece Takers */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-bold text-foreground mb-1">Set-Piece Takers</h3>
        <p className="text-[9px] text-muted-foreground/60 mb-3">Assigned takers get a delivery bonus on corners and free kicks. Penalty taker is used in shootouts and spot-kicks.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Corner / Free Kick Taker</label>
            <PlayerSelect
              players={lineupPlayers.filter(p => p.position !== 'GK')}
              selectedId={club.setPieceTakerId}
              onChange={setSetPieceTaker}
              placeholder="Auto (best available)"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Penalty Taker</label>
            <PlayerSelect
              players={lineupPlayers.filter(p => p.position !== 'GK')}
              selectedId={club.penaltyTakerId}
              onChange={setPenaltyTaker}
              placeholder="Auto (best attacker)"
            />
          </div>
        </div>
      </GlassPanel>
    </div>
  );
};

export default TacticsPage;
