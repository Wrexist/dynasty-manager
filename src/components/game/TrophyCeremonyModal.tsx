/**
 * Trophy ceremony overlay (G4) — the domestic counterpart to the World Cup
 * trophy lift. Fired on a confirmed league title or a domestic Cup / League Cup
 * final win (see `detectTrophyMoments`). Reuses the shared `TrophyLift` visual
 * and the presentation queue so it never collides with other post-advance
 * overlays; the crowd roar + haptic fire once, when it actually becomes visible.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrophyLift } from './TrophyLift';
import { useScrollLock } from '@/hooks/useScrollLock';
import { usePresentationSlot } from '@/hooks/usePresentationQueue';
import { useGameStore } from '@/store/gameStore';
import { hapticSuccess } from '@/utils/haptics';
import { sfxRoar } from '@/utils/sfx';

interface TrophyCeremonyModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
}

export function TrophyCeremonyModal({ open, onClose, title, subtitle }: TrophyCeremonyModalProps) {
  const soundEnabled = useGameStore(s => s.settings.soundEnabled !== false);
  const slotActive = usePresentationSlot('trophyLift', open);
  const visible = open && slotActive;
  useScrollLock(visible);

  useEffect(() => {
    if (!visible) return;
    hapticSuccess();
    if (soundEnabled) sfxRoar(true);
  }, [visible, soundEnabled]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-background/85 backdrop-blur-sm"
            style={{ touchAction: 'none' }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative bg-card/95 backdrop-blur-xl border-2 border-amber-400/50 rounded-2xl max-w-sm w-full p-7 text-center overflow-hidden shadow-[0_0_50px_rgba(245,178,5,0.2)]"
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-80"
              style={{ background: 'radial-gradient(120% 90% at 50% 0%, hsl(43 96% 46% / 0.28) 0%, hsl(43 96% 46% / 0.05) 45%, transparent 72%)' }}
            />
            <div className="relative space-y-4">
              <TrophyLift gold icon={<Trophy className="w-11 h-11" />} />
              <h2 className="text-2xl font-black font-display text-amber-300 drop-shadow-[0_0_12px_hsl(43_96%_55%/0.5)]">
                {title}
              </h2>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
              <Button className="w-full mt-2" onClick={onClose}>
                Continue
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
