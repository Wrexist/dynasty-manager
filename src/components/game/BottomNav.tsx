import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GameScreen } from '@/types/game';
import { LayoutDashboard, Users, Target, ArrowLeftRight, Briefcase, User, Mail } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MoreDrawer } from './MoreDrawer';
import { hapticLight } from '@/utils/haptics';
import { useMatchLocked, useCareerUnemployed } from '@/hooks/useGameSelectors';

const SQUAD_SCREENS: GameScreen[] = ['squad', 'staff', 'youth-academy', 'training'];
const MARKET_SCREENS: GameScreen[] = ['transfers', 'scouting', 'packs'];

const tabs: { screen: GameScreen; label: string; icon: React.ElementType; group?: GameScreen[] }[] = [
  { screen: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { screen: 'squad', label: 'Squad', icon: Users, group: SQUAD_SCREENS },
  { screen: 'tactics', label: 'Tactics', icon: Target },
  { screen: 'transfers', label: 'Market', icon: ArrowLeftRight, group: MARKET_SCREENS },
];

const unemployedTabs: { screen: GameScreen; label: string; icon: React.ElementType; group?: GameScreen[] }[] = [
  { screen: 'job-market', label: 'Jobs', icon: Briefcase },
  { screen: 'career-overview', label: 'Career', icon: User },
  { screen: 'inbox', label: 'Inbox', icon: Mail },
];

export function BottomNav() {
  const { currentScreen, messages, incomingOffers, jobOffers, gameMode } = useGameStore(useShallow(s => ({
    currentScreen: s.currentScreen, messages: s.messages, incomingOffers: s.incomingOffers,
    jobOffers: s.jobOffers, gameMode: s.gameMode,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  const matchLocked = useMatchLocked();
  const isUnemployed = useCareerUnemployed();
  const reduceMotion = useReducedMotion();
  const unreadCount = useMemo(() => messages.filter(m => !m.read).length, [messages]);
  const pendingOffers = incomingOffers.length;
  const hasJobOffers = gameMode === 'career' && jobOffers.length > 0;
  const activeTabs = isUnemployed ? unemployedTabs : tabs;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-3 pt-2 pb-2 safe-area-bottom pointer-events-none">
      <nav
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          'pointer-events-auto max-w-lg mx-auto flex items-center gap-1 bg-card/40 backdrop-blur-xl border border-border/50 rounded-full p-1 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]',
          matchLocked && 'opacity-60',
        )}
      >
        {activeTabs.map(({ screen, label, icon: Icon, group }) => {
          const active = group
            ? group.includes(currentScreen)
            : currentScreen === screen;
          return (
            <button
              key={screen}
              type="button"
              onClick={() => { if (matchLocked) return; hapticLight(); setScreen(screen); }}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              aria-disabled={matchLocked || undefined}
              className={cn(
                'relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-full transition-colors min-h-[44px]',
                matchLocked ? 'pointer-events-none' : active ? 'text-primary-foreground' : 'text-foreground/70',
              )}
            >
              {active && (
                <motion.span
                  layoutId="bottom-tab-pill"
                  initial={false}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }
                  }
                  className="absolute inset-0 rounded-full bg-primary/90 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.2),0_4px_16px_hsl(var(--primary)/0.35)]"
                />
              )}
              <span className="relative inline-flex flex-col items-center gap-0.5">
                <span className="relative">
                  <Icon className="w-5 h-5" />
                  {(screen === 'job-market' || screen === 'dashboard') && hasJobOffers && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-1 -right-1.5 w-2 h-2 bg-primary rounded-full animate-pulse"
                    />
                  )}
                  {screen === 'dashboard' && !hasJobOffers && unreadCount > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-1 -right-1.5 w-2 h-2 bg-destructive rounded-full animate-pulse"
                    />
                  )}
                  {screen === 'inbox' && unreadCount > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-1 -right-1.5 w-2 h-2 bg-destructive rounded-full animate-pulse"
                    />
                  )}
                  {screen === 'transfers' && pendingOffers > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-1 -right-1.5 w-2 h-2 bg-destructive rounded-full animate-pulse"
                    />
                  )}
                </span>
                <span className="text-[10px] font-medium">{label}</span>
              </span>
            </button>
          );
        })}
        <MoreDrawer disabled={matchLocked} />
      </nav>
    </div>
  );
}
