/**
 * Dashboard banner for the active date-boxed live event (e.g. the 2026 World
 * Cup Festival). Renders only while an event window is live, and is the primary
 * entry point to the Festival hub. Dismissal is session-scoped, so it returns
 * on the next launch — a gentle recurring nudge rather than a one-and-done.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ArrowRight, X, CalendarClock } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { getActiveLiveEvent, getEventDaysRemaining } from '@/utils/liveEvents';
import { readSessionJson, writeSessionJson } from '@/store/helpers/persistence';
import { hapticLight } from '@/utils/haptics';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'dynasty-festival-banner-dismissed';

export function FestivalBanner() {
  const setScreen = useGameStore(s => s.setScreen);
  const event = getActiveLiveEvent();

  // Session-scoped dismissal, keyed by event id so a new event re-surfaces.
  const [dismissed, setDismissed] = useState(
    () => !!event && readSessionJson<string>(DISMISS_KEY) === event.id,
  );

  if (!event || dismissed) return null;

  const daysLeft = getEventDaysRemaining(event);

  const dismiss = () => {
    writeSessionJson(DISMISS_KEY, event.id);
    setDismissed(true);
  };

  const enter = () => {
    hapticLight();
    setScreen('festival');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'relative overflow-hidden rounded-xl p-3.5 mb-3 border border-primary/30',
          'bg-gradient-to-br from-primary/15 via-primary/5 to-transparent',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
        )}
        role="region"
        aria-label={event.name}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        />
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-2 right-2 p-2 -m-1 rounded-full text-foreground/40 hover:text-foreground/80 hover:bg-white/5 transition-colors"
          aria-label="Dismiss festival banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <button type="button" onClick={enter} className="relative flex items-center gap-3 w-full text-left pr-6">
          <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-b from-primary/30 to-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.3)]">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-primary/80 font-semibold">Live Event</p>
            <p className="text-sm font-bold text-foreground font-display leading-tight truncate">{event.name}</p>
            {daysLeft !== null && daysLeft >= 0 && (
              <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-foreground/65">
                <CalendarClock className="w-3 h-3" />
                {daysLeft === 0 ? 'Final day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
              </span>
            )}
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-primary">
            Enter <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
