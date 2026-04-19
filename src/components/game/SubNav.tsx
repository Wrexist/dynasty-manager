import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { GameScreen } from '@/types/game';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';
import { useMatchLocked } from '@/hooks/useGameSelectors';

interface SubNavItem {
  screen: GameScreen;
  label: string;
}

interface SubNavProps {
  items: SubNavItem[];
}

export function SubNav({ items }: SubNavProps) {
  const currentScreen = useGameStore(s => s.currentScreen);
  const setScreen = useGameStore(s => s.setScreen);
  const matchLocked = useMatchLocked();

  return (
    <div className="relative px-4 py-2">
      <nav
        aria-label="Sub navigation"
        className="flex gap-1 overflow-x-auto scrollbar-hide bg-card/40 backdrop-blur-xl border border-border/50 rounded-full p-1 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]"
      >
        {items.map(({ screen, label }) => {
          const active = currentScreen === screen;
          return (
            <button
              key={screen}
              onClick={() => { if (matchLocked) return; hapticLight(); setScreen(screen); }}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-colors',
                active ? 'text-primary-foreground' : 'text-foreground/70 hover:text-foreground'
              )}
            >
              {active && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-primary/90 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.2),0_4px_16px_hsl(var(--primary)/0.35)]"
                />
              )}
              <span className="relative">{label}</span>
            </button>
          );
        })}
      </nav>
      <div className="absolute right-4 top-2 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none rounded-r-full" />
    </div>
  );
}
