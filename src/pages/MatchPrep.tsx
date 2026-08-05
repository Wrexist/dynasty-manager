import { useGameStore } from '@/store/gameStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useShallow } from 'zustand/react/shallow';
import { getSuffix } from '@/utils/helpers';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ClubCrest } from '@/components/game/ClubCrest';
import { SectionHeader } from '@/components/game/SectionHeader';
import { LineupEditor } from '@/components/game/LineupEditor';
import { OptimizeLineupButton } from '@/components/game/OptimizeLineupButton';
import { OptimizeResultModal } from '@/components/game/OptimizeResultModal';
import { Swords, AlertTriangle, Flame, Info, Shield, Zap, ArrowUp, ArrowDown, Minus, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRatingBadgeClasses, getRatingColor } from '@/utils/uiHelpers';
import { useCurrentMatch, useLeaguePosition } from '@/hooks/useGameSelectors';
import { useLineupOptimizer } from '@/hooks/useLineupOptimizer';
import { Button } from '@/components/ui/button';
import { getDerbyIntensity, getDerbyName, LEAGUES } from '@/data/league';
import { getCompetitionInfo } from '@/utils/competitionBadge';
import { FORMATION_POSITIONS, FormationType, type Position, type GamePlanId } from '@/types/game';
import { GAME_PLANS } from '@/config/gamePlan';
import { Target } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS } from '@/config/ui';
import { isPro } from '@/utils/monetization';
import { ProUpsell } from '@/components/game/ProUpsell';

const FORMATION_HINTS: Record<FormationType, string> = {
  '4-4-2': 'Balanced and direct. Strong in midfield and up front.',
  '4-3-3': 'Wide attacking play with wingers. Good pressing shape.',
  '3-5-2': 'Midfield dominance with wing-backs. Vulnerable on flanks.',
  '4-2-3-1': 'Solid double pivot with a creative #10. Great balance.',
  '4-1-4-1': 'Defensive stability with one anchor. Counter-attack ready.',
  '3-4-3': 'Ultra-attacking with 3 forwards. Risky at the back.',
  '5-3-2': 'Deep defensive block. Hard to break down but limited width.',
  '4-5-1': 'Ultra-defensive packed midfield. Great for frustrating opponents.',
  '4-1-2-1-2': 'The diamond. Central overload with no natural width.',
  '3-4-1-2': 'Two strikers with a creative #10. Wing-backs provide width.',
};

const MatchPrep = () => {
  const { t } = useTranslation();
  const { week, clubs, players, playerClubId, leagueTable, monetization, rivalries, playerDivision, seasonPhase, matchGamePlan } = useGameStore(useShallow((s) => ({
    week: s.week,
    clubs: s.clubs,
    players: s.players,
    playerClubId: s.playerClubId,
    leagueTable: s.leagueTable,
    monetization: s.monetization,
    rivalries: s.rivalries,
    playerDivision: s.playerDivision,
    seasonPhase: s.seasonPhase,
    matchGamePlan: s.matchGamePlan,
  })));
  const setScreen = useGameStore((s) => s.setScreen);
  const setGamePlan = useGameStore((s) => s.setGamePlan);
  const playCurrentMatch = useGameStore((s) => s.playCurrentMatch);
  const { potentialGain, autoFilling, optimizeLineup, result: optimizeResult, dismissResult: dismissOptimizeResult } = useLineupOptimizer();
  // Instant Sim skips all live tactical control — confirm before committing.
  const [confirmSim, setConfirmSim] = useState(false);
  const runSim = () => {
    setConfirmSim(false);
    const result = playCurrentMatch();
    if (result) setScreen('match-review');
  };

  const myClub = clubs[playerClubId];

  const { match, isHome, opponent: oppClub, competition } = useCurrentMatch();
  const oppClubId = match ? (isHome ? match.awayClubId : match.homeClubId) : '';
  // Continental opponents from foreign leagues are "virtual" — they exist only
  // as name/colour records (state.virtualClubs) with no players, lineup, or
  // league-table entry. Comparison widgets would render false data for them
  // (0 OVR, empty threats, bottom of *your* league table), so we swap those
  // panels for an honest "limited intel" presentation instead.
  const isVirtualOpp = !!match && !!oppClubId && !clubs[oppClubId];
  const oppPos = useLeaguePosition(oppClubId);
  const myPos = useLeaguePosition();
  const inPlayoffs = (seasonPhase as string) === 'playoffs';
  const competitionInfo = getCompetitionInfo(competition, {
    inPlayoffs,
    leagueName: LEAGUES.find(d => d.id === playerDivision)?.shortName,
  });

  // Resolve opponent club data for the rating memo (avoids depending on entire clubs record)
  const oppClubData = match ? (isHome ? clubs[match.awayClubId] : clubs[match.homeClubId]) : undefined;

  // Starting XI rating comparison (must be before early return to satisfy hooks rules)
  const ratingComparison = useMemo(() => {
    const empty = { def: 0, mid: 0, att: 0 };
    if (!myClub || !oppClubData) return { myOvr: 0, oppOvr: 0, diff: 0, myUnits: empty, oppUnits: empty };

    const myLineup = myClub.lineup.map(id => players[id]).filter(Boolean);
    const oppLineup = oppClubData.lineup.map(id => players[id]).filter(Boolean);
    const avg = (arr: { overall: number }[]) => arr.length ? Math.round(arr.reduce((s, p) => s + p.overall, 0) / arr.length) : 0;
    const myOvr = avg(myLineup);
    const oppOvr = avg(oppLineup);

    const DEF = new Set<string>(['GK', 'CB', 'LB', 'RB']);
    const MID = new Set<string>(['CDM', 'CM', 'CAM', 'LM', 'RM']);
    const ATT = new Set<string>(['LW', 'RW', 'ST']);
    const unitAvg = (lineup: typeof myLineup, formation: FormationType) => {
      const slots = FORMATION_POSITIONS[formation] || [];
      const def: number[] = [];
      const mid: number[] = [];
      const att: number[] = [];
      lineup.forEach((p, i) => {
        const pos = slots[i]?.pos as Position | undefined;
        if (!pos) return;
        if (DEF.has(pos)) def.push(p.overall);
        else if (MID.has(pos)) mid.push(p.overall);
        else if (ATT.has(pos)) att.push(p.overall);
      });
      const a = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
      return { def: a(def), mid: a(mid), att: a(att) };
    };
    const myUnits = unitAvg(myLineup, myClub.formation);
    const oppUnits = unitAvg(oppLineup, oppClubData.formation);

    return { myOvr, oppOvr, diff: myOvr - oppOvr, myUnits, oppUnits };
  }, [myClub, oppClubData, players]);

  if (!match || !oppClub) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <GlassPanel className="p-6 text-center">
          <p className="text-sm text-muted-foreground">No upcoming match this week</p>
        </GlassPanel>
      </div>
    );
  }

  const myEntry = leagueTable.find(e => e.clubId === playerClubId);
  const oppEntry = leagueTable.find(e => e.clubId === oppClubId);

  // Opponent key players
  const oppPlayers = (oppClub.playerIds || []).map(id => players[id]).filter(Boolean).sort((a, b) => b.overall - a.overall);
  const oppKeyPlayers = oppPlayers.slice(0, 3);

  // Derby detection
  const derbyIntensity = getDerbyIntensity(match.homeClubId, match.awayClubId);
  const derbyName = getDerbyName(match.homeClubId, match.awayClubId);

  // Fitness warnings — only for starting 11
  const mySquad = (myClub.playerIds || []).map(id => players[id]).filter(Boolean);
  const lineupIds = new Set(myClub.lineup || []);
  const fitnessWarnings = mySquad.filter(p => lineupIds.has(p.id) && (p.fitness < 70 || p.injured));

  // Tactical analysis
  const myFormation = myClub.formation;
  const oppFormation = oppClub.formation;
  const myHint = FORMATION_HINTS[myFormation];
  const oppHint = FORMATION_HINTS[oppFormation];

  // Low-fitness lineup count
  const lowFitnessInLineup = mySquad.filter(p => lineupIds.has(p.id) && p.fitness < 75 && !p.injured).length;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-bar-safe space-y-3">
      <SectionHeader title={t('matchPrep.matchPreparation')} />
      <PageHint screen="matchPrep" title={PAGE_HINTS.matchPrep.title} body={PAGE_HINTS.matchPrep.body} />

      {/* Match Header */}
      <GlassPanel className={cn("p-4", competitionInfo.borderAccent)}>
        <div className="text-center mb-2">
          <span className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-micro font-bold uppercase tracking-wider border',
            competitionInfo.bg
          )}>
            <Trophy className="w-3 h-3" />
            <span className={competitionInfo.color}>{competitionInfo.name}</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <ClubCrest club={myClub} size="md" className="mx-auto mb-1" />
            <p className="text-xs font-bold text-foreground">{myClub.shortName}</p>
            <p className="text-micro text-muted-foreground tabular-nums">{myPos}{typeof myPos === 'number' ? getSuffix(myPos) : ''}</p>
          </div>
          <div className="px-4">
            <p className="text-sm font-bold text-muted-foreground">{isHome ? 'HOME' : 'AWAY'}</p>
            <p className="text-xs text-muted-foreground">Week {week}</p>
          </div>
          <div className="text-center flex-1">
            <ClubCrest club={oppClub} size="md" className="mx-auto mb-1" />
            <p className="text-xs font-bold text-foreground">{oppClub.shortName}</p>
            {/* A virtual opponent has no entry in the player's league table —
                showing a position would place them bottom of the wrong league. */}
            <p className="text-micro text-muted-foreground tabular-nums">
              {isVirtualOpp ? 'Foreign league' : `${oppPos}${typeof oppPos === 'number' ? getSuffix(oppPos) : ''}`}
            </p>
          </div>
        </div>
      </GlassPanel>

      {/* Continental opponent — no squad data to compare against */}
      {isVirtualOpp && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Info className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Continental Opponent</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Limited intel — {oppClub.name} play in a foreign league, so detailed
            squad ratings, form, and key threats aren't available. Expect a
            competitive side and prepare your strongest XI.
          </p>
        </GlassPanel>
      )}

      {/* Team Rating Comparison */}
      {!isVirtualOpp && (
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-3">
          {/* My team OVR */}
          <div className="flex-1 flex flex-col items-center">
            <div className={cn(
              'w-14 h-14 rounded-xl flex flex-col items-center justify-center',
              getRatingBadgeClasses(ratingComparison.myOvr)
            )}>
              <span className="text-xl font-black tabular-nums leading-none">{ratingComparison.myOvr}</span>
              <span className="text-micro font-semibold opacity-70 leading-none mt-0.5">OVR</span>
            </div>
            <p className="text-micro text-muted-foreground mt-1">{myClub.shortName}</p>
          </div>

          {/* Rating difference */}
          <div className="px-3 flex flex-col items-center">
            <div className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold',
              ratingComparison.diff > 0 ? 'bg-emerald-500/15 text-emerald-400' :
              ratingComparison.diff < 0 ? 'bg-destructive/15 text-destructive' :
              'bg-muted/30 text-muted-foreground'
            )}>
              {ratingComparison.diff > 0 ? <ArrowUp className="w-3 h-3" /> :
               ratingComparison.diff < 0 ? <ArrowDown className="w-3 h-3" /> :
               <Minus className="w-3 h-3" />}
              <span className="tabular-nums">{ratingComparison.diff > 0 ? '+' : ''}{ratingComparison.diff}</span>
            </div>
            <p className={cn(
              'text-micro font-semibold mt-1',
              ratingComparison.diff >= 5 ? 'text-emerald-400' :
              ratingComparison.diff >= 1 ? 'text-emerald-400/70' :
              ratingComparison.diff <= -5 ? 'text-destructive' :
              ratingComparison.diff <= -1 ? 'text-destructive/70' :
              'text-muted-foreground'
            )}>
              {ratingComparison.diff >= 5 ? 'Favoured' :
               ratingComparison.diff >= 1 ? 'Slight Edge' :
               ratingComparison.diff <= -5 ? 'Underdog' :
               ratingComparison.diff <= -1 ? 'Tough Test' :
               'Even Match'}
            </p>
          </div>

          {/* Opponent OVR */}
          <div className="flex-1 flex flex-col items-center">
            <div className={cn(
              'w-14 h-14 rounded-xl flex flex-col items-center justify-center',
              getRatingBadgeClasses(ratingComparison.oppOvr)
            )}>
              <span className="text-xl font-black tabular-nums leading-none">{ratingComparison.oppOvr}</span>
              <span className="text-micro font-semibold opacity-70 leading-none mt-0.5">OVR</span>
            </div>
            <p className="text-micro text-muted-foreground mt-1">{oppClub.shortName}</p>
          </div>
        </div>

        {/* Unit comparison bars */}
        <div className="space-y-1.5">
          {[
            { label: 'DEF', my: ratingComparison.myUnits.def, opp: ratingComparison.oppUnits.def },
            { label: 'MID', my: ratingComparison.myUnits.mid, opp: ratingComparison.oppUnits.mid },
            { label: 'ATT', my: ratingComparison.myUnits.att, opp: ratingComparison.oppUnits.att },
          ].map(u => {
            // Scale bars relative to max possible (99) so the visual gap is meaningful
            const scale = 99;
            const myW = Math.max(5, (u.my / scale) * 100);
            const oppW = Math.max(5, (u.opp / scale) * 100);
            return (
              <div key={u.label} className="flex items-center gap-1.5 text-xs">
                <span className={cn('w-7 text-right font-bold tabular-nums', getRatingColor(u.my))}>{u.my}</span>
                <div className="flex-1 flex items-center gap-1">
                  {/* My bar — grows right */}
                  <div className="flex-1 flex justify-end">
                    <div
                      className={cn('h-2 rounded-full transition-all', u.my >= u.opp ? 'bg-emerald-500' : 'bg-muted-foreground/30')}
                      style={{ width: `${myW}%` }}
                    />
                  </div>
                  <span className="text-micro text-muted-foreground font-semibold w-7 text-center shrink-0">{u.label}</span>
                  {/* Opp bar — grows left */}
                  <div className="flex-1 flex justify-start">
                    <div
                      className={cn('h-2 rounded-full transition-all', u.opp > u.my ? 'bg-emerald-500' : 'bg-muted-foreground/30')}
                      style={{ width: `${oppW}%` }}
                    />
                  </div>
                </div>
                <span className={cn('w-7 font-bold tabular-nums', getRatingColor(u.opp))}>{u.opp}</span>
              </div>
            );
          })}
        </div>
      </GlassPanel>
      )}

      {/* Derby Banner */}
      {derbyIntensity > 0 && derbyName && (
        <GlassPanel className={cn(
          'p-3 border',
          derbyIntensity >= 3 ? 'border-destructive/50 bg-destructive/10' : derbyIntensity >= 2 ? 'border-amber-500/50 bg-amber-500/10' : 'border-primary/50 bg-primary/10'
        )}>
          <div className="flex items-center gap-2 justify-center">
            <Flame className={cn('w-4 h-4', derbyIntensity >= 3 ? 'text-destructive' : derbyIntensity >= 2 ? 'text-amber-400' : 'text-primary')} />
            <span className={cn('text-sm font-bold', derbyIntensity >= 3 ? 'text-destructive' : derbyIntensity >= 2 ? 'text-amber-400' : 'text-primary')}>
              {derbyName}
            </span>
            <Flame className={cn('w-4 h-4', derbyIntensity >= 3 ? 'text-destructive' : derbyIntensity >= 2 ? 'text-amber-400' : 'text-primary')} />
          </div>
          <p className="text-micro text-muted-foreground text-center mt-1">
            Rivalry match — expect higher intensity, more fouls and cards
          </p>
        </GlassPanel>
      )}

      {/* Form Comparison */}
      {!isVirtualOpp && (
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Recent Form</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16 shrink-0">{myClub.shortName}</span>
            <div className="flex gap-1">
              {(myEntry?.form || []).slice(-5).map((r, i) => (
                <span key={i} className={cn(
                  'w-5 h-5 rounded text-micro font-bold flex items-center justify-center',
                  r === 'W' ? 'bg-emerald-500/20 text-emerald-400' : r === 'D' ? 'bg-amber-500/20 text-amber-400' : 'bg-destructive/20 text-destructive'
                )}>{r}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16 shrink-0">{oppClub.shortName}</span>
            <div className="flex gap-1">
              {(oppEntry?.form || []).slice(-5).map((r, i) => (
                <span key={i} className={cn(
                  'w-5 h-5 rounded text-micro font-bold flex items-center justify-center',
                  r === 'W' ? 'bg-emerald-500/20 text-emerald-400' : r === 'D' ? 'bg-amber-500/20 text-amber-400' : 'bg-destructive/20 text-destructive'
                )}>{r}</span>
              ))}
            </div>
          </div>
        </div>
      </GlassPanel>
      )}

      {/* Head-to-Head Record */}
      {(() => {
        const h2h = rivalries?.[oppClubId];
        if (!h2h || (h2h.wins === 0 && h2h.draws === 0 && h2h.losses === 0)) return null;
        const total = h2h.wins + h2h.draws + h2h.losses;
        return (
          <GlassPanel className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Head-to-Head Record</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-center">
                <p className="text-lg font-black text-emerald-400 tabular-nums">{h2h.wins}</p>
                <p className="text-micro text-muted-foreground">Wins</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-lg font-black text-amber-400 tabular-nums">{h2h.draws}</p>
                <p className="text-micro text-muted-foreground">Draws</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-lg font-black text-destructive tabular-nums">{h2h.losses}</p>
                <p className="text-micro text-muted-foreground">Losses</p>
              </div>
            </div>
            {/* Win percentage bar */}
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden flex">
              {h2h.wins > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(h2h.wins / total) * 100}%` }} />}
              {h2h.draws > 0 && <div className="bg-amber-500 h-full" style={{ width: `${(h2h.draws / total) * 100}%` }} />}
              {h2h.losses > 0 && <div className="bg-destructive h-full" style={{ width: `${(h2h.losses / total) * 100}%` }} />}
            </div>
            {h2h.grudgeLevel >= 3 && (
              <p className="text-micro text-destructive mt-1.5 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Bitter rivalry — expect a fiery contest
              </p>
            )}
          </GlassPanel>
        );
      })()}

      {/* Tactical Analysis */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Tactical Overview</h3>
        </div>
        <div className="space-y-2">
          <div className="bg-muted/30 rounded-lg p-2.5">
            <p className="text-micro text-muted-foreground uppercase tracking-wider mb-0.5">Your Formation</p>
            <p className="text-xs font-bold text-foreground">{myFormation}</p>
            <p className="text-micro text-muted-foreground mt-0.5">{myHint}</p>
          </div>
          {!isVirtualOpp && (
          <div className="bg-muted/30 rounded-lg p-2.5">
            <p className="text-micro text-muted-foreground uppercase tracking-wider mb-0.5">Opponent Formation</p>
            <p className="text-xs font-bold text-foreground">{oppFormation}</p>
            <p className="text-micro text-muted-foreground mt-0.5">{oppHint}</p>
          </div>
          )}
          {!isVirtualOpp && myFormation !== oppFormation && (
            <div className="flex items-start gap-1.5 pt-1">
              <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-micro text-primary/80">
                {oppFormation.startsWith('3') || oppFormation.startsWith('5')
                  ? 'Opponent plays with 3 at the back — use wide play to exploit the flanks.'
                  : oppFormation === '4-1-4-1' || oppFormation === '4-2-3-1'
                  ? 'Opponent has a defensive setup — consider going attacking to break them down.'
                  : oppFormation === '3-4-3' || oppFormation === '4-3-3'
                  ? 'Opponent is attacking — a cautious approach could catch them on the counter.'
                  : 'Different shapes mean different matchups — adjust your mentality if needed.'}
              </p>
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Opponent Manager */}
      {oppClub.aiManagerProfile && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Opponent Manager</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center text-xs font-bold text-foreground">
              {oppClub.aiManagerProfile.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{oppClub.aiManagerProfile.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn(
                  'text-micro font-bold px-2 py-0.5 rounded-full uppercase',
                  oppClub.aiManagerProfile.style === 'attacking' ? 'bg-destructive/20 text-destructive' :
                  oppClub.aiManagerProfile.style === 'defensive' ? 'bg-blue-500/20 text-blue-400' :
                  oppClub.aiManagerProfile.style === 'possession' ? 'bg-emerald-500/20 text-emerald-400' :
                  oppClub.aiManagerProfile.style === 'counter-attack' ? 'bg-amber-500/20 text-amber-400' :
                  oppClub.aiManagerProfile.style === 'direct' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-muted/30 text-muted-foreground'
                )}>
                  {oppClub.aiManagerProfile.style.replace('-', ' ')}
                </span>
                <span className="text-micro text-muted-foreground">
                  Adaptability: {Math.round(oppClub.aiManagerProfile.adaptability * 100)}%
                </span>
              </div>
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Lineup Fitness Warning */}
      {lowFitnessInLineup > 0 && (
        <GlassPanel className="p-3 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">
              <span className="font-semibold">{lowFitnessInLineup} player{lowFitnessInLineup > 1 ? 's' : ''} in your lineup</span>{' '}
              {lowFitnessInLineup > 1 ? 'have' : 'has'} low fitness ({'<'}75%). They'll perform worse — consider rotating them out.
            </p>
          </div>
        </GlassPanel>
      )}

      {/* Opponent Key Players */}
      {!isVirtualOpp && (
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Key Threats</h3>
        <div className="space-y-2">
          {oppKeyPlayers.map(p => (
            <div key={p.id} className="flex items-center gap-3">
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                getRatingBadgeClasses(p.overall)
              )}>
                {p.overall}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{p.firstName} {p.lastName}</p>
                <p className="text-micro text-muted-foreground">{p.position} · {p.goals}G {p.assists}A</p>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>
      )}

      {/* Fitness Warnings */}
      {fitnessWarnings.length > 0 && (
        <GlassPanel className="p-4 border-amber-500/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-400">Fitness Warnings</h3>
          </div>
          <div className="space-y-1.5">
            {fitnessWarnings.map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-xs text-foreground">{p.lastName} ({p.position})</span>
                <span className={cn('text-micro font-semibold',
                  p.injured ? 'text-destructive' : 'text-amber-400'
                )}>
                  {p.injured ? `Injured (${p.injuryWeeks}w)` : `${p.fitness}% fitness`}
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Squad Comparison */}
      {!isVirtualOpp && (
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Swords className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Squad Depth</h3>
        </div>
        {(() => {
          const myAllPlayers = (myClub.playerIds || []).map(id => players[id]).filter(Boolean);
          const myBest = myAllPlayers.length ? myAllPlayers.reduce((m, p) => p.overall > m ? p.overall : m, 0) : 0;
          const oppBest = oppPlayers.length ? oppPlayers.reduce((m, p) => p.overall > m ? p.overall : m, 0) : 0;
          const myInjured = myAllPlayers.filter(p => p.injured).length;
          const oppInjured = oppPlayers.filter(p => p.injured).length;
          const rows = [
            { label: 'Best Player', my: myBest, opp: oppBest },
            { label: 'Squad Size', my: myAllPlayers.length, opp: oppPlayers.length },
            { label: 'Injured', my: myInjured, opp: oppInjured },
          ];
          return (
            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.label} className="flex items-center gap-2 text-xs">
                  <span className={cn('w-8 text-right font-bold tabular-nums', r.my > r.opp ? 'text-emerald-400' : r.my < r.opp ? 'text-muted-foreground' : 'text-foreground')}>{r.my}</span>
                  <div className="flex-1 text-center text-micro text-muted-foreground">{r.label}</div>
                  <span className={cn('w-8 font-bold tabular-nums', r.opp > r.my ? 'text-emerald-400' : r.opp < r.my ? 'text-muted-foreground' : 'text-foreground')}>{r.opp}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </GlassPanel>
      )}

      {/* Opposition Game Plan — a pre-match lever to act on the intel above.
          Applies for the whole match through the same modifier path team talks
          use (config/gamePlan.ts). */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Game Plan</h3>
        </div>
        <p className="text-micro text-muted-foreground mb-3">
          Answer their intel with a plan for the whole match. Each is a tradeoff.
        </p>
        <div className="space-y-2">
          {([{ id: 'none' as GamePlanId, label: 'No Special Plan', tradeoff: 'Play it straight — no tactical tweaks.' }, ...GAME_PLANS]).map(plan => {
            const isSelected = matchGamePlan === plan.id;
            const dangerMan = oppKeyPlayers[0];
            const label = plan.id === 'man_mark' && dangerMan
              ? `Shackle ${dangerMan.lastName}`
              : plan.label;
            return (
              <button
                key={plan.id}
                onClick={() => setGamePlan(isSelected && plan.id !== 'none' ? 'none' : (plan.id as GamePlanId))}
                aria-pressed={isSelected}
                className={cn(
                  'w-full text-left rounded-lg border p-2.5 transition-all',
                  isSelected ? 'border-primary bg-primary/10' : 'border-border/50 bg-muted/20 hover:bg-muted/30'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('text-xs font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>{label}</span>
                  {isSelected && plan.id !== 'none' && (
                    <span className="text-micro font-bold uppercase tracking-wider text-primary shrink-0">Selected</span>
                  )}
                </div>
                <p className="text-micro text-muted-foreground mt-0.5">{plan.tradeoff}</p>
              </button>
            );
          })}
        </div>
      </GlassPanel>

      {/* Lineup & Bench */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Your Formation: {myClub.formation}</h3>

        <div className="mb-3">
          {isPro(monetization) ? (
            <OptimizeLineupButton potentialGain={potentialGain} autoFilling={autoFilling} onOptimize={optimizeLineup} />
          ) : (
            <ProUpsell feature="Optimize Lineup" />
          )}
        </div>

        <LineupEditor />
      </GlassPanel>

      {/* Instant Sim Upsell (free users only) */}
      {!isPro(monetization) && (
        <ProUpsell feature="Instant Match Sim" />
      )}

      {/* Ready Button — sticky at bottom. `bottom-20` clears the BottomNav
          footprint on non-notch devices; the inline calc adds the iOS
          safe-area inset so the CTA sits clearly above the nav pill and the
          home-indicator gesture area on notched iPhones. */}
      <div
        className="fixed left-0 right-0 z-30 px-4 pb-2 pt-2 bg-gradient-to-t from-background via-background to-transparent"
        style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-lg mx-auto flex gap-2">
          <Button
            size="lg"
            className="flex-1 h-14 text-lg font-bold gap-3"
            onClick={() => setScreen('match')}
          >
            <Swords className="w-5 h-5" /> Ready to Play
          </Button>
          {isPro(monetization) && (
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-4 font-bold gap-2 border-primary/50 text-primary bg-primary/10 hover:bg-primary/20 active:bg-primary/30"
              onClick={() => setConfirmSim(true)}
            >
              <Zap className="w-5 h-5" /> Sim
            </Button>
          )}
        </div>
      </div>

      {/* Confirm instant sim — it forfeits all live tactical control. */}
      {confirmSim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <GlassPanel className="p-5 max-w-sm w-full space-y-4">
            <h3 className="text-base font-bold text-foreground font-display">Simulate this match?</h3>
            <p className="text-sm text-muted-foreground">
              Instant Sim plays the match out immediately — you won't be able to make
              substitutions, change tactics, or influence it live.
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-9 gap-1.5" onClick={runSim}>
                <Zap className="w-4 h-4" /> Sim Match
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-9" onClick={() => setConfirmSim(false)}>
                Cancel
              </Button>
            </div>
          </GlassPanel>
        </div>
      )}

      <OptimizeResultModal result={optimizeResult} onDismiss={dismissOptimizeResult} />
    </div>
  );
};

export default MatchPrep;
