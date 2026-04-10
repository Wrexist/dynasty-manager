import type { ContinentalKnockoutTie, ContinentalCompetition, VirtualClub } from '@/types/game';
import { cn } from '@/lib/utils';
import { Shield, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { getKnockoutRoundName } from '@/utils/continental';

const COMP_COLORS: Record<string, { text: string; bg: string; gradient: string; ring: string; badge: string }> = {
  champions_cup: { text: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/30', gradient: 'bg-gradient-to-br from-blue-400/20 via-blue-500/10 to-transparent border-blue-400/30 shadow-[0_0_24px_rgba(96,165,250,0.15)]', ring: 'border-blue-400/40 ring-1 ring-blue-400/20', badge: 'bg-blue-400/20 text-blue-400' },
  shield_cup: { text: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/30', gradient: 'bg-gradient-to-br from-orange-400/20 via-orange-500/10 to-transparent border-orange-400/30 shadow-[0_0_24px_rgba(251,146,60,0.15)]', ring: 'border-orange-400/40 ring-1 ring-orange-400/20', badge: 'bg-orange-400/20 text-orange-400' },
  conference_cup: { text: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30', gradient: 'bg-gradient-to-br from-emerald-400/20 via-emerald-500/10 to-transparent border-emerald-400/30 shadow-[0_0_24px_rgba(52,211,153,0.15)]', ring: 'border-emerald-400/40 ring-1 ring-emerald-400/20', badge: 'bg-emerald-400/20 text-emerald-400' },
};

interface KnockoutBracketProps {
  ties: ContinentalKnockoutTie[];
  virtualClubs: Record<string, VirtualClub>;
  playerClubId: string;
  clubs: Record<string, { name: string; shortName: string; color: string }>;
  currentRound: string | null;
  winnerId: string | null;
  competition?: ContinentalCompetition;
}

function getClubInfo(clubId: string, clubs: Record<string, { name: string; shortName: string; color: string }>, virtualClubs: Record<string, VirtualClub>) {
  const real = clubs[clubId];
  if (real) return { name: real.name, shortName: real.shortName, color: real.color };
  const vc = virtualClubs[clubId];
  if (vc) return { name: vc.name, shortName: vc.shortName, color: vc.color };
  return { name: 'Unknown', shortName: '???', color: '#888' };
}

function TieCard({ tie, virtualClubs, playerClubId, clubs, compRing }: {
  tie: ContinentalKnockoutTie;
  virtualClubs: Record<string, VirtualClub>;
  playerClubId: string;
  clubs: Record<string, { name: string; shortName: string; color: string }>;
  compRing: string;
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
      isPlayer ? compRing : 'border-border/50',
      isDecided && !isPlayer && 'opacity-70',
    )}>
      {/* Home team */}
      <div className={cn('flex items-center gap-2', tie.winnerId === tie.homeClubId && 'font-bold')}>
        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: home.color }}>
          <Shield className="w-2.5 h-2.5 text-white" />
        </div>
        <span className={cn(
          'text-xs flex-1 truncate',
          tie.homeClubId === playerClubId ? 'text-primary' :
          isDecided && tie.winnerId !== tie.homeClubId ? 'text-muted-foreground/60' : 'text-foreground'
        )}>
          {home.shortName}
        </span>
        <div className="flex items-center gap-1 text-xs">
          {tie.leg1Played && <span className="font-mono text-muted-foreground">{tie.leg1HomeGoals}</span>}
          {tie.leg2Played && !isFinal && <span className="font-mono text-muted-foreground">{tie.leg2AwayGoals}</span>}
          {(tie.leg1Played || tie.leg2Played) && !isFinal && (
            <span className={cn('font-mono font-bold ml-1', tie.winnerId === tie.homeClubId ? 'text-emerald-400' : 'text-foreground')}>({homeAgg})</span>
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
          tie.awayClubId === playerClubId ? 'text-primary' :
          isDecided && tie.winnerId !== tie.awayClubId ? 'text-muted-foreground/60' : 'text-foreground'
        )}>
          {away.shortName}
        </span>
        <div className="flex items-center gap-1 text-xs">
          {tie.leg1Played && <span className="font-mono text-muted-foreground">{tie.leg1AwayGoals}</span>}
          {tie.leg2Played && !isFinal && <span className="font-mono text-muted-foreground">{tie.leg2HomeGoals}</span>}
          {(tie.leg1Played || tie.leg2Played) && !isFinal && (
            <span className={cn('font-mono font-bold ml-1', tie.winnerId === tie.awayClubId ? 'text-emerald-400' : 'text-foreground')}>({awayAgg})</span>
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

export function KnockoutBracket({ ties, virtualClubs, playerClubId, clubs, currentRound, winnerId, competition }: KnockoutBracketProps) {
  const rounds: ('R16' | 'QF' | 'SF' | 'F')[] = ['R16', 'QF', 'SF', 'F'];
  const cc = COMP_COLORS[competition || 'champions_cup'];

  return (
    <div className="space-y-4">
      {/* Tournament winner banner */}
      {winnerId && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={cn(
            'rounded-xl p-4 text-center border',
            winnerId === playerClubId ? cc.gradient : cc.bg
          )}
        >
          <motion.div animate={winnerId === playerClubId ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
            <Trophy className={cn('w-7 h-7 mx-auto mb-1', cc.text)} />
          </motion.div>
          <p className={cn('text-sm font-bold', cc.text)}>
            {winnerId === playerClubId
              ? 'You Won!'
              : `Winner: ${getClubInfo(winnerId, clubs, virtualClubs).name}`}
          </p>
        </motion.div>
      )}

      {rounds.map((round, roundIdx) => {
        const roundTies = ties.filter(t => t.round === round);
        if (roundTies.length === 0) return null;

        const isCurrent = currentRound === round;
        const allDecided = roundTies.every(t => t.winnerId !== null);

        return (
          <motion.div
            key={round}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: roundIdx * 0.1 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              <h3 className={cn(
                'text-sm font-display font-bold',
                isCurrent ? cc.text : allDecided ? 'text-muted-foreground' : 'text-foreground'
              )}>
                {getKnockoutRoundName(round)}
              </h3>
              {isCurrent && (
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', cc.badge)}>Current</span>
              )}
              <span className="text-[10px] text-muted-foreground">{roundTies.length} {roundTies.length === 1 ? 'tie' : 'ties'}</span>
            </div>

            <div className={cn('grid gap-2', round === 'F' ? 'grid-cols-1' : 'grid-cols-2')}>
              {roundTies.map((tie, tieIdx) => (
                <motion.div
                  key={tie.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: roundIdx * 0.1 + tieIdx * 0.05 }}
                >
                  <TieCard tie={tie} virtualClubs={virtualClubs} playerClubId={playerClubId} clubs={clubs} compRing={cc.ring} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
