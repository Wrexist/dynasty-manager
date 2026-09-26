import { Star, X, ChevronRight } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { isStarterKitAvailable, getStarterKitRemainingMs } from '@/utils/monetization';
import { STARTER_KIT } from '@/config/monetization';
import { hapticLight } from '@/utils/haptics';

/**
 * Week-1 Starter Kit placement on the Dashboard.
 *
 * The only purchase surface for the kit used to be a card buried in the Shop —
 * reachable only via More → Shop — so most new managers never saw it before its
 * 7-day window expired. This banner surfaces the same offer (same product, same
 * price, no fake countdown) on the screen new players actually live on, and
 * deep-links to the Shop's purchase card. Self-hides when purchased, dismissed
 * or expired via isStarterKitAvailable.
 */
export function StarterKitBanner() {
  const monetization = useGameStore(s => s.monetization);
  const dismissStarterKit = useGameStore(s => s.dismissStarterKit);
  const setScreen = useGameStore(s => s.setScreen);

  if (!isStarterKitAvailable(monetization)) return null;

  const daysLeft = Math.max(1, Math.ceil(getStarterKitRemainingMs(monetization) / 86_400_000));

  return (
    // The dismiss X is a 44px sibling of the Shop link, not an absolutely
    // positioned 30px glyph over its corner: a hit area that big overlapping the
    // link's chevron would turn "open the Shop" taps into dismissals.
    <GlassPanel className="py-1.5 pl-3 pr-0 flex items-center gap-1 border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--gold)/0.04)]">
      <button
        type="button"
        onClick={() => { hapticLight(); setScreen('shop'); }}
        className="flex-1 min-w-0 min-h-11 flex items-center gap-3 text-left"
        aria-label={`${STARTER_KIT.name} — view in Shop`}
      >
        <div className="w-9 h-9 rounded-xl bg-[hsl(var(--gold)/0.15)] border border-[hsl(var(--gold)/0.3)] flex items-center justify-center shrink-0">
          <Star className="w-4 h-4 text-[hsl(var(--gold))]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground">
            {STARTER_KIT.name}
            <span className="ml-2 text-micro font-semibold uppercase tracking-wider text-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.12)] px-1.5 py-0.5 rounded-full">
              {daysLeft} day{daysLeft === 1 ? '' : 's'} left
            </span>
          </p>
          <p className="text-micro text-muted-foreground leading-snug truncate">
            Manager identity cosmetics for new managers — view in Shop
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/70 shrink-0" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => { hapticLight(); dismissStarterKit(); }}
        aria-label="Dismiss starter kit offer"
        className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full text-foreground/40 hover:text-foreground/80 hover:bg-white/5 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </GlassPanel>
  );
}
