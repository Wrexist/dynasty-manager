import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { Sparkles, MapPin, TrendingUp, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticHeavy } from '@/utils/haptics';
import { useEffect } from 'react';

export function GemRevealModal() {
  const gem = useGameStore(s => s.pendingGemReveal);
  const players = useGameStore(s => s.players);

  useEffect(() => {
    if (gem) hapticHeavy();
  }, [gem]);

  if (!gem) return null;

  const player = players[gem.playerId];
  if (!player) return null;

  const dismiss = () => {
    useGameStore.setState({ pendingGemReveal: null });
  };

  const potentialGap = player.potential - player.overall;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[58] flex items-center justify-center bg-black/70 px-4"
        onClick={dismiss}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="w-full max-w-sm bg-card border border-primary/40 rounded-2xl overflow-hidden shadow-[0_0_30px_hsl(43_96%_46%/0.15)]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-primary/10 px-5 py-4 text-center border-b border-primary/20">
            <motion.div
              initial={{ rotate: -10, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
            >
              <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
            </motion.div>
            <p className="text-lg font-black text-primary font-display uppercase tracking-wide">Hidden Gem Found!</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground">Discovered in {gem.region}</p>
            </div>
          </div>

          {/* Player Info */}
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">{player.firstName} {player.lastName}</p>
                <p className="text-xs text-muted-foreground">{player.position} · Age {player.age}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Overall</p>
                <p className={cn(
                  'text-lg font-black tabular-nums',
                  player.overall >= 70 ? 'text-primary' : player.overall >= 60 ? 'text-amber-400' : 'text-foreground'
                )}>{player.overall}</p>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 text-center">
                <p className="text-[10px] text-primary/70">Potential</p>
                <p className="text-lg font-black text-primary tabular-nums">{player.potential}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Growth</p>
                <p className="text-lg font-black text-emerald-400 tabular-nums">+{potentialGap}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-400 font-medium">
                {potentialGap >= 15 ? 'Generational talent — sign immediately!' :
                 potentialGap >= 10 ? 'Exceptional potential — a star in the making' :
                 'Quality prospect — could become a key player'}
              </p>
            </div>
          </div>

          <div className="px-5 pb-4">
            <Button className="w-full" onClick={dismiss}>
              Check Scouting Reports
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
