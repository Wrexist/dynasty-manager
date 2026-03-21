import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getRoundName, ROUND_ORDER, CUP_BYE_MARKER } from '@/data/cup';
import { cn } from '@/lib/utils';
import { Trophy, Shield, ChevronRight, ChevronDown } from 'lucide-react';
import type { CupRound, CupTie } from '@/types/game';

function TieCard({ tie, playerClubId, clubs }: { tie: CupTie; playerClubId: string; clubs: Record<string, { name: string; shortName: string; color: string }> }) {
  const home = clubs[tie.homeClubId];
  const away = clubs[tie.awayClubId];
  const isPlayerMatch = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
  const winnerId = tie.played ? (tie.homeGoals > tie.awayGoals ? tie.homeClubId : tie.awayClubId) : null;

  return (
    <div className={cn(
      'bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-3',
      isPlayerMatch && 'ring-1 ring-primary/40'
    )}>
      <div className="flex items-center gap-2">
        {/* Home */}
        <div className={cn('flex-1 flex items-center gap-2', winnerId === tie.homeClubId && 'font-bold')}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: home?.color || '#888' }}>
            <Shield className="w-3 h-3 text-white" />
          </div>
          <span className={cn(
            'text-sm truncate',
            tie.homeClubId === playerClubId ? 'text-primary' : 'text-foreground'
          )}>
            {home?.shortName || '???'}
          </span>
        </div>

        {/* Score */}
        <div className="flex items-center gap-1 px-2">
          {tie.played ? (
            <span className="text-sm font-mono font-bold text-foreground">
              {tie.homeGoals} - {tie.awayGoals}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">vs</span>
          )}
        </div>

        {/* Away */}
        <div className={cn('flex-1 flex items-center gap-2 justify-end', winnerId === tie.awayClubId && 'font-bold')}>
          <span className={cn(
            'text-sm truncate',
            tie.awayClubId === playerClubId ? 'text-primary' : 'text-foreground'
          )}>
            {away?.shortName || '???'}
          </span>
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: away?.color || '#888' }}>
            <Shield className="w-3 h-3 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

function RoundSection({ round, ties, playerClubId, clubs, isCurrent, allPlayed }: {
  round: CupRound;
  ties: CupTie[];
  playerClubId: string;
  clubs: Record<string, { name: string; shortName: string; color: string }>;
  isCurrent: boolean;
  allPlayed: boolean;
}) {
  // Auto-expand current round and rounds with player matches; collapse completed large rounds
  const playerTie = ties.find(t => t.homeClubId === playerClubId || t.awayClubId === playerClubId);
  const isLargeRound = ties.length > 8;
  const [expanded, setExpanded] = useState(!allPlayed || isCurrent || !!playerTie);

  // Update expanded when round state changes (e.g. round completes)
  useEffect(() => {
    if (allPlayed && !isCurrent && !playerTie) setExpanded(false);
    if (isCurrent) setExpanded(true);
  }, [allPlayed, isCurrent, playerTie]);

  // Player's match always shown at top
  const sortedTies = playerTie
    ? [playerTie, ...ties.filter(t => t.id !== playerTie.id)]
    : ties;

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
      </button>

      {expanded && (
        <div className="space-y-2">
          {(isLargeRound && allPlayed && !isCurrent)
            ? (
              <>
                {/* Show player's match prominently, then compact summary */}
                {playerTie && (
                  <TieCard tie={playerTie} playerClubId={playerClubId} clubs={clubs} />
                )}
                <div className="text-xs text-muted-foreground px-3 py-2 bg-card/30 rounded-lg">
                  {ties.filter(t => t.played).length} matches completed
                  {playerTie && ` · Your result: ${playerTie.homeGoals}-${playerTie.awayGoals}`}
                </div>
              </>
            )
            : sortedTies.map(tie => (
              <TieCard key={tie.id} tie={tie} playerClubId={playerClubId} clubs={clubs} />
            ))
          }
        </div>
      )}
    </div>
  );
}

const CupPage = () => {
  const { cup, clubs, playerClubId } = useGameStore();

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
      {/* Header */}
      <div className="flex items-center gap-3">
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
                  ? `Current: ${getRoundName(cup.currentRound)}`
                  : 'Complete'}
          </p>
        </div>
      </div>

      {/* Your status banner */}
      {playerEliminated && !cupWinner && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-center">
          <p className="text-sm text-destructive font-medium">Eliminated from the cup</p>
        </div>
      )}
      {cupWinner === playerClubId && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 text-center">
          <Trophy className="w-6 h-6 text-primary mx-auto mb-1" />
          <p className="text-sm text-primary font-bold">Cup Winners!</p>
        </div>
      )}

      {/* Rounds — filter out bye ties from display */}
      {ROUND_ORDER.map((round) => {
        const ties = cup.ties.filter(t => t.round === round && t.awayClubId !== CUP_BYE_MARKER);
        if (ties.length === 0) return null;

        const allPlayed = ties.every(t => t.played);
        const isCurrent = cup.currentRound === round;

        return (
          <RoundSection
            key={round}
            round={round as CupRound}
            ties={ties}
            playerClubId={playerClubId}
            clubs={clubs}
            isCurrent={isCurrent}
            allPlayed={allPlayed}
          />
        );
      })}
    </div>
  );
};

export default CupPage;
