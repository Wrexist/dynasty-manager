import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { getNation } from '@/data/nations';
import { cn } from '@/lib/utils';
import { Globe, Trophy, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

const InternationalTournament = () => {
  const { internationalTournament, managerNationality, seasonPhase, advanceWeek, setScreen } = useGameStore();

  if (!internationalTournament) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-bold text-foreground font-display mb-2">No Active Tournament</h2>
        <p className="text-sm text-muted-foreground">
          International tournaments take place every 2-4 seasons after the domestic season ends.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => setScreen('national-team')}>
          View National Team
        </Button>
      </div>
    );
  }

  const tournament = internationalTournament;
  const isInternationalPhase = seasonPhase === 'international';

  return (
    <div className="max-w-lg mx-auto px-4 py-5 pb-24 space-y-5">
      {/* Tournament header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-5"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-amber-500/5 to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground font-display">{tournament.name}</h1>
              <p className="text-sm text-muted-foreground">
                Phase: <span className="capitalize text-foreground">{tournament.phase}</span>
                {tournament.winner && ` — Winner: ${tournament.winner}`}
              </p>
            </div>
          </div>

          {isInternationalPhase && tournament.phase !== 'complete' && (
            <Button className="w-full mt-2" onClick={advanceWeek}>
              <Play className="w-4 h-4 mr-2" />
              Advance Tournament
            </Button>
          )}

          {tournament.phase === 'complete' && isInternationalPhase && (
            <Button className="w-full mt-2" onClick={advanceWeek}>
              Complete Tournament & Start New Season
            </Button>
          )}
        </div>
      </motion.div>

      {/* Group Stage */}
      {tournament.groups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-foreground px-1">Group Stage</h2>
          {tournament.groups.map((group) => (
            <div key={group.name} className="bg-card/40 backdrop-blur-xl border border-border/30 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-card/60 border-b border-border/20">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">{group.name}</h3>
              </div>

              {/* Table */}
              <div className="px-4 py-2">
                <div className="grid grid-cols-[1fr_24px_24px_24px_24px_40px_32px] gap-1 text-[10px] text-muted-foreground mb-1">
                  <span>Team</span>
                  <span className="text-center">P</span>
                  <span className="text-center">W</span>
                  <span className="text-center">D</span>
                  <span className="text-center">L</span>
                  <span className="text-center">GD</span>
                  <span className="text-center font-bold">Pts</span>
                </div>
                {group.table.map((entry, i) => {
                  const nation = getNation(entry.nationality);
                  const isPlayer = entry.nationality === managerNationality;
                  const qualifies = i < 2;
                  return (
                    <div
                      key={entry.nationality}
                      className={cn(
                        'grid grid-cols-[1fr_24px_24px_24px_24px_40px_32px] gap-1 py-1.5 text-xs items-center',
                        isPlayer && 'bg-primary/5 -mx-1 px-1 rounded',
                        qualifies && 'border-l-2 border-emerald-500/50',
                        !qualifies && 'border-l-2 border-transparent'
                      )}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <div
                          className="w-4 h-4 rounded shrink-0"
                          style={{ backgroundColor: nation?.color || '#555' }}
                        />
                        <span className={cn('truncate', isPlayer ? 'font-bold text-foreground' : 'text-foreground/80')}>
                          {entry.nationality}
                        </span>
                      </span>
                      <span className="text-center text-muted-foreground">{entry.played}</span>
                      <span className="text-center text-muted-foreground">{entry.won}</span>
                      <span className="text-center text-muted-foreground">{entry.drawn}</span>
                      <span className="text-center text-muted-foreground">{entry.lost}</span>
                      <span className="text-center text-muted-foreground">{entry.goalsFor - entry.goalsAgainst >= 0 ? '+' : ''}{entry.goalsFor - entry.goalsAgainst}</span>
                      <span className="text-center font-bold text-foreground">{entry.points}</span>
                    </div>
                  );
                })}
              </div>

              {/* Fixtures */}
              <div className="border-t border-border/20 px-4 py-2 space-y-1">
                {group.fixtures.map(fix => {
                  const homeNation = getNation(fix.homeNation);
                  const awayNation = getNation(fix.awayNation);
                  const isPlayerMatch = fix.homeNation === managerNationality || fix.awayNation === managerNationality;
                  return (
                    <div
                      key={fix.id}
                      className={cn(
                        'flex items-center justify-between py-1 text-xs',
                        isPlayerMatch && 'text-foreground font-medium',
                        !isPlayerMatch && 'text-muted-foreground'
                      )}
                    >
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: homeNation?.color || '#555' }} />
                        <span className="truncate">{fix.homeNation}</span>
                      </div>
                      <span className="font-mono px-2 shrink-0">
                        {fix.played ? `${fix.homeGoals} - ${fix.awayGoals}` : 'vs'}
                      </span>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                        <span className="truncate text-right">{fix.awayNation}</span>
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: awayNation?.color || '#555' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Knockout Stage */}
      {tournament.knockoutTies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-foreground px-1">Knockout Stage</h2>
          {(['R16', 'QF', 'SF', 'F'] as const).map(round => {
            const roundTies = tournament.knockoutTies.filter(t => t.round === round);
            if (roundTies.length === 0) return null;
            const roundLabel = round === 'R16' ? 'Round of 16' : round === 'QF' ? 'Quarter-Finals' : round === 'SF' ? 'Semi-Finals' : 'Final';
            return (
              <div key={round} className="bg-card/40 backdrop-blur-xl border border-border/30 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-card/60 border-b border-border/20">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">{roundLabel}</h3>
                </div>
                <div className="px-4 py-2 space-y-2">
                  {roundTies.map(tie => {
                    const homeNation = getNation(tie.homeNation);
                    const awayNation = getNation(tie.awayNation);
                    const isPlayerMatch = tie.homeNation === managerNationality || tie.awayNation === managerNationality;
                    const isWinner = (nation: string) => tie.winnerId === nation;
                    return (
                      <div
                        key={tie.id}
                        className={cn(
                          'flex items-center justify-between py-2 text-sm',
                          isPlayerMatch && 'bg-primary/5 -mx-2 px-2 rounded-lg'
                        )}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: homeNation?.color || '#555' }} />
                          <span className={cn(
                            'truncate',
                            isWinner(tie.homeNation) ? 'font-bold text-foreground' : 'text-foreground/70'
                          )}>
                            {tie.homeNation}
                          </span>
                        </div>
                        <span className="font-mono px-3 shrink-0 text-xs">
                          {tie.played ? (
                            <>
                              {tie.homeGoals} - {tie.awayGoals}
                              {tie.penaltyShootout && (
                                <span className="text-muted-foreground ml-1">
                                  (pen {tie.penaltyShootout.home}-{tie.penaltyShootout.away})
                                </span>
                              )}
                            </>
                          ) : 'vs'}
                        </span>
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className={cn(
                            'truncate text-right',
                            isWinner(tie.awayNation) ? 'font-bold text-foreground' : 'text-foreground/70'
                          )}>
                            {tie.awayNation}
                          </span>
                          <div className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: awayNation?.color || '#555' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tournament Winner */}
      {tournament.winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-primary/20 via-amber-500/10 to-transparent border border-primary/30 rounded-2xl p-5 text-center"
        >
          <Trophy className="w-10 h-10 text-primary mx-auto mb-2" />
          <h2 className="text-lg font-bold text-foreground font-display">{tournament.winner}</h2>
          <p className="text-sm text-primary">Champions!</p>
        </motion.div>
      )}

      {/* Navigation */}
      <Button variant="outline" className="w-full" onClick={() => setScreen('national-team')}>
        <Globe className="w-4 h-4 mr-2" />
        View National Team Squad
      </Button>
    </div>
  );
};

export default InternationalTournament;
