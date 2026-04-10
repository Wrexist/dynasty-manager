import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NEGOTIATION_MAX_STRIKES } from '@/config/transfers';

interface StrikeIndicatorProps {
  strikes: number;
  latestOutcome?: 'rejected' | 'accepted' | null;
}

export function StrikeIndicator({ strikes, latestOutcome }: StrikeIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: NEGOTIATION_MAX_STRIKES }, (_, i) => {
        const isFilled = i < strikes;
        const isLatest = i === strikes - 1 && latestOutcome != null;
        const isAccepted = isLatest && latestOutcome === 'accepted';
        const isRejected = isFilled && !isAccepted;

        return (
          <div
            key={i}
            className={cn(
              'relative w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-300',
              isFilled
                ? isAccepted
                  ? 'bg-emerald-500/15 border border-emerald-500/50'
                  : 'bg-red-500/15 border border-red-500/50'
                : 'bg-transparent border border-border/40'
            )}
          >
            <AnimatePresence mode="wait">
              {isRejected && (
                <motion.div
                  key={`x-${i}`}
                  initial={isLatest ? { scale: 0, rotate: -90 } : false}
                  animate={{ scale: 1, rotate: 0, x: isLatest ? [0, -2, 2, -1, 1, 0] : 0 }}
                  transition={{
                    scale: { type: 'spring', stiffness: 400, damping: 15 },
                    rotate: { type: 'spring', stiffness: 400, damping: 15 },
                    x: { duration: 0.4, delay: 0.2 },
                  }}
                >
                  <X className="w-3 h-3 text-red-400" strokeWidth={3} />
                </motion.div>
              )}
              {isAccepted && (
                <motion.div
                  key={`check-${i}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                >
                  <Check className="w-3 h-3 text-emerald-400" strokeWidth={3} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
