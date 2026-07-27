/**
 * Manager Legacy — the cross-save meta-progression hub ("Dynasty Legacy").
 *
 * Aggregates every recorded dynasty (Hall of Managers entries) into one
 * lifetime record: total trophies, clubs managed, win rate, best finishes and
 * a lifetime tier badge. Read-only and derived on mount — no persistence of its
 * own. The per-dynasty breakdown lives in the Hall of Fame (linked below).
 */
import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Crown, Trophy, Medal, Award, Star, Shield, Globe2, Target, Flame, ChevronRight } from 'lucide-react';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PageHint } from '@/components/game/PageHint';
import { useGameStore } from '@/store/gameStore';
import { loadHall } from '@/utils/hallOfManagers';
import { computeManagerLegacy, tierProgress } from '@/utils/managerLegacy';
import { track } from '@/utils/analytics';
import type { LegacyTier } from '@/types/game';
import { cn } from '@/lib/utils';

const TIER_META: Record<LegacyTier, { icon: React.ElementType; blurb: string }> = {
  Rookie: { icon: Star, blurb: 'Your story is just beginning.' },
  Journeyman: { icon: Shield, blurb: 'Silverware on the board.' },
  Established: { icon: Medal, blurb: 'A manager of real pedigree.' },
  Elite: { icon: Award, blurb: 'Among the modern greats.' },
  Legendary: { icon: Trophy, blurb: 'A name written into history.' },
  Immortal: { icon: Crown, blurb: 'A dynasty that will never be forgotten.' },
};

function ordinal(pos: number): string {
  if (pos <= 0) return '—';
  const s = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
  return `${pos}${s}`;
}

function DynastyLegacy() {
  const setScreen = useGameStore(s => s.setScreen);
  const legacy = useMemo(() => computeManagerLegacy(loadHall()), []);
  const TierIcon = TIER_META[legacy.tier].icon;
  const nextTier = tierProgress(legacy.totalTrophies);

  useEffect(() => {
    track('legacy_viewed', { tier: legacy.tier, trophies: legacy.totalTrophies });
  }, [legacy.tier, legacy.totalTrophies]);

  const stats: { label: string; value: string | number; icon: React.ElementType }[] = [
    { label: 'League Titles', value: legacy.totalTitles, icon: Trophy },
    { label: 'Continental', value: legacy.totalContinentalWins, icon: Globe2 },
    { label: 'Domestic Cups', value: legacy.totalCupWins, icon: Award },
    { label: 'League Cups', value: legacy.totalLeagueCupWins, icon: Medal },
    { label: 'Dynasties', value: legacy.dynasties, icon: Shield },
    { label: 'Seasons', value: legacy.totalSeasons, icon: Flame },
    { label: 'Win Rate', value: `${legacy.winRate}%`, icon: Target },
    { label: 'Best Finish', value: ordinal(legacy.bestPosition), icon: Star },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <PageHint
        screen="dynasty-legacy"
        title="Manager Legacy"
        body="Your lifetime record across every save. Trophies, clubs and milestones from all your dynasties add up here into a single legacy — and a tier that rises as you win."
      />

      {/* Hero — lifetime tier + total trophies */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <GlassPanel className="relative overflow-hidden p-5 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{ background: 'radial-gradient(130% 90% at 50% -10%, hsl(var(--gold) / 0.20) 0%, hsl(var(--gold) / 0.04) 42%, transparent 72%)' }}
          />
          <div className="relative">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-b from-primary/30 to-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.3)] mb-3">
              <TierIcon className="w-8 h-8" />
            </div>
            <p className="text-micro uppercase tracking-[0.2em] text-primary/80 font-semibold">Lifetime Tier</p>
            <h1 className="text-2xl font-black text-foreground font-display leading-tight">{legacy.tier}</h1>
            <p className="text-xs text-foreground/65 mt-1">{TIER_META[legacy.tier].blurb}</p>

            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-lg font-black text-primary tabular-nums">{legacy.totalTrophies}</span>
              <span className="text-xs text-foreground/70">career trophies</span>
            </div>
            <p className="text-micro text-foreground/55 mt-2">
              {nextTier
                ? `${nextTier.remaining} more ${nextTier.remaining === 1 ? 'trophy' : 'trophies'} to ${nextTier.next}`
                : 'Maximum tier reached — a true Immortal.'}
            </p>
          </div>
        </GlassPanel>
      </motion.div>

      {legacy.dynasties === 0 ? (
        <GlassPanel className="p-8 text-center">
          <Star className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No legacy yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Complete a season to start building your dynasty.</p>
        </GlassPanel>
      ) : (
        <>
          {/* Stat grid */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <GlassPanel className="p-4">
              <div className="grid grid-cols-4 gap-3">
                {stats.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="text-center">
                    <Icon className="w-4 h-4 text-primary/80 mx-auto mb-1" />
                    <p className="text-sm font-black text-foreground tabular-nums leading-none">{value}</p>
                    <p className="text-micro text-muted-foreground mt-1 leading-tight">{label}</p>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </motion.div>

          {/* Clubs managed */}
          {legacy.clubsManaged.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <GlassPanel className="p-4">
                <p className="text-micro uppercase tracking-[0.16em] text-primary/80 font-semibold mb-2">
                  Clubs Managed · {legacy.clubsManaged.length}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {legacy.clubsManaged.map(club => (
                    <span key={club} className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-foreground/85">
                      {club}
                    </span>
                  ))}
                </div>
              </GlassPanel>
            </motion.div>
          )}
        </>
      )}

      {/* Per-dynasty detail link */}
      <button
        type="button"
        onClick={() => setScreen('hall-of-managers')}
        className={cn(
          'w-full flex items-center justify-between gap-3 p-4 rounded-xl text-left transition-colors',
          'bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.06]',
        )}
      >
        <div className="flex items-center gap-3">
          <Crown className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Hall of Fame</p>
            <p className="text-micro text-muted-foreground">Every dynasty, ranked</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-foreground/40" />
      </button>
    </div>
  );
}

export default DynastyLegacy;
