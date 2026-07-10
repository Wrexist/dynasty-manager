import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { loadSessionSnapshot, clearSessionSnapshot } from '@/store/helpers/persistence';
import { TrendingUp, TrendingDown, ArrowRight, Clock, Heart, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlayerClub, useLeaguePosition } from '@/hooks/useGameSelectors';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { usePresentationSlot } from '@/hooks/usePresentationQueue';
import { getSuffix } from '@/utils/helpers';

export function SessionRecap() {
  const [show, setShow] = useState(false);
  const [snapshot, setSnapshot] = useState<ReturnType<typeof loadSessionSnapshot>>(null);
  const club = usePlayerClub();
  const pos = useLeaguePosition();
  const week = useGameStore(s => s.week);
  const season = useGameStore(s => s.season);
  const totalWeeks = useGameStore(s => s.totalWeeks);
  const boardConfidence = useGameStore(s => s.boardConfidence);
  const players = useGameStore(s => s.players);

  const injuredCount = useMemo(() => {
    if (!club) return 0;
    return club.playerIds.filter(id => players[id]?.injured).length;
  }, [club, players]);

  const checkedRef = useRef(false);
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    const snap = loadSessionSnapshot();
    if (!snap) return;
    // Only show recap if at least 1 hour has passed since last session
    const elapsed = Date.now() - snap.timestamp;
    if (elapsed < 60 * 60 * 1000) return;
    // Only show if something changed (different week)
    if (snap.week === week && snap.season === season) return;
    setSnapshot(snap);
    setShow(true);
    clearSessionSnapshot();
  }, [week, season]);

  // Compute the change list defensively (needs a snapshot + club) so the
  // presentation-queue registration below reflects true visibility — an empty
  // list must not claim the active slot and strand the queue (G3).
  const changes = useMemo<{ icon: typeof TrendingUp; text: string; color: string }[]>(() => {
    if (!show || !snapshot || !club) return [];
    const out: { icon: typeof TrendingUp; text: string; color: string }[] = [];
    const posChange = snapshot.leaguePosition - pos; // positive = improved
    const confChange = boardConfidence - snapshot.boardConfidence;
    const budgetChange = club.budget - snapshot.budget;

    if (posChange > 0) {
      out.push({ icon: TrendingUp, text: `Climbed ${posChange} place${posChange !== 1 ? 's' : ''} to ${pos}${getSuffix(pos)}`, color: 'text-emerald-400' });
    } else if (posChange < 0) {
      out.push({ icon: TrendingDown, text: `Dropped ${Math.abs(posChange)} place${Math.abs(posChange) !== 1 ? 's' : ''} to ${pos}${getSuffix(pos)}`, color: 'text-destructive' });
    }
    if (confChange >= 5) {
      out.push({ icon: Heart, text: `Board confidence up ${confChange}%`, color: 'text-emerald-400' });
    } else if (confChange <= -5) {
      out.push({ icon: AlertTriangle, text: `Board confidence down ${Math.abs(confChange)}%`, color: 'text-destructive' });
    }
    if (injuredCount > snapshot.injuredCount) {
      out.push({ icon: AlertTriangle, text: `${injuredCount - snapshot.injuredCount} new injur${injuredCount - snapshot.injuredCount !== 1 ? 'ies' : 'y'} since last session`, color: 'text-amber-400' });
    }
    if (budgetChange >= 1_000_000) {
      out.push({ icon: TrendingUp, text: `Budget grew by £${(budgetChange / 1e6).toFixed(1)}M`, color: 'text-emerald-400' });
    }
    return out;
  }, [show, snapshot, club, pos, boardConfidence, injuredCount]);

  // Presentation queue (G3): register only when there is something to show.
  const active = usePresentationSlot('sessionRecap', changes.length > 0);
  const visible = changes.length > 0 && active;

  const dismiss = () => setShow(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  useScrollLock(visible);
  useFocusTrap(containerRef, visible);
  useEscapeClose(dismiss, visible);

  if (!visible || !snapshot || !club) return null;

  const weeksElapsed = (season - snapshot.season) * totalWeeks + (week - snapshot.week);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[54] flex items-end justify-center bg-black/60 px-4 pb-8 safe-area-bottom"
          onClick={dismiss}
          role="dialog"
          aria-modal="true"
          aria-label="Session recap"
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full max-w-sm bg-card border border-border/50 rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground font-display">Welcome Back!</h3>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {weeksElapsed} week{weeksElapsed !== 1 ? 's' : ''} since last session
                </span>
              </div>

              <div className="space-y-2">
                {changes.map((change, i) => {
                  const Icon = change.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * i }}
                      className="flex items-center gap-2 text-xs"
                    >
                      <Icon className={cn('w-3.5 h-3.5 shrink-0', change.color)} />
                      <span className={cn('font-medium', change.color)}>{change.text}</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="px-5 pb-4">
              <Button className="w-full gap-2" onClick={dismiss}>
                <ArrowRight className="w-4 h-4" /> Let's Go
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
