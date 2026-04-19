import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GameScreen } from '@/types/game';
import { LayoutDashboard, Users, Target, ArrowLeftRight, Briefcase, User, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
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
  const unreadCount = useMemo(() => messages.filter(m => !m.read).length, [messages]);
  const pendingOffers = incomingOffers.length;
  const hasJobOffers = gameMode === 'career' && jobOffers.length > 0;
  const activeTabs = isUnemployed ? unemployedTabs : tabs;

  return (
    <nav role="navigation" aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {activeTabs.map(({ screen, label, icon: Icon, group }) => {
          const active = group
            ? group.includes(currentScreen)
            : currentScreen === screen;
          return (
            <button
              key={screen}
              onClick={() => { if (matchLocked) return; hapticLight(); setScreen(screen); }}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              aria-disabled={matchLocked || undefined}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-0 relative min-h-[44px] justify-center',
                matchLocked ? 'pointer-events-none opacity-40' : active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className="relative">
                <Icon className={cn('w-5 h-5', active && 'drop-shadow-[0_0_6px_hsl(var(--primary))]')} />
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
              </div>
              <span className="text-[10px] font-medium">{label}</span>
              {active && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
        <MoreDrawer disabled={matchLocked} />
      </div>
    </nav>
  );
}
