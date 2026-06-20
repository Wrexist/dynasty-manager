/**
 * World Cup Festival hub — the home of the active date-boxed live event.
 *
 * Players check in once a day to earn Festival Points and claim a tiered,
 * World-Cup-themed reward track (sim-neutral manager XP). All progress is
 * device-global (localStorage) so it survives across save slots; only the XP
 * payout lands on the active career. Reachable from the Dashboard banner while
 * an event is live (registered as the `festival` GameScreen).
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Globe, Trophy, Check, Lock, Sparkles, CalendarClock, Gift, Flame } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { FlagIcon } from '@/components/game/FlagIcon';
import {
  getActiveLiveEvent,
  readActiveFestivalProgress,
  getTrackStatus,
  getEventDaysRemaining,
  canCheckInToday,
  type LiveEventProgress,
} from '@/utils/liveEvents';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { cn } from '@/lib/utils';

function FestivalHub() {
  const festivalCheckIn = useGameStore(s => s.festivalCheckIn);
  const claimFestivalTier = useGameStore(s => s.claimFestivalTier);

  const event = getActiveLiveEvent();
  const [progress, setProgress] = useState<LiveEventProgress | null>(
    () => (event ? readActiveFestivalProgress(event) : null),
  );

  if (!event || !progress) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center space-y-3">
        <Globe className="w-10 h-10 mx-auto text-foreground/30" />
        <h2 className="text-base font-bold text-foreground font-display">No festival running</h2>
        <p className="text-xs text-foreground/60">Check back during the next live event for themed rewards.</p>
      </div>
    );
  }

  const daysLeft = getEventDaysRemaining(event);
  const track = getTrackStatus(progress, event);
  const checkedInToday = !canCheckInToday(progress);
  const nextTier = track.find(t => !t.unlocked);
  const maxPoints = event.tiers[event.tiers.length - 1].points;
  const trackPct = Math.min(100, Math.round((progress.points / maxPoints) * 100));

  const handleCheckIn = () => {
    hapticLight();
    const result = festivalCheckIn();
    if (!result) return;
    hapticSuccess();
    setProgress(result);
    toast.success(`+${event.checkInPoints} Festival Points`, {
      description: 'Come back tomorrow to keep climbing the track.',
    });
  };

  const handleClaim = (tierId: string) => {
    hapticLight();
    const result = claimFestivalTier(tierId);
    if (!result) return;
    hapticSuccess();
    setProgress(result.progress);
    toast.success(`Reward claimed! +${result.xp} XP`);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-3 space-y-4 pb-8">
      {/* Hero */}
      <GlassPanel className="relative overflow-hidden p-4">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(130% 90% at 50% -20%, hsl(43 96% 46% / 0.18) 0%, hsl(43 96% 46% / 0.04) 40%, transparent 70%)',
          }}
        />
        <div className="relative flex items-start gap-3">
          <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-b from-primary/30 to-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.3)]">
            <Trophy className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-primary/80 font-semibold">Live Event</p>
            <h1 className="text-lg font-bold text-foreground font-display leading-tight">{event.name}</h1>
            <p className="text-[11px] text-foreground/70 leading-snug mt-0.5">{event.tagline}</p>
            {daysLeft !== null && daysLeft >= 0 && (
              <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded-full bg-white/5 border border-white/10">
                <CalendarClock className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-semibold text-foreground/80 tabular-nums">
                  {daysLeft === 0 ? 'Final day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                </span>
              </div>
            )}
          </div>
        </div>
        {/* Nation strip — World Cup flavour. */}
        <div className="relative flex items-center gap-2 mt-3.5 pt-3 border-t border-white/[0.06] overflow-hidden">
          {['Brazil', 'Argentina', 'France', 'England', 'Spain', 'Germany', 'Portugal', 'Italy'].map(n => (
            <FlagIcon key={n} nationality={n} size={22} className="rounded-sm shrink-0 opacity-90" />
          ))}
        </div>
      </GlassPanel>

      {/* Daily check-in */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground font-display">Daily Check-In</span>
          </div>
          <span className="text-[11px] font-semibold text-primary tabular-nums">{progress.points} pts</span>
        </div>

        {/* Track progress bar */}
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mb-1">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
            initial={false}
            animate={{ width: `${trackPct}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 28 }}
          />
        </div>
        <p className="text-[10px] text-foreground/55 mb-1">
          {nextTier
            ? `${nextTier.tier.points - progress.points} pts to ${nextTier.tier.label}`
            : 'All reward tiers unlocked — nice run!'}
        </p>
        <p className="text-[10px] text-primary/70 mb-3">+{event.matchWinPoints} pts for every match you win during the festival.</p>

        <button
          type="button"
          onClick={handleCheckIn}
          disabled={checkedInToday}
          className={cn(
            'w-full flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-sm tracking-wide transition-transform active:scale-[0.98]',
            checkedInToday
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
              : cn(
                  'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground',
                  'shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.25),0_4px_12px_-4px_hsl(43_96%_46%/0.4)]',
                ),
          )}
        >
          {checkedInToday ? (
            <>
              <Check className="w-4 h-4" />
              Checked in — back tomorrow
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Check in for +{event.checkInPoints} pts
            </>
          )}
        </button>
      </GlassPanel>

      {/* Reward track */}
      <GlassPanel className="p-4">
        <h2 className="text-sm font-bold text-foreground font-display mb-3">Reward Track</h2>
        <ul className="space-y-2">
          {track.map(({ tier, unlocked, claimed, claimable }) => (
            <li
              key={tier.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors',
                claimed
                  ? 'bg-emerald-500/10 border-emerald-500/25'
                  : claimable
                    ? 'bg-primary/15 border-primary/40 shadow-[0_0_12px_-4px_hsl(43_96%_46%/0.5)]'
                    : 'bg-white/[0.025] border-white/[0.06]',
              )}
            >
              <div className={cn(
                'shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.25)]',
                claimed ? 'bg-emerald-500/25 text-emerald-300'
                  : unlocked ? 'bg-primary/25 text-primary'
                    : 'bg-white/10 text-foreground/40',
              )}>
                {claimed ? <Check className="w-4 h-4" /> : unlocked ? <Gift className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold', claimed ? 'text-foreground/60' : 'text-foreground')}>
                  {tier.label}
                </p>
                <p className="text-[10px] text-foreground/55 tabular-nums">{tier.points} pts · +{tier.xp} XP</p>
              </div>
              {claimable ? (
                <button
                  type="button"
                  onClick={() => handleClaim(tier.id)}
                  className={cn(
                    'shrink-0 px-3 h-8 rounded-lg text-xs font-bold tracking-wide',
                    'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] active:scale-[0.97] transition-transform',
                  )}
                >
                  Claim
                </button>
              ) : (
                <span className={cn(
                  'shrink-0 text-[10px] font-semibold uppercase tracking-wide',
                  claimed ? 'text-emerald-300/80' : 'text-foreground/35',
                )}>
                  {claimed ? 'Claimed' : 'Locked'}
                </span>
              )}
            </li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  );
}

export default FestivalHub;
