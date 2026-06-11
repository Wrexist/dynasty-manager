import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { getRoundName, ROUND_ORDER, CUP_BYE_MARKER } from '@/data/cup';
import { getCompetitionCalendar } from '@/config/continental';
import { TournamentHeader } from '@/components/game/TournamentHeader';
import { GlassPanel } from '@/components/game/GlassPanel';
import { cn } from '@/lib/utils';
import { Shield, ChevronRight, ChevronDown, Calendar, Award, Target } from 'lucide-react';
import type { CupRound, CupTie } from '@/types/game';
import { PageHint } from '@/components/game/PageHint';

function TieCard({ tie, playerClubId, clubs }: { tie: CupTie; playerClubId: string; clubs: Record<string, { name: string; shortName: string; color: string }> }) {
  const home = clubs[tie.homeClubId];
  const away = clubs[tie.awayClubId];
  const isPlayerMatch = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
  const winnerId = tie.played
    ? (tie.winnerId || (tie.homeGoals > tie.awayGoals ? tie.homeClubId : tie.awayClubId))
    : null;

  return (
    <GlassPanel className={cn('p-3', isPlayerMatch && 'ring-1 ring-cyan-400/40')}>
      <div className="flex items-center gap-2">
        <div className={cn('flex-1 flex items-center gap-2', winnerId === tie.homeClubId && 'font-bold')}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: home?.color || '#888' }}>
            <Shield className="w-3 h-3 text-white" />
          </div>
          <span className={cn(
            'text-sm truncate',
            tie.homeClubId === playerClubId ? 'text-primary' :
            winnerId && winnerId !== tie.homeClubId ? 'text-muted-foreground/60' : 'text-foreground'
          )}>
            {home?.shortName || '???'}
          </span>
        </div>
        <div className="flex items-center gap-1 px-2">
          {tie.played ? (
            <span className={cn(
              'text-sm font-mono font-bold',
              winnerId === tie.homeClubId ? 'text-cyan-400' : winnerId === tie.awayClubId ? 'text-foreground' : 'text-foreground'
            )}>
              {tie.homeGoals}
              <span className="text-muted-foreground mx-0.5">-</span>
              <span className={winnerId === tie.awayClubId ? 'text-cyan-400' : ''}>
                {tie.awayGoals}
              </span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">vs</span>
          )}
        </div>
        <div className={cn('flex-1 flex items-center gap-2 justify-end', winnerId === tie.awayClubId && 'font-bold')}>
          <span className={cn(
            'text-sm truncate',
            tie.awayClubId === playerClubId ? 'text-primary' :
            winnerId && winnerId !== tie.awayClubId ? 'text-muted-foreground/60' : 'text-foreground'
          )}>
            {away?.shortName || '???'}
          </span>
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: away?.color || '#888' }}>
            <Shield className="w-3 h-3 text-white" />
          </div>
        </div>
      </div>
      {tie.penaltyShootout && (
        <div className="text-[10px] text-center text-muted-foreground mt-1">
          Pens: {tie.penaltyShootout.home}-{tie.penaltyShootout.away}
        </div>
      )}
    </GlassPanel>
  );
}

function RoundSection({ round, ties, playerClubId, clubs, isCurrent, allPlayed, currentWeek, roundWeek }: {
  round: CupRound; ties: CupTie[]; playerClubId: string;
  clubs: Record<string, { name: string; shortName: string; color: string }>;
  isCurrent: boolean; allPlayed: boolean; currentWeek: number; roundWeek: number;
}) {
  const playerTie = ties.find(t => t.homeClubId === playerClubId || t.awayClubId === playerClubId);
  const isLargeRound = ties.length > 8;
  const [expanded, setExpanded] = useState(!allPlayed || isCurrent || !!playerTie);

  useEffect(() => {
    if (allPlayed && !isCurrent && !playerTie) setExpanded(false);
    if (isCurrent) setExpanded(true);
  }, [allPlayed, isCurrent, playerTie]);

  const sortedTies = playerTie ? [playerTie, ...ties.filter(t => t.id !== playerTie.id)] : ties;
  const weeksAway = roundWeek - currentWeek;

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 w-full text-left">
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
        <h2 className={cn('text-sm font-display font-bold', isCurrent ? 'text-cyan-400' : allPlayed ? 'text-muted-foreground' : 'text-foreground')}>
          {getRoundName(round)}
        </h2>
        <span className="text-[10px] text-muted-foreground">{ties.length} {ties.length === 1 ? 'tie' : 'ties'}</span>
        {isCurrent && <span className="text-[10px] bg-cyan-400/20 text-cyan-400 px-2 py-0.5 rounded-full font-medium">Current</span>}
        {!allPlayed && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground ml-auto shrink-0">
            <Calendar className="w-2.5 h-2.5" />
            Week {roundWeek}
            {weeksAway > 0 && ` · in ${weeksAway}w`}
          </span>
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-2">
              {(isLargeRound && allPlayed && !isCurrent) ? (
                <>
                  {playerTie && <TieCard tie={playerTie} playerClubId={playerClubId} clubs={clubs} />}
                  <div className="text-xs text-muted-foreground px-3 py-2 bg-card/30 rounded-lg">
                    {ties.filter(t => t.played).length} matches completed
                  </div>
                </>
              ) : sortedTies.map((tie, i) => (
                <motion.div
                  key={tie.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <TieCard tie={tie} playerClubId={playerClubId} clubs={clubs} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const LeagueCupPage = () => {
  const { leagueCup, clubs, playerClubId, week, totalWeeks } = useGameStore(useShallow(s => ({
    leagueCup: s.leagueCup,
    clubs: s.clubs,
    playerClubId: s.playerClubId,
    week: s.week,
    totalWeeks: s.totalWeeks,
  })));
  const leagueCupWeeks = getCompetitionCalendar(totalWeeks).leagueCupWeeks;

  const progressionText = useMemo(() => {
    if (!leagueCup || leagueCup.eliminated || leagueCup.winner) return null;
    const currentRound = leagueCup.currentRound;
    if (!currentRound) return null;
    const currentIdx = ROUND_ORDER.indexOf(currentRound);
    const finalIdx = ROUND_ORDER.indexOf('F');
    if (currentIdx < 0 || finalIdx < 0) return null;
    const winsToFinal = finalIdx - currentIdx;
    if (winsToFinal <= 0) return 'League Cup Final!';
    return `${getRoundName(currentRound)} — ${winsToFinal} win${winsToFinal > 1 ? 's' : ''} from the final`;
  }, [leagueCup]);

  if (!leagueCup || !leagueCup.ties.length) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center text-muted-foreground py-12">
          <Award className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No League Cup competition this season.</p>
        </div>
      </div>
    );
  }

  const winnerClub = leagueCup.winner ? clubs[leagueCup.winner] : null;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <PageHint
        screen="league-cup"
        title="League Cup"
        body="A knockout cup competition running alongside the league. Win each round to progress — ties are decided on the day with extra time and penalties if needed. Winning earns prize money and board confidence."
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <TournamentHeader
          competition="league_cup"
          subtitle={leagueCup.currentRound ? `Current: ${getRoundName(leagueCup.currentRound)} · Week ${leagueCupWeeks[leagueCup.currentRound]}` : 'Complete'}
          winnerId={leagueCup.winner}
          winnerName={winnerClub?.name}
          playerEliminated={leagueCup.eliminated}
        />
      </motion.div>

      {/* Progression indicator */}
      {progressionText && !leagueCup.eliminated && !leagueCup.winner && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-cyan-400/5 border border-cyan-400/20 rounded-xl p-2.5 flex items-center justify-center gap-2"
        >
          <Target className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <p className="text-xs text-cyan-400 font-medium">{progressionText}</p>
        </motion.div>
      )}

      {leagueCup.eliminated && !leagueCup.winner && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-center"
        >
          <p className="text-sm text-destructive font-medium">Eliminated from the League Cup</p>
        </motion.div>
      )}
      {leagueCup.winner === playerClubId && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="bg-gradient-to-br from-cyan-400/20 via-cyan-500/10 to-transparent border border-cyan-400/30 rounded-xl p-4 text-center shadow-[0_0_24px_rgba(52,211,153,0.15)]"
        >
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
            <Award className="w-8 h-8 text-cyan-400 mx-auto mb-1" />
          </motion.div>
          <p className="text-base text-cyan-400 font-bold font-display">League Cup Winners!</p>
        </motion.div>
      )}

      {ROUND_ORDER.map((round, i) => {
        const ties = leagueCup.ties.filter(t => t.round === round && t.awayClubId !== CUP_BYE_MARKER);
        if (ties.length === 0) return null;
        const allPlayed = ties.every(t => t.played);
        const isCurrent = leagueCup.currentRound === round;
        const roundWeek = leagueCupWeeks[round as CupRound];

        return (
          <motion.div
            key={round}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
          >
            <RoundSection
              round={round as CupRound}
              ties={ties}
              playerClubId={playerClubId}
              clubs={clubs}
              isCurrent={isCurrent}
              allPlayed={allPlayed}
              currentWeek={week}
              roundWeek={roundWeek}
            />
          </motion.div>
        );
      })}
    </div>
  );
};

export default LeagueCupPage;
