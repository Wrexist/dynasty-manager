import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollLock } from '@/hooks/useScrollLock';

export function FarewellModal() {
  const pendingFarewell = useGameStore(s => s.pendingFarewell);
  const dismissFarewell = useGameStore(s => s.dismissFarewell);
  const current = pendingFarewell[0];

  useScrollLock(!!current);

  if (!current) return null;

  const remaining = pendingFarewell.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        key={current.playerId}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-4"
        style={{ touchAction: 'none' }}
        onClick={dismissFarewell}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          onClick={(e) => e.stopPropagation()}
        >
          <GlassPanel className="p-6 max-w-sm w-full border-primary/30">
            <div className="text-center mb-4">
              <Heart className="w-10 h-10 text-primary mx-auto mb-2" />
              <h3 className="text-lg font-black font-display text-foreground">Farewell</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {current.playerName} has left the club.
              </p>
              {current.seasonsServed > 0 && (
                <p className="text-xs text-primary mt-1 font-semibold">
                  {current.seasonsServed} season{current.seasonsServed !== 1 ? 's' : ''} of service
                </p>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {current.stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-lg font-black text-foreground tabular-nums">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-center text-muted-foreground mb-3">
              Thank you for the memories. Good luck in the future.
            </p>

            <Button variant="outline" className="w-full" onClick={dismissFarewell}>
              {remaining > 0 ? `Farewell (${remaining} more)` : 'Farewell'}
            </Button>
          </GlassPanel>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
