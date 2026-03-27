import type { ContinentalKnockoutTie, VirtualClub } from '@/types/game';
import { cn } from '@/lib/utils';
import { Shield, Trophy } from 'lucide-react';
import { getKnockoutRoundName } from '@/utils/continental';

interface KnockoutBracketProps {
  ties: ContinentalKnockoutTie[];
  virtualClubs: Record<string, VirtualClub>;
  playerClubId: string;
  clubs: Record<string, { name: string; shortName: string; color: string }>;
  currentRound: string | null;
  winnerId: string | null;
}

function getClubInfo(clubId: string, clubs: Record<string, { name: string; shortName: string; color: string }>, virtualClubs: Record<string, VirtualClub>) {
  const real = clubs[clubId];
  if (real) return { name: real.name, shortName: real.shortName, color: real.color };
  const vc = virtualClubs[clubId];
  if (vc) return { name: vc.name, shortName: vc.shortName, color: vc.color };
  return { name: 'Unknown', shortName: '???', color: '#888' };
}

function TieCard({ tie, virtualClubs, playerClubId, clubs }: {
  tie: ContinentalKnockoutTie;
  virtualClubs: Record<string, VirtualClub>;
  playerClubId: string;
  clubs: Record<string, { name: string; shortName: string; color: string }>;
}) {
  const home = getClubInfo(tie.homeClubId, clubs, virtualClubs);
  const away = getClubInfo(tie.awayClubId, clubs, virtualClubs);
  const isPlayer = tie.homeClubId === playerClubId || tie.awayClubId === playerClubId;
  const isFinal = tie.round === 'F';
  const isDecided = tie.winnerId !== null;

  // Aggregate for 2-leg ties
  const homeAgg = tie.leg1HomeGoals + (tie.leg2Played ? tie.leg2AwayGoals : 0);
  const awayAgg = tie.leg1AwayGoals + (tie.leg2Played ? tie.leg2HomeGoals : 0);

  return (
    <div className={cn(
      'bg-card/60 backdrop-blur-xl border rounded-xl p-2.5 space-y-1.5',
      isPlayer ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border/50',
      isDecided && !isPlayer && 'opacity-70',
    )}>
      {/* Home team */}
      <div className={cn('flex items-center gap-2', tie.winnerId === tie.homeClubId && 'font-bold')}>
        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: home.color }}>
          <Shield className="w-2.5 h-2.5 text-white" />
        </div>
        <span className={cn(
          'text-xs flex-1 truncate',
          tie.homeClubId === playerClubId ? 'text-primary' : 'text-foreground'
        )}>
          {home.shortName}
        </span>
        <div className="flex items-center gap-1 text-xs">
          {tie.leg1Played && <span className="font-mono text-muted-foreground">{tie.leg1HomeGoals}</span>}
          {tie.leg2Played && !isFinal && <span className="font-mono text-muted-foreground">{tie.leg2AwayGoals}</span>}
          {(tie.leg1Played || tie.leg2Played) && !isFinal && (
            <span className="font-mono font-bold text-foreground ml-1">({homeAgg})</span>
          )}
        </div>
      </div>

      {/* Away team */}
      <div className={cn('flex items-center gap-2', tie.winnerId === tie.awayClubId && 'font-bold')}>
        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: away.color }}>
          <Shield className="w-2.5 h-2.5 text-white" />
        </div>
        <span className={cn(
          'text-xs flex-1 truncate',
          tie.awayClubId === playerClubId ? 'text-primary' : 'text-foreground'
        )}>
          {away.shortName}
        </span>
        <div className="flex items-center gap-1 text-xs">
          {tie.leg1Played && <span className="font-mono text-muted-foreground">{tie.leg1AwayGoals}</span>}
          {tie.leg2Played && !isFinal && <span className="font-mono text-muted-foreground">{tie.leg2HomeGoals}</span>}
          {(tie.leg1Played || tie.leg2Played) && !isFinal && (
            <span className="font-mono font-bold text-foreground ml-1">({awayAgg})</span>
          )}
        </div>
      </div>

      {/* Penalty indicator */}
      {tie.penaltyShootout && (
        <div className="text-[10px] text-center text-muted-foreground">
          Pens: {tie.penaltyShootout.home}-{tie.penaltyShootout.away}
        </div>
      )}

      {/* Status */}
      {!tie.leg1Played && (
        <div className="text-[10px] text-center text-muted-foreground">
          Week {tie.week1}{!isFinal && ` & ${tie.week2}`}
        </div>
      )}
    </div>
  );
}

export function KnockoutBracket({ ties, virtualClubs, playerClubId, clubs, currentRound, winnerId }: KnockoutBracketProps) {
  const rounds: ('R16' | 'QF' | 'SF' | 'F')[] = ['R16', 'QF', 'SF', 'F'];

  return (
    <div className="space-y-4">
      {/* Tournament winner banner */}
      {winnerId && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 text-center">
          <Trophy className="w-6 h-6 text-primary mx-auto mb-1" />
          <p className="text-sm text-primary font-bold">
            {winnerId === playerClubId
              ? 'You Won!'
              : `Winner: ${getClubInfo(winnerId, clubs, virtualClubs).name}`}
          </p>
        </div>
      )}

      {rounds.map(round => {
        const roundTies = ties.filter(t => t.round === round);
        if (roundTies.length === 0) return null;

        const isCurrent = currentRound === round;
        const allDecided = roundTies.every(t => t.winnerId !== null);

        return (
          <div key={round} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className={cn(
                'text-sm font-display font-bold',
                isCurrent ? 'text-primary' : allDecided ? 'text-muted-foreground' : 'text-foreground'
              )}>
                {getKnockoutRoundName(round)}
              </h3>
              {isCurrent && (
                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Current</span>
              )}
              <span className="text-[10px] text-muted-foreground">{roundTies.length} {roundTies.length === 1 ? 'tie' : 'ties'}</span>
            </div>

            <div className={cn('grid gap-2', round === 'F' ? 'grid-cols-1' : 'grid-cols-2')}>
              {roundTies.map(tie => (
                <TieCard key={tie.id} tie={tie} virtualClubs={virtualClubs} playerClubId={playerClubId} clubs={clubs} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
