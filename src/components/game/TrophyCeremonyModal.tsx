/**
 * Season-verdict ceremony overlay (G4) — the domestic counterpart to the World
 * Cup trophy lift. Fired on a confirmed league title, a domestic Cup / League
 * Cup final win, continental silverware, either Super Cup (see
 * `detectTrophyMoments`) and — in the `somber` tone — relegation.
 *
 * Two tones share one overlay because they occupy the same beat in the
 * presentation queue and only one of them can ever be true at a time:
 *   - `triumph` (default): gold, TrophyLift, confetti, crowd roar.
 *   - `somber`: rose, no lift, no confetti, a deflating groan. Deliberately
 *     NOT the celebration path — relegation should not feel like a reward.
 *
 * Audio + haptic fire once, when the overlay actually becomes visible (the
 * presentation queue may hold it behind another overlay first).
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { Trophy, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrophyLift } from './TrophyLift';
import { PackConfetti } from './pack/PackConfetti';
import { useScrollLock } from '@/hooks/useScrollLock';
import { usePresentationSlot } from '@/hooks/usePresentationQueue';
import { useGameStore } from '@/store/gameStore';
import { hapticHeavy, hapticSuccess } from '@/utils/haptics';
import { sfxGroan, sfxRoar } from '@/utils/sfx';

interface TrophyCeremonyModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  /** `somber` swaps the whole beat (palette, icon, audio, haptic) for the
   *  relegation case. Defaults to the celebratory trophy lift. */
  tone?: 'triumph' | 'somber';
  /** Gold confetti burst behind the panel. On by default for `triumph`;
   *  never rendered for `somber`. Honours reduced motion via PackConfetti. */
  confetti?: boolean;
}

export function TrophyCeremonyModal({
  open, onClose, title, subtitle, tone = 'triumph', confetti = true,
}: TrophyCeremonyModalProps) {
  const soundEnabled = useGameStore(s => s.settings.soundEnabled !== false);
  const slotActive = usePresentationSlot('trophyLift', open);
  const visible = open && slotActive;
  const somber = tone === 'somber';
  useScrollLock(visible);

  useEffect(() => {
    if (!visible) return;
    if (somber) {
      hapticHeavy();
      if (soundEnabled) sfxGroan();
    } else {
      hapticSuccess();
      if (soundEnabled) sfxRoar(true);
    }
  }, [visible, soundEnabled, somber]);

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
          {!somber && confetti && (
            <div className="absolute inset-0 pointer-events-none">
              <PackConfetti count={36} hueBase={43} hueRange={26} saturation={94} lightness={54} />
            </div>
          )}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={
              somber
                ? 'relative bg-card/95 backdrop-blur-xl border-2 border-destructive/50 rounded-2xl max-w-sm w-full p-7 text-center overflow-hidden shadow-[0_0_50px_rgba(244,63,94,0.18)]'
                : 'relative bg-card/95 backdrop-blur-xl border-2 border-amber-400/50 rounded-2xl max-w-sm w-full p-7 text-center overflow-hidden shadow-[0_0_50px_rgba(245,178,5,0.2)]'
            }
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-80"
              style={{
                background: somber
                  ? 'radial-gradient(120% 90% at 50% 0%, hsl(350 89% 60% / 0.22) 0%, hsl(350 89% 60% / 0.05) 45%, transparent 72%)'
                  : 'radial-gradient(120% 90% at 50% 0%, hsl(43 96% 46% / 0.28) 0%, hsl(43 96% 46% / 0.05) 45%, transparent 72%)',
              }}
            />
            <div className="relative space-y-4">
              {somber ? (
                <div className="flex justify-center">
                  <ArrowDown className="w-11 h-11 text-rose-300 drop-shadow-[0_0_10px_rgba(244,63,94,0.55)]" />
                </div>
              ) : (
                <TrophyLift gold icon={<Trophy className="w-11 h-11" />} />
              )}
              <h2
                className={
                  somber
                    ? 'text-2xl font-black font-display text-rose-300 drop-shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                    : 'text-2xl font-black font-display text-amber-300 drop-shadow-[0_0_12px_hsl(43_96%_55%/0.5)]'
                }
              >
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
