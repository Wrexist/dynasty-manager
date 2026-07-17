import { useRef, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { GraduationCap, Star, ArrowRight } from 'lucide-react';
import { PremiumSparkle } from '@/components/game/icons/PremiumSparkle';
import { PlayerBadge } from '@/components/game/PlayerBadge';
import { cn } from '@/lib/utils';
import { hapticHeavy, hapticLight } from '@/utils/haptics';
import { getPotentialInfo } from '@/utils/uiHelpers';
import { getPotentialStars, getScoutVerdict } from '@/utils/youth';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { usePresentationSlot } from '@/hooks/usePresentationQueue';

/**
 * Intake Day (Youth Academy v1). One-at-a-time reveal of the season's fresh
 * academy class, best prospect last with a gold walkout-style glow. Reuses the
 * gem-reveal visual language and the shared presentation queue — the prospects
 * are already in the academy; this modal only drives the reveal and clears the
 * `pendingYouthIntake` flag on dismiss.
 */
export function IntakeDayModal() {
  const { pending, players, clubs, playerClubId } = useGameStore(useShallow(s => ({
    pending: s.pendingYouthIntake,
    players: s.players,
    clubs: s.clubs,
    playerClubId: s.playerClubId,
  })));

  const active = usePresentationSlot('intakeDay', !!pending);
  const visible = !!pending && active;

  const [index, setIndex] = useState(0);

  // Reset the reveal pointer whenever a new class arrives.
  useEffect(() => { setIndex(0); }, [pending?.season]);

  // Best prospect last: sort by potential ascending so the reveal builds to the
  // gem. filter(Boolean) — some ids may reference players cleaned up elsewhere.
  const classList = useMemo(() => {
    if (!pending) return [];
    return pending.players
      .map(id => players[id])
      .filter(Boolean)
      .sort((a, b) => a.potential - b.potential);
  }, [pending, players]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dismiss = () => { useGameStore.setState({ pendingYouthIntake: null }); };
  useFocusTrap(containerRef, visible);
  useEscapeClose(dismiss, visible);

  useEffect(() => {
    if (visible) hapticLight();
  }, [visible]);

  const current = classList[index];
  const isLast = index >= classList.length - 1;
  const isBest = isLast && classList.length > 0;

  // Heavy haptic when the best prospect (final card) lands.
  useEffect(() => {
    if (visible && isBest) hapticHeavy();
  }, [visible, isBest, index]);

  if (!visible) return null;
  // Defensive: no resolvable players in the class — clear and bail.
  if (classList.length === 0 || !current) { dismiss(); return null; }

  const club = clubs[playerClubId];
  const jerseyColor = club?.color || '#d4a843';
  const potInfo = getPotentialInfo(current.potential);
  const stars = getPotentialStars(current.potential);
  const verdict = getScoutVerdict(current.potential, current.id);

  const handleNext = () => {
    hapticLight();
    if (isLast) dismiss();
    else setIndex(i => i + 1);
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[58] flex items-center justify-center bg-black/70 px-4"
        onClick={handleNext}
        role="dialog"
        aria-modal="true"
        aria-label="Youth Intake Day reveal"
      >
        <motion.div
          key={index}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className={cn(
            'w-full max-w-sm bg-card rounded-2xl overflow-hidden',
            isBest
              ? 'border border-primary shadow-[0_0_50px_hsl(43_96%_55%/0.45)]'
              : 'border border-primary/40 shadow-[0_0_30px_hsl(var(--primary)/0.15)]',
          )}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={cn('px-5 py-4 text-center border-b', isBest ? 'bg-primary/15 border-primary/30' : 'bg-primary/10 border-primary/20')}>
            <motion.div
              initial={{ rotate: -10, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.15, type: 'spring' }}
            >
              {isBest
                ? <PremiumSparkle className="w-10 h-10 mx-auto mb-2 drop-shadow-[0_0_12px_hsl(43_96%_55%/0.6)]" />
                : <GraduationCap className="w-9 h-9 mx-auto mb-2 text-primary" />}
            </motion.div>
            <p className="text-lg font-black text-primary font-display uppercase tracking-wide">
              {isBest ? 'Star of the Intake!' : 'Intake Day'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Prospect {index + 1} of {classList.length} · Class of S{pending!.season}</p>
          </div>

          {/* Prospect */}
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <PlayerBadge
                clubColor={jerseyColor}
                overall={current.overall}
                position={current.position}
                size={isBest ? 'lg' : 'md'}
                noGlow={!isBest}
              />
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">{current.firstName} {current.lastName}</p>
                <p className="text-xs text-muted-foreground">{current.position} · Age {current.age}</p>
                <div className="flex items-center gap-0.5 mt-1" aria-label={`${stars} star potential`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={cn('w-3.5 h-3.5', i < stars ? cn(potInfo.fillClass, 'fill-current') : 'text-muted-foreground/30')}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Potential band */}
            <div className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
              <span className="text-xs text-muted-foreground">Potential</span>
              <span className={cn('text-sm font-bold', potInfo.textClass)}>{potInfo.label}</span>
            </div>

            {/* Scout verdict */}
            <div className="flex items-start gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              <GraduationCap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/90 font-medium">{verdict}</p>
            </div>
          </div>

          {/* Action */}
          <div className="px-5 pb-4">
            <Button className="w-full gap-2" onClick={handleNext}>
              {isLast ? 'Done' : 'Next Prospect'}
              {!isLast && <ArrowRight className="w-4 h-4" />}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
