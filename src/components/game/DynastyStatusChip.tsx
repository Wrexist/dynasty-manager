/**
 * Compact, persistent Dashboard status strip: lifetime tier badge + current
 * daily streak. Makes the retention loops visible at a glance (the daily reward
 * modal only shows once a day; the Legacy page is a tap away). Reads
 * device-global state on mount — cheap, and stable within a session.
 *
 * Hidden entirely for a brand-new player with no streak and no recorded
 * dynasty, so it never clutters a first session.
 */
import { useMemo } from 'react';
import { Flame, Medal, ChevronRight } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { readDailyStreak } from '@/store/helpers/persistence';
import { loadHall } from '@/utils/hallOfManagers';
import { computeManagerLegacy } from '@/utils/managerLegacy';
import { hapticLight } from '@/utils/haptics';
import { cn } from '@/lib/utils';

export function DynastyStatusChip() {
  const setScreen = useGameStore(s => s.setScreen);

  const { streak, tier, trophies } = useMemo(() => {
    const s = readDailyStreak();
    const legacy = computeManagerLegacy(loadHall());
    return { streak: s?.current ?? 0, tier: legacy.tier, trophies: legacy.totalTrophies };
  }, []);

  // Nothing to show for a fresh install with no streak and no dynasty yet.
  if (streak <= 0 && trophies <= 0) return null;

  const open = () => { hapticLight(); setScreen('dynasty-legacy'); };

  return (
    <button
      type="button"
      onClick={open}
      aria-label={`Manager legacy: ${tier} tier${streak > 0 ? `, ${streak} day streak` : ''}`}
      className={cn(
        'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-colors',
        'bg-white/[0.025] hover:bg-white/[0.05] active:bg-white/[0.075]',
        'border border-white/[0.06]',
      )}
    >
      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-primary/15 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.25)]">
        <Medal className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.16em] text-primary/80 font-semibold leading-none">Legacy</p>
        <p className="text-sm font-bold text-foreground leading-tight">{tier}</p>
      </div>
      {streak > 0 && (
        <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-full bg-white/[0.04] border border-white/10">
          <Flame className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-foreground tabular-nums">{streak}</span>
        </div>
      )}
      <ChevronRight className="w-4 h-4 text-foreground/40 shrink-0" aria-hidden />
    </button>
  );
}
