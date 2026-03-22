import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { Button } from '@/components/ui/button';
import { useScrollLock } from '@/hooks/useScrollLock';
import { cn } from '@/lib/utils';
import type { Achievement } from '@/utils/achievements';
import { getTierColor, getTierBgColor, getAchievementXP } from '@/utils/achievements';

interface AchievementUnlockModalProps {
  open: boolean;
  onClose: () => void;
  achievement: Achievement | null;
}

const PARTICLE_COUNT = 24;

function Sparkle({ index: _index }: { index: number }) {
  const x = Math.random() * 100;
  const delay = Math.random() * 0.4;
  const duration = 1.2 + Math.random() * 1.2;
  const size = 3 + Math.random() * 5;
  const tier = 'gold'; // Default sparkle color
  const hues = { bronze: 30, silver: 220, gold: 43 };
  const hue = (hues[tier] || 43) + Math.random() * 20 - 10;

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        top: '40%',
        backgroundColor: `hsl(${hue}, 90%, ${50 + Math.random() * 20}%)`,
      }}
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{
        opacity: [1, 1, 0],
        y: [0, -100 - Math.random() * 160],
        x: [0, (Math.random() - 0.5) * 120],
        scale: [1, 0.3],
      }}
      transition={{ duration, delay, ease: 'easeOut' }}
    />
  );
}

export function AchievementUnlockModal({ open, onClose, achievement }: AchievementUnlockModalProps) {
  useScrollLock(open);

  if (!achievement) return null;

  const xpReward = getAchievementXP(achievement.tier);
  const tierLabel = achievement.tier.charAt(0).toUpperCase() + achievement.tier.slice(1);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" style={{ touchAction: 'none' }} onClick={onClose} />

          {/* Modal */}
          <motion.div
            className="relative bg-card/95 backdrop-blur-xl border-2 border-primary/50 rounded-2xl max-w-sm w-full p-6 overflow-hidden shadow-[0_0_60px_rgba(234,179,8,0.2)]"
            initial={{ scale: 0.7, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          >
            {/* Sparkles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
                <Sparkle key={i} index={i} />
              ))}
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="relative text-center space-y-3">
              {/* Achievement badge label */}
              <motion.p
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                Achievement Unlocked!
              </motion.p>

              {/* Icon with tier glow */}
              <motion.div
                className="flex justify-center"
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.15 }}
              >
                <div className={cn(
                  'w-16 h-16 rounded-2xl flex items-center justify-center border-2',
                  getTierBgColor(achievement.tier)
                )}>
                  <DynamicIcon name={achievement.icon} className={cn('w-8 h-8', getTierColor(achievement.tier))} />
                </div>
              </motion.div>

              {/* Title */}
              <motion.h2
                className={cn(
                  'text-xl font-black font-display',
                  getTierColor(achievement.tier),
                  achievement.tier === 'gold' && 'drop-shadow-[0_0_10px_hsl(43,96%,46%,0.5)]'
                )}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                {achievement.title}
              </motion.h2>

              {/* Description */}
              <motion.p
                className="text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                {achievement.description}
              </motion.p>

              {/* Tier + XP reward */}
              <motion.div
                className="flex items-center justify-center gap-3 pt-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <span className={cn(
                  'text-xs font-bold uppercase px-2.5 py-1 rounded-full border',
                  getTierBgColor(achievement.tier),
                  getTierColor(achievement.tier)
                )}>
                  {tierLabel}
                </span>
                <span className="text-sm font-bold text-primary">
                  +{xpReward} XP
                </span>
              </motion.div>

              {/* Hidden achievement bonus */}
              {achievement.hidden && (
                <motion.p
                  className="text-[10px] text-primary/70 italic"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                >
                  Hidden achievement discovered!
                </motion.p>
              )}

              {/* Dismiss */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Button className="w-full mt-2" onClick={onClose}>
                  Continue
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
