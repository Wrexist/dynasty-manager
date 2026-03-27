import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getRoundName, ROUND_ORDER, CUP_BYE_MARKER } from '@/data/cup';
import { LEAGUE_CUP_WEEKS } from '@/config/continental';
import { TournamentHeader } from '@/components/game/TournamentHeader';
import { cn } from '@/lib/utils';
import { Shield, ChevronRight, ChevronDown, Calendar, Award } from 'lucide-react';
import type { CupRound, CupTie } from '@/types/game';

function TieCard({ tie, playerClubId, clubs }: { tie: CupTie; playerClubId: string; clubs: Record<string, { name: string; shortName: string; color: string }> }) {
  const home = clubs[tie.homeClubId];
  const away = clubs[tie.awayClubId];
  const isPlayerMatch = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
  const winnerId = tie.played
    ? (tie.winnerId || (tie.homeGoals > tie.awayGoals ? tie.homeClubId : tie.awayClubId))
    : null;

  return (
    <div className={cn(
      'bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-3',
      isPlayerMatch && 'ring-1 ring-emerald-400/40'
    )}>
      <div className="flex items-center gap-2">
        <div className={cn('flex-1 flex items-center gap-2', winnerId === tie.homeClubId && 'font-bold')}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: home?.color || '#888' }}>
            <Shield className="w-3 h-3 text-white" />
          </div>
          <span className={cn('text-sm truncate', tie.homeClubId === playerClubId ? 'text-primary' : 'text-foreground')}>
            {home?.shortName || '???'}
          </span>
        </div>
        <div className="flex items-center gap-1 px-2">
          {tie.played ? (
            <span className="text-sm font-mono font-bold text-foreground">
              {tie.homeGoals} - {tie.awayGoals}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">vs</span>
          )}
        </div>
        <div className={cn('flex-1 flex items-center gap-2 justify-end', winnerId === tie.awayClubId && 'font-bold')}>
          <span className={cn('text-sm truncate', tie.awayClubId === playerClubId ? 'text-primary' : 'text-foreground')}>
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
    </div>
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
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 w-full text-left">
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
        <h2 className={cn('text-sm font-display font-bold', isCurrent ? 'text-emerald-400' : allPlayed ? 'text-muted-foreground' : 'text-foreground')}>
          {getRoundName(round)}
        </h2>
        <span className="text-[10px] text-muted-foreground">{ties.length} {ties.length === 1 ? 'tie' : 'ties'}</span>
        {isCurrent && <span className="text-[10px] bg-emerald-400/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">Current</span>}
        {!allPlayed && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground ml-auto shrink-0">
            <Calendar className="w-2.5 h-2.5" />
            Week {roundWeek}
            {weeksAway > 0 && ` · in ${weeksAway}w`}
          </span>
        )}
      </button>
      {expanded && (
        <div className="space-y-2">
          {(isLargeRound && allPlayed && !isCurrent) ? (
            <>
              {playerTie && <TieCard tie={playerTie} playerClubId={playerClubId} clubs={clubs} />}
              <div className="text-xs text-muted-foreground px-3 py-2 bg-card/30 rounded-lg">
                {ties.filter(t => t.played).length} matches completed
              </div>
            </>
          ) : sortedTies.map(tie => (
            <TieCard key={tie.id} tie={tie} playerClubId={playerClubId} clubs={clubs} />
          ))}
        </div>
      )}
    </div>
  );
}

const LeagueCupPage = () => {
  const { leagueCup, clubs, playerClubId, week } = useGameStore();

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
      <TournamentHeader
        competition="league_cup"
        subtitle={leagueCup.currentRound ? `Current: ${getRoundName(leagueCup.currentRound)} · Week ${LEAGUE_CUP_WEEKS[leagueCup.currentRound]}` : 'Complete'}
        winnerId={leagueCup.winner}
        winnerName={winnerClub?.name}
        playerEliminated={leagueCup.eliminated}
      />

      {leagueCup.eliminated && !leagueCup.winner && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-center">
          <p className="text-sm text-destructive font-medium">Eliminated from the League Cup</p>
        </div>
      )}
      {leagueCup.winner === playerClubId && (
        <div className="bg-emerald-400/10 border border-emerald-400/30 rounded-xl p-3 text-center">
          <Award className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
          <p className="text-sm text-emerald-400 font-bold">League Cup Winners!</p>
        </div>
      )}

      {ROUND_ORDER.map((round) => {
        const ties = leagueCup.ties.filter(t => t.round === round && t.awayClubId !== CUP_BYE_MARKER);
        if (ties.length === 0) return null;
        const allPlayed = ties.every(t => t.played);
        const isCurrent = leagueCup.currentRound === round;
        const roundWeek = LEAGUE_CUP_WEEKS[round as CupRound];

        return (
          <RoundSection
            key={round}
            round={round as CupRound}
            ties={ties}
            playerClubId={playerClubId}
            clubs={clubs}
            isCurrent={isCurrent}
            allPlayed={allPlayed}
            currentWeek={week}
            roundWeek={roundWeek}
          />
        );
      })}
    </div>
  );
};

export default LeagueCupPage;
