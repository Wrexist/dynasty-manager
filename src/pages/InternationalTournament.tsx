import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { FlagIcon } from '@/components/game/FlagIcon';
import { cn } from '@/lib/utils';
import { Globe, Trophy, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PAGE_HINTS } from '@/config/ui';
import { PageHint } from '@/components/game/PageHint';

const PHASE_STEPS = [
  { key: 'group', label: 'Groups' },
  { key: 'R16', label: 'R16' },
  { key: 'QF', label: 'QF' },
  { key: 'SF', label: 'SF' },
  { key: 'F', label: 'Final' },
] as const;

function getPhaseIndex(phase: string, currentRound: string | null): number {
  if (phase === 'group') return 0;
  if (phase === 'complete') return 4;
  const roundMap: Record<string, number> = { R16: 1, QF: 2, SF: 3, F: 4 };
  return roundMap[currentRound || ''] ?? 0;
}

function getAdvanceLabel(phase: string, currentRound: string | null): string {
  if (phase === 'group') return 'Play Next Matchday';
  if (phase === 'complete') return 'Complete Tournament & Start New Season';
  const roundNames: Record<string, string> = { R16: 'Round of 16', QF: 'Quarter-Finals', SF: 'Semi-Finals', F: 'Final' };
  return `Play ${roundNames[currentRound || ''] || 'Next Round'}`;
}

const InternationalTournament = () => {
  const internationalTournament = useGameStore((s) => s.internationalTournament);
  const managerNationality = useGameStore((s) => s.managerNationality);
  const seasonPhase = useGameStore((s) => s.seasonPhase);
  const advanceWeek = useGameStore((s) => s.advanceWeek);
  const setScreen = useGameStore((s) => s.setScreen);

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
  const phaseIndex = getPhaseIndex(tournament.phase, tournament.currentRound);

  return (
    <div className="max-w-lg mx-auto px-4 py-5 pb-24 space-y-5">
      <PageHint screen="internationalTournament" title={PAGE_HINTS.internationalTournament.title} body={PAGE_HINTS.internationalTournament.body} />

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

          {/* Phase progress bar */}
          <div className="flex items-center gap-1 mb-3">
            {PHASE_STEPS.map((step, i) => (
              <div key={step.key} className="flex items-center flex-1">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    'flex flex-col items-center flex-1',
                  )}
                >
                  <div className={cn(
                    'w-full h-1.5 rounded-full transition-colors',
                    i <= phaseIndex ? 'bg-primary' : 'bg-border/40',
                    i === phaseIndex && tournament.phase !== 'complete' && 'animate-pulse'
                  )} />
                  <span className={cn(
                    'text-[9px] mt-1 font-medium',
                    i <= phaseIndex ? 'text-primary' : 'text-muted-foreground/50'
                  )}>
                    {step.label}
                  </span>
                </motion.div>
              </div>
            ))}
          </div>

          {isInternationalPhase && tournament.phase !== 'complete' && (
            <Button className="w-full mt-2" onClick={advanceWeek}>
              <Play className="w-4 h-4 mr-2" />
              {getAdvanceLabel(tournament.phase, tournament.currentRound)}
            </Button>
          )}

          {tournament.phase === 'complete' && isInternationalPhase && (
            <Button className="w-full mt-2" onClick={advanceWeek}>
              {getAdvanceLabel(tournament.phase, tournament.currentRound)}
            </Button>
          )}
        </div>
      </motion.div>

      {/* Group Stage */}
      {tournament.groups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-foreground px-1">Group Stage</h2>
          {tournament.groups.map((group, gi) => {
            const allPlayed = group.fixtures.every(f => f.played);
            return (
            <motion.div
              key={group.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + gi * 0.1 }}
              className="bg-card/40 backdrop-blur-xl border border-border/30 rounded-xl overflow-hidden"
            >
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
                  const isPlayer = entry.nationality === managerNationality;
                  const qualifies = i < 2;
                  return (
                    <motion.div
                      key={entry.nationality}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + gi * 0.1 + i * 0.05 }}
                      className={cn(
                        'grid grid-cols-[1fr_24px_24px_24px_24px_40px_32px] gap-1 py-1.5 text-xs items-center',
                        isPlayer && 'bg-primary/5 -mx-1 px-1 rounded',
                        qualifies && 'border-l-2 border-emerald-500/50',
                        !qualifies && 'border-l-2 border-transparent'
                      )}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <FlagIcon nationality={entry.nationality} size={14} />
                        <span className={cn('truncate', isPlayer ? 'font-bold text-foreground' : 'text-foreground/80')}>
                          {entry.nationality}
                        </span>
                        {allPlayed && (
                          <span className={cn(
                            'text-[8px] font-bold px-1 py-0.5 rounded shrink-0',
                            qualifies ? 'bg-emerald-500/20 text-emerald-400' : 'bg-destructive/20 text-destructive'
                          )}>
                            {qualifies ? 'Q' : 'E'}
                          </span>
                        )}
                      </span>
                      <span className="text-center text-muted-foreground">{entry.played}</span>
                      <span className="text-center text-muted-foreground">{entry.won}</span>
                      <span className="text-center text-muted-foreground">{entry.drawn}</span>
                      <span className="text-center text-muted-foreground">{entry.lost}</span>
                      <span className="text-center text-muted-foreground">{entry.goalsFor - entry.goalsAgainst >= 0 ? '+' : ''}{entry.goalsFor - entry.goalsAgainst}</span>
                      <span className="text-center font-bold text-foreground">{entry.points}</span>
                    </motion.div>
                  );
                })}
              </div>

              {/* Fixtures */}
              <div className="border-t border-border/20 px-4 py-2 space-y-1">
                {group.fixtures.map(fix => {
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
                        <FlagIcon nationality={fix.homeNation} size={14} />
                        <span className="truncate">{fix.homeNation}</span>
                      </div>
                      <span className="font-mono px-2 shrink-0">
                        {fix.played ? `${fix.homeGoals} - ${fix.awayGoals}` : 'vs'}
                      </span>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                        <span className="truncate text-right">{fix.awayNation}</span>
                        <FlagIcon nationality={fix.awayNation} size={14} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
            );
          })}

        </div>
      )}

      {/* Knockout Stage */}
      {tournament.knockoutTies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-foreground px-1">Knockout Stage</h2>
          {(['R16', 'QF', 'SF', 'F'] as const).map((round, ri) => {
            const roundTies = tournament.knockoutTies.filter(t => t.round === round);
            if (roundTies.length === 0) return null;
            const roundLabel = round === 'R16' ? 'Round of 16' : round === 'QF' ? 'Quarter-Finals' : round === 'SF' ? 'Semi-Finals' : 'Final';
            return (
              <motion.div
                key={round}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + ri * 0.1 }}
                className="bg-card/40 backdrop-blur-xl border border-border/30 rounded-xl overflow-hidden"
              >
                <div className="px-4 py-2.5 bg-card/60 border-b border-border/20 flex items-center gap-2">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">{roundLabel}</h3>
                  {tournament.currentRound === round && tournament.phase !== 'complete' && (
                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Current</span>
                  )}
                </div>
                <div className="px-4 py-2 space-y-2">
                  {roundTies.map((tie, ti) => {
                    const isPlayerMatch = tie.homeNation === managerNationality || tie.awayNation === managerNationality;
                    const isWinner = (nation: string) => tie.winnerId === nation;
                    return (
                      <motion.div
                        key={tie.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + ri * 0.1 + ti * 0.05 }}
                        className={cn(
                          'flex items-center justify-between py-2 text-sm',
                          isPlayerMatch && 'bg-primary/5 -mx-2 px-2 rounded-lg'
                        )}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FlagIcon nationality={tie.homeNation} size={16} />
                          <span className={cn(
                            'truncate',
                            isWinner(tie.homeNation) ? 'font-bold text-foreground' :
                            tie.winnerId && !isWinner(tie.homeNation) ? 'text-foreground/50' : 'text-foreground/70'
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
                            isWinner(tie.awayNation) ? 'font-bold text-foreground' :
                            tie.winnerId && !isWinner(tie.awayNation) ? 'text-foreground/50' : 'text-foreground/70'
                          )}>
                            {tie.awayNation}
                          </span>
                          <FlagIcon nationality={tie.awayNation} size={16} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Tournament Winner */}
      {tournament.winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="bg-gradient-to-br from-primary/20 via-amber-500/10 to-transparent border border-primary/30 rounded-2xl p-5 text-center shadow-[0_0_30px_rgba(234,179,8,0.15)]"
        >
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
            <Trophy className="w-10 h-10 text-primary mx-auto mb-2" />
          </motion.div>
          <h2 className="text-lg font-bold text-foreground font-display">
            <FlagIcon nationality={tournament.winner} size={20} /> {tournament.winner}
          </h2>
          <p className="text-sm text-primary font-medium">
            {tournament.winner === managerNationality ? 'Your Nation — Champions!' : 'Champions!'}
          </p>
        </motion.div>
      )}

      {/* Player eliminated banner */}
      {tournament.playerEliminated && !tournament.winner && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-center"
        >
          <p className="text-sm text-destructive font-medium">Your nation has been eliminated</p>
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
