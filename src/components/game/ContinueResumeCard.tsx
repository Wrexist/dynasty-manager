/**
 * "Continue where you left off" resume card (G5).
 *
 * Shown once per app session when a returning player lands on the Dashboard
 * mid-season with a pending decision. Deep-links to the single highest-priority
 * pending item (see `selectResumeItem`). Derived entirely from existing state —
 * no new save shape; the once-per-session guard is sessionStorage only.
 */
import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { readSessionJson, writeSessionJson, STORAGE_KEYS } from '@/store/helpers/persistence';
import { selectResumeItem, type ResumeSignals } from '@/utils/resumeCard';
import { hapticLight } from '@/utils/haptics';
import { track } from '@/utils/analytics';
import { cn } from '@/lib/utils';

export function ContinueResumeCard() {
  const { t } = useTranslation();
  const setScreen = useGameStore(s => s.setScreen);
  const playerClubId = useGameStore(s => s.playerClubId);
  const clubs = useGameStore(s => s.clubs);
  const players = useGameStore(s => s.players);
  const incomingOffers = useGameStore(s => s.incomingOffers);
  const fixtures = useGameStore(s => s.fixtures);
  const week = useGameStore(s => s.week);
  const season = useGameStore(s => s.season);

  // Once-per-session: capture whether it was already shown at first mount so a
  // navigate-away-and-back doesn't re-surface it within the same session.
  const [alreadyShown] = useState(() => readSessionJson<boolean>(STORAGE_KEYS.RESUME_CARD_SHOWN) === true);
  const [dismissed, setDismissed] = useState(false);

  const item = useMemo(() => {
    const club = clubs[playerClubId];
    if (!club) return null;
    // Don't nag a brand-new career on its very first screen.
    if (season === 1 && week === 1) return null;

    const lineupIncomplete = (club.lineup || []).filter(id => !!players[id]).length < 11;
    const unplayedMatchThisWeek = (fixtures || []).some(
      m => !m.played && m.week === week && (m.homeClubId === playerClubId || m.awayClubId === playerClubId),
    );
    const expiringStarContract = (club.playerIds || []).some(id => {
      const p = players[id];
      return p && p.contractEnd <= season && p.overall >= 75;
    });
    const signals: ResumeSignals = {
      lineupIncomplete,
      incomingOffers: incomingOffers?.length ?? 0,
      unplayedMatchThisWeek,
      expiringStarContract,
    };
    return selectResumeItem(signals);
  }, [clubs, playerClubId, players, incomingOffers, fixtures, week, season]);

  const shouldShow = !alreadyShown && !dismissed && !!item;

  // Mark shown as soon as it becomes eligible, so it counts as this session's
  // one appearance even if the player navigates away without acting.
  useEffect(() => {
    if (shouldShow) writeSessionJson(STORAGE_KEYS.RESUME_CARD_SHOWN, true);
  }, [shouldShow]);

  if (!shouldShow || !item) return null;

  const go = () => {
    hapticLight();
    track('resume_card_tap', { screen: item.screen, reason: item.reason });
    setDismissed(true);
    setScreen(item.screen);
  };

  const dismiss = () => {
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'relative overflow-hidden rounded-xl p-3.5 border border-primary/30',
          'bg-gradient-to-br from-primary/15 via-primary/5 to-transparent',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
        )}
        role="region"
        aria-label={t('continueResumeCard.continueWhereYouLeftOff')}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-2 right-2 p-2 -m-1 rounded-full text-foreground/40 hover:text-foreground/80 hover:bg-white/5 transition-colors"
          aria-label={t('continueResumeCard.dismissResumeCard')}
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <button type="button" onClick={go} className="relative flex items-center gap-3 w-full text-left pr-6">
          <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-b from-primary/30 to-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.3)]">
            <DynamicIcon name={item.icon} className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-primary/80 font-semibold">Pick up where you left off</p>
            <p className="text-sm font-bold text-foreground font-display leading-tight truncate">{item.title}</p>
            <p className="text-[11px] text-foreground/65 leading-snug mt-0.5">{item.description}</p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-primary">
            Go <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
