import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { Shield, Trophy } from 'lucide-react';
import { TournamentHeader } from '@/components/game/TournamentHeader';
import type { SuperCupMatch } from '@/types/game';

function SuperCupMatchCard({ match, clubs, playerClubId }: {
  match: SuperCupMatch;
  clubs: Record<string, { name: string; shortName: string; color: string }>;
  playerClubId: string;
}) {
  const home = clubs[match.homeClubId];
  const away = clubs[match.awayClubId];
  const isPlayer = match.homeClubId === playerClubId || match.awayClubId === playerClubId;

  return (
    <div className={cn(
      'bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-4',
      isPlayer && 'ring-1 ring-amber-400/40'
    )}>
      <div className="text-center text-[10px] text-muted-foreground mb-3 uppercase tracking-wider">
        {match.type === 'domestic' ? 'Domestic Super Cup' : 'Continental Super Cup'}
      </div>

      <div className="flex items-center gap-3">
        {/* Home */}
        <div className="flex-1 text-center">
          <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-1.5"
            style={{ backgroundColor: home?.color || '#888' }}>
            <Shield className="w-5 h-5 text-white" />
          </div>
          <p className={cn('text-sm font-medium truncate', match.homeClubId === playerClubId && 'text-primary')}>
            {home?.shortName || '???'}
          </p>
          <p className="text-[10px] text-muted-foreground">League Champion</p>
        </div>

        {/* Score */}
        <div className="text-center px-3">
          {match.played ? (
            <div>
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="text-2xl font-mono font-bold text-foreground inline-block"
              >
                {match.homeGoals} - {match.awayGoals}
              </motion.span>
              {match.penaltyShootout && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Pens: {match.penaltyShootout.home}-{match.penaltyShootout.away}
                </div>
              )}
            </div>
          ) : (
            <div>
              <span className="text-lg text-muted-foreground">vs</span>
              <div className="text-[10px] text-muted-foreground mt-0.5">Week {match.week}</div>
            </div>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 text-center">
          <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-1.5"
            style={{ backgroundColor: away?.color || '#888' }}>
            <Shield className="w-5 h-5 text-white" />
          </div>
          <p className={cn('text-sm font-medium truncate', match.awayClubId === playerClubId && 'text-primary')}>
            {away?.shortName || '???'}
          </p>
          <p className="text-[10px] text-muted-foreground">Cup Winner</p>
        </div>
      </div>

      {/* Winner */}
      {match.winnerId && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
          className="mt-3 text-center"
        >
          <div className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
            match.winnerId === playerClubId
              ? 'bg-primary/20 text-primary shadow-[0_0_16px_rgba(234,179,8,0.15)]'
              : 'bg-card text-foreground'
          )}>
            <Trophy className="w-3 h-3" />
            {clubs[match.winnerId]?.name || 'Winner'}
          </div>
        </motion.div>
      )}
    </div>
  );
}

const SuperCupPage = () => {
  const { domesticSuperCup, continentalSuperCup, clubs, playerClubId } = useGameStore(useShallow(s => ({
    domesticSuperCup: s.domesticSuperCup,
    continentalSuperCup: s.continentalSuperCup,
    clubs: s.clubs,
    playerClubId: s.playerClubId,
  })));

  const hasDomestic = !!domesticSuperCup;
  const hasContinental = !!continentalSuperCup;

  if (!hasDomestic && !hasContinental) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center text-muted-foreground py-12">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No Super Cup matches this season.</p>
        </div>
      </div>
    );
  }

  const cards = [domesticSuperCup, continentalSuperCup].filter(Boolean) as SuperCupMatch[];

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <TournamentHeader competition="super_cup" subtitle="Season opener" />

      {cards.map((match, i) => (
        <motion.div
          key={match.type}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <SuperCupMatchCard match={match} clubs={clubs} playerClubId={playerClubId} />
        </motion.div>
      ))}
    </div>
  );
};

export default SuperCupPage;
