import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { getRoundName, getCupWeek, ROUND_ORDER, CUP_BYE_MARKER } from '@/data/cup';
import { cn } from '@/lib/utils';
import { Trophy, Shield, ChevronRight, ChevronDown, Calendar, Target } from 'lucide-react';
import type { CupRound, CupTie } from '@/types/game';
import { PAGE_HINTS } from '@/config/ui';
import { PageHint } from '@/components/game/PageHint';
import { GlassPanel } from '@/components/game/GlassPanel';

function TieCard({ tie, playerClubId, clubs }: { tie: CupTie; playerClubId: string; clubs: Record<string, { name: string; shortName: string; color: string }> }) {
  const home = clubs[tie.homeClubId];
  const away = clubs[tie.awayClubId];
  const isPlayerMatch = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
  // Legacy fallback for played ties without winnerId: only highlight a winner
  // when the score actually decides one — a level score used to (wrongly)
  // name the away team the winner.
  const winnerId = tie.played
    ? (tie.winnerId || (tie.homeGoals > tie.awayGoals ? tie.homeClubId
        : tie.awayGoals > tie.homeGoals ? tie.awayClubId : null))
    : null;

  return (
    <GlassPanel className={cn('p-3', isPlayerMatch && 'ring-1 ring-primary/40')}>
      <div className="flex items-center gap-2">
        {/* Home */}
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

        {/* Score */}
        <div className="flex items-center gap-1 px-2">
          {tie.played ? (
            <span className={cn(
              'text-sm font-mono font-bold',
              winnerId === tie.homeClubId ? 'text-emerald-400' : winnerId === tie.awayClubId ? 'text-foreground' : 'text-foreground'
            )}>
              {tie.homeGoals}
              <span className="text-muted-foreground mx-0.5">-</span>
              <span className={winnerId === tie.awayClubId ? 'text-emerald-400' : ''}>
                {tie.awayGoals}
              </span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">vs</span>
          )}
        </div>

        {/* Away */}
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
  round: CupRound;
  ties: CupTie[];
  playerClubId: string;
  clubs: Record<string, { name: string; shortName: string; color: string }>;
  isCurrent: boolean;
  allPlayed: boolean;
  currentWeek: number;
  roundWeek: number;
}) {
  const playerTie = ties.find(t => t.homeClubId === playerClubId || t.awayClubId === playerClubId);
  const isLargeRound = ties.length > 8;
  const [expanded, setExpanded] = useState(!allPlayed || isCurrent || !!playerTie);

  useEffect(() => {
    if (allPlayed && !isCurrent && !playerTie) setExpanded(false);
    if (isCurrent) setExpanded(true);
  }, [allPlayed, isCurrent, playerTie]);

  const sortedTies = playerTie
    ? [playerTie, ...ties.filter(t => t.id !== playerTie.id)]
    : ties;

  const weeksAway = roundWeek - currentWeek;
  const isUpcoming = !allPlayed && weeksAway > 0;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
        )}
        <h2 className={cn(
          'text-sm font-display font-bold',
          isCurrent ? 'text-primary' : allPlayed ? 'text-muted-foreground' : 'text-foreground'
        )}>
          {getRoundName(round)}
        </h2>
        <span className="text-[10px] text-muted-foreground">
          {ties.length} {ties.length === 1 ? 'tie' : 'ties'}
        </span>
        {isCurrent && (
          <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
            Current
          </span>
        )}
        {!allPlayed && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground ml-auto shrink-0">
            <Calendar className="w-2.5 h-2.5" />
            Week {roundWeek}
            {isUpcoming && ` · in ${weeksAway}w`}
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
              {(isLargeRound && allPlayed && !isCurrent)
                ? (
                  <>
                    {playerTie && (
                      <TieCard tie={playerTie} playerClubId={playerClubId} clubs={clubs} />
                    )}
                    <div className="text-xs text-muted-foreground px-3 py-2 bg-card/30 rounded-lg">
                      {ties.filter(t => t.played).length} matches completed
                      {playerTie && ` · Your result: ${playerTie.homeGoals}-${playerTie.awayGoals}`}
                    </div>
                  </>
                )
                : sortedTies.map((tie, i) => (
                  <motion.div
                    key={tie.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <TieCard tie={tie} playerClubId={playerClubId} clubs={clubs} />
                  </motion.div>
                ))
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const CupPage = () => {
  const { cup, clubs, playerClubId, week, totalWeeks } = useGameStore(useShallow(s => ({
    cup: s.cup,
    clubs: s.clubs,
    playerClubId: s.playerClubId,
    week: s.week,
    totalWeeks: s.totalWeeks,
  })));

  // Progression indicator: count rounds remaining to the final
  const progressionText = useMemo(() => {
    if (!cup || cup.eliminated || cup.winner) return null;
    const currentRound = cup.currentRound;
    if (!currentRound) return null;
    const currentIdx = ROUND_ORDER.indexOf(currentRound);
    const finalIdx = ROUND_ORDER.indexOf('F');
    if (currentIdx < 0 || finalIdx < 0) return null;
    const winsToFinal = finalIdx - currentIdx;
    if (winsToFinal <= 0) return 'Cup Final!';
    return `${getRoundName(currentRound)} — ${winsToFinal} win${winsToFinal > 1 ? 's' : ''} from the final`;
  }, [cup]);

  if (!cup || !cup.ties.length) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center text-muted-foreground py-12">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No cup competition this season.</p>
        </div>
      </div>
    );
  }

  const playerEliminated = cup.eliminated;
  const cupWinner = cup.winner;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <PageHint screen="cup" title={PAGE_HINTS.cup.title} body={PAGE_HINTS.cup.body} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-display font-bold text-foreground">Dynasty Cup</h1>
          <p className="text-xs text-muted-foreground">
            {cupWinner
              ? `Winner: ${clubs[cupWinner]?.name || 'Unknown'}`
              : playerEliminated
                ? 'You have been eliminated'
                : cup.currentRound
                  ? `Current: ${getRoundName(cup.currentRound)} · Week ${getCupWeek(cup.currentRound, totalWeeks)}`
                  : 'Complete'}
          </p>
        </div>
      </motion.div>

      {/* Progression indicator */}
      {progressionText && !playerEliminated && !cupWinner && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 flex items-center justify-center gap-2"
        >
          <Target className="w-3.5 h-3.5 text-primary shrink-0" />
          <p className="text-xs text-primary font-medium">{progressionText}</p>
        </motion.div>
      )}

      {/* Your status banner */}
      {playerEliminated && !cupWinner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-center"
        >
          <p className="text-sm text-destructive font-medium">Eliminated from the cup</p>
        </motion.div>
      )}
      {cupWinner === playerClubId && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="bg-gradient-to-br from-primary/20 via-amber-500/10 to-transparent border border-primary/30 rounded-xl p-4 text-center shadow-[0_0_24px_rgba(234,179,8,0.15)]"
        >
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
            <Trophy className="w-8 h-8 text-primary mx-auto mb-1" />
          </motion.div>
          <p className="text-base text-primary font-bold font-display">Cup Winners!</p>
        </motion.div>
      )}

      {/* Rounds */}
      {ROUND_ORDER.map((round, i) => {
        const ties = cup.ties.filter(t => t.round === round && t.awayClubId !== CUP_BYE_MARKER);
        if (ties.length === 0) return null;

        const allPlayed = ties.every(t => t.played);
        const isCurrent = cup.currentRound === round;
        const roundWeek = getCupWeek(round as CupRound, totalWeeks);

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

export default CupPage;
