import { useGameStore } from '@/store/gameStore';
import { GameScreen } from '@/types/game';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

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

  return (
    <div className="relative">
      <div className="flex gap-1.5 overflow-x-auto px-4 pr-10 py-2 scrollbar-hide">
        {items.map(({ screen, label }) => (
          <button
            key={screen}
            onClick={() => { hapticLight(); setScreen(screen); }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0',
              currentScreen === screen
                ? 'bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)]'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Scroll fade indicator */}
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none" />
    </div>
  );
}
