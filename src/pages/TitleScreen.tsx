import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { getSlotSummaries } from '@/store/slices/orchestrationSlice';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Play, Settings, Trash2, Save, Swords, ChevronRight, RotateCcw } from 'lucide-react';
import { PremiumSparkle } from '@/components/game/icons/PremiumSparkle';
import { cn } from '@/lib/utils';
import { getSuffix } from '@/utils/helpers';
import { signalReady, saveStorageReady } from '@/main';
import { errorToast } from '@/utils/gameToast';
import { hapticMedium, hapticLight } from '@/utils/haptics';
import {
  readCommunityPackSlotPref,
  writeCommunityPackSlotPref,
  clearCommunityPackSlotPref,
  isSaveStorageHydrated,
  getFlag,
  STORAGE_KEYS,
} from '@/store/helpers/persistence';
import { CommunityPackPopup } from '@/components/CommunityPackPopup';
import { isPro, isSubscriptionActive } from '@/utils/monetization';
import { hasUnseenWhatsNew } from '@/data/whatsNew';
import { SettingsBody } from './SettingsPage';
import type { TitleFloatingCircle } from '@/types/game';


const TitleScreen = () => {
  const navigate = useNavigate();
  const monetization = useGameStore(s => s.monetization);
  const loadGame = useGameStore(s => s.loadGame);
  const resetGame = useGameStore(s => s.resetGame);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Which slot is currently prompting the community pack popup. null = hidden.
  const [communityPackSlot, setCommunityPackSlot] = useState<number | null>(null);
  const userIsPro = isPro(monetization);
  const hasActiveSub = isSubscriptionActive(monetization);

  // Signal to main.tsx that the first screen is mounted (hides splash)
  useEffect(() => { signalReady?.(); }, []);

  // Re-read "What's New" seen state on every mount so the NEW badge
  // clears once the user returns from /whats-new. `refreshKey` already
  // bumps on focus-related flows; this mirrors that cadence.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const whatsNewUnseen = useMemo(() => hasUnseenWhatsNew(), [refreshKey]);

  // Prefetch the Dashboard chunk while the user reads the title screen.
  // Also kick off the ~2.5MB national player pool fetch in the background —
  // it's not needed for the title screen itself, but New Game / Continue
  // will both need it within a few seconds, so we want it warming in the
  // network cache while the user is reading. Both prefetches are
  // fire-and-forget; failures fall through to lazy fetch on first use.
  useEffect(() => {
    const timer = setTimeout(() => {
      import('./Dashboard').catch(() => {});
      import('@/data/nationalPlayerPoolAccess').then(m => m.loadNationalPool()).catch(() => {});
      import('@/data/playerTemplatesAccess').then(m => m.loadClubTemplates()).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Save slots live in IndexedDB (authoritative) with a localStorage mirror
  // (may be empty on mobile when quota was exceeded). Until the IDB hydration
  // promise resolves, `getSlotSummaries` returns empty — so we gate the
  // slot picker on it and bump `refreshKey` once hydration lands.
  const [hydrated, setHydrated] = useState(isSaveStorageHydrated());
  useEffect(() => {
    if (hydrated) return;
    let cancelled = false;
    saveStorageReady.then(() => {
      if (cancelled) return;
      setHydrated(true);
      setRefreshKey(k => k + 1);
    });
    return () => { cancelled = true; };
  }, [hydrated]);

  // `getSlotSummaries` is a module-level import with no closure state, so it
  // is referentially stable — `refreshKey` is the only real dep (bumping it
  // forces a re-read after delete / reset actions from the Sheet menu).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const slots = useMemo(() => getSlotSummaries(), [refreshKey, hydrated]);
  const handleContinue = (slot: number) => {
    if (loadGame(slot)) {
      queueMicrotask(() => navigate('/game'));
      return;
    }
    // If loadGame set a loadError, the SaveRecoveryDialog will render over
    // this screen with the appropriate message + actions (recovery / skip).
    // Only fall back to the toast when the slot is genuinely empty — the
    // dialog isn't shown for that path.
    if (!useGameStore.getState().loadError) {
      errorToast('Save data not found', 'This slot is empty.');
    }
  };

  const handleNewGame = (slot: number) => {
    const pref = readCommunityPackSlotPref(slot);
    if (pref === null) {
      // First New Game on this slot — ask once, then remember the choice.
      setCommunityPackSlot(slot);
      return;
    }
    // Returning to a slot that already answered the community pack popup —
    // still funnel through the subscription paywall on first sight.
    const shouldShowSubscribe =
      !userIsPro && !hasActiveSub && !getFlag(STORAGE_KEYS.SUBSCRIBE_ONBOARDING_SEEN);
    const nextRoute = shouldShowSubscribe ? '/subscribe' : '/mode-select';
    navigate(nextRoute, { state: { slot, communityPackEnabled: pref, returnTo: '/mode-select' } });
  };

  const handleCommunityPackChoice = (enabled: boolean) => {
    const slot = communityPackSlot;
    if (slot === null) return;
    writeCommunityPackSlotPref(slot, enabled);
    setCommunityPackSlot(null);
    // Show the subscription onboarding once per device, before mode-select.
    // Skip for users who already have Pro (one-time purchase or active sub)
    // and for those who already answered the trial paywall on a prior run.
    const shouldShowSubscribe =
      !userIsPro && !hasActiveSub && !getFlag(STORAGE_KEYS.SUBSCRIBE_ONBOARDING_SEEN);
    const nextRoute = shouldShowSubscribe ? '/subscribe' : '/mode-select';
    navigate(nextRoute, { state: { slot, communityPackEnabled: enabled, returnTo: '/mode-select' } });
  };

  const handleDelete = (slot: number) => {
    hapticMedium();
    resetGame(slot);
    // Clear the per-slot community pack pref so the popup shows again
    // on the next "New Game" for this slot.
    clearCommunityPackSlotPref(slot);
    setConfirmDelete(null);
    setRefreshKey(k => k + 1);
  };

  // Generate floating circle definitions once
  const floatingCircles = useMemo<TitleFloatingCircle[]>(() => [
    { id: 0, size: 280, x: 15, y: 10, opacity: 0.04, color: 'hsl(43 96% 46%)', duration: 22, driftX: 60, driftY: 40 },
    { id: 1, size: 180, x: 75, y: 70, opacity: 0.03, color: 'hsl(215 60% 50%)', duration: 18, driftX: -50, driftY: 35 },
    { id: 2, size: 350, x: 50, y: 40, opacity: 0.025, color: 'hsl(43 96% 46%)', duration: 25, driftX: 45, driftY: -55 },
    { id: 3, size: 120, x: 20, y: 75, opacity: 0.05, color: 'hsl(215 60% 50%)', duration: 16, driftX: -40, driftY: -30 },
    { id: 4, size: 220, x: 80, y: 20, opacity: 0.03, color: 'hsl(43 96% 46%)', duration: 20, driftX: -55, driftY: 50 },
    { id: 5, size: 160, x: 40, y: 85, opacity: 0.04, color: 'hsl(215 60% 50%)', duration: 19, driftX: 35, driftY: -45 },
  ], []);

  const buttonVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.5 + i * 0.1, duration: 0.5, ease: 'easeOut' as const },
    }),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-6 pt-10 pb-14 overflow-hidden relative safe-area-top safe-area-bottom">
      {/* Floating background circles — pure CSS animation for GPU efficiency.
          The .title-float-circle class gives index.css a clean handle to
          disable the drift under prefers-reduced-motion. */}
      {floatingCircles.map((circle) => (
        <div
          key={circle.id}
          className="title-float-circle absolute rounded-full blur-2xl pointer-events-none will-change-transform"
          style={{
            width: circle.size,
            height: circle.size,
            left: `${circle.x}%`,
            top: `${circle.y}%`,
            backgroundColor: circle.color,
            opacity: circle.opacity,
            '--drift-x': `${circle.driftX}px`,
            '--drift-y': `${circle.driftY}px`,
            animation: `float-drift ${circle.duration}s ease-in-out infinite`,
          } as React.CSSProperties}
        />
      ))}

      {/* What's New — small floating pill, top-right corner. Surfaces the
          latest release notes without taking a full row in the menu list.
          Pulses a green dot until the user opens the page once. */}
      <motion.button
        type="button"
        onClick={() => { hapticLight(); navigate('/whats-new'); }}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.45, ease: 'easeOut' }}
        whileTap={{ scale: 0.94 }}
        className={cn(
          'absolute right-4 z-20 flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full',
          'bg-white/[0.06] border border-white/15 backdrop-blur-md',
          'text-[11px] font-semibold text-foreground/90 tracking-wide',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_14px_-6px_rgba(0,0,0,0.6)]',
          'transition-colors active:bg-white/[0.12] hover:bg-white/[0.09]',
          whatsNewUnseen && 'border-primary/35',
        )}
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
        aria-label={whatsNewUnseen ? 'What’s new — unread update' : 'What’s new'}
      >
        <PremiumSparkle className="w-4 h-4 shrink-0" />
        <span>What&apos;s New!</span>
        {whatsNewUnseen && (
          <span
            aria-hidden
            className="ml-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_hsl(150_85%_60%/0.7)]"
          />
        )}
      </motion.button>

      {/* Title section */}
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        className="text-center relative z-10 flex flex-col items-center"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative mb-5"
        >
          {/* Soft halo behind logo for premium glow */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-full blur-2xl opacity-60"
            style={{ background: 'radial-gradient(circle, hsl(43 96% 46% / 0.35) 0%, transparent 70%)' }}
          />
          <img
            src="/logo.png"
            alt="Dynasty Manager"
            className="w-28 h-28 drop-shadow-[0_6px_24px_hsl(43_96%_46%/0.35)]"
          />
        </motion.div>
        <h1 className="text-[3.25rem] leading-none font-black text-foreground tracking-tight font-display">DYNASTY</h1>
        <p className="text-xl text-primary font-bold tracking-[0.38em] mt-1.5 font-display">MANAGER</p>
        <div className="flex items-center justify-center gap-2.5 mt-3.5">
          <span aria-hidden className="h-px w-8 bg-gradient-to-r from-transparent to-primary/40" />
          <p className="text-[10px] text-muted-foreground tracking-[0.42em] uppercase font-display">Football Edition</p>
          <span aria-hidden className="h-px w-8 bg-gradient-to-l from-transparent to-primary/40" />
        </div>
      </motion.div>

      {/* Save Slots + CTAs */}
      <div className="mt-10 flex flex-col gap-2.5 w-full max-w-sm relative z-10">
        <motion.div
          custom={0}
          variants={buttonVariants}
          initial="hidden"
          animate="visible"
          className="flex items-center justify-between px-1 mb-1"
        >
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-semibold">Save Slots</p>
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.3em] font-semibold">
            {slots.filter(s => s.exists).length}/{slots.length}
          </p>
        </motion.div>

        {!hydrated ? (
          // Save slots live in IndexedDB; until hydration lands, render skeleton
          // rows that match the populated-slot shape. Without this the empty
          // "New Game" state flashes for ~100-300ms on mobile and the user can
          // tap it before their real save loads — risking an accidental overwrite.
          [1, 2, 3].map((slotN, idx) => (
            <motion.div
              key={`skeleton-${slotN}`}
              custom={idx + 1}
              variants={buttonVariants}
              initial="hidden"
              animate="visible"
              aria-busy="true"
              aria-label="Loading save slot"
            >
              <GlassPanel className="p-0">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/10 animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-3 w-2/3 rounded bg-white/[0.06] animate-pulse" />
                    <div className="h-2.5 w-1/2 rounded bg-white/[0.04] animate-pulse" />
                  </div>
                </div>
              </GlassPanel>
            </motion.div>
          ))
        ) : slots.map((slot, idx) => (
          <motion.div key={slot.slot} custom={idx + 1} variants={buttonVariants} initial="hidden" animate="visible">
            {slot.exists ? (
              <GlassPanel className="p-0">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { hapticLight(); handleContinue(slot.slot); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:scale-[0.985] transition-transform"
                    aria-label={`Continue — ${slot.clubName}, Season ${slot.season} Week ${slot.week}`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/25 to-primary/10 border border-primary/30 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_12px_-4px_hsl(43_96%_46%/0.4)]">
                        <Save className="w-[18px] h-[18px] text-primary" />
                      </div>
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-background/90 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0 pr-8">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-foreground truncate">{slot.clubName}</p>
                        {slot.gameMode === 'career' && (
                          <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-[1px] rounded-full font-semibold shrink-0 uppercase tracking-wider border border-primary/25">
                            Career
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 flex items-center gap-1.5">
                        <RotateCcw className="w-3 h-3 text-primary/70 shrink-0" aria-hidden />
                        Season {slot.season} · Wk {slot.week}
                        {slot.position && ` · ${slot.position}${getSuffix(Number(slot.position))}`}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); hapticLight(); setConfirmDelete(slot.slot); }}
                    className="absolute top-1.5 right-1.5 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 active:bg-destructive/20 transition-colors"
                    aria-label={`Delete save slot ${slot.slot}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {confirmDelete === slot.slot && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="border-t border-white/[0.08] px-4 py-3 flex items-center gap-2"
                  >
                    <p className="text-[11px] text-muted-foreground flex-1">Delete this save permanently?</p>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="h-8 px-3 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(slot.slot)}
                      className="h-8 px-3 rounded-lg text-[11px] font-semibold bg-destructive/20 text-red-300 border border-destructive/30 hover:bg-destructive/30 active:bg-destructive/40 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                    >
                      Delete
                    </button>
                  </motion.div>
                )}
              </GlassPanel>
            ) : (
              <GlassPanel
                className="p-0"
                onClick={() => handleNewGame(slot.slot)}
                aria-label={`Start new game in slot ${slot.slot}`}
              >
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-dashed border-white/15 flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <Play className="w-[18px] h-[18px] text-muted-foreground fill-muted-foreground/30" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground/90">New Game</p>
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5">Slot {slot.slot} · Start a new dynasty</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                </div>
              </GlassPanel>
            )}
          </motion.div>
        ))}

        {/* Divider between save slots and quick actions */}
        <motion.div
          custom={slots.length + 1}
          variants={buttonVariants}
          initial="hidden"
          animate="visible"
          className="flex items-center gap-3 px-1 pt-3 pb-0.5"
        >
          <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </motion.div>

        {/* Challenge Mode */}
        <motion.div custom={slots.length + 2} variants={buttonVariants} initial="hidden" animate="visible">
          <GlassPanel
            className="p-0"
            onClick={() => navigate('/challenge')}
            aria-label="Challenge Mode"
          >
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/25 to-primary/10 border border-primary/30 flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_12px_-4px_hsl(43_96%_46%/0.4)]">
                <Swords className="w-[18px] h-[18px] text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">Challenge Mode</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Curated scenarios · bespoke objectives</p>
              </div>
              <ChevronRight className="w-4 h-4 text-primary/70 shrink-0" />
            </div>
          </GlassPanel>
        </motion.div>

        {/* Settings */}
        <motion.div custom={slots.length + 3} variants={buttonVariants} initial="hidden" animate="visible">
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                onClick={() => hapticLight()}
                className="w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[0.985] transition-transform"
                aria-label="Open settings"
              >
                <GlassPanel className="p-0">
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-11 h-11 rounded-xl bg-white/[0.06] border border-white/15 flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                      <Settings className="w-[18px] h-[18px] text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold text-foreground">Settings</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Speed · display · purchases</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                  </div>
                </GlassPanel>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-background border-border/50 rounded-t-2xl h-[85vh] max-h-[85vh] flex flex-col">
              <SheetHeader>
                <SheetTitle className="text-foreground">Settings</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto -mx-6 px-6 pt-2">
                <SettingsBody variant="title" />
              </div>
            </SheetContent>
          </Sheet>
        </motion.div>
      </div>

      <p className="absolute bottom-5 text-[10px] text-muted-foreground/50 tracking-[0.4em] font-display">v{__APP_VERSION__}</p>

      <CommunityPackPopup
        open={communityPackSlot !== null}
        onChoice={handleCommunityPackChoice}
        onClose={() => setCommunityPackSlot(null)}
      />
    </div>
  );
};

export default TitleScreen;
