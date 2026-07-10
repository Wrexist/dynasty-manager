/**
 * Daily login-streak reward modal.
 *
 * Auto-presents once per local day when a reward is claimable and a career is
 * active (it's mounted inside the Dashboard, which only renders in-game). The
 * streak itself is device-global; claiming grants escalating manager XP into
 * the active save and advances the run. Skipping a day breaks the streak —
 * the loss-aversion loop that pulls players back daily.
 *
 * Gated behind the first-launch welcome tutorial (WELCOME_SHOWN) so a brand-new
 * player isn't hit with two overlays at once. Re-show within a session is
 * suppressed via a tab-scoped flag so it doesn't pop on every Dashboard visit.
 *
 * Visual language matches OnboardingChecklist: LIQUID_GLASS_SURFACE, a specular
 * crescent, a gold accent edge, spring entrance, focus trap + Escape close.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Flame, Check, X, Sparkles, Gift } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { evaluateDailyStreak, localDateKey, type DailyStreakStatus } from '@/utils/dailyStreak';
import { readDailyStreak, getFlag, readSessionJson, writeSessionJson, STORAGE_KEYS } from '@/store/helpers/persistence';
import { DAILY_REWARD_XP, DAILY_STREAK_CYCLE } from '@/config/gameBalance';
import { LIQUID_GLASS_SURFACE } from '@/components/game/GlassPanel';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { usePresentationSlot } from '@/hooks/usePresentationQueue';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { cn } from '@/lib/utils';

// Tab-scoped guard: stamp the day we last auto-opened so the modal doesn't
// re-pop on every Dashboard remount within a session.
const SESSION_SHOWN_KEY = 'dynasty-daily-reward-shown';

export function DailyRewardModal() {
  const claimDailyStreakReward = useGameStore(s => s.claimDailyStreakReward);

  // Evaluate the streak once on mount (pure function of stored record + clock).
  const initialStatus = useMemo<DailyStreakStatus>(() => evaluateDailyStreak(readDailyStreak()), []);

  const [open, setOpen] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [status, setStatus] = useState<DailyStreakStatus>(initialStatus);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const close = () => setOpen(false);
  // Presentation queue (G3): defer to higher-priority overlays (digest,
  // celebrations, decisions) — the daily reward shows last.
  const active = usePresentationSlot('dailyReward', open);
  const visible = open && active;
  useFocusTrap(cardRef, visible);
  useEscapeClose(close, visible);

  // Clear the post-claim auto-close timer if the modal unmounts first (e.g. the
  // player navigates away within the 1.5s window), avoiding a setState on an
  // unmounted component.
  useEffect(() => () => { if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current); }, []);

  // Decide whether to auto-open: claimable, past the first-launch tutorial,
  // and not already auto-shown for today in this tab.
  useEffect(() => {
    if (!initialStatus.canClaim) return;
    if (!getFlag(STORAGE_KEYS.WELCOME_SHOWN)) return;
    const today = localDateKey();
    if (readSessionJson<string>(SESSION_SHOWN_KEY) === today) return;
    writeSessionJson(SESSION_SHOWN_KEY, today);
    setOpen(true);
  }, [initialStatus]);

  const handleClaim = () => {
    if (claimed) return;
    hapticLight();
    const result = claimDailyStreakReward();
    if (!result) { setOpen(false); return; }
    hapticSuccess();
    setStatus(result);
    setClaimed(true);
    toast.success(`Day ${result.current} streak!`, {
      description: `+${result.rewardXP} XP collected. Come back tomorrow to keep it going.`,
    });
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 1500);
  };

  if (!initialStatus.canClaim) return null;

  const milestoneDay = DAILY_STREAK_CYCLE;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 safe-area-bottom"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Daily reward"
        >
          <motion.div
            ref={cardRef}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className={cn(LIQUID_GLASS_SURFACE, 'w-full max-w-sm overflow-visible')}
            onClick={e => e.stopPropagation()}
          >
            {/* Specular crescent — same material treatment as the rest of the UI. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-2/3 rounded-2xl overflow-hidden"
              style={{
                background:
                  'radial-gradient(120% 90% at 50% -20%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 38%, rgba(255,255,255,0) 70%)',
                mixBlendMode: 'screen',
              }}
            />
            {/* Gold accent edge. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent"
            />

            <button
              type="button"
              onClick={close}
              className="absolute top-2.5 right-2.5 p-2 -m-1 rounded-full text-foreground/40 hover:text-foreground/80 hover:bg-white/5 transition-colors"
              aria-label="Close daily reward"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative p-5">
              {/* Header */}
              <div className="flex items-center gap-3 mb-1">
                <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-b from-primary/30 to-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.3)]">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-primary/80 font-semibold">Daily Reward</p>
                  <h2 className="text-base font-bold text-foreground font-display leading-tight">
                    {status.current}-day streak
                  </h2>
                </div>
              </div>
              <p className="text-[11px] text-foreground/70 mb-4 leading-snug">
                {status.streakBroken
                  ? 'Welcome back — your streak restarts today. Log in daily to climb the rewards.'
                  : 'Log in every day to keep your streak alive and grow the rewards.'}
              </p>

              {/* 7-day cycle track */}
              <div className="grid grid-cols-7 gap-1.5 mb-5">
                {DAILY_REWARD_XP.map((xp, i) => {
                  const day = i + 1;
                  const isToday = day === status.dayInCycle;
                  const isCollected = day < status.dayInCycle || (isToday && claimed);
                  const isMilestone = day === milestoneDay;
                  return (
                    <div
                      key={day}
                      className={cn(
                        'relative flex flex-col items-center justify-center rounded-lg py-2 gap-0.5 border transition-colors',
                        isCollected
                          ? 'bg-emerald-500/15 border-emerald-500/30'
                          : isToday
                            ? 'bg-primary/20 border-primary/50 shadow-[0_0_12px_-2px_hsl(43_96%_46%/0.5)]'
                            : 'bg-white/[0.03] border-white/[0.06]',
                      )}
                    >
                      {isToday && !claimed && (
                        <motion.span
                          aria-hidden
                          className="absolute inset-0 rounded-lg ring-1 ring-primary/60"
                          animate={{ opacity: [0.3, 0.8, 0.3] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center',
                        isCollected ? 'text-emerald-300' : isToday ? 'text-primary' : 'text-foreground/40',
                      )}>
                        {isCollected
                          ? <Check className="w-3.5 h-3.5" />
                          : isMilestone
                            ? <Gift className="w-3.5 h-3.5" />
                            : <Sparkles className="w-3 h-3" />}
                      </div>
                      <span className={cn(
                        'text-[9px] font-semibold tabular-nums leading-none',
                        isToday ? 'text-primary' : isCollected ? 'text-emerald-300/90' : 'text-foreground/50',
                      )}>
                        +{xp}
                      </span>
                      <span className="text-[8px] text-foreground/40 leading-none">D{day}</span>
                    </div>
                  );
                })}
              </div>

              {/* Claim button */}
              <button
                type="button"
                onClick={handleClaim}
                disabled={claimed}
                className={cn(
                  'w-full flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-sm tracking-wide transition-transform active:scale-[0.98]',
                  claimed
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : cn(
                        'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground',
                        'shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.25),0_4px_12px_-4px_hsl(43_96%_46%/0.4)]',
                      ),
                )}
              >
                {claimed ? (
                  <>
                    <Check className="w-4 h-4" />
                    Collected +{status.rewardXP} XP
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Claim +{status.rewardXP} XP
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
