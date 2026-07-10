import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { Button } from '@/components/ui/button';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { cn } from '@/lib/utils';
import type { Achievement } from '@/utils/achievements';
import { getTierColor, getTierBgColor, getAchievementXP } from '@/utils/achievements';
import { hapticSuccess } from '@/utils/haptics';
import { usePresentationSlot } from '@/hooks/usePresentationQueue';

interface AchievementUnlockModalProps {
  open: boolean;
  onClose: () => void;
  achievement: Achievement | null;
}

const PARTICLE_COUNT = 24;
const SPARKLE_HUE = 43; // gold

interface SparkleSpec {
  x: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  yTarget: number;
  xTarget: number;
}

/** Roll sparkle specs once — re-rolling Math.random() per render retargeted
 *  in-flight animations whenever the modal re-rendered. */
function makeSparkleSpecs(): SparkleSpec[] {
  return Array.from({ length: PARTICLE_COUNT }).map(() => {
    const hue = SPARKLE_HUE + Math.random() * 20 - 10;
    return {
      x: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 1.2 + Math.random() * 1.2,
      size: 3 + Math.random() * 5,
      color: `hsl(${hue}, 90%, ${50 + Math.random() * 20}%)`,
      yTarget: -100 - Math.random() * 160,
      xTarget: (Math.random() - 0.5) * 120,
    };
  });
}

function Sparkle({ spec }: { spec: SparkleSpec }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: spec.size,
        height: spec.size,
        left: `${spec.x}%`,
        top: '40%',
        backgroundColor: spec.color,
      }}
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{
        opacity: [1, 1, 0],
        y: [0, spec.yTarget],
        x: [0, spec.xTarget],
        scale: [1, 0.3],
      }}
      transition={{ duration: spec.duration, delay: spec.delay, ease: 'easeOut' }}
    />
  );
}

export function AchievementUnlockModal({ open, onClose, achievement }: AchievementUnlockModalProps) {
  // Presentation queue (G3): stack behind the digest/celebration — only show
  // and buzz when we're the active overlay.
  const slotActive = usePresentationSlot('achievement', open && !!achievement);
  const visible = open && !!achievement && slotActive;
  useScrollLock(visible);

  const panelRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(panelRef, visible);
  useEscapeClose(onClose, visible);

  // Match the CelebrationModal pattern — fire one success notification haptic
  // exactly when the modal becomes visible (not while queued behind others).
  useEffect(() => {
    if (visible) hapticSuccess();
  }, [visible]);

  // Sparkle layout rolled once and stable across re-renders.
  const sparkleSpecs = useMemo(() => makeSparkleSpecs(), []);

  if (!achievement) return null;

  const xpReward = getAchievementXP(achievement.tier);
  const tierLabel = achievement.tier.charAt(0).toUpperCase() + achievement.tier.slice(1);

  return (
    <AnimatePresence>
      {visible && (
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
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Achievement unlocked: ${achievement.title}`}
            className="relative bg-card/95 backdrop-blur-xl border-2 border-primary/50 rounded-2xl max-w-sm w-full p-6 overflow-hidden shadow-[0_0_60px_rgba(234,179,8,0.2)]"
            initial={{ scale: 0.7, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          >
            {/* Sparkles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {sparkleSpecs.map((spec, i) => (
                <Sparkle key={i} spec={spec} />
              ))}
            </div>

            {/* Close button — 44px hit target (StorylineModal pattern) */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close achievement"
              className="absolute top-0 right-0 z-10 flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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
                  achievement.tier === 'gold' && 'drop-shadow-[0_0_10px_hsl(var(--gold)/0.5)]'
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
