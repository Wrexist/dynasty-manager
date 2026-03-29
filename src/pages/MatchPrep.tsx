import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getSuffix } from '@/utils/helpers';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LineupEditor } from '@/components/game/LineupEditor';
import { Swords, AlertTriangle, Flame, Info, Shield, Wand2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRatingBadgeClasses } from '@/utils/uiHelpers';
import { useCurrentMatch, useLeaguePosition } from '@/hooks/useGameSelectors';
import { Button } from '@/components/ui/button';
import { getDerbyIntensity, getDerbyName } from '@/data/league';
import { FormationType } from '@/types/game';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS } from '@/config/ui';
import { isPro } from '@/utils/monetization';

const FORMATION_HINTS: Record<FormationType, string> = {
  '4-4-2': 'Balanced and direct. Strong in midfield and up front.',
  '4-3-3': 'Wide attacking play with wingers. Good pressing shape.',
  '3-5-2': 'Midfield dominance with wing-backs. Vulnerable on flanks.',
  '4-2-3-1': 'Solid double pivot with a creative #10. Great balance.',
  '4-1-4-1': 'Defensive stability with one anchor. Counter-attack ready.',
  '3-4-3': 'Ultra-attacking with 3 forwards. Risky at the back.',
  '5-3-2': 'Deep defensive block. Hard to break down but limited width.',
};

const MatchPrep = () => {
  const { week, clubs, players, playerClubId, leagueTable, setScreen, monetization, playCurrentMatch, autoFillTeam, rivalries } = useGameStore();
  const [autoFilling, setAutoFilling] = useState(false);

  const { match, isHome, opponent: oppClub } = useCurrentMatch();
  const oppClubId = match ? (isHome ? match.awayClubId : match.homeClubId) : '';
  const oppPos = useLeaguePosition(oppClubId);
  const myPos = useLeaguePosition();

  if (!match || !oppClub) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <GlassPanel className="p-6 text-center">
          <p className="text-sm text-muted-foreground">No upcoming match this week</p>
        </GlassPanel>
      </div>
    );
  }

  const myClub = clubs[playerClubId];
  const myEntry = leagueTable.find(e => e.clubId === playerClubId);
  const oppEntry = leagueTable.find(e => e.clubId === oppClubId);

  // Opponent key players
  const oppPlayers = oppClub.playerIds.map(id => players[id]).filter(Boolean).sort((a, b) => b.overall - a.overall);
  const oppKeyPlayers = oppPlayers.slice(0, 3);

  // Derby detection
  const derbyIntensity = getDerbyIntensity(match.homeClubId, match.awayClubId);
  const derbyName = getDerbyName(match.homeClubId, match.awayClubId);

  // Fitness warnings — only for starting 11
  const mySquad = myClub.playerIds.map(id => players[id]).filter(Boolean);
  const lineupIds = new Set(myClub.lineup);
  const fitnessWarnings = mySquad.filter(p => lineupIds.has(p.id) && (p.fitness < 70 || p.injured));

  // Tactical analysis
  const myFormation = myClub.formation;
  const oppFormation = oppClub.formation;
  const myHint = FORMATION_HINTS[myFormation];
  const oppHint = FORMATION_HINTS[oppFormation];

  // Low-fitness lineup count
  const lowFitnessInLineup = mySquad.filter(p => lineupIds.has(p.id) && p.fitness < 75 && !p.injured).length;


  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-20 space-y-3">
      <h2 className="text-lg font-display font-bold text-foreground">Match Preparation</h2>
      <PageHint screen="matchPrep" title={PAGE_HINTS.matchPrep.title} body={PAGE_HINTS.matchPrep.body} />

      {/* Match Header */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="w-10 h-10 rounded-full mx-auto mb-1" style={{ backgroundColor: myClub.color }} />
            <p className="text-xs font-bold text-foreground">{myClub.shortName}</p>
            <p className="text-[10px] text-muted-foreground">{myPos}{typeof myPos === 'number' ? getSuffix(myPos) : ''}</p>
          </div>
          <div className="px-4">
            <p className="text-sm font-bold text-muted-foreground">{isHome ? 'HOME' : 'AWAY'}</p>
            <p className="text-xs text-muted-foreground">Week {week}</p>
          </div>
          <div className="text-center flex-1">
            <div className="w-10 h-10 rounded-full mx-auto mb-1" style={{ backgroundColor: oppClub.color }} />
            <p className="text-xs font-bold text-foreground">{oppClub.shortName}</p>
            <p className="text-[10px] text-muted-foreground">{oppPos}{typeof oppPos === 'number' ? getSuffix(oppPos) : ''}</p>
          </div>
        </div>
      </GlassPanel>

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
          <p className="text-[10px] text-muted-foreground text-center mt-1">
            Rivalry match — expect higher intensity, more fouls and cards
          </p>
        </GlassPanel>
      )}

      {/* Form Comparison */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Recent Form</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16 shrink-0">{myClub.shortName}</span>
            <div className="flex gap-1">
              {(myEntry?.form || []).slice(-5).map((r, i) => (
                <span key={i} className={cn(
                  'w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center',
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
                  'w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center',
                  r === 'W' ? 'bg-emerald-500/20 text-emerald-400' : r === 'D' ? 'bg-amber-500/20 text-amber-400' : 'bg-destructive/20 text-destructive'
                )}>{r}</span>
              ))}
            </div>
          </div>
        </div>
      </GlassPanel>

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
                <p className="text-[10px] text-muted-foreground">Wins</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-lg font-black text-amber-400 tabular-nums">{h2h.draws}</p>
                <p className="text-[10px] text-muted-foreground">Draws</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-lg font-black text-destructive tabular-nums">{h2h.losses}</p>
                <p className="text-[10px] text-muted-foreground">Losses</p>
              </div>
            </div>
            {/* Win percentage bar */}
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden flex">
              {h2h.wins > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(h2h.wins / total) * 100}%` }} />}
              {h2h.draws > 0 && <div className="bg-amber-500 h-full" style={{ width: `${(h2h.draws / total) * 100}%` }} />}
              {h2h.losses > 0 && <div className="bg-destructive h-full" style={{ width: `${(h2h.losses / total) * 100}%` }} />}
            </div>
            {h2h.grudgeLevel >= 3 && (
              <p className="text-[10px] text-destructive mt-1.5 flex items-center gap-1">
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
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Your Formation</p>
            <p className="text-xs font-bold text-foreground">{myFormation}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{myHint}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Opponent Formation</p>
            <p className="text-xs font-bold text-foreground">{oppFormation}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{oppHint}</p>
          </div>
          {myFormation !== oppFormation && (
            <div className="flex items-start gap-1.5 pt-1">
              <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-[10px] text-primary/80">
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
                  'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                  oppClub.aiManagerProfile.style === 'attacking' ? 'bg-destructive/20 text-destructive' :
                  oppClub.aiManagerProfile.style === 'defensive' ? 'bg-blue-500/20 text-blue-400' :
                  oppClub.aiManagerProfile.style === 'possession' ? 'bg-emerald-500/20 text-emerald-400' :
                  oppClub.aiManagerProfile.style === 'counter-attack' ? 'bg-amber-500/20 text-amber-400' :
                  oppClub.aiManagerProfile.style === 'direct' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-muted/30 text-muted-foreground'
                )}>
                  {oppClub.aiManagerProfile.style.replace('-', ' ')}
                </span>
                <span className="text-[10px] text-muted-foreground">
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
                <p className="text-[10px] text-muted-foreground">{p.position} · {p.goals}G {p.assists}A</p>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>

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
                <span className={cn('text-[10px] font-semibold',
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
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Swords className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Squad Comparison</h3>
        </div>
        {(() => {
          const myPlayers = myClub.playerIds.map(id => players[id]).filter(Boolean);
          const myAvg = myPlayers.length ? Math.round(myPlayers.reduce((s, p) => s + p.overall, 0) / myPlayers.length) : 0;
          const oppAvg = oppPlayers.length ? Math.round(oppPlayers.reduce((s, p) => s + p.overall, 0) / oppPlayers.length) : 0;
          const myBest = myPlayers.length ? Math.max(...myPlayers.map(p => p.overall)) : 0;
          const oppBest = oppPlayers.length ? Math.max(...oppPlayers.map(p => p.overall)) : 0;
          const myInjured = myPlayers.filter(p => p.injured).length;
          const oppInjured = oppPlayers.filter(p => p.injured).length;
          const rows = [
            { label: 'Avg Rating', my: myAvg, opp: oppAvg },
            { label: 'Best Player', my: myBest, opp: oppBest },
            { label: 'Squad Size', my: myPlayers.length, opp: oppPlayers.length },
            { label: 'Injured', my: myInjured, opp: oppInjured },
          ];
          return (
            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.label} className="flex items-center gap-2 text-xs">
                  <span className={cn('w-8 text-right font-bold tabular-nums', r.my > r.opp ? 'text-emerald-400' : r.my < r.opp ? 'text-muted-foreground' : 'text-foreground')}>{r.my}</span>
                  <div className="flex-1 text-center text-[10px] text-muted-foreground">{r.label}</div>
                  <span className={cn('w-8 font-bold tabular-nums', r.opp > r.my ? 'text-emerald-400' : r.opp < r.my ? 'text-muted-foreground' : 'text-foreground')}>{r.opp}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </GlassPanel>

      {/* Lineup & Bench */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Your Formation: {myClub.formation}</h3>
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
              'flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all',
              autoFilling
                ? 'bg-primary/30 text-primary/70 cursor-not-allowed'
                : 'bg-primary/20 hover:bg-primary/30 text-primary'
            )}
          >
            <Wand2 className={cn('w-3 h-3', autoFilling && 'animate-spin')} />
            {autoFilling ? 'Filling...' : 'Smart Fill'}
          </button>
        </div>
        <LineupEditor />
      </GlassPanel>

      {/* Ready Button — sticky at bottom */}
      <div className="fixed bottom-20 left-0 right-0 z-30 px-4 pb-2 pt-2 bg-gradient-to-t from-background via-background to-transparent">
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
              onClick={() => {
                playCurrentMatch();
                setScreen('match-review');
              }}
            >
              <Zap className="w-5 h-5" /> Sim
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchPrep;
