import { useGameStore } from '@/store/gameStore';
import { getSuffix } from '@/utils/helpers';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PitchView } from '@/components/game/PitchView';
import { Swords, AlertTriangle, Flame, Info, Shield, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRatingBadgeClasses } from '@/utils/uiHelpers';
import { useCurrentMatch, useLeaguePosition } from '@/hooks/useGameSelectors';
import { Button } from '@/components/ui/button';
import { getDerbyIntensity, getDerbyName } from '@/data/league';
import { FormationType } from '@/types/game';
import { calculateChemistryLinks } from '@/utils/chemistry';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS } from '@/config/ui';

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
  const { week, season, clubs, players, playerClubId, leagueTable, setScreen } = useGameStore();

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

  // Fitness warnings
  const mySquad = myClub.playerIds.map(id => players[id]).filter(Boolean);
  const fitnessWarnings = mySquad.filter(p => p.fitness < 70 || p.injured);

  // Tactical analysis
  const myFormation = myClub.formation;
  const oppFormation = oppClub.formation;
  const myHint = FORMATION_HINTS[myFormation];
  const oppHint = FORMATION_HINTS[oppFormation];

  // Low-fitness lineup count
  const lineupIds = new Set(myClub.lineup);
  const lowFitnessInLineup = mySquad.filter(p => lineupIds.has(p.id) && p.fitness < 75 && !p.injured).length;

  // Formation labels
  const myLineup = myClub.lineup.map(id => players[id]).filter(Boolean);
  const oppLineup = oppClub.lineup.map(id => players[id]).filter(Boolean);

  // Chemistry links for pitch visualization
  const chemLinks = calculateChemistryLinks(myLineup, myClub.formation, season);

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
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

      {/* Formation Preview */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Your Formation: {myClub.formation}</h3>
          <button
            onClick={() => setScreen('tactics')}
            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-semibold"
          >
            <Pencil className="w-3 h-3" /> Edit Lineup
          </button>
        </div>
        <PitchView
          formation={myClub.formation}
          homeColor={myClub.color}
          homeLabels={myLineup.map(p => p.lastName.slice(0, 3).toUpperCase())}
          playerOveralls={myLineup.map(p => p.overall)}
          playerFitness={myLineup.map(p => Math.round(p.fitness))}
          playerIds={myLineup.map(p => p.id)}
          awayFormation={oppClub.formation}
          awayColor={oppClub.color}
          awayPlayerIds={oppClub.lineup}
          awayLabels={oppLineup.map(p => p.lastName.slice(0, 3).toUpperCase())}
          awayPlayerOveralls={oppLineup.map(p => p.overall)}
          showAway
          chemistryLinks={chemLinks}
        />
      </GlassPanel>

      {/* Ready Button */}
      <Button
        size="lg"
        className="w-full h-14 text-lg font-bold gap-3"
        onClick={() => setScreen('match')}
      >
        <Swords className="w-5 h-5" /> Ready to Play
      </Button>
    </div>
  );
};

export default MatchPrep;
