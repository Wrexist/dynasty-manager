import { useGameStore } from '@/store/gameStore';
import { GameScreen } from '@/types/game';
import { LayoutDashboard, Users, Target, ArrowLeftRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MoreDrawer } from './MoreDrawer';
import { hapticLight } from '@/utils/haptics';

const SQUAD_SCREENS: GameScreen[] = ['squad', 'staff', 'youth-academy', 'training'];
const MARKET_SCREENS: GameScreen[] = ['transfers', 'scouting'];

const tabs: { screen: GameScreen; label: string; icon: React.ElementType; group?: GameScreen[] }[] = [
  { screen: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { screen: 'squad', label: 'Squad', icon: Users, group: SQUAD_SCREENS },
  { screen: 'tactics', label: 'Tactics', icon: Target },
  { screen: 'transfers', label: 'Market', icon: ArrowLeftRight, group: MARKET_SCREENS },
];

export function BottomNav() {
  const { currentScreen, setScreen, messages, incomingOffers } = useGameStore();
  const unreadCount = messages.filter(m => !m.read).length;
  const pendingOffers = incomingOffers.length;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map(({ screen, label, icon: Icon, group }) => {
          const active = group
            ? group.includes(currentScreen)
            : currentScreen === screen;
          return (
            <button
              key={screen}
              onClick={() => { hapticLight(); setScreen(screen); }}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-0 relative',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className="relative">
                <Icon className={cn('w-5 h-5', active && 'drop-shadow-[0_0_6px_hsl(var(--primary))]')} />
                {screen === 'dashboard' && unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1.5 w-2 h-2 bg-destructive rounded-full" />
                )}
                {screen === 'transfers' && pendingOffers > 0 && (
                  <div className="absolute -top-1 -right-1.5 w-2 h-2 bg-destructive rounded-full" />
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
        <MoreDrawer />
      </div>
    </nav>
  );
}
