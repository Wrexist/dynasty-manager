/**
 * DevToolsPanel — floating bottom-right tester for Dynasty Manager.
 *
 * Visibility: enabled whenever Vite mode is non-production (so: `npm run
 * dev`, `npm run build:dev`, tests) OR when localStorage has the
 * `devtools` flag set to '1'. Evaluated synchronously at module load
 * with no useEffect, no gameStarted gate, and a max z-index so nothing
 * can hide the trigger. Shows a console banner on first render so you
 * can confirm it's mounted even before expanding the panel.
 *
 * Everything here talks to the live game store directly — no separate
 * dev-only actions on the store surface. Keeps the zustand API small.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

/**
 * Evaluate once at module load. Anything that's not a production bundle
 * gets the panel by default; production bundles require an opt-in flag.
 */
function resolveVisibility(): { visible: boolean; source: string } {
  // Vite populates import.meta.env.MODE and DEV. Treat anything non-
  // production as dev-eligible so build:dev and preview also get it.
  let mode = 'unknown';
  let dev = false;
  try {
    mode = import.meta.env?.MODE ?? 'unknown';
    dev = import.meta.env?.DEV === true || mode !== 'production';
  } catch {
    // import.meta can throw in exotic runtimes; fall through.
  }

  let flag = false;
  try {
    if (typeof window !== 'undefined') {
      flag = window.localStorage?.getItem('devtools') === '1';
    }
  } catch {
    // localStorage can throw in private-mode Safari etc.
  }

  if (flag) return { visible: true, source: `localStorage:devtools=1 (mode=${mode})` };
  if (dev) return { visible: true, source: `vite mode=${mode}` };
  return { visible: false, source: `vite mode=${mode}, no flag` };
}

const VISIBILITY = resolveVisibility();
if (typeof console !== 'undefined') {
  if (VISIBILITY.visible) {
    // eslint-disable-next-line no-console
    console.info(
      `%c[DevTools] mounted — ${VISIBILITY.source}`,
      'background:#f59e0b;color:#000;padding:2px 6px;border-radius:3px;font-weight:bold;',
    );
  } else {
    // eslint-disable-next-line no-console
    console.info(
      `[DevTools] hidden — ${VISIBILITY.source}. Run \`localStorage.devtools='1'; location.reload()\` to enable.`,
    );
  }
}

export function DevToolsPanel() {
  const gameStarted = useGameStore((s) => s.gameStarted);
  const season = useGameStore((s) => s.season);
  const week = useGameStore((s) => s.week);
  const totalWeeks = useGameStore((s) => s.totalWeeks);
  const playerClubId = useGameStore((s) => s.playerClubId);
  const budget = useGameStore((s) => s.clubs[s.playerClubId]?.budget ?? 0);
  const setScreen = useGameStore((s) => s.setScreen);
  const advanceWeek = useGameStore((s) => s.advanceWeek);
  const advanceToNextMatch = useGameStore((s) => s.advanceToNextMatch);
  const endSeason = useGameStore((s) => s.endSeason);
  const saveGame = useGameStore((s) => s.saveGame);
  const resetGame = useGameStore((s) => s.resetGame);

  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const budgetLabel = useMemo(() => {
    if (budget >= 1_000_000) return `£${(budget / 1_000_000).toFixed(1)}M`;
    if (budget >= 1_000) return `£${Math.round(budget / 1_000)}K`;
    return `£${budget}`;
  }, [budget]);

  // Gate on dev/flag. No gameStarted gate — panel is useful pre-game too
  // (can jump to Settings, reset slot, etc.).
  if (!VISIBILITY.visible) return null;

  const go = (screen: GameScreen) => {
    // Panel may be open from any route — title, club-select, /game. Ensure
    // we switch to /game so GameShell is the active route and can pick up
    // the screen-state change.
    if (gameStarted) {
      setScreen(screen);
      navigate('/game');
    } else {
      toast.info('Start or load a game first');
    }
    setOpen(false);
  };

  const needsGame = !gameStarted || !playerClubId;
  const requireGame = (fn: () => void) => () => {
    if (needsGame) {
      toast.info('Start or load a game first');
      return;
    }
    fn();
  };

  return (
    <>
      {/* Floating trigger — max z-index, above bottom nav with big safe-area buffer */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'fixed right-3 z-[2147483646] flex items-center gap-1.5 rounded-full px-3 py-2 shadow-xl',
          'bg-amber-500 text-black font-black text-[11px] uppercase tracking-wider',
          'border-2 border-amber-200',
          'hover:bg-amber-400 active:scale-95 transition-all',
        )}
        style={{ bottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
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
              'fixed z-[2147483647] right-3 left-3 sm:left-auto sm:w-[360px]',
              'bg-card border border-amber-500/40 rounded-xl shadow-2xl',
              'overflow-hidden flex flex-col',
            )}
            style={{
              bottom: 'calc(10rem + env(safe-area-inset-bottom, 0px))',
              maxHeight: 'calc(100vh - 14rem - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px))',
            }}
            role="dialog"
            aria-label="Developer tools"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-amber-500/30 bg-amber-500/10 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 shrink-0">Dev Tools</p>
                <span className="text-[10px] text-muted-foreground tabular-nums truncate">
                  {gameStarted ? `· S${season} W${week}/${totalWeeks} · ${budgetLabel}` : '· (no game loaded)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
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
                  <Pill tone="primary" onClick={requireGame(() => { inspectFirstPlayer(); setOpen(false); })}>
                    Inspect 1st player
                  </Pill>
                  <Pill tone="primary" onClick={requireGame(() => { inspectRivalClub(); setOpen(false); })}>
                    Inspect rival club
                  </Pill>
                </div>
              </Section>

              <Section icon={Clock} title="Time">
                <div className="grid grid-cols-3 gap-1.5">
                  <Pill onClick={requireGame(async () => {
                    await Promise.resolve(advanceWeek());
                    toast.success(`Advanced to W${useGameStore.getState().week}`);
                  })}>
                    +1 week
                  </Pill>
                  <Pill onClick={requireGame(async () => {
                    await Promise.resolve(advanceToNextMatch());
                    toast.success('Jumped to next match');
                  })}>
                    Next match
                  </Pill>
                  <Pill tone="danger" onClick={requireGame(() => {
                    endSeason();
                    toast.success('Season ended');
                  })}>
                    End season
                  </Pill>
                </div>
              </Section>

              <Section icon={TestTube} title="Scenarios">
                <div className="grid grid-cols-2 gap-1.5">
                  <Pill tone="primary" onClick={requireGame(() => {
                    const { count } = seedBallonDor();
                    toast.success(`Seeded Ballon d'Or (${count} players)`);
                    setScreen('ballon-dor');
                    setOpen(false);
                  })}>
                    Seed Ballon d'Or
                  </Pill>
                  <Pill onClick={requireGame(() => {
                    armPackPity();
                    toast.success('Pack pity armed');
                  })}>
                    Arm pack pity
                  </Pill>
                  <Pill onClick={requireGame(() => {
                    const r = injectInjury();
                    if (r) toast.success(`Injured ${r.playerName}`);
                    else toast.info('No healthy squad player to injure');
                  })}>
                    Random injury
                  </Pill>
                  <Pill onClick={requireGame(() => {
                    const { healed, fitnessReset } = healSquad();
                    toast.success(`Healed ${healed}, refreshed ${fitnessReset}`);
                  })}>
                    Heal & refresh
                  </Pill>
                  <Pill onClick={requireGame(() => {
                    const r = toggleWantsToLeave();
                    if (r) toast.success(`${r.playerName} wantsToLeave → ${r.nowWants ? 'true' : 'false'}`);
                    else toast.info('No eligible player');
                  })}>
                    Toggle "wants out"
                  </Pill>
                </div>
              </Section>

              <Section icon={Coins} title="Money">
                <div className="grid grid-cols-4 gap-1.5">
                  <Pill onClick={requireGame(() => { adjustBudget(1_000_000); toast.success('+£1M'); })}>+£1M</Pill>
                  <Pill onClick={requireGame(() => { adjustBudget(10_000_000); toast.success('+£10M'); })}>+£10M</Pill>
                  <Pill onClick={requireGame(() => { adjustBudget(100_000_000); toast.success('+£100M'); })}>+£100M</Pill>
                  <Pill tone="danger" onClick={requireGame(() => { adjustBudget(-10_000_000); toast.info('-£10M'); })}>−£10M</Pill>
                </div>
              </Section>

              <Section icon={Save} title="Save">
                <div className="grid grid-cols-2 gap-1.5">
                  <Pill onClick={requireGame(() => { saveGame(); toast.success('Saved'); })}>Save now</Pill>
                  <Pill tone="danger" onClick={requireGame(() => {
                    if (!window.confirm('Reset current save slot? This cannot be undone.')) return;
                    resetGame();
                    toast.success('Save reset');
                    setOpen(false);
                  })}>
                    Reset slot
                  </Pill>
                </div>
              </Section>

              <p className="text-[10px] text-muted-foreground/70 text-center pt-1">
                {VISIBILITY.source}
              </p>
            </div>

            {/* Footer hint */}
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
