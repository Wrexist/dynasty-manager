import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { GameScreen } from '@/types/game';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';
import { useMatchLocked } from '@/hooks/useGameSelectors';
import { SPRING_SNAPPY } from '@/config/motion';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';

export interface SubNavItem {
  screen: GameScreen;
  label: string;
  /** Optional Tailwind bg color utility — renders a small dot badge on the pill. */
  dot?: string;
}

interface SubNavProps {
  items: SubNavItem[];
  /** Unique id for the sliding layout indicator; prevents cross-nav interference. */
  layoutId?: string;
}

export function SubNav({ items, layoutId = 'subnav-pill' }: SubNavProps) {
  const { t } = useTranslation();
  const currentScreen = useGameStore(s => s.currentScreen);
  const setScreen = useGameStore(s => s.setScreen);
  const matchLocked = useMatchLocked();
  const reduceMotion = useReducedMotionPref();

  return (
    <div className="relative px-4 py-2">
      <nav
        aria-label={t('subNav.subNavigation')}
        role="tablist"
        className={cn(
          'flex gap-1 overflow-x-auto scrollbar-hide bg-card/95 border border-border/50 rounded-full p-1 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]',
          matchLocked && 'opacity-60',
        )}
      >
        {items.map(({ screen, label, dot }) => {
          const active = currentScreen === screen;
          return (
            <button
              key={screen}
              type="button"
              role="tab"
              aria-selected={active}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              disabled={matchLocked}
              onClick={() => {
                if (matchLocked) return;
                // Haptic fires BEFORE the active-tab early return: re-tapping
                // the current tab used to produce literally nothing — no
                // navigation, no animation, no haptic — which reads as a
                // broken control rather than a no-op.
                hapticLight();
                if (active) return;
                setScreen(screen);
              }}
              className={cn(
                'relative px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap shrink-0',
                'transition-[transform,colors] duration-150 active:scale-[0.97] motion-reduce:active:scale-100',
                active ? 'text-primary-foreground' : 'text-foreground/70 hover:text-foreground',
                matchLocked && 'cursor-not-allowed',
              )}
            >
              {active && (
                <motion.span
                  layoutId={layoutId}
                  initial={false}
                  transition={
                    reduceMotion ? { duration: 0 } : SPRING_SNAPPY
                  }
                  className={cn(
                    'absolute inset-0 rounded-full will-change-transform shadow-lg',
                    'bg-gradient-to-b from-primary/80 via-primary to-primary/70',
                  )}
                />
              )}
              <span className="relative inline-flex items-center gap-1.5">
                {label}
                {dot && (
                  <span
                    className={cn('w-1.5 h-1.5 rounded-full', dot)}
                    aria-hidden="true"
                  />
                )}
              </span>
            </button>
          );
        })}
      </nav>
      <div className="absolute right-4 top-2 bottom-2 w-8 bg-gradient-to-l from-card/80 to-transparent pointer-events-none rounded-r-full" />
    </div>
  );
}
