import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LineupEditor } from '@/components/game/LineupEditor';
import { OptimizeLineupButton } from '@/components/game/OptimizeLineupButton';
import { cn } from '@/lib/utils';
import { calculateChemistryLinks } from '@/utils/chemistry';
import { MENTOR_SENIOR_AGE, MENTOR_JUNIOR_AGE } from '@/config/chemistry';
import { getRatingColor, getRatingBadgeClasses } from '@/utils/uiHelpers';
import { MENTALITIES, WIDTHS, TEMPOS, DEFENSIVE_LINES, PRESSING_OPTIONS, STYLE_PRESETS, getAvailableFormations } from '@/config/tactics';
import type { StylePreset } from '@/config/tactics';
import { FORMATION_POSITIONS, type Position } from '@/types/game';
import { Globe, BookOpen, Handshake, Heart, ArrowRightLeft, AlertTriangle, Save, Trash2, Upload, Shield, Swords, Target } from 'lucide-react';
import { FlagIcon } from '@/components/game/FlagIcon';
import { useState, useMemo } from 'react';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS, PRESSING_LOW_THRESHOLD, PRESSING_MED_THRESHOLD, HELP_TEXTS } from '@/config/ui';
import { InfoTip } from '@/components/game/InfoTip';
import { PlayerSelect } from '@/components/game/PlayerSelect';
import { useLineupOptimizer } from '@/hooks/useLineupOptimizer';
import { infoToast } from '@/utils/gameToast';
import { hapticLight } from '@/utils/haptics';
import { isPro } from '@/utils/monetization';
import { hasPerk } from '@/utils/managerPerks';
import { ProUpsell } from '@/components/game/ProUpsell';
import { MAX_TACTICAL_PRESETS } from '@/config/monetization';

function pressingLabel(v: number): string {
  if (v <= PRESSING_LOW_THRESHOLD) return 'Low';
  if (v <= PRESSING_MED_THRESHOLD) return 'Medium';
  return 'High';
}

const TacticsPage = () => {
  const { playerClubId, clubs, players, tactics, season, training } = useGameStore(useShallow(s => ({
    playerClubId: s.playerClubId, clubs: s.clubs, players: s.players, tactics: s.tactics,
    season: s.season, training: s.training,
  })));
  const monetization = useGameStore(s => s.monetization);
  const managerProgression = useGameStore(s => s.managerProgression);
  const hasFormationMasterPerk = hasPerk(managerProgression, 'formation_master');
  const tacticalPresets = useGameStore(s => s.tacticalPresets);
  const setFormation = useGameStore(s => s.setFormation);
  const setDefensiveFormation = useGameStore(s => s.setDefensiveFormation);
  const setTactics = useGameStore(s => s.setTactics);
  const saveTacticalPreset = useGameStore(s => s.saveTacticalPreset);
  const loadTacticalPreset = useGameStore(s => s.loadTacticalPreset);
  const deleteTacticalPreset = useGameStore(s => s.deleteTacticalPreset);
  const updateLineup = useGameStore(s => s.updateLineup);
  const setSetPieceTaker = useGameStore(s => s.setSetPieceTaker);
  const setPenaltyTaker = useGameStore(s => s.setPenaltyTaker);
  const club = clubs[playerClubId];
  const [swapSubId, setSwapSubId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const userIsPro = isPro(monetization);
  const { potentialGain, autoFilling, optimizeLineup } = useLineupOptimizer();
  const { chemLinks } = useMemo(() => {
    if (!club) return { chemLinks: [] as ReturnType<typeof calculateChemistryLinks> };
    const lp = club.lineup.map(id => players[id]).filter(Boolean);
    const chemLinks = calculateChemistryLinks(lp, club.formation, season);
    return { chemLinks };
  }, [club, players, season]);

  // Memoize lineup players (used by Starting XI list, set-piece filters, potentialGain)
  const lineupPlayers = useMemo(() => {
    if (!club) return [];
    return club.lineup.map(id => players[id]).filter(Boolean);
  }, [club, players]);

  // Team rating breakdown by unit (DEF / MID / ATT)
  const teamRating = useMemo(() => {
    if (lineupPlayers.length === 0) return null;
    const slots = FORMATION_POSITIONS[club.formation] || [];
    const DEF = new Set<string>(['GK', 'CB', 'LB', 'RB']);
    const MID = new Set<string>(['CDM', 'CM', 'CAM', 'LM', 'RM']);
    const ATT = new Set<string>(['LW', 'RW', 'ST']);
    const defPlayers: number[] = [];
    const midPlayers: number[] = [];
    const attPlayers: number[] = [];
    lineupPlayers.forEach((p, i) => {
      const pos = slots[i]?.pos as Position | undefined;
      if (!pos) return;
      if (DEF.has(pos)) defPlayers.push(p.overall);
      else if (MID.has(pos)) midPlayers.push(p.overall);
      else if (ATT.has(pos)) attPlayers.push(p.overall);
    });
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
    const subsPlayers = club.subs.map(id => players[id]).filter(Boolean);
    const subsAvg = subsPlayers.length ? Math.round(subsPlayers.reduce((s, p) => s + p.overall, 0) / subsPlayers.length) : 0;
    const avgFitness = Math.round(lineupPlayers.reduce((s, p) => s + p.fitness, 0) / lineupPlayers.length);
    const defVal = avg(defPlayers);
    const midVal = avg(midPlayers);
    const attVal = avg(attPlayers);
    const units = [defVal, midVal, attVal].filter(v => v > 0);
    const weakest = units.length > 1 ? Math.min(...units) : null;
    return {
      overall: Math.round(lineupPlayers.reduce((s, p) => s + p.overall, 0) / lineupPlayers.length),
      def: defVal,
      mid: midVal,
      att: attVal,
      subsAvg,
      avgFitness,
      weakest,
    };
  }, [lineupPlayers, club, players]);

  // Group chemistry links by type (memoized)
  const { natLinks, mentorLinks, partnershipLinks, loyaltyLinks } = useMemo(() => ({
    natLinks: chemLinks.filter(l => l.type === 'nationality'),
    mentorLinks: chemLinks.filter(l => l.type === 'mentor'),
    partnershipLinks: chemLinks.filter(l => l.type === 'partnership'),
    loyaltyLinks: chemLinks.filter(l => l.type === 'loyalty'),
  }), [chemLinks]);

  if (!club) return null;

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
          {getAvailableFormations(hasFormationMasterPerk).map(f => (
            <button
              key={f}
              onClick={() => { if (club.formation !== f) { setFormation(f); infoToast(`Formation set to ${f}`); } }}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-mono font-bold transition-all shrink-0',
                club.formation === f
                  ? 'bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)]'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
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
            onClick={() => { setDefensiveFormation(null); hapticLight(); infoToast('Defensive shape mirrors formation'); }}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-mono font-bold transition-all shrink-0',
              !club.defensiveFormation
                ? 'bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)]'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            Same
          </button>
          {getAvailableFormations(hasFormationMasterPerk).filter(f => f !== club.formation).map(f => (
            <button
              key={f}
              onClick={() => { setDefensiveFormation(f); hapticLight(); infoToast(`Defensive shape set to ${f}`); }}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-mono font-bold transition-all shrink-0',
                club.defensiveFormation === f
                  ? 'bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)]'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
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

      {/* Optimize Lineup */}
      {userIsPro ? (
        <OptimizeLineupButton potentialGain={potentialGain} autoFilling={autoFilling} onOptimize={optimizeLineup} />
      ) : (
        <ProUpsell feature="Optimize Lineup" />
      )}

      {/* Team Rating Summary */}
      {teamRating && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Swords className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Starting XI Rating</p>
          </div>
          <div className="flex items-center justify-center mb-3">
            <div className={cn(
              'w-16 h-16 rounded-xl flex flex-col items-center justify-center',
              getRatingBadgeClasses(teamRating.overall)
            )}>
              <span className="text-2xl font-black tabular-nums leading-none">{teamRating.overall}</span>
              <span className="text-[9px] font-semibold opacity-70 mt-0.5">OVR</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'DEF', value: teamRating.def, icon: <Shield className="w-3 h-3 text-sky-400" /> },
              { label: 'MID', value: teamRating.mid, icon: <Swords className="w-3 h-3 text-amber-400" /> },
              { label: 'ATT', value: teamRating.att, icon: <Target className="w-3 h-3 text-emerald-400" /> },
            ].map(u => (
              <div key={u.label} className={cn(
                'text-center rounded-lg py-2',
                teamRating.weakest !== null && u.value === teamRating.weakest
                  ? 'bg-amber-500/10 border border-amber-500/20'
                  : 'bg-muted/20'
              )}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  {u.icon}
                  <span className="text-[10px] text-muted-foreground font-semibold">{u.label}</span>
                </div>
                <span className={cn('text-sm font-bold tabular-nums', getRatingColor(u.value))}>{u.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-center gap-3 text-[10px]">
            <span>
              <span className="text-muted-foreground">Bench: </span>
              <span className={cn('font-bold tabular-nums', getRatingColor(teamRating.subsAvg))}>{teamRating.subsAvg}</span>
            </span>
            <span className="text-muted-foreground/30">|</span>
            <span>
              <span className="text-muted-foreground">Fitness: </span>
              <span className={cn(
                'font-bold tabular-nums',
                teamRating.avgFitness >= 80 ? 'text-emerald-400' :
                teamRating.avgFitness >= 60 ? 'text-amber-400' :
                'text-destructive'
              )}>{teamRating.avgFitness}%</span>
            </span>
          </div>
        </GlassPanel>
      )}

      {/* Lineup Editor with Drag & Drop */}
      <GlassPanel className="p-4">
        <LineupEditor />
      </GlassPanel>

      {/* Chemistry Links Detail */}
      {chemLinks.length > 0 && (
        <GlassPanel className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Chemistry Links ({chemLinks.length})</p>

          <div className="space-y-2 max-h-[30vh] overflow-y-auto">
            {natLinks.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Globe className="w-3 h-3 text-primary" />
                  <span className="text-[10px] text-muted-foreground font-semibold">Nationality ({natLinks.length})</span>
                </div>
                <div className="space-y-0.5">
                  {natLinks.map((link) => {
                    const a = players[link.playerIdA];
                    const b = players[link.playerIdB];
                    if (!a || !b) return null;
                    return (
                      <div key={`nat-${link.playerIdA}-${link.playerIdB}`} className="flex items-center gap-2 bg-muted/20 rounded px-2 py-1">
                        <FlagIcon nationality={a.nationality} size={14} />
                        <span className="text-[10px] text-foreground flex-1">{a.lastName} & {b.lastName}</span>
                        <span className="text-[9px] text-primary font-bold">+{link.strength}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {mentorLinks.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <BookOpen className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-muted-foreground font-semibold">Mentor ({mentorLinks.length})</span>
                </div>
                <div className="space-y-0.5">
                  {mentorLinks.map((link) => {
                    const a = players[link.playerIdA];
                    const b = players[link.playerIdB];
                    if (!a || !b) return null;
                    const senior = a.age >= MENTOR_SENIOR_AGE && b.age <= MENTOR_JUNIOR_AGE ? a
                      : b.age >= MENTOR_SENIOR_AGE && a.age <= MENTOR_JUNIOR_AGE ? b
                      : a;
                    const junior = senior === a ? b : a;
                    return (
                      <div key={`men-${link.playerIdA}-${link.playerIdB}`} className="flex items-center gap-2 bg-muted/20 rounded px-2 py-1">
                        <span className="text-[10px] text-foreground flex-1">{senior.lastName} → {junior.lastName}</span>
                        <span className="text-[9px] text-emerald-400 font-bold">+{link.strength}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {partnershipLinks.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Handshake className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] text-muted-foreground font-semibold">Partnership ({partnershipLinks.length})</span>
                </div>
                <div className="space-y-0.5">
                  {partnershipLinks.map((link) => {
                    const a = players[link.playerIdA];
                    const b = players[link.playerIdB];
                    if (!a || !b) return null;
                    return (
                      <div key={`part-${link.playerIdA}-${link.playerIdB}`} className="flex items-center gap-2 bg-muted/20 rounded px-2 py-1">
                        <span className="text-[10px] text-foreground flex-1">{a.lastName} & {b.lastName}</span>
                        <span className="text-[9px] text-amber-400 font-bold">+{link.strength}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {loyaltyLinks.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Heart className="w-3 h-3 text-sky-400" />
                  <span className="text-[10px] text-muted-foreground font-semibold">Loyalty ({loyaltyLinks.length})</span>
                </div>
                <div className="space-y-0.5">
                  {loyaltyLinks.map((link) => {
                    const a = players[link.playerIdA];
                    const b = players[link.playerIdB];
                    if (!a || !b) return null;
                    return (
                      <div key={`loy-${link.playerIdA}-${link.playerIdB}`} className="flex items-center gap-2 bg-muted/20 rounded px-2 py-1">
                        <span className="text-[10px] text-foreground flex-1">{a.lastName} & {b.lastName}</span>
                        <span className="text-[9px] text-sky-400 font-bold">+{link.strength}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </GlassPanel>
      )}

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

      {/* Custom Tactical Presets (Pro Feature) */}
      {userIsPro ? (
        <GlassPanel className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">My Presets</p>
          {tacticalPresets.length > 0 && (
            <div className="space-y-2 mb-3">
              {tacticalPresets.map(preset => (
                <div key={preset.id} className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{preset.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {preset.formation} · {preset.tactics.mentality} · {preset.tactics.tempo} tempo
                    </p>
                  </div>
                  <button
                    onClick={() => { loadTacticalPreset(preset.id); infoToast(`Loaded "${preset.name}"`); }}
                    className="p-1.5 rounded-lg hover:bg-primary/20 text-primary transition-colors"
                    title="Load preset"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteTacticalPreset(preset.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete preset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {tacticalPresets.length < MAX_TACTICAL_PRESETS ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                placeholder="Preset name..."
                maxLength={24}
                className="flex-1 bg-muted/30 border border-border/30 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
              />
              <button
                onClick={() => {
                  const name = presetName.trim() || `Preset ${tacticalPresets.length + 1}`;
                  saveTacticalPreset(name);
                  setPresetName('');
                  infoToast(`Saved "${name}"`);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
              >
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">Maximum {MAX_TACTICAL_PRESETS} presets saved.</p>
          )}
        </GlassPanel>
      ) : (
        <ProUpsell feature="Custom Tactics Creator" />
      )}

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
                onClick={() => { setTactics({ mentality: m.value }); hapticLight(); }}
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
                onClick={() => { setTactics({ width: w.value }); hapticLight(); }}
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
                onClick={() => { setTactics({ tempo: t.value }); hapticLight(); }}
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
                onClick={() => { setTactics({ defensiveLine: d.value }); hapticLight(); }}
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
                onClick={() => { setTactics({ pressingIntensity: p.value }); hapticLight(); }}
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
              <span className="text-sm text-foreground flex-1"><FlagIcon nationality={p.nationality} size={16} /> {p.firstName[0]}. {p.lastName}</span>
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
                  <span className="text-sm text-foreground flex-1 text-left"><FlagIcon nationality={p.nationality} size={16} /> {p.firstName[0]}. {p.lastName}</span>
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
              <span className="text-sm text-foreground/70 flex-1 text-left"><FlagIcon nationality={p.nationality} size={16} /> {p.firstName[0]}. {p.lastName}</span>
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
              placeholder="Auto (best passing + shooting)"
              sortMode="setpiece"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Penalty Taker</label>
            <PlayerSelect
              players={lineupPlayers.filter(p => p.position !== 'GK')}
              selectedId={club.penaltyTakerId}
              onChange={setPenaltyTaker}
              placeholder="Auto (best shooting + mental)"
              sortMode="penalty"
            />
          </div>
        </div>
      </GlassPanel>
    </div>
  );
};

export default TacticsPage;
