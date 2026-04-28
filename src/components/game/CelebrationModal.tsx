import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { Button } from '@/components/ui/button';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useGameStore } from '@/store/gameStore';
import { getActiveCosmetic } from '@/utils/monetization';
import { COSMETIC_ITEMS } from '@/config/monetization';
import { hapticSuccess } from '@/utils/haptics';

interface CelebrationModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  icon?: string;
  stats?: { label: string; value: string }[];
}

interface ConfettiConfig {
  count: number;
  hueBase: number;
  hueRange: number;
  saturation: number;
  lightness: number;
  sizeMin: number;
  sizeRange: number;
  speed: number;
}

const CONFETTI_STYLES: Record<string, ConfettiConfig> = {
  default: { count: 20, hueBase: 43, hueRange: 20, saturation: 96, lightness: 46, sizeMin: 4, sizeRange: 6, speed: 1 },
  'confetti-gold': { count: 25, hueBase: 43, hueRange: 15, saturation: 96, lightness: 50, sizeMin: 4, sizeRange: 6, speed: 1 },
  'confetti-pyro': { count: 30, hueBase: 15, hueRange: 25, saturation: 90, lightness: 50, sizeMin: 5, sizeRange: 8, speed: 1.2 },
  'confetti-snow': { count: 25, hueBase: 210, hueRange: 30, saturation: 30, lightness: 85, sizeMin: 3, sizeRange: 5, speed: 0.6 },
};

function Particle({ config }: { config: ConfettiConfig }) {
  const x = Math.random() * 100;
  const delay = Math.random() * 0.5;
  const duration = (1.5 + Math.random() * 1.5) / config.speed;
  const size = config.sizeMin + Math.random() * config.sizeRange;
  const hue = config.hueBase + Math.random() * config.hueRange - config.hueRange / 2;

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        top: '50%',
        backgroundColor: `hsl(${hue}, ${config.saturation}%, ${config.lightness + Math.random() * 20}%)`,
      }}
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{
        opacity: [1, 1, 0],
        y: [0, -120 - Math.random() * 180],
        x: [0, (Math.random() - 0.5) * 100],
        scale: [1, 0.5],
      }}
      transition={{ duration, delay, ease: 'easeOut' }}
    />
  );
}

export function CelebrationModal({ open, onClose, title, description, icon, stats }: CelebrationModalProps) {
  const monetization = useGameStore(s => s.monetization);
  const celebTextId = getActiveCosmetic(monetization, 'celebration_text');
  const celebItem = celebTextId ? COSMETIC_ITEMS.find(c => c.id === celebTextId) : null;
  const displayTitle = celebItem ? celebItem.name : title;
  const confettiId = getActiveCosmetic(monetization, 'confetti_style');
  const confettiConfig = CONFETTI_STYLES[confettiId || 'default'] || CONFETTI_STYLES.default;
  // 20–30 particles animating translate + scale for 1.5–3s is a vestibular
  // trigger for reduced-motion users. Skip rendering them entirely — the
  // spring-in modal + haptic + gold border is celebration enough.
  const prefersReducedMotion = useReducedMotion();
  useScrollLock(open);

  // Single source of truth for celebration moments — promotions, trophy
  // wins, season triumphs all funnel through this modal, so we fire one
  // success haptic on open instead of sprinkling them through callers.
  useEffect(() => {
    if (open) hapticSuccess();
  }, [open]);

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
            className="relative bg-card/95 backdrop-blur-xl border-2 border-primary/50 rounded-2xl max-w-sm w-full p-6 overflow-hidden shadow-[0_0_40px_rgba(234,179,8,0.15)]"
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {/* Particles — skipped under reduced motion. */}
            {!prefersReducedMotion && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {Array.from({ length: confettiConfig.count }).map((_, i) => (
                  <Particle key={i} config={confettiConfig} />
                ))}
              </div>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="relative text-center space-y-4">
              {/* Icon */}
              {icon && (
                <motion.div
                  className="flex justify-center relative"
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.15 }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 m-auto w-20 h-20 rounded-full blur-2xl opacity-80"
                    style={{ background: 'radial-gradient(circle, hsl(43 96% 55% / 0.55) 0%, transparent 70%)' }}
                  />
                  <DynamicIcon name={icon} className="w-14 h-14 text-primary relative drop-shadow-[0_4px_18px_hsl(43_96%_46%/0.6)]" />
                </motion.div>
              )}

              {/* Title */}
              <motion.h2
                className="text-xl font-black font-display text-[hsl(var(--gold))] drop-shadow-[0_0_10px_hsl(var(--gold)/0.5)]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {displayTitle}
              </motion.h2>

              {/* Description */}
              <motion.p
                className="text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {description}
              </motion.p>

              {/* Stats */}
              {stats && stats.length > 0 && (
                <motion.div
                  className="grid grid-cols-2 gap-2 pt-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  {stats.map((stat, i) => (
                    <div
                      key={i}
                      className="rounded-lg px-3 py-2 relative overflow-hidden"
                      style={{
                        background:
                          'linear-gradient(180deg, hsl(var(--primary)/0.12) 0%, hsl(var(--primary)/0.04) 100%)',
                        boxShadow:
                          'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px hsl(var(--primary)/0.2), 0 8px 18px -10px hsl(var(--primary)/0.35)',
                      }}
                    >
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                      <p
                        className="text-base font-black tabular-nums bg-clip-text text-transparent"
                        style={{ backgroundImage: 'linear-gradient(180deg, #FFF6D8 0%, hsl(var(--foreground)) 100%)' }}
                      >
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </motion.div>
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
