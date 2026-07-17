/**
 * Dynasty Pass — the free, season-long reward track.
 *
 * Players earn Season Pass Points just by playing (matches, monthly objectives,
 * trophies) and claim a 15-tier track of manager-XP rewards. Progress is
 * save-scoped (`GameState.seasonPass`) and resets each season; trophies won seed
 * the next season's pass. Sim-neutral by construction (XP-only payout). Reachable
 * from the More drawer and a Dashboard progress chip.
 */
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Ticket, Check, Lock, Gift, Sparkles, Star } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import {
  getSeasonPassStatus,
  seasonPassProgressPct,
  nextLockedTier,
  claimableTierCount,
} from '@/utils/seasonPass';
import { SEASON_PASS_POINTS } from '@/config/seasonPass';
import { cn } from '@/lib/utils';

function SeasonPassPage() {
  const seasonPass = useGameStore(s => s.seasonPass);
  const season = useGameStore(s => s.season);
  const claimSeasonPassTier = useGameStore(s => s.claimSeasonPassTier);

  const track = getSeasonPassStatus(seasonPass);
  const pct = seasonPassProgressPct(seasonPass);
  const next = nextLockedTier(seasonPass);
  const claimable = claimableTierCount(seasonPass);

  const handleClaim = (tier: number) => {
    hapticLight();
    const result = claimSeasonPassTier(tier);
    if (!result) return;
    hapticSuccess();
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
            <Ticket className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-primary/80 font-semibold">Free Reward Track</p>
            <h1 className="text-lg font-bold text-foreground font-display leading-tight">Dynasty Pass</h1>
            <p className="text-[11px] text-foreground/70 leading-snug mt-0.5">
              Season {season} · earn points every match, objective and trophy.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold text-primary tabular-nums leading-none">{seasonPass.points}</p>
            <p className="text-[9px] uppercase tracking-wide text-foreground/50 mt-0.5">points</p>
          </div>
        </div>

        {/* Overall track progress bar */}
        <div className="relative mt-4">
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 28 }}
            />
          </div>
          <p className="text-[10px] text-foreground/55 mt-1.5">
            {next
              ? `${next.points - seasonPass.points} pts to ${next.label}`
              : 'Every tier unlocked — an immortal season!'}
          </p>
        </div>

        {/* How points are earned */}
        <div className="relative mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-2 gap-x-3 gap-y-1.5">
          {[
            { label: 'Match played', v: `+${SEASON_PASS_POINTS.matchPlayed}` },
            { label: 'Match won', v: `+${SEASON_PASS_POINTS.win}` },
            { label: 'Objective done', v: `+${SEASON_PASS_POINTS.objectiveCompleted}` },
            { label: 'Trophy won', v: `+${SEASON_PASS_POINTS.trophy}` },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-[10px] text-foreground/60">{row.label}</span>
              <span className="text-[10px] font-semibold text-primary tabular-nums">{row.v}</span>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Reward track */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground font-display">Reward Track</h2>
          {claimable > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/40 text-[10px] font-bold uppercase tracking-wide text-primary">
              <Sparkles className="w-3 h-3" />
              {claimable} new
            </span>
          )}
        </div>
        <ul className="space-y-2">
          {track.map(({ tier, unlocked, claimed, claimable: canClaim }) => (
            <li
              key={tier.tier}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors',
                claimed
                  ? 'bg-emerald-500/10 border-emerald-500/25'
                  : canClaim
                    ? 'bg-primary/15 border-primary/40 shadow-[0_0_12px_-4px_hsl(43_96%_46%/0.5)]'
                    : 'bg-white/[0.025] border-white/[0.06]',
              )}
            >
              <div className={cn(
                'shrink-0 w-8 h-8 rounded-full flex items-center justify-center relative',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.25)]',
                claimed ? 'bg-emerald-500/25 text-emerald-300'
                  : unlocked ? 'bg-primary/25 text-primary'
                    : 'bg-white/10 text-foreground/40',
              )}>
                {claimed ? <Check className="w-4 h-4" /> : unlocked ? <Gift className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                <span className="absolute -bottom-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-background border border-white/10 text-[9px] font-bold text-foreground/70 flex items-center justify-center tabular-nums">
                  {tier.tier}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold', claimed ? 'text-foreground/60' : 'text-foreground')}>
                  {tier.label}
                </p>
                <p className="text-[10px] text-foreground/55 tabular-nums flex items-center gap-1">
                  {tier.points} pts
                  <span className="text-foreground/30">·</span>
                  <Star className="w-2.5 h-2.5 text-primary/70" />
                  +{tier.xp} XP
                </p>
              </div>
              {canClaim ? (
                <button
                  type="button"
                  onClick={() => handleClaim(tier.tier)}
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

export default SeasonPassPage;
