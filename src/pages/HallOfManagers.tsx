import { useState, useEffect } from 'react';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Trophy, Star, Crown, Medal, Award, Diamond, Flame, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { loadHall, type HallEntry } from '@/utils/hallOfManagers';
import { useGameStore } from '@/store/gameStore';
import { isPro, getActiveCosmetic } from '@/utils/monetization';
import { PageHint } from '@/components/game/PageHint';

const PRESTIGE_BADGE_ICONS: Record<string, React.ElementType> = {
  'prestige-crown': Crown,
  'prestige-laurel': Award,
  'prestige-diamond': Diamond,
  'prestige-phoenix': Flame,
  'prestige-shield': Shield,
  'prestige-flame': Flame,
};

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Crown className="w-5 h-5 text-primary" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-[#C0C0C0]" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-[#CD7F32]" />;
  return <span className="text-xs font-bold text-muted-foreground w-5 text-center">{rank}</span>;
};

const HallOfManagers = () => {
  const monetization = useGameStore(s => s.monetization);
  const [entries, setEntries] = useState<HallEntry[]>([]);
  const userIsPro = isPro(monetization);
  const homFrame = getActiveCosmetic(monetization, 'hom_frame');
  const prestigeBadgeId = getActiveCosmetic(monetization, 'prestige_badge');
  const BadgeIcon = (prestigeBadgeId && PRESTIGE_BADGE_ICONS[prestigeBadgeId]) || Star;

  useEffect(() => {
    setEntries(loadHall());
  }, []);

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <PageHint
        screen="hall-of-managers"
        title="Hall of Managers"
        body="The ultimate leaderboard — your best careers ranked by legacy score. Points come from trophies, promotions, longevity, and prestige. Each save contributes to this permanent record."
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center mb-4">
          <Trophy className="w-10 h-10 text-primary mx-auto mb-2" />
          <h2 className="text-xl font-black text-foreground font-display">Hall of Managers</h2>
          <p className="text-xs text-muted-foreground mt-1">Your greatest careers across all saves</p>
        </div>

        {entries.length === 0 ? (
          <GlassPanel className="p-8 text-center">
            <Star className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No records yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Complete a season to be recorded here.</p>
          </GlassPanel>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <GlassPanel className={cn(
                  'p-4',
                  i === 0 && 'border-primary/40 bg-primary/5',
                  homFrame === 'hom-frame-gold' && 'border-primary/60 shadow-[0_0_12px_hsl(43_96%_46%/0.15)]',
                  homFrame === 'hom-frame-holographic' && 'border-accent/60 shadow-[0_0_12px_hsl(215_60%_50%/0.2)]',
                )}>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8">
                      {getRankIcon(i + 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground truncate">{entry.clubName}</p>
                        {userIsPro && <Crown className="w-3 h-3 text-primary shrink-0" />}
                        {entry.prestigeLevel > 0 && (
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: Math.min(entry.prestigeLevel, 5) }).map((_, j) => (
                              <BadgeIcon key={j} className="w-2.5 h-2.5 fill-primary text-primary" />
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {entry.seasons} season{entry.seasons !== 1 ? 's' : ''} · {entry.winRate}% win rate
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-primary" />
                        <span className="text-sm font-black text-primary tabular-nums">{entry.titles}</span>
                      </div>
                      {entry.cupWins > 0 && (
                        <p className="text-[10px] text-muted-foreground">{entry.cupWins} cup{entry.cupWins !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  </div>

                  {/* Expanded stats row */}
                  <div className="grid grid-cols-4 gap-2 mt-3 pt-2 border-t border-border/20 text-center">
                    <div>
                      <p className="text-xs font-bold text-foreground tabular-nums">{entry.bestPosition}{entry.bestPosition === 1 ? 'st' : entry.bestPosition === 2 ? 'nd' : entry.bestPosition === 3 ? 'rd' : 'th'}</p>
                      <p className="text-[9px] text-muted-foreground">Best Pos</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground tabular-nums">{entry.bestPoints}</p>
                      <p className="text-[9px] text-muted-foreground">Best Pts</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground tabular-nums">{entry.totalWins}</p>
                      <p className="text-[9px] text-muted-foreground">Wins</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground tabular-nums">{entry.totalMatches}</p>
                      <p className="text-[9px] text-muted-foreground">Matches</p>
                    </div>
                  </div>
                </GlassPanel>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default HallOfManagers;
