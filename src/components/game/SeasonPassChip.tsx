/**
 * Compact Dashboard chip for the Dynasty Pass — shows current points, the next
 * tier label, and a "NEW" pip when tiers are ready to claim. Taps through to the
 * full Season Pass track. Self-hides for a fresh season with zero progress so it
 * never clutters a brand-new career.
 */
import { Ticket, ChevronRight, Sparkles } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { hapticLight } from '@/utils/haptics';
import { nextLockedTier, claimableTierCount, seasonPassProgressPct } from '@/utils/seasonPass';
import { cn } from '@/lib/utils';

export function SeasonPassChip() {
  const seasonPass = useGameStore(s => s.seasonPass);
  const setScreen = useGameStore(s => s.setScreen);

  const claimable = claimableTierCount(seasonPass);
  // Nothing earned yet and nothing to claim — stay out of the way on a fresh season.
  if (seasonPass.points <= 0 && claimable <= 0) return null;

  const next = nextLockedTier(seasonPass);
  const pct = seasonPassProgressPct(seasonPass);
  const open = () => { hapticLight(); setScreen('season-pass'); };

  return (
    <button
      type="button"
      onClick={open}
      aria-label={`Dynasty Pass: ${seasonPass.points} points${claimable > 0 ? `, ${claimable} rewards ready to claim` : ''}`}
      className={cn(
        'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-colors',
        'bg-white/[0.025] hover:bg-white/[0.05] active:bg-white/[0.075]',
        'border border-white/[0.06]',
      )}
    >
      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-primary/15 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.25)]">
        <Ticket className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.16em] text-primary/80 font-semibold leading-none">Dynasty Pass</p>
        <div className="mt-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[10px] text-foreground/55 mt-1 truncate">
          {next ? `${next.points - seasonPass.points} pts to ${next.label}` : 'Track complete!'}
        </p>
      </div>
      {claimable > 0 && (
        <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-full bg-primary/20 border border-primary/40">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-bold text-primary tabular-nums">{claimable}</span>
        </div>
      )}
      <ChevronRight className="w-4 h-4 text-foreground/40 shrink-0" aria-hidden />
    </button>
  );
}
