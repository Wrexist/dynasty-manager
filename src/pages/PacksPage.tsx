import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { Package, Coins, Flame, Clock } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel, LIQUID_GLASS_SURFACE } from '@/components/game/GlassPanel';
import { PageHint } from '@/components/game/PageHint';
import { AnimatedNumber } from '@/components/game/AnimatedNumber';
import { PAGE_HINTS, PLAYER_TIER_THRESHOLDS } from '@/config/ui';
import { MAX_SQUAD_SIZE } from '@/config/gameBalance';
import { PACK_TIERS, PACK_TIER_MAP, PACK_PITY_THRESHOLD, RECENT_PULLS_LIMIT, getFeaturedPackTier } from '@/config/packs';
import type { PackPlayerPlacement, PackTierKey, PackTierDefinition, PackUnlockMethod } from '@/types/game';
import { PackShopCard } from '@/components/game/pack/PackShopCard';
import { PackOpeningOverlay } from '@/components/game/pack/PackOpeningOverlay';
import { PlayerCard } from '@/components/game/PlayerCard';
import { formatMoney } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import { errorToast, infoToast, successToast } from '@/utils/gameToast';
import type { Player } from '@/types/game';
import { NATIVE_ADS_READY, showRewardedAd } from '@/utils/ads';
import { purchaseConsumable } from '@/utils/purchases';

function playerTier(ovr: number) {
  for (const t of PLAYER_TIER_THRESHOLDS) if (ovr >= t.min) return t;
  return PLAYER_TIER_THRESHOLDS[PLAYER_TIER_THRESHOLDS.length - 1];
}

/** Same YYYY-MM-DD key the slice uses to bucket per-day pack opens. */
function todayDateKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Milliseconds until the next local midnight (when daily allowances reset). */
function msUntilNextMidnight(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

/** Format a duration like `5h 23m 14s`. Drops leading zero components. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

const PacksPage = () => {
  const { club, players, openedPacks, packPityCounter, season, week, dailyPackOpens } = useGameStore(useShallow((s) => ({
    club: s.clubs[s.playerClubId],
    players: s.players,
    openedPacks: s.openedPacks || [],
    packPityCounter: s.packPityCounter || 0,
    season: s.season,
    week: s.week,
    dailyPackOpens: s.dailyPackOpens || { date: '', free: {}, ad: {} },
  })));
  const openPack = useGameStore(s => s.openPack);
  const canOpenPack = useGameStore(s => s.canOpenPack);
  const quickSellPackedPlayer = useGameStore(s => s.quickSellPackedPlayer);

  const [opening, setOpening] = useState<{ tier: PackTierKey; players: Player[]; pityTriggered?: boolean; placement?: Record<string, PackPlayerPlacement> } | null>(null);
  const [replay, setReplay] = useState<{ tier: PackTierKey; players: Player[] } | null>(null);
  /** True while a rewarded ad or IAP flow is in flight — prevents
   *  double-clicks producing duplicate spend or back-to-back ad requests. */
  const [busy, setBusy] = useState(false);

  // Live countdown to next midnight (when free + ad daily quotas reset).
  // Recomputed every second; cheap because the page is lightweight.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const msToReset = msUntilNextMidnight();

  // Keep just drops the card from the overlay view — the player stays on
  // the squad (openPack already wrote them in). No store action needed.
  const handleKeep = (playerId: string) => {
    setOpening(prev => prev ? { ...prev, players: prev.players.filter(p => p.id !== playerId) } : prev);
  };

  const handleQuickSell = (playerId: string) => {
    const result = quickSellPackedPlayer(playerId);
    if (!result.success) {
      errorToast('Cannot quick-sell', result.message);
      return;
    }
    if (typeof result.amount === 'number') {
      successToast('Quick-sold', `+${formatMoney(result.amount)} to budget.`);
    }
    setOpening(prev => prev ? { ...prev, players: prev.players.filter(p => p.id !== playerId) } : prev);
  };

  const handleKeepAll = () => {
    setOpening(prev => prev ? { ...prev, players: [] } : prev);
  };

  const handleSellAll = () => {
    const remaining = opening?.players ?? [];
    if (remaining.length === 0) return;
    let total = 0;
    let sold = 0;
    let lastError: string | undefined;
    for (const p of remaining) {
      const result = quickSellPackedPlayer(p.id);
      if (result.success && typeof result.amount === 'number') {
        total += result.amount;
        sold += 1;
      } else if (!result.success) {
        lastError = result.message;
      }
    }
    if (sold > 0) {
      successToast(`Sold ${sold} player${sold === 1 ? '' : 's'}`, `+${formatMoney(total)} to budget.`);
    } else if (lastError) {
      errorToast('Cannot sell all', lastError);
    }
    setOpening(prev => prev ? { ...prev, players: [] } : prev);
  };

  useEffect(() => {
    PACK_TIERS.forEach((t) => { if (t.artSrc) { const img = new Image(); img.src = t.artSrc; } });
  }, []);

  const budget = club?.budget ?? 0;
  const squadSize = club?.playerIds.length ?? 0;

  const pityRemaining = Math.max(0, PACK_PITY_THRESHOLD - packPityCounter);
  const pityProgressPct = Math.min(100, (packPityCounter / PACK_PITY_THRESHOLD) * 100);

  // Per-tier daily-bucket reads. Resets when the device's local date
  // rolls over by virtue of the date key not matching any longer.
  const today = todayDateKey();
  const usedToday = (tier: PackTierDefinition): { free: number; ad: number } => {
    if (dailyPackOpens.date !== today) return { free: 0, ad: 0 };
    return {
      free: dailyPackOpens.free[tier.key] || 0,
      ad: dailyPackOpens.ad[tier.key] || 0,
    };
  };
  const freeRemaining = (tier: PackTierDefinition): number => {
    const cap = tier.freeDailyLimit ?? 0;
    if (cap === 0) return 0;
    return Math.max(0, cap - usedToday(tier).free);
  };
  const adRemaining = (tier: PackTierDefinition): number => {
    // V1: ads are disabled at the native layer, so the ad-unlock path is
    // never offered. Re-enables automatically when NATIVE_ADS_READY flips.
    if (!NATIVE_ADS_READY) return 0;
    const cap = tier.adDailyLimit ?? 0;
    if (cap === 0) return 0;
    return Math.max(0, cap - usedToday(tier).ad);
  };

  /** Pick the active method for a tier given today's usage. Mirrors the
   *  slice's `defaultMethodFor` priority: free → ad → iap → currency.
   *  Returns null if no method is available right now (rare — would mean
   *  caps hit and no IAP/currency fallback). */
  const activeMethodFor = (tier: PackTierDefinition): PackUnlockMethod | null => {
    if (freeRemaining(tier) > 0) return 'free';
    if (adRemaining(tier) > 0) return 'ad';
    if (tier.productId) return 'iap';
    if ((tier.price ?? 0) > 0) return 'currency';
    return null;
  };

  const featuredKey = useMemo(() => getFeaturedPackTier(season, week), [season, week]);
  const featured = PACK_TIER_MAP[featuredKey];
  const nonFeatured = useMemo(() => PACK_TIERS.filter(t => t.key !== featuredKey), [featuredKey]);

  /** True if the player can use the active method right now. Currency
   *  packs check budget; free/ad respect daily caps; IAP is always
   *  available here (the store decides on the device). */
  const isAffordable = (tier: PackTierDefinition): boolean => {
    const method = activeMethodFor(tier);
    if (method === null) return false;
    if (method === 'currency') return budget >= tier.price;
    return true;
  };

  /** Whether ANY free or ad allowance has been used today across all
   *  tiers — drives the "Free packs reset in Xh Ym" banner. We don't
   *  show the countdown when nothing has been used yet (no need to
   *  remind the user about a reset that doesn't matter). */
  const dailyAllowanceUsed = PACK_TIERS.some(t =>
    usedToday(t).free > 0 || usedToday(t).ad > 0,
  );

  const handleOpen = async (tierKey: PackTierKey) => {
    // Guard against rapid double-taps while an overlay is already up,
    // a pack was just opened this frame, or an async ad/IAP is mid-flight.
    if (opening || replay || busy) return;
    const tier = PACK_TIER_MAP[tierKey];
    if (!club) return;

    const method = activeMethodFor(tier);
    if (!method) {
      errorToast('Daily allowance used', 'Wait until the daily reset for free packs.');
      return;
    }

    // Single source-of-truth eligibility pre-flight. Critical for the
    // IAP path: without this, a charged consumable could be followed
    // by an openPack failure (e.g. an active challenge blocking
    // signings) — the user pays real money and gets nothing.
    const eligibility = canOpenPack(tierKey, method);
    if (eligibility.ok === false) {
      errorToast('Cannot open pack', eligibility.message);
      return;
    }

    if (method === 'free' || method === 'currency') {
      const result = openPack(tierKey, { method });
      if (!result.success || !result.players) {
        errorToast('Could not open pack', result.message);
        return;
      }
      setOpening({ tier: tierKey, players: result.players, pityTriggered: result.pityTriggered, placement: result.placement });
      return;
    }

    if (method === 'ad') {
      setBusy(true);
      try {
        const watched = await showRewardedAd();
        if (!watched) {
          infoToast('Ad not shown', 'No reward granted — please try again.');
          return;
        }
        const result = openPack(tierKey, { method, skipPayment: true });
        if (!result.success || !result.players) {
          errorToast('Could not open pack', result.message);
          return;
        }
        setOpening({ tier: tierKey, players: result.players, pityTriggered: result.pityTriggered, placement: result.placement });
      } finally {
        setBusy(false);
      }
      return;
    }

    // method === 'iap'
    if (!tier.productId) {
      errorToast('Pack unavailable', 'This pack is missing a store product ID.');
      return;
    }
    setBusy(true);
    try {
      const purchased = await purchaseConsumable(tier.productId);
      if (!purchased) {
        // User cancelled or store unavailable — silent on cancel.
        return;
      }
      const result = openPack(tierKey, { method, skipPayment: true });
      if (!result.success || !result.players) {
        if (result.paidButRejected) {
          errorToast(
            'Purchase succeeded but pack was blocked',
            `${result.message} Your payment will be investigated — contact support if the pack isn't credited within 24 hours.`,
          );
        } else {
          errorToast('Could not open pack', result.message);
        }
        return;
      }
      successToast('Purchase complete', `${tier.label} unlocked.`);
      setOpening({ tier: tierKey, players: result.players, pityTriggered: result.pityTriggered, placement: result.placement });
    } catch {
      errorToast('Purchase failed', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const recentPacks = openedPacks.slice(0, RECENT_PULLS_LIMIT);

  return (
    <div className="max-w-lg mx-auto">
      <PageHint screen="packs" title={PAGE_HINTS.packs.title} body={PAGE_HINTS.packs.body} />

      <div className="px-4 pb-6 space-y-4">
        {/* Header + budget chip */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Player Packs
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Spend budget, sign players instantly.</p>
          </div>
          <div
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur text-xs font-semibold tabular-nums',
              budget <= 0 ? 'text-destructive border-destructive/40 bg-destructive/10' : 'text-primary border-primary/30 bg-primary/10',
            )}
            aria-live="polite"
            aria-label={`Budget ${formatMoney(budget)}`}
          >
            <Coins className="w-3.5 h-3.5" />
            <AnimatedNumber value={budget} duration={450} formatFn={formatMoney} />
          </div>
        </div>

        {/* Squad cap chip + reset countdown. The reset chip only shows
            once a free or ad open has been used today — no point telling
            the user about a reset that has nothing to reset. */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest">
          <span className={cn(
            'px-2 py-1 rounded-md border',
            squadSize >= MAX_SQUAD_SIZE
              ? 'border-destructive/40 text-destructive bg-destructive/10'
              : 'border-border/60 text-muted-foreground bg-muted/20',
          )}>
            Squad {squadSize}/{MAX_SQUAD_SIZE}
          </span>
          {dailyAllowanceUsed && (
            <span
              className="px-2 py-1 rounded-md border border-primary/40 text-primary bg-primary/10 flex items-center gap-1 tabular-nums"
              aria-live="polite"
              aria-label={`Free packs reset in ${formatCountdown(msToReset)}`}
            >
              <Clock className="w-3 h-3" /> Free packs reset in {formatCountdown(msToReset)}
            </span>
          )}
        </div>

        {/* Featured hero */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Featured Pack</h3>
          </div>
          <PackShopCard
            featured
            tier={featured}
            affordable={isAffordable(featured)}
            squadOk={squadSize + featured.cards <= MAX_SQUAD_SIZE}
            onSelect={() => { void handleOpen(featured.key); }}
            method={activeMethodFor(featured)}
            freeRemaining={freeRemaining(featured)}
            adRemaining={adRemaining(featured)}
            resetCountdown={dailyAllowanceUsed ? formatCountdown(msToReset) : undefined}
          />
        </div>

        {/* Standard pack grid */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">All Packs</h3>
          <div className="grid grid-cols-2 gap-3">
            {nonFeatured.map(tier => (
              <PackShopCard
                key={tier.key}
                tier={tier}
                affordable={isAffordable(tier)}
                squadOk={squadSize + tier.cards <= MAX_SQUAD_SIZE}
                onSelect={() => { void handleOpen(tier.key); }}
                method={activeMethodFor(tier)}
                freeRemaining={freeRemaining(tier)}
                adRemaining={adRemaining(tier)}
                resetCountdown={dailyAllowanceUsed ? formatCountdown(msToReset) : undefined}
              />
            ))}
          </div>
        </div>

        {/* Pity meter */}
        <GlassPanel className="p-3">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-foreground">Guarantee Tracker</span>
            <span className="text-muted-foreground">
              {pityRemaining === 0 ? 'Next gold guaranteed!' : `${pityRemaining} dry pack${pityRemaining === 1 ? '' : 's'} to guaranteed gold`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-500"
              style={{ width: `${pityProgressPct}%` }}
            />
          </div>
        </GlassPanel>

        {/* Recent pulls — liquid glass cards highlighting the best player from each pack. */}
        {recentPacks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Recent Pulls</h3>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
              {recentPacks.map(rec => {
                const tier = PACK_TIER_MAP[rec.tier];
                const pulled = rec.playerIds.map(id => players[id]).filter(Boolean) as Player[];
                if (pulled.length === 0) return null;
                const best = pulled.reduce((top, p) => (p.overall > top.overall ? p : top), pulled[0]);
                const ptier = playerTier(best.overall);
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => setReplay({ tier: rec.tier, players: pulled })}
                    className={cn(
                      LIQUID_GLASS_SURFACE,
                      'group shrink-0 w-48 text-left p-3 transition-transform',
                      'hover:-translate-y-0.5 active:scale-[0.98]',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                    )}
                    aria-label={`Replay ${tier.label} — top pull ${best.firstName} ${best.lastName} ${best.overall} OVR`}
                  >
                    {/* Tier-coloured glow at the top corner — subtle pack signature. */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-50"
                      style={{ background: `radial-gradient(circle, ${tier.gradientFrom} 0%, transparent 70%)` }}
                    />
                    {/* Top row — pack chip + season stamp. */}
                    <div className="relative flex items-center justify-between gap-2 mb-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {tier.artSrc && (
                          <img
                            src={tier.artSrc}
                            alt=""
                            aria-hidden
                            className="w-5 h-6 rounded-sm object-cover shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                          />
                        )}
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
                          {tier.label}
                        </span>
                      </span>
                      <span className="text-[9px] tabular-nums text-muted-foreground/80 shrink-0">
                        S{rec.season} · W{rec.week}
                      </span>
                    </div>

                    {/* Best player block — mini shield (matches the tactics
                        tile look: OVR top-left, position top-right) plus
                        side text for player tier. */}
                    <div className="relative flex items-center gap-2.5">
                      <div className="shrink-0">
                        <PlayerCard player={best} size="sm" interactive="none" compact />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground leading-tight truncate">
                          {best.firstName.charAt(0)}. {best.lastName}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground leading-tight mt-0.5 truncate">
                          {ptier.label}
                        </p>
                      </div>
                    </div>

                    {/* Footer — top pull badge + pack pull count. */}
                    <div className="relative flex items-center justify-between mt-2.5">
                      <span className={cn(
                        'text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded',
                        ptier.badgeClass,
                      )}>
                        Top Pull
                      </span>
                      {pulled.length > 1 && (
                        <span className="text-[9px] text-muted-foreground tabular-nums">
                          +{pulled.length - 1} more
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {openedPacks.length === 0 && (
          <GlassPanel className="p-6 text-center">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No packs opened yet</p>
            <p className="text-xs text-muted-foreground mt-1">Pick a pack above — revealed players join your squad instantly.</p>
          </GlassPanel>
        )}
      </div>

      {/* Pack Opening Overlay */}
      <AnimatePresence>
        {opening && (
          <PackOpeningOverlay
            tier={opening.tier}
            players={opening.players}
            pityTriggered={opening.pityTriggered}
            onClose={() => setOpening(null)}
            onKeep={handleKeep}
            onQuickSell={handleQuickSell}
            onKeepAll={handleKeepAll}
            onSellAll={handleSellAll}
            placement={opening.placement}
          />
        )}
      </AnimatePresence>

      {/* Replay recent pull (summary state only) */}
      <AnimatePresence>
        {replay && (
          <PackOpeningOverlay
            tier={replay.tier}
            players={replay.players}
            onClose={() => setReplay(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default PacksPage;
