import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Trophy, Award, Star, Medal, Lock } from 'lucide-react';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { cn } from '@/lib/utils';
import { getSuffix } from '@/utils/helpers';
import { ACHIEVEMENTS, getTierColor } from '@/utils/achievements';
import { motion } from 'framer-motion';
import { getActiveCosmetic } from '@/utils/monetization';

const TrophyCabinet = () => {
  const store = useGameStore();
  const { seasonHistory, unlockedAchievements, clubRecords, monetization } = store;
  const cabinetStyle = getActiveCosmetic(monetization, 'cabinet_style');

  const leagueTitles = seasonHistory.filter(h => h.position === 1);
  const cupWins = clubRecords.cupWins;
  const promotions = seasonHistory.filter(h => h.promoted);
  const totalTrophies = leagueTitles.length + cupWins + promotions.length;

  // Group achievements by tier
  const achievementsByTier = {
    gold: ACHIEVEMENTS.filter(a => a.tier === 'gold'),
    silver: ACHIEVEMENTS.filter(a => a.tier === 'silver'),
    bronze: ACHIEVEMENTS.filter(a => a.tier === 'bronze'),
  };

  return (
    <div className={cn(
      "max-w-lg mx-auto px-4 py-4 space-y-4",
      cabinetStyle === 'cabinet-marble' && 'cabinet-marble',
      cabinetStyle === 'cabinet-neon' && 'cabinet-neon',
      cabinetStyle === 'cabinet-vault' && 'cabinet-vault',
    )}>
      <h2 className="text-lg font-display font-bold text-foreground">Trophy Cabinet</h2>

      {/* Trophy Count Header */}
      <GlassPanel className="p-5 text-center border-primary/30">
        <Trophy className="w-10 h-10 text-primary mx-auto mb-2" />
        <p className="text-3xl font-black text-primary tabular-nums">{totalTrophies}</p>
        <p className="text-xs text-muted-foreground">Total Honours</p>
      </GlassPanel>

      {/* Achievement Completion Tracker */}
      {(() => {
        const totalVisible = ACHIEVEMENTS.filter(a => !a.hidden || unlockedAchievements.includes(a.id)).length;
        const unlocked = unlockedAchievements.length;
        const pct = totalVisible > 0 ? Math.round((unlocked / totalVisible) * 100) : 0;
        const goldDone = achievementsByTier.gold.filter(a => unlockedAchievements.includes(a.id)).length;
        const silverDone = achievementsByTier.silver.filter(a => unlockedAchievements.includes(a.id)).length;
        const bronzeDone = achievementsByTier.bronze.filter(a => unlockedAchievements.includes(a.id)).length;
        return (
          <GlassPanel className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Medal className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">Achievement Progress</span>
              </div>
              <span className="text-sm font-black text-primary tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden mb-2">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{unlocked}/{totalVisible} unlocked</span>
              <div className="flex items-center gap-3">
                <span className="text-primary">{goldDone} gold</span>
                <span className="text-gray-300">{silverDone} silver</span>
                <span className="text-amber-600">{bronzeDone} bronze</span>
              </div>
            </div>
          </GlassPanel>
        );
      })()}

      {/* Trophy Shelf: League Titles */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">League Titles</h3>
          <span className="text-xs text-primary font-bold ml-auto">{leagueTitles.length}</span>
        </div>
        {leagueTitles.length === 0 ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-xl bg-muted/30 border border-dashed border-border/50 mx-auto mb-2 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-muted-foreground/30" />
            </div>
            <p className="text-[10px] text-muted-foreground">Win the league to earn your first title</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {leagueTitles.map((h, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="bg-primary/10 border border-primary/30 rounded-lg p-2 text-center"
              >
                <Trophy className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-[10px] font-bold text-primary">S{h.season}</p>
                <p className="text-[9px] text-muted-foreground">{h.points}pts</p>
              </motion.div>
            ))}
          </div>
        )}
      </GlassPanel>

      {/* Cup Wins */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-foreground">Cup Wins</h3>
          <span className="text-xs text-amber-400 font-bold ml-auto">{cupWins}</span>
        </div>
        {cupWins === 0 ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-xl bg-muted/30 border border-dashed border-border/50 mx-auto mb-2 flex items-center justify-center">
              <Award className="w-5 h-5 text-muted-foreground/30" />
            </div>
            <p className="text-[10px] text-muted-foreground">Win the Dynasty Cup to fill this shelf</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: cupWins }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-center"
              >
                <Award className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                <p className="text-[10px] font-bold text-amber-400">Cup</p>
              </motion.div>
            ))}
          </div>
        )}
      </GlassPanel>

      {/* Promotions */}
      {promotions.length > 0 && (
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-foreground">Promotions</h3>
            <span className="text-xs text-emerald-400 font-bold ml-auto">{promotions.length}</span>
          </div>
          <div className="space-y-1.5">
            {promotions.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-emerald-500/5 rounded-lg px-3 py-2">
                <span className="text-emerald-400 font-semibold">Season {h.season}</span>
                <span className="text-muted-foreground">{h.position}{getSuffix(h.position)} place — Promoted!</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Achievements */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Medal className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Achievements</h3>
          <span className="text-xs text-muted-foreground ml-auto">
            {unlockedAchievements.length}/{ACHIEVEMENTS.filter(a => !a.hidden).length}
          </span>
        </div>

        {/* Tier sections */}
        {(['gold', 'silver', 'bronze'] as const).map(tier => (
          <div key={tier} className="mb-3 last:mb-0">
            <p className={cn(
              'text-[10px] font-bold uppercase tracking-wider mb-2',
              tier === 'gold' ? 'text-primary' : tier === 'silver' ? 'text-gray-300' : 'text-amber-600'
            )}>
              {tier} ({achievementsByTier[tier].filter(a => unlockedAchievements.includes(a.id)).length}/{achievementsByTier[tier].filter(a => !a.hidden || unlockedAchievements.includes(a.id)).length})
            </p>
            <div className="space-y-1.5">
              {achievementsByTier[tier]
                .filter(a => !a.hidden || unlockedAchievements.includes(a.id))
                .map(a => {
                  const unlocked = unlockedAchievements.includes(a.id);
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 transition-colors',
                        unlocked ? 'bg-muted/30' : 'bg-muted/10 opacity-50'
                      )}
                    >
                      {unlocked ? <DynamicIcon name={a.icon} className="w-4 h-4 text-primary" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs font-semibold truncate', unlocked ? 'text-foreground' : 'text-muted-foreground')}>
                          {a.hidden && !unlocked ? '???' : a.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {a.hidden && !unlocked ? 'Hidden achievement' : a.description}
                        </p>
                      </div>
                      {unlocked ? (
                        <span className={cn('text-[10px] font-bold', getTierColor(a.tier))}>
                          ✓
                        </span>
                      ) : a.progress && !a.hidden ? (() => {
                        const prog = a.progress(store);
                        if (!prog || prog.current <= 0) return null;
                        const pct = Math.min(100, Math.round((prog.current / prog.target) * 100));
                        return (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="w-12 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                              <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[9px] text-muted-foreground tabular-nums">{prog.current}/{prog.target}</span>
                          </div>
                        );
                      })() : null}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </GlassPanel>
    </div>
  );
};

export default TrophyCabinet;
