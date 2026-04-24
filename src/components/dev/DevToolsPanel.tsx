/**
 * DevToolsPanel — floating bottom-right tester for Dynasty Manager.
 *
 * Gated on `import.meta.env.DEV || localStorage.getItem('devtools') === '1'`
 * so prod builds stay clean by default. Set `localStorage.devtools = '1'`
 * in a production deploy to enable on-device testing.
 *
 * Everything here talks to the live game store directly — no separate
 * dev-only actions on the store surface. Keeps the zustand API small.
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Wrench, X, Zap, Coins, Clock, Navigation, TestTube, Save } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { GameScreen } from '@/types/game';
import {
  adjustBudget,
  armPackPity,
  healSquad,
  injectInjury,
  inspectFirstPlayer,
  inspectRivalClub,
  seedBallonDor,
  toggleWantsToLeave,
} from '@/utils/devSeeders';

const SCREEN_SHORTCUTS: { screen: GameScreen; label: string }[] = [
  { screen: 'dashboard', label: 'Dashboard' },
  { screen: 'squad', label: 'Squad' },
  { screen: 'tactics', label: 'Tactics' },
  { screen: 'transfers', label: 'Market' },
  { screen: 'scouting', label: 'Scouting' },
  { screen: 'packs', label: 'Packs' },
  { screen: 'youth-academy', label: 'Youth' },
  { screen: 'ballon-dor', label: "Ballon d'Or" },
  { screen: 'training', label: 'Training' },
  { screen: 'staff', label: 'Staff' },
  { screen: 'facilities', label: 'Facilities' },
  { screen: 'finance', label: 'Finance' },
  { screen: 'cup', label: 'Cup' },
  { screen: 'league-table', label: 'League' },
  { screen: 'inbox', label: 'Inbox' },
  { screen: 'trophy-cabinet', label: 'Trophies' },
  { screen: 'season-summary', label: 'Season' },
  { screen: 'manager-profile', label: 'Profile' },
  { screen: 'perks', label: 'Perks' },
  { screen: 'board', label: 'Board' },
  { screen: 'calendar', label: 'Calendar' },
  { screen: 'merchandise', label: 'Merch' },
  { screen: 'shop', label: 'Shop' },
  { screen: 'settings', label: 'Settings' },
];

function shouldRender(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem('devtools') === '1';
  } catch {
    return false;
  }
}

export function DevToolsPanel() {
  const gameStarted = useGameStore((s) => s.gameStarted);
  const season = useGameStore((s) => s.season);
  const week = useGameStore((s) => s.week);
  const totalWeeks = useGameStore((s) => s.totalWeeks);
  const budget = useGameStore((s) => s.clubs[s.playerClubId]?.budget ?? 0);
  const setScreen = useGameStore((s) => s.setScreen);
  const advanceWeek = useGameStore((s) => s.advanceWeek);
  const advanceToNextMatch = useGameStore((s) => s.advanceToNextMatch);
  const endSeason = useGameStore((s) => s.endSeason);
  const saveGame = useGameStore((s) => s.saveGame);
  const resetGame = useGameStore((s) => s.resetGame);

  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);

  // Check eligibility once after mount — avoids SSR/client mismatch noise.
  useEffect(() => {
    setEnabled(shouldRender());
  }, []);

  const budgetLabel = useMemo(() => {
    if (budget >= 1_000_000) return `£${(budget / 1_000_000).toFixed(1)}M`;
    if (budget >= 1_000) return `£${Math.round(budget / 1_000)}K`;
    return `£${budget}`;
  }, [budget]);

  if (!enabled || !gameStarted) return null;

  const go = (screen: GameScreen) => {
    setScreen(screen);
    setOpen(false);
  };

  return (
    <>
      {/* Floating trigger — sits above the bottom nav with safe-area padding */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'fixed right-3 z-[90] flex items-center gap-1.5 rounded-full px-3 py-2 shadow-lg',
          'bg-amber-500 text-black font-bold text-[11px] uppercase tracking-wider',
          'border-2 border-amber-300/60',
          'hover:bg-amber-400 active:scale-95 transition-all',
        )}
        style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
        aria-label={open ? 'Close dev tools' : 'Open dev tools'}
      >
        <Wrench className="w-3.5 h-3.5" />
        Dev
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="devtools-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'fixed z-[91] right-3 left-3 sm:left-auto sm:w-[360px]',
              'bg-card border border-amber-500/40 rounded-xl shadow-2xl',
              'overflow-hidden flex flex-col',
            )}
            style={{
              bottom: 'calc(8.5rem + env(safe-area-inset-bottom, 0px))',
              maxHeight: 'calc(100vh - 12rem - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px))',
            }}
            role="dialog"
            aria-label="Developer tools"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-amber-500/30 bg-amber-500/10 shrink-0">
              <div className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Dev Tools</p>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  · S{season} W{week}/{totalWeeks} · {budgetLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 p-3 space-y-4">
              <Section icon={Navigation} title="Screens">
                <div className="grid grid-cols-3 gap-1.5">
                  {SCREEN_SHORTCUTS.map((s) => (
                    <Pill key={s.screen} onClick={() => go(s.screen)}>
                      {s.label}
                    </Pill>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  <Pill
                    tone="primary"
                    onClick={() => {
                      inspectFirstPlayer();
                      setOpen(false);
                    }}
                  >
                    Inspect 1st player
                  </Pill>
                  <Pill
                    tone="primary"
                    onClick={() => {
                      inspectRivalClub();
                      setOpen(false);
                    }}
                  >
                    Inspect rival club
                  </Pill>
                </div>
              </Section>

              <Section icon={Clock} title="Time">
                <div className="grid grid-cols-3 gap-1.5">
                  <Pill
                    onClick={async () => {
                      await Promise.resolve(advanceWeek());
                      toast.success(`Advanced to W${useGameStore.getState().week}`);
                    }}
                  >
                    +1 week
                  </Pill>
                  <Pill
                    onClick={async () => {
                      await Promise.resolve(advanceToNextMatch());
                      toast.success('Jumped to next match');
                    }}
                  >
                    Next match
                  </Pill>
                  <Pill
                    tone="danger"
                    onClick={() => {
                      endSeason();
                      toast.success('Season ended');
                    }}
                  >
                    End season
                  </Pill>
                </div>
              </Section>

              <Section icon={TestTube} title="Scenarios">
                <div className="grid grid-cols-2 gap-1.5">
                  <Pill
                    tone="primary"
                    onClick={() => {
                      const { count } = seedBallonDor();
                      toast.success(`Seeded Ballon d'Or (${count} players)`);
                      setScreen('ballon-dor');
                      setOpen(false);
                    }}
                  >
                    Seed Ballon d'Or
                  </Pill>
                  <Pill
                    onClick={() => {
                      armPackPity();
                      toast.success('Pack pity armed');
                    }}
                  >
                    Arm pack pity
                  </Pill>
                  <Pill
                    onClick={() => {
                      const r = injectInjury();
                      if (r) toast.success(`Injured ${r.playerName}`);
                      else toast.info('No healthy squad player to injure');
                    }}
                  >
                    Random injury
                  </Pill>
                  <Pill
                    onClick={() => {
                      const { healed, fitnessReset } = healSquad();
                      toast.success(`Healed ${healed}, refreshed ${fitnessReset}`);
                    }}
                  >
                    Heal & refresh
                  </Pill>
                  <Pill
                    onClick={() => {
                      const r = toggleWantsToLeave();
                      if (r) toast.success(`${r.playerName} wantsToLeave → ${r.nowWants ? 'true' : 'false'}`);
                      else toast.info('No eligible player');
                    }}
                  >
                    Toggle "wants out"
                  </Pill>
                </div>
              </Section>

              <Section icon={Coins} title="Money">
                <div className="grid grid-cols-4 gap-1.5">
                  <Pill
                    onClick={() => {
                      adjustBudget(1_000_000);
                      toast.success('+£1M');
                    }}
                  >
                    +£1M
                  </Pill>
                  <Pill
                    onClick={() => {
                      adjustBudget(10_000_000);
                      toast.success('+£10M');
                    }}
                  >
                    +£10M
                  </Pill>
                  <Pill
                    onClick={() => {
                      adjustBudget(100_000_000);
                      toast.success('+£100M');
                    }}
                  >
                    +£100M
                  </Pill>
                  <Pill
                    tone="danger"
                    onClick={() => {
                      adjustBudget(-10_000_000);
                      toast.info('-£10M');
                    }}
                  >
                    −£10M
                  </Pill>
                </div>
              </Section>

              <Section icon={Save} title="Save">
                <div className="grid grid-cols-2 gap-1.5">
                  <Pill
                    onClick={() => {
                      saveGame();
                      toast.success('Saved');
                    }}
                  >
                    Save now
                  </Pill>
                  <Pill
                    tone="danger"
                    onClick={() => {
                      if (!window.confirm('Reset current save slot? This cannot be undone.')) return;
                      resetGame();
                      toast.success('Save reset');
                      setOpen(false);
                    }}
                  >
                    Reset slot
                  </Pill>
                </div>
              </Section>

              <p className="text-[10px] text-muted-foreground/70 text-center pt-1">
                Gated on DEV mode or localStorage <code className="text-amber-400">devtools=1</code>
              </p>
            </div>

            {/* Quick time hint */}
            <div className="shrink-0 flex items-center justify-center gap-1 px-3 py-1.5 border-t border-border/40 text-[9px] text-muted-foreground">
              <Zap className="w-2.5 h-2.5 text-amber-400" />
              <span>Side-stepping game logic — expect state drift</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Sub-pieces ─────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Wrench;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3 h-3 text-amber-400" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

type PillTone = 'default' | 'primary' | 'danger';

function Pill({
  children,
  onClick,
  tone = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: PillTone;
}) {
  const base =
    'text-[10px] font-medium px-2 py-1.5 rounded-md transition-colors active:scale-[0.97] min-h-[32px] flex items-center justify-center text-center leading-tight';
  const toneClasses: Record<PillTone, string> = {
    default: 'bg-muted/50 text-foreground hover:bg-muted',
    primary: 'bg-primary/20 text-primary hover:bg-primary/30',
    danger: 'bg-destructive/15 text-destructive hover:bg-destructive/25',
  };
  return (
    <button type="button" onClick={onClick} className={cn(base, toneClasses[tone])}>
      {children}
    </button>
  );
}
