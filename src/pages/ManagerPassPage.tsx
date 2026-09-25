/**
 * Manager Pass — the seasonal cosmetic reward track (a free row and a Pro row).
 *
 * Draws the device-global Pass record; every rule (seasons, XP, what is
 * claimable, Pro gating, equipping) lives in `managerPassSlice` and
 * `utils/managerPass.ts`. Pro is read through `isPro()` only.
 */
import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Ticket, Crown, Lock, Check, CalendarCheck, Gift, Info } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PageHint } from '@/components/game/PageHint';
import { ProUpsell } from '@/components/game/ProUpsell';
import { ProfileBannerLayer, EarnedCosmeticRow, EarnedCategoryIcon } from '@/components/game/EarnedCosmetics';
import { useGameStore } from '@/store/gameStore';
import { isPro, getActiveCosmetic } from '@/utils/monetization';
import { observeClock } from '@/store/helpers/persistence';
import {
  passSeasonFromOrdinal,
  getPassSeasonDaysRemaining,
  passTierProgress,
  passClaimStatus,
  passRewardId,
  canCheckInPass,
  claimablePassRewards,
  carriedProRewards,
  passClaimableCount,
  ownedEarnedCosmetics,
  type PassClaimStatus,
} from '@/utils/managerPass';
import {
  MANAGER_PASS_TRACK,
  MANAGER_PASS_TIER_COUNT,
  MANAGER_PASS_XP,
  MANAGER_PASS_MATCH_XP_DAILY_CAP,
  MANAGER_PASS_SEASON_THEMES,
} from '@/config/managerPass';
import { COSMETIC_ITEMS } from '@/config/monetization';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import type { CosmeticItem, ManagerPassTrack } from '@/types/game';
import type { TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';

const itemById = new Map(COSMETIC_ITEMS.map(c => [c.id, c]));

const STATE_KEY: Record<Exclude<PassClaimStatus, 'claimable' | 'none'>, TranslationKey> = {
  locked: 'managerPass.locked',
  pro_locked: 'managerPass.needsPro',
  claimed: 'managerPass.collected',
};

function RewardCell({ tier, track, status, onCollect }: {
  tier: number;
  track: ManagerPassTrack;
  status: PassClaimStatus;
  onCollect: (tier: number, track: ManagerPassTrack) => void;
}) {
  const { t } = useTranslation();
  const item = itemById.get(passRewardId(tier, track) ?? '');
  if (!item || status === 'none') {
    return <div className="flex-1 min-h-[44px] rounded-lg border border-dashed border-white/[0.06]" aria-hidden />;
  }
  const claimable = status === 'claimable';
  const body = (
    <>
      <EarnedCategoryIcon category={item.category} className={cn('w-4 h-4 shrink-0', status === 'locked' || status === 'pro_locked' ? 'text-muted-foreground' : 'text-primary')} />
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-xs font-semibold text-foreground truncate">{item.name}</span>
        <span className={cn('block text-micro', claimable ? 'text-primary font-semibold' : 'text-muted-foreground')}>
          {claimable ? t('managerPass.collect') : t(STATE_KEY[status])}
        </span>
      </span>
      {status === 'claimed' && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
      {status === 'locked' && <Lock className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />}
      {status === 'pro_locked' && <Crown className="w-3.5 h-3.5 text-primary/70 shrink-0" />}
    </>
  );
  const base = 'flex-1 min-w-0 min-h-[44px] px-2.5 py-1.5 rounded-lg flex items-center gap-2 border';
  const label = t('managerPass.rewardLabel', {
    tier,
    track: t(track === 'free' ? 'managerPass.free' : 'managerPass.pro'),
    name: item.name,
    state: claimable ? t('managerPass.collect') : t(STATE_KEY[status]),
  });
  if (claimable) {
    return (
      <button
        type="button"
        onClick={() => onCollect(tier, track)}
        aria-label={label}
        className={cn(base, 'bg-primary/10 border-primary/40 transition-colors hover:bg-primary/15')}
      >
        {body}
      </button>
    );
  }
  return (
    <div aria-label={label} role="group" className={cn(base, status === 'claimed' ? 'bg-white/[0.03] border-white/10' : 'bg-white/[0.015] border-white/[0.06] opacity-70')}>
      {body}
    </div>
  );
}

function ManagerPassPage() {
  const { t } = useTranslation();
  const record = useGameStore(s => s.managerPass);
  const monetization = useGameStore(s => s.monetization);
  const refreshManagerPass = useGameStore(s => s.refreshManagerPass);
  const checkInManagerPass = useGameStore(s => s.checkInManagerPass);
  const claimManagerPassReward = useGameStore(s => s.claimManagerPassReward);
  const claimAllManagerPassRewards = useGameStore(s => s.claimAllManagerPassRewards);
  const equipEarnedCosmetic = useGameStore(s => s.equipEarnedCosmetic);
  const clearCosmetic = useGameStore(s => s.clearCosmetic);

  // The record is device-global and fed by play elsewhere; re-read it (and
  // roll the season) whenever the page opens.
  useEffect(() => { refreshManagerPass(); }, [refreshManagerPass]);

  const pro = isPro(monetization);
  // Judge "today" on the same clock the slice's actions use (the furthest
  // time this device has seen), or a clock behind that mark would draw an
  // enabled check-in button whose tap does nothing.
  const now = new Date(observeClock());
  const season = passSeasonFromOrdinal(record.seasonOrdinal);
  const theme = MANAGER_PASS_SEASON_THEMES[season.themeIndex];
  const daysLeft = getPassSeasonDaysRemaining(season, now);
  const progress = passTierProgress(record.xp);
  const canCheckIn = canCheckInPass(record, now);
  const claimableCount = passClaimableCount(record, pro);
  // Last season's Pro rewards (reached while the device read not-Pro):
  // collectable once Pro is confirmed, until this season ends.
  const carried = carriedProRewards(record, true).map(id => itemById.get(id)).filter(Boolean) as CosmeticItem[];
  const proWaiting = pro ? 0 : claimablePassRewards(record, true).filter(c => c.track === 'pro').length + carried.length;
  const bannerId = getActiveCosmetic(monetization, 'profile_banner');

  // Owned earned cosmetics, grouped by category for the locker. Recomputed
  // when the record changes (a claim) or what is worn changes.
  const locker = useMemo(() => {
    const owned = ownedEarnedCosmetics();
    return (['title_badge', 'celebration_text', 'profile_banner'] as const)
      .map(category => ({ category, items: owned.filter(c => c.category === category) }))
      .filter(g => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, monetization.activeCosmetics]);

  const onCheckIn = () => {
    const gained = checkInManagerPass();
    if (gained) {
      hapticSuccess();
      toast.success(t('managerPass.checkInToast', { xp: gained }));
    }
  };

  const onCollect = (tier: number, track: ManagerPassTrack) => {
    const item = claimManagerPassReward(tier, track);
    if (item) {
      hapticSuccess();
      toast.success(t('managerPass.collectedToast', { name: item.name }));
    }
  };

  const onCollectAll = () => {
    const items = claimAllManagerPassRewards();
    if (items.length) {
      hapticSuccess();
      toast.success(t('managerPass.collectedManyToast', { n: items.length }));
    }
  };

  const wear = (item: CosmeticItem) => {
    hapticLight();
    equipEarnedCosmetic(item.id);
  };

  const earnRows: { labelKey: TranslationKey; xp: number }[] = [
    { labelKey: 'managerPass.earn.checkIn', xp: MANAGER_PASS_XP.dailyCheckIn },
    { labelKey: 'managerPass.earn.match', xp: MANAGER_PASS_XP.matchPlayed },
    { labelKey: 'managerPass.earn.win', xp: MANAGER_PASS_XP.matchWinBonus },
    { labelKey: 'managerPass.earn.draw', xp: MANAGER_PASS_XP.matchDrawBonus },
    { labelKey: 'managerPass.earn.objective', xp: MANAGER_PASS_XP.objectiveCompleted },
    { labelKey: 'managerPass.earn.season', xp: MANAGER_PASS_XP.seasonCompleted },
    { labelKey: 'managerPass.earn.trophy', xp: MANAGER_PASS_XP.trophyWon },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <PageHint screen="manager-pass" title={t('managerPass.title')} body={t('managerPass.hintBody')} />

      {/* Hero — season, tier, XP bar */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <GlassPanel className="relative overflow-hidden p-5">
          <ProfileBannerLayer bannerId={bannerId} />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-micro uppercase tracking-[0.2em] text-primary/80 font-semibold">{t('managerPass.title')}</p>
                <h1 className="text-2xl font-black text-foreground font-display leading-tight">{t(theme.nameKey)}</h1>
                <p className="text-xs text-foreground/65 mt-0.5">{t(theme.taglineKey)}</p>
              </div>
              <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-b from-primary/30 to-primary/10 text-primary">
                <Ticket className="w-6 h-6" />
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <p className="text-sm font-bold text-foreground tabular-nums">
                {t('managerPass.tierOf', { tier: progress.tier, max: MANAGER_PASS_TIER_COUNT })}
              </p>
              <p className="text-micro text-foreground/60">
                {daysLeft > 0 ? t('managerPass.daysLeft', { n: daysLeft }) : t('managerPass.lastDay')}
              </p>
            </div>
            <div
              className="mt-1.5 h-2 rounded-full bg-white/[0.06] overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.needed}
              aria-valuenow={progress.into}
              aria-label={t('managerPass.xpBarLabel')}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((progress.into / progress.needed) * 100)}%` }} />
            </div>
            <p className="text-micro text-foreground/60 mt-1.5">
              {progress.next === null
                ? t('managerPass.maxTier')
                : t('managerPass.xpToNext', { into: progress.into, needed: progress.needed, next: progress.next })}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-micro font-semibold border',
                pro ? 'text-primary border-primary/40 bg-primary/10' : 'text-muted-foreground border-white/10 bg-white/[0.03]',
              )}>
                {pro ? <Crown className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {pro ? t('managerPass.proActive') : t('managerPass.proLocked')}
              </span>
              {record.completedSeasonIds.length > 0 && (
                <span className="text-micro text-foreground/60">
                  {t('managerPass.seasonsCompleted', { n: record.completedSeasonIds.length })}
                </span>
              )}
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Actions */}
      <div className="grid gap-2">
        <button
          type="button"
          onClick={onCheckIn}
          disabled={!canCheckIn}
          className={cn(
            'w-full min-h-[44px] px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold border transition-colors',
            canCheckIn
              ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
              : 'bg-white/[0.03] text-muted-foreground border-white/10',
          )}
        >
          <CalendarCheck className="w-4 h-4" />
          {canCheckIn ? t('managerPass.checkIn', { xp: MANAGER_PASS_XP.dailyCheckIn }) : t('managerPass.checkedIn')}
        </button>
        {claimableCount > 0 && (
          <button
            type="button"
            onClick={onCollectAll}
            className="w-full min-h-[44px] px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-primary bg-primary/10 border border-primary/40 transition-colors hover:bg-primary/15"
          >
            <Gift className="w-4 h-4" />
            {t('managerPass.collectAll', { n: claimableCount })}
          </button>
        )}
        {!pro && (
          <ProUpsell
            feature={proWaiting > 0 ? t('managerPass.proUpsellWaiting', { n: proWaiting }) : t('managerPass.proUpsell')}
          />
        )}
      </div>

      {/* Last season's Pro rewards (carry-over) */}
      {carried.length > 0 && (
        <GlassPanel className="p-4" aria-label={t('managerPass.carry.title', { n: carried.length })}>
          <p className="text-micro uppercase tracking-[0.16em] text-primary/80 font-semibold mb-1 inline-flex items-center gap-1">
            <Crown className="w-3 h-3" />{t('managerPass.carry.title', { n: carried.length })}
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            {pro ? t('managerPass.carry.readyBody') : t('managerPass.carry.lockedBody')}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {carried.map(item => (
              <li key={item.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-white/10 bg-white/[0.03] text-xs text-foreground">
                <EarnedCategoryIcon category={item.category} className={cn('w-3.5 h-3.5', pro ? 'text-primary' : 'text-muted-foreground')} />
                {item.name}
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}

      {/* Track */}
      <GlassPanel className="p-4">
        <p className="text-micro uppercase tracking-[0.16em] text-primary/80 font-semibold mb-2">{t('managerPass.track')}</p>
        <div className="flex gap-2 mb-1.5 text-micro font-semibold" aria-hidden>
          <span className="w-9 shrink-0" />
          <span className="flex-1 text-muted-foreground">{t('managerPass.free')}</span>
          <span className="flex-1 inline-flex items-center gap-1 text-primary/80"><Crown className="w-3 h-3" />{t('managerPass.pro')}</span>
        </div>
        <ol className="space-y-1.5">
          {MANAGER_PASS_TRACK.map(def => {
            const reached = progress.tier >= def.tier;
            return (
              <li key={def.tier} className="flex items-stretch gap-2">
                <div
                  className={cn(
                    'w-9 shrink-0 rounded-lg flex items-center justify-center text-xs font-black tabular-nums border',
                    reached ? 'text-primary border-primary/40 bg-primary/10' : 'text-muted-foreground border-white/[0.06] bg-white/[0.02]',
                  )}
                  aria-label={t('managerPass.tier', { n: def.tier })}
                >
                  {def.tier}
                </div>
                <RewardCell tier={def.tier} track="free" status={passClaimStatus(record, def.tier, 'free', pro)} onCollect={onCollect} />
                <RewardCell tier={def.tier} track="pro" status={passClaimStatus(record, def.tier, 'pro', pro)} onCollect={onCollect} />
              </li>
            );
          })}
        </ol>
      </GlassPanel>

      {/* How to earn */}
      <GlassPanel className="p-4">
        <p className="text-micro uppercase tracking-[0.16em] text-primary/80 font-semibold mb-2">{t('managerPass.howToEarn')}</p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">
          {earnRows.map(row => (
            <div key={row.labelKey} className="contents">
              <dt className="text-xs text-foreground/80">{t(row.labelKey)}</dt>
              <dd className="text-xs font-semibold text-primary tabular-nums text-right">{t('managerPass.xpValue', { xp: row.xp })}</dd>
            </div>
          ))}
        </dl>
        <p className="text-micro text-muted-foreground mt-2">{t('managerPass.earn.cap', { n: MANAGER_PASS_MATCH_XP_DAILY_CAP })}</p>
      </GlassPanel>

      {/* Locker */}
      <GlassPanel className="p-4">
        <p className="text-micro uppercase tracking-[0.16em] text-primary/80 font-semibold mb-1">{t('managerPass.locker')}</p>
        {locker.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">{t('managerPass.lockerEmpty')}</p>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {locker.flatMap(group => group.items).map(item => (
              <EarnedCosmeticRow
                key={item.id}
                item={item}
                owned
                equipped={monetization.activeCosmetics[item.category] === item.id}
                onEquip={() => wear(item)}
                onRemove={() => clearCosmetic(item.category)}
              />
            ))}
          </div>
        )}
      </GlassPanel>

      <p className="flex items-start gap-1.5 text-micro text-muted-foreground px-1">
        <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
        {t('managerPass.cosmeticOnly')}
      </p>
    </div>
  );
}

export default ManagerPassPage;
