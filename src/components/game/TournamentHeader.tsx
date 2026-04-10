import { motion } from 'framer-motion';
import { Trophy, Shield, Award } from 'lucide-react';
import type { ContinentalCompetition } from '@/types/game';
import { cn } from '@/lib/utils';

interface TournamentHeaderProps {
  competition: ContinentalCompetition | 'league_cup' | 'super_cup';
  subtitle: string;
  winnerId?: string | null;
  winnerName?: string;
  playerEliminated?: boolean;
}

const COMP_CONFIG = {
  champions_cup: { name: 'Champions Cup', icon: Trophy, color: 'text-primary' },
  shield_cup: { name: 'Shield Cup', icon: Shield, color: 'text-accent' },
  conference_cup: { name: 'Conference Cup', icon: Award, color: 'text-emerald-400' },
  league_cup: { name: 'League Cup', icon: Award, color: 'text-emerald-400' },
  super_cup: { name: 'Super Cup', icon: Trophy, color: 'text-amber-400' },
};

export function TournamentHeader({ competition, subtitle, winnerId, winnerName, playerEliminated }: TournamentHeaderProps) {
  const config = COMP_CONFIG[competition];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3"
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-shadow', {
        'bg-primary/20': competition === 'champions_cup',
        'bg-accent/20': competition === 'shield_cup',
        'bg-emerald-400/20': competition === 'conference_cup' || competition === 'league_cup',
        'bg-amber-400/20': competition === 'super_cup',
        'shadow-[0_0_20px_rgba(234,179,8,0.15)]': !!winnerId,
        'opacity-50': playerEliminated && !winnerId,
      })}>
        {winnerId ? (
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
            <Icon className={cn('w-5 h-5', config.color)} />
          </motion.div>
        ) : (
          <Icon className={cn('w-5 h-5', config.color)} />
        )}
      </div>
      <div>
        <h1 className="text-lg font-display font-bold text-foreground">{config.name}</h1>
        <p className="text-xs text-muted-foreground">
          {winnerId
            ? `Winner: ${winnerName || 'Unknown'}`
            : playerEliminated
              ? 'You have been eliminated'
              : subtitle}
        </p>
      </div>
    </motion.div>
  );
}
