import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { Trophy, Star, Award, ArrowRight, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { PRESTIGE_OPTIONS, calculatePrestigeStats } from '@/utils/prestige';

const PrestigePage = () => {
  const { seasonHistory, managerStats, managerProgression, setScreen, startPrestige } = useGameStore();
  const prestigeLevel = managerProgression.prestigeLevel || 0;
  const stats = calculatePrestigeStats(seasonHistory, managerStats, prestigeLevel);

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* Header */}
        <div className="text-center mb-6">
          <Crown className="w-12 h-12 text-primary mx-auto mb-2" />
          <h2 className="text-2xl font-black text-foreground font-display">Prestige Mode</h2>
          <p className="text-sm text-muted-foreground mt-1">
            You've reached the summit. Start a new journey with earned bonuses.
          </p>
          {prestigeLevel > 0 && (
            <div className="flex items-center justify-center gap-1 mt-2">
              {Array.from({ length: prestigeLevel }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-primary text-primary" />
              ))}
              <span className="text-xs text-primary font-bold ml-1">Prestige {prestigeLevel}</span>
            </div>
          )}
        </div>

        {/* Career Stats Summary */}
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Career Summary</h3>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-lg font-black text-primary tabular-nums">{stats.titles}</p>
              <p className="text-[10px] text-muted-foreground">Titles</p>
            </div>
            <div>
              <p className="text-lg font-black text-foreground tabular-nums">{stats.cupWins}</p>
              <p className="text-[10px] text-muted-foreground">Cups</p>
            </div>
            <div>
              <p className="text-lg font-black text-foreground tabular-nums">{stats.totalSeasons}</p>
              <p className="text-[10px] text-muted-foreground">Seasons</p>
            </div>
            <div>
              <p className="text-lg font-black text-foreground tabular-nums">{stats.winRate}%</p>
              <p className="text-[10px] text-muted-foreground">Win Rate</p>
            </div>
          </div>
        </GlassPanel>

        {/* Prestige Options */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold px-1">Choose Your Path</p>
          {PRESTIGE_OPTIONS.map((option, i) => (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i, duration: 0.3 }}
            >
              <GlassPanel
                className="p-4 hover:border-primary/40 transition-colors cursor-pointer"
                onClick={() => startPrestige(option.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xl">{option.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{option.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {option.bonuses.map((bonus, j) => (
                        <span
                          key={j}
                          className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                        >
                          {bonus}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </GlassPanel>
            </motion.div>
          ))}
        </div>

        <p className="text-[10px] text-center text-muted-foreground px-4">
          Prestige carries forward your manager level, career timeline, and achievements.
          Your Hall of Managers record is updated automatically.
        </p>

        <Button variant="ghost" className="w-full" onClick={() => setScreen('season-summary')}>
          Not Yet — Continue Current Career
        </Button>
      </motion.div>
    </div>
  );
};

export default PrestigePage;
