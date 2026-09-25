/**
 * Manager Legacy — the cross-save meta-progression hub ("Dynasty Legacy").
 *
 * Aggregates every recorded dynasty (Hall of Managers entries) into one
 * lifetime record: total trophies, clubs managed, win rate, best finishes and
 * a lifetime tier. Each tier unlocks earned cosmetics and a Manager Career
 * job-market reputation bonus (`config/managerPass.ts` → LEGACY_TIER_UNLOCKS);
 * both are derived from the Hall on demand — no persistence of its own. The
 * per-dynasty breakdown lives in the Hall of Fame (linked below).
 */
import { useEffect, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { motion } from 'framer-motion';
import { Crown, Trophy, Medal, Award, Star, Shield, Globe2, Target, Flame, ChevronRight, Briefcase, Ticket, Check, Lock } from 'lucide-react';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PageHint } from '@/components/game/PageHint';
import { ProfileBannerLayer, EarnedCosmeticRow } from '@/components/game/EarnedCosmetics';
import { useGameStore } from '@/store/gameStore';
import { loadHall } from '@/utils/hallOfManagers';
import {
  computeManagerLegacy,
  tierProgress,
  LEGACY_TIER_ORDER,
  legacyTierThreshold,
  legacyJobReputationBonus,
} from '@/utils/managerLegacy';
import { getActiveCosmetic } from '@/utils/monetization';
import { LEGACY_TIER_UNLOCKS } from '@/config/managerPass';
import { COSMETIC_ITEMS } from '@/config/monetization';
import { track } from '@/utils/analytics';
import { hapticLight } from '@/utils/haptics';
import type { LegacyTier } from '@/types/game';
import type { TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';

const TIER_META: Record<LegacyTier, { icon: React.ElementType; nameKey: TranslationKey; blurbKey: TranslationKey }> = {
  Rookie: { icon: Star, nameKey: 'dynastyLegacy.tier.Rookie', blurbKey: 'dynastyLegacy.blurb.Rookie' },
  Journeyman: { icon: Shield, nameKey: 'dynastyLegacy.tier.Journeyman', blurbKey: 'dynastyLegacy.blurb.Journeyman' },
  Established: { icon: Medal, nameKey: 'dynastyLegacy.tier.Established', blurbKey: 'dynastyLegacy.blurb.Established' },
  Elite: { icon: Award, nameKey: 'dynastyLegacy.tier.Elite', blurbKey: 'dynastyLegacy.blurb.Elite' },
  Legendary: { icon: Trophy, nameKey: 'dynastyLegacy.tier.Legendary', blurbKey: 'dynastyLegacy.blurb.Legendary' },
  Immortal: { icon: Crown, nameKey: 'dynastyLegacy.tier.Immortal', blurbKey: 'dynastyLegacy.blurb.Immortal' },
};

const itemById = new Map(COSMETIC_ITEMS.map(c => [c.id, c]));

function ordinal(pos: number): string {
  if (pos <= 0) return '—';
  const s = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
  return `${pos}${s}`;
}

function DynastyLegacy() {
  const { t } = useTranslation();
  const setScreen = useGameStore(s => s.setScreen);
  const monetization = useGameStore(s => s.monetization);
  const equipEarnedCosmetic = useGameStore(s => s.equipEarnedCosmetic);
  const clearCosmetic = useGameStore(s => s.clearCosmetic);
  const legacy = useMemo(() => computeManagerLegacy(loadHall()), []);
  const TierIcon = TIER_META[legacy.tier].icon;
  const nextTier = tierProgress(legacy.totalTrophies);
  const reachedIdx = LEGACY_TIER_ORDER.indexOf(legacy.tier);
  const jobBonus = legacyJobReputationBonus(legacy.tier);
  const bannerId = getActiveCosmetic(monetization, 'profile_banner');

  useEffect(() => {
    track('legacy_viewed', { tier: legacy.tier, trophies: legacy.totalTrophies });
  }, [legacy.tier, legacy.totalTrophies]);

  const stats: { labelKey: TranslationKey; value: string | number; icon: React.ElementType }[] = [
    { labelKey: 'dynastyLegacy.stat.titles', value: legacy.totalTitles, icon: Trophy },
    { labelKey: 'dynastyLegacy.stat.continental', value: legacy.totalContinentalWins, icon: Globe2 },
    { labelKey: 'dynastyLegacy.stat.cups', value: legacy.totalCupWins, icon: Award },
    { labelKey: 'dynastyLegacy.stat.leagueCups', value: legacy.totalLeagueCupWins, icon: Medal },
    { labelKey: 'dynastyLegacy.stat.dynasties', value: legacy.dynasties, icon: Shield },
    { labelKey: 'dynastyLegacy.stat.seasons', value: legacy.totalSeasons, icon: Flame },
    { labelKey: 'dynastyLegacy.stat.winRate', value: `${legacy.winRate}%`, icon: Target },
    { labelKey: 'dynastyLegacy.stat.bestFinish', value: ordinal(legacy.bestPosition), icon: Star },
  ];

  const links = [
    { screen: 'manager-pass', icon: Ticket, titleKey: 'dynastyLegacy.managerPass', bodyKey: 'dynastyLegacy.managerPassBody' },
    { screen: 'hall-of-managers', icon: Crown, titleKey: 'dynastyLegacy.hallOfFame', bodyKey: 'dynastyLegacy.everyDynastyRanked' },
  ] as const;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <PageHint
        screen="dynasty-legacy"
        title={t('dynastyLegacy.managerLegacy')}
        body={t('dynastyLegacy.yourLifetimeRecordAcrossEvery')}
      />

      {/* Hero — lifetime tier + total trophies */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <GlassPanel className="relative overflow-hidden p-5 text-center">
          <ProfileBannerLayer bannerId={bannerId} />
          <div className="relative">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-b from-primary/30 to-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.3)] mb-3">
              <TierIcon className="w-8 h-8" />
            </div>
            <p className="text-micro uppercase tracking-[0.2em] text-primary/80 font-semibold">{t('dynastyLegacy.lifetimeTier')}</p>
            <h1 className="text-2xl font-black text-foreground font-display leading-tight">{t(TIER_META[legacy.tier].nameKey)}</h1>
            <p className="text-xs text-foreground/65 mt-1">{t(TIER_META[legacy.tier].blurbKey)}</p>

            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-lg font-black text-primary tabular-nums">{legacy.totalTrophies}</span>
              <span className="text-xs text-foreground/70">{t('dynastyLegacy.careerTrophies')}</span>
            </div>
            <p className="text-micro text-foreground/55 mt-2">
              {nextTier
                ? t(nextTier.remaining === 1 ? 'dynastyLegacy.toNextTierOne' : 'dynastyLegacy.toNextTier', {
                  n: nextTier.remaining,
                  tier: t(TIER_META[nextTier.next].nameKey),
                })
                : t('dynastyLegacy.maxTier')}
            </p>
          </div>
        </GlassPanel>
      </motion.div>

      {legacy.dynasties === 0 ? (
        <GlassPanel className="p-8 text-center">
          <Star className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('dynastyLegacy.noLegacy')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('dynastyLegacy.noLegacyBody')}</p>
        </GlassPanel>
      ) : (
        <>
          {/* Stat grid */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <GlassPanel className="p-4">
              <div className="grid grid-cols-4 gap-3">
                {stats.map(({ labelKey, value, icon: Icon }) => (
                  <div key={labelKey} className="text-center">
                    <Icon className="w-4 h-4 text-primary/80 mx-auto mb-1" />
                    <p className="text-sm font-black text-foreground tabular-nums leading-none">{value}</p>
                    <p className="text-micro text-muted-foreground mt-1 leading-tight">{t(labelKey)}</p>
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
                  {t('dynastyLegacy.clubsManaged', { n: legacy.clubsManaged.length })}
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

      {/* Legacy unlocks — cosmetics + job-market standing per tier */}
      <GlassPanel className="p-4">
        <p className="text-micro uppercase tracking-[0.16em] text-primary/80 font-semibold">{t('dynastyLegacy.unlocks')}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('dynastyLegacy.unlocksBody')}</p>

        <div className="mt-3 flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
          <Briefcase className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/85">
            {jobBonus > 0 ? t('dynastyLegacy.jobBonusNow', { n: jobBonus }) : t('dynastyLegacy.jobBonusNone')}
          </p>
        </div>

        <ol className="mt-3 space-y-3">
          {LEGACY_TIER_ORDER.filter(tier => tier !== 'Rookie').map(tier => {
            const reached = LEGACY_TIER_ORDER.indexOf(tier) <= reachedIdx;
            const unlock = LEGACY_TIER_UNLOCKS[tier];
            const Icon = TIER_META[tier].icon;
            const items = unlock.rewardIds.map(id => itemById.get(id)).filter(Boolean);
            return (
              <li key={tier} className={cn('rounded-xl border p-3', reached ? 'border-primary/30 bg-primary/[0.04]' : 'border-white/[0.06] bg-white/[0.015]')}>
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-4 h-4', reached ? 'text-primary' : 'text-muted-foreground')} />
                  <p className="text-sm font-bold text-foreground flex-1">{t(TIER_META[tier].nameKey)}</p>
                  <span className={cn('inline-flex items-center gap-1 text-micro font-semibold', reached ? 'text-emerald-400' : 'text-muted-foreground')}>
                    {reached ? <Check className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    {reached ? t('dynastyLegacy.tierReached') : t('dynastyLegacy.tierAt', { n: legacyTierThreshold(tier) })}
                  </span>
                </div>
                <p className="text-micro text-muted-foreground mt-1">{t('dynastyLegacy.jobBonus', { n: unlock.jobReputationBonus })}</p>
                <div className="mt-1 divide-y divide-white/[0.05]">
                  {items.map(item => (
                    <EarnedCosmeticRow
                      key={item.id}
                      item={item}
                      owned={reached}
                      lockedLabel={t('dynastyLegacy.reachTier', { tier: t(TIER_META[tier].nameKey) })}
                      equipped={monetization.activeCosmetics[item.category] === item.id}
                      onEquip={() => { hapticLight(); equipEarnedCosmetic(item.id); }}
                      onRemove={() => clearCosmetic(item.category)}
                    />
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      </GlassPanel>

      {/* Manager Pass + per-dynasty detail links */}
      {links.map(link => (
        <button
          key={link.screen}
          type="button"
          onClick={() => { hapticLight(); setScreen(link.screen); }}
          className={cn(
            'w-full min-h-[44px] flex items-center justify-between gap-3 p-4 rounded-xl text-left transition-colors',
            'bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.06]',
          )}
        >
          <div className="flex items-center gap-3">
            <link.icon className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t(link.titleKey)}</p>
              <p className="text-micro text-muted-foreground">{t(link.bodyKey)}</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-foreground/40" />
        </button>
      ))}
    </div>
  );
}

export default DynastyLegacy;
