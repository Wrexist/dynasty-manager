import type { Player } from '@/types/game';
import { useGameStore } from '@/store/gameStore';

/** Ownership stays with the parent; the displayed club is only the borrower. */
export function LoanOwnership({ player }: { player: Player }) {
  const parent = useGameStore(s => s.clubs[player.loanFromClubId ?? '']?.name);
  const borrower = useGameStore(s => s.clubs[player.clubId]?.name);
  const loan = useGameStore(s => s.activeLoans.find(l => l.playerId === player.id));
  const seasonWeeks = useGameStore(s => s.totalWeeks);
  if (!player.onLoan) return null;
  const endWeek = loan ? loan.startWeek + loan.durationWeeks : null;
  return (
    <div className="mb-3 rounded-lg border border-sky-400/30 bg-sky-400/10 p-3 text-sm">
      <p className="font-semibold text-sky-300">On loan from {parent || 'parent club'}</p>
      <p className="text-muted-foreground">Contract held by {parent || 'the parent club'}. Playing temporarily for {borrower || 'the borrowing club'}.</p>
      {loan && <p className="text-muted-foreground">Scheduled return: {endWeek! >= seasonWeeks ? `end of Season ${loan.startSeason}` : `Season ${loan.startSeason}, Week ${endWeek}`}.</p>}
    </div>
  );
}
