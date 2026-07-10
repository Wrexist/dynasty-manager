import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { Button } from '@/components/ui/button';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { useGameStore } from '@/store/gameStore';
import { getActiveCosmetic } from '@/utils/monetization';
import { COSMETIC_ITEMS } from '@/config/monetization';
import { hapticSuccess } from '@/utils/haptics';
import { usePresentationSlot } from '@/hooks/usePresentationQueue';

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

interface ParticleSpec {
  x: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  yTarget: number;
  xTarget: number;
}

/** Roll particle specs once per config — re-rolling Math.random() in the
 *  component body retargeted in-flight animations on every re-render. */
function makeParticleSpecs(config: ConfettiConfig): ParticleSpec[] {
  return Array.from({ length: config.count }).map(() => {
    const hue = config.hueBase + Math.random() * config.hueRange - config.hueRange / 2;
    return {
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: (1.5 + Math.random() * 1.5) / config.speed,
      size: config.sizeMin + Math.random() * config.sizeRange,
      color: `hsl(${hue}, ${config.saturation}%, ${config.lightness + Math.random() * 20}%)`,
      yTarget: -120 - Math.random() * 180,
      xTarget: (Math.random() - 0.5) * 100,
    };
  });
}

function Particle({ spec }: { spec: ParticleSpec }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: spec.size,
        height: spec.size,
        left: `${spec.x}%`,
        top: '50%',
        backgroundColor: spec.color,
      }}
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{
        opacity: [1, 1, 0],
        y: [0, spec.yTarget],
        x: [0, spec.xTarget],
        scale: [1, 0.5],
      }}
      transition={{ duration: spec.duration, delay: spec.delay, ease: 'easeOut' }}
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
  // Presentation queue (G3): stack after the weekly digest — only show, lock
  // and buzz when we're the active overlay.
  const slotActive = usePresentationSlot('celebration', open);
  const visible = open && slotActive;
  useScrollLock(visible);
  const particleSpecs = useMemo(() => makeParticleSpecs(confettiConfig), [confettiConfig]);

  const panelRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(panelRef, visible);
  useEscapeClose(onClose, visible);

  // Single source of truth for celebration moments — promotions, trophy
  // wins, season triumphs all funnel through this modal, so we fire one
  // success haptic when it actually becomes visible (not while queued).
  useEffect(() => {
    if (visible) hapticSuccess();
  }, [visible]);

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
            aria-label={displayTitle}
            className="relative bg-card/95 backdrop-blur-xl border-2 border-primary/50 rounded-2xl max-w-sm w-full p-6 overflow-hidden shadow-[0_0_40px_rgba(234,179,8,0.15)]"
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {/* Particles — skipped under reduced motion. */}
            {!prefersReducedMotion && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {particleSpecs.map((spec, i) => (
                  <Particle key={i} spec={spec} />
                ))}
              </div>
            )}

            {/* Close button — 44px hit target (StorylineModal pattern) */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close celebration"
              className="absolute top-0 right-0 z-10 flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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
