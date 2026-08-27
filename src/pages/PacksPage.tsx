import * as Sentry from '@sentry/react';
import { useTranslation } from '@/hooks/useTranslation';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { Package, Coins, Flame, Clock, Loader2, Gift, Store } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel, LIQUID_GLASS_SURFACE } from '@/components/game/GlassPanel';
import { PageHint } from '@/components/game/PageHint';
import { AnimatedNumber } from '@/components/game/AnimatedNumber';
import { PAGE_HINTS, PLAYER_TIER_THRESHOLDS } from '@/config/ui';
import { MAX_SQUAD_SIZE } from '@/config/gameBalance';
import {
  PACK_TIERS,
  PACK_TIER_MAP,
  PACK_PITY_THRESHOLD,
  RECENT_PULLS_LIMIT,
  getFeaturedPackTier,
  getFeaturedPackPresentation,
  FREE_PACK_TIER,
  PAID_PACK_TIERS,
  nextStreakBand,
  resolvePackTier,
  WEEKLY_PACK_SKINS,
} from '@/config/packs';
import { PackOddsSheet } from '@/components/game/pack/PackOddsSheet';
import { currentLoginStreak, weeklyBonusCardsFor } from '@/store/slices/packsSlice';
import { hapticLight } from '@/utils/haptics';
import type { PackPlayerPlacement, PackTierKey, PackTierDefinition, PackUnlockMethod, ProductId } from '@/types/game';
import { PackShopCard } from '@/components/game/pack/PackShopCard';
import { PackOpeningOverlay } from '@/components/game/pack/PackOpeningOverlay';
import { PlayerCard } from '@/components/game/PlayerCard';
import { formatMoney } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import { errorToast, infoToast, successToast } from '@/utils/gameToast';
import type { Player } from '@/types/game';
import { REWARDED_ADS_USABLE, showRewardedAd } from '@/utils/ads';
import { isPro } from '@/utils/monetization';
import { PENDING_CREDIT_TTL_MS } from '@/config/monetization';
import { purchaseConsumable, getStoreAvailability, isPurchaseNotAttempted } from '@/utils/purchases';
import { readPendingPackCredit, writePendingPackCredit, clearPendingPackCredit, currentWeekIndex, msUntilNextWeekIndex } from '@/store/helpers/persistence';
import { track } from '@/utils/analytics';
import { isReviewWorthyPackTier, maybeRequestReview } from '@/utils/appReview';
import { addGameBreadcrumb } from '@/utils/sentry';

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

/** Format a duration like `6d 9h`, `5h 23m`, `4m 07s`. Drops leading zero
 *  components, and rolls into DAYS past 24 hours — the weekly rotation is up to
 *  seven days out and rendered "153h 55m", which is a number nobody converts in
 *  their head into "next Thursday". */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** For each pulled player, compute how many OVR better they are than the
 *  user's current best in the same position (excluding the just-pulled
 *  cards themselves, since openPack already wrote them into the squad).
 *  Returns a sparse map — only positive deltas are included, so consumers
 *  can render an "upgrade" badge purely on key presence. */
function computeSquadImprovement(
  pulled: Player[],
  squadPlayerIds: string[],
  allPlayers: Record<string, Player>,
): Record<string, { delta: number; currentBestOvr: number }> {
  const pulledIds = new Set(pulled.map(p => p.id));
  const bestByPosition = new Map<string, number>();
  for (const id of squadPlayerIds) {
    if (pulledIds.has(id)) continue;
    const sp = allPlayers[id];
    if (!sp) continue;
    const prev = bestByPosition.get(sp.position) ?? 0;
    if (sp.overall > prev) bestByPosition.set(sp.position, sp.overall);
  }
  const result: Record<string, { delta: number; currentBestOvr: number }> = {};
  for (const p of pulled) {
    const currentBest = bestByPosition.get(p.position) ?? 0;
    if (currentBest === 0) continue; // no existing player at position → no badge
    const delta = p.overall - currentBest;
    if (delta > 0) result[p.id] = { delta, currentBestOvr: currentBest };
  }
  return result;
}

/** Module-level (survives PacksPage unmount within the same JS session):
 *  true while a consumable IAP is awaiting StoreKit. The mount reconciler
 *  must not re-grant a pending credit whose purchase is still in flight —
 *  navigating away and back mid-purchase would otherwise double-grant. */
let iapInFlight = false;

const PacksPage = () => {
  const { t } = useTranslation();
  // `season`/`week` are deliberately NOT selected any more: the featured pack
  // rotates on the real week, so subscribing to the in-game clock here would
  // re-render the whole Market on every week advance for nothing.
  const { club, players, openedPacks, packPityCounter, dailyPackOpens, weeklyPackBonus } = useGameStore(useShallow((s) => ({
    club: s.clubs[s.playerClubId],
    players: s.players,
    openedPacks: s.openedPacks || [],
    packPityCounter: s.packPityCounter || 0,
    dailyPackOpens: s.dailyPackOpens || { date: '', free: {}, ad: {} },
    // Subscribed purely so spending the week's bonus re-renders the hero.
    weeklyPackBonus: s.weeklyPackBonus || null,
  })));
  const monetization = useGameStore(s => s.monetization);
  const recordAdWatched = useGameStore(s => s.recordAdWatched);
  const userIsPro = isPro(monetization);
  const openPack = useGameStore(s => s.openPack);
  const canOpenPack = useGameStore(s => s.canOpenPack);
  const quickSellPackedPlayer = useGameStore(s => s.quickSellPackedPlayer);
  const undoLastQuickSell = useGameStore(s => s.undoLastQuickSell);
  // Paid-pack durability uses `flushSave` (synchronous) rather than
  // `saveGame` (debounced idle) — see the purchase path below.
  const flushSave = useGameStore(s => s.flushSave);
  const activeSlot = useGameStore(s => s.activeSlot);

  const [opening, setOpening] = useState<{ tier: PackTierKey; players: Player[]; pityTriggered?: boolean } | null>(null);
  const [replay, setReplay] = useState<{ tier: PackTierKey; players: Player[] } | null>(null);
  /** True while a rewarded ad or IAP flow is in flight — prevents
   *  double-clicks producing duplicate spend or back-to-back ad requests. */
  const [busy, setBusy] = useState(false);

  // Live countdown to next midnight (when free + ad daily quotas reset).
  // Ticks every 30s — the countdown display is `Xh YYm` granularity (see
  // formatCountdown), so per-second re-rendering of the entire ~500-line
  // tree was pure waste. 30s catches the minute-boundary flips fast
  // enough that the user never sees a stale value.
  const [, forceTick] = useState(0);
  useEffect(() => {
    // Pause the countdown re-render while the tab is hidden; tick once on
    // resume so the displayed time is fresh.
    let id: number | undefined;
    const stop = () => { if (id !== undefined) { window.clearInterval(id); id = undefined; } };
    const start = () => { id = window.setInterval(() => forceTick(t => t + 1), 30_000); };
    const onVisibility = () => { stop(); if (!document.hidden) { forceTick(t => t + 1); start(); } };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  const msToReset = msUntilNextMidnight();

  // Reconcile a crash-stranded paid pack: a pending-credit marker with no
  // in-flight purchase means a previous session charged the user but died
  // before granting (or before the save flushed). Re-grant into the same
  // save slot that paid. Runs once per mount; if the grant is still blocked
  // (e.g. a challenge restricts signings) the marker is kept for next time.
  useEffect(() => {
    if (iapInFlight || !club) return;
    const pending = readPendingPackCredit();
    if (!pending) return;
    if (pending.slot !== activeSlot) return; // credit belongs to another save
    // Proof of payment, not merely evidence of an attempt. `charged === false`
    // means the marker was written and the store never confirmed — granting it
    // handed out paid packs for free, repeatably. Report it rather than
    // dropping it silently: with no receipt backend, Sentry is the only trail
    // support has if a real charge ever lands here.
    if (pending.charged === false) {
      Sentry.captureMessage('[Packs] Dropping unconfirmed pack credit', 'info');
      clearPendingPackCredit();
      return;
    }
    // Stale markers expire. A credit that has survived this long is not going
    // to be reconciled by another mount, and an immortal marker is a standing
    // grant waiting for a squad slot to free up.
    if (pending.timestamp > 0 && Date.now() - pending.timestamp > PENDING_CREDIT_TTL_MS) {
      Sentry.captureMessage('[Packs] Dropping expired pack credit', 'warning');
      clearPendingPackCredit();
      return;
    }
    const tier = PACK_TIER_MAP[pending.tierKey as PackTierKey];
    if (!tier) { clearPendingPackCredit(); return; } // tier removed — nothing we can grant
    const result = openPack(pending.tierKey as PackTierKey, {
      method: 'iap',
      skipPayment: true,
      // Suppress the slice's Sentry alert once we've already reported this
      // stranded marker — otherwise a persistently-blocked claim re-fires on
      // every mount.
      suppressPaidRejectSentry: pending.reported === true,
    });
    if (result.success && result.players) {
      // Durable first, clear second — see the note on the purchase path.
      flushSave();
      if (useGameStore.getState().saveStatus !== 'failed') clearPendingPackCredit();
      successToast('Purchase restored', `Your paid ${tier.label} from the previous session has been credited.`);
      setOpening({ tier: pending.tierKey as PackTierKey, players: result.players, pityTriggered: result.pityTriggered });
    } else {
      // Grant is blocked (e.g. squad full). Keep the marker so the claim
      // survives, but tell the user exactly what's in the way and how to fix
      // it — a paid pack silently refusing to appear reads as a lost purchase.
      infoToast(
        `Your paid ${tier.label} is waiting`,
        result.message || 'Free up a squad slot, then reopen this screen to claim it.',
      );
      // Mark the marker reported so the slice's Sentry alert fires only once.
      if (!pending.reported) writePendingPackCredit({ ...pending, reported: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only reconciliation; deps would re-fire on every store change
  }, []);

  // Keep just drops the card from the overlay view — the player stays on
  // the squad (openPack already wrote them in). No store action needed.
  const handleKeep = (playerId: string) => {
    setOpening(prev => prev ? { ...prev, players: prev.players.filter(p => p.id !== playerId) } : prev);
  };

  const handleQuickSell = (playerId: string) => {
    // Capture the card up front so Undo can drop it back into the reveal.
    const soldPlayer = opening?.players.find(p => p.id === playerId);
    const result = quickSellPackedPlayer(playerId);
    if (!result.success) {
      errorToast('Cannot quick-sell', result.message);
      return;
    }
    setOpening(prev => prev ? { ...prev, players: prev.players.filter(p => p.id !== playerId) } : prev);
    if (typeof result.amount === 'number') {
      successToast('Quick-sold', `+${formatMoney(result.amount)} to budget.`, {
        duration: 6000,
        action: {
          label: 'Undo',
          onClick: () => {
            if (undoLastQuickSell()) {
              hapticLight();
              if (soldPlayer) {
                setOpening(prev => prev ? { ...prev, players: [soldPlayer, ...prev.players] } : prev);
              }
              infoToast('Sale reversed', soldPlayer ? `${soldPlayer.firstName} ${soldPlayer.lastName} is back in your squad.` : 'Player returned to your squad.');
            } else {
              errorToast('Too late to undo', 'That sale can no longer be reversed.');
            }
          },
        },
      });
    }
  };

  const handleKeepAll = () => {
    setOpening(prev => prev ? { ...prev, players: [] } : prev);
  };

  const handleSellAll = () => {
    if (busy) return;
    const remaining = opening?.players ?? [];
    if (remaining.length === 0) return;
    // Set busy for the duration of the loop — without it, a double-tap on
    // Sell All while the toast is still pending could enter this function
    // twice and mutate openedPacks records out from under the iteration.
    setBusy(true);
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
    setBusy(false);
    if (sold > 0) {
      successToast(`Sold ${sold} player${sold === 1 ? '' : 's'}`, `+${formatMoney(total)} to budget.`);
    } else if (lastError) {
      errorToast('Cannot sell all', lastError);
    }
    setOpening(prev => prev ? { ...prev, players: [] } : prev);
  };

  useEffect(() => {
    PACK_TIERS.forEach((t) => {
      for (const src of [t.artSrc, t.artLegacySrc]) {
        if (src) { const img = new Image(); img.src = src; }
      }
    });
    WEEKLY_PACK_SKINS.forEach((sk) => { const img = new Image(); img.src = sk.artSrc; });
  }, []);

  // Market impression — the denominator for every conversion rate on this
  // page. Fired once per mount, not per render.
  useEffect(() => {
    track('market_viewed', {
      featuredTier: featuredKey,
      weeklyBonusAvailable: featuredBonus > 0,
      streak,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one impression per visit
  }, []);

  const budget = club?.budget ?? 0;
  const squadSize = club?.playerIds.length ?? 0;

  const pityRemaining = Math.max(0, PACK_PITY_THRESHOLD - packPityCounter);
  const pityProgressPct = Math.min(100, (packPityCounter / PACK_PITY_THRESHOLD) * 100);

  /** Pre-computed "+X OVR vs current best" map for the currently-open pack.
   *  Drives the upgrade badge on each summary card in the overlay. Memoized
   *  on the open payload so we only walk the squad once per pack open. */
  const openingImprovement = useMemo(() => {
    if (!opening || !club) return undefined;
    return computeSquadImprovement(opening.players, club.playerIds, players);
  }, [opening, club, players]);

  /** Per-pull placement badge (XI / bench / squad), derived reactively from the
   *  club's LIVE lineup/subs. openPack now defers the lineup re-optimization, so
   *  this updates automatically once that lands — well before the summary phase
   *  where the badge is shown. */
  const openingPlacement = useMemo<Record<string, PackPlayerPlacement> | undefined>(() => {
    if (!opening || !club) return undefined;
    const starters = new Set(club.lineup || []);
    const bench = new Set(club.subs || []);
    const map: Record<string, PackPlayerPlacement> = {};
    for (const p of opening.players) {
      map[p.id] = starters.has(p.id) ? 'starter' : bench.has(p.id) ? 'bench' : 'squad';
    }
    return map;
  }, [opening, club]);

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
    // Gated for BOTH cohorts on a real ad SDK. Pro's entitlement is skipping
    // the video (see the `userIsPro ? true : await showRewardedAd()` below),
    // NOT getting free pack opens that free players cannot earn — that would
    // be a paid squad advantage. Both unlock together when the SDK ships.
    if (!REWARDED_ADS_USABLE) return 0;
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
    // Only offer the IAP path when the store confirmed it can sell this SKU.
    // Offering a buy button the store will reject is the Guideline 2.1.0
    // condition that got build 174 rejected — ShopPage and SubscribeOnboarding
    // both guard it, and this surface sells consumables that are far more
    // likely to be mid-configuration than the Pro SKUs.
    if (tier.productId && packSkuPurchasable(tier.productId)) return 'iap';
    if ((tier.price ?? 0) > 0) return 'currency';
    return null;
  };

  // Store-availability probe, scoped to the consumable pack SKUs this page
  // sells. `null` = not probed yet or off-device → assume sellable, matching
  // the convention in ShopPage and SubscribeOnboarding.
  const [packAvailableIds, setPackAvailableIds] = useState<ProductId[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    const ids = PACK_TIERS.map(t => t.productId).filter(Boolean) as ProductId[];
    if (ids.length === 0) return;
    getStoreAvailability(ids)
      .then(({ supported, available }) => {
        if (!cancelled) setPackAvailableIds(supported ? available : null);
      })
      .catch(() => { if (!cancelled) setPackAvailableIds(null); });
    return () => { cancelled = true; };
  }, []);
  const packSkuPurchasable = (productId: ProductId) =>
    packAvailableIds === null || packAvailableIds.includes(productId);

  // ── Market composition ──
  // Featured rotates on the REAL week, not the in-game one. `(season, week)`
  // meant the headline pack changed while the player watched — several times
  // in one sitting during a season sim — so no countdown could be honest and
  // the slot carried no scarcity at all. `weekTick` is only here to re-render
  // the countdown; the values themselves come from the monotonic clock.
  const featuredKey = getFeaturedPackTier(currentWeekIndex());
  // The hero wears this week's promo cover (name + art). Contents, price,
  // guarantee and odds all still come from the tier underneath — a skin never
  // changes what is in the pack.
  const featured = getFeaturedPackPresentation(currentWeekIndex());
  const freeTier = PACK_TIER_MAP[FREE_PACK_TIER];
  /** Paid ladder, cheapest first, with the featured pack lifted out of the
   *  grid — it is already the hero, and showing it twice was the single most
   *  confusing thing about the old layout. */
  const paidTiers = useMemo(
    () => PAID_PACK_TIERS.filter(k => k !== featuredKey).map(k => PACK_TIER_MAP[k]),
    [featuredKey],
  );
  const streak = currentLoginStreak();
  const nextBand = nextStreakBand(streak);
  const nextBandFloor = nextBand === null
    ? null
    : resolvePackTier(freeTier, { streak: nextBand }).guaranteedMinOvr;
  // `weeklyPackBonus` is referenced so the memo re-runs when the claim lands;
  // the authority is the device record `weeklyBonusCardsFor` reads.
   
  // not read here on purpose: it is the state MIRROR whose change re-runs this
  // memo, while the authoritative claim is the device record that
  // `weeklyBonusCardsFor` reads. Dropping it would leave the hero showing a
  // bonus that has just been spent until the next unrelated re-render.
  const featuredBonus = useMemo(
    () => weeklyBonusCardsFor(featuredKey, 'iap'),
    [featuredKey, weeklyPackBonus],
  );
  const weeklyCountdown = formatCountdown(msUntilNextWeekIndex());

  /** Pack whose odds sheet is open, or null. */
  const [oddsTier, setOddsTier] = useState<PackTierKey | null>(null);
  const showOdds = (key: PackTierKey) => {
    setOddsTier(key);
    track('pack_odds_viewed', { tierKey: key });
  };

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
      track('pack_opened', { tierKey, method, pityTriggered: result.pityTriggered === true });
      setOpening({ tier: tierKey, players: result.players, pityTriggered: result.pityTriggered });
      return;
    }

    if (method === 'ad') {
      setBusy(true);
      try {
        // Pro paid for ad-free: same pack, same daily allowance, no video.
        // Skipping the watch is the entitlement, not a shortcut around a cap —
        // the adDailyLimit still applies to both cohorts identically.
        const watched = userIsPro ? true : await showRewardedAd();
        if (!watched) {
          infoToast('Ad not shown', 'No reward granted — please try again.');
          return;
        }
        recordAdWatched();
        const result = openPack(tierKey, { method, skipPayment: true });
        if (!result.success || !result.players) {
          errorToast('Could not open pack', result.message);
          return;
        }
        track('pack_opened', { tierKey, method, pityTriggered: result.pityTriggered === true });
        setOpening({ tier: tierKey, players: result.players, pityTriggered: result.pityTriggered });
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
    // Snapshot the bonus BEFORE the open consumes it — after `openPack`,
    // `weeklyBonusCardsFor` reads 0 and the analytics event would under-report
    // every bonus that was actually granted.
    const bonusAtPurchase = weeklyBonusCardsFor(tierKey, 'iap');
    setBusy(true);
    iapInFlight = true;
    addGameBreadcrumb('purchase', 'pack iap initiated', { surface: 'packs', productId: tier.productId, tierKey });
    track('purchase_initiated', { productId: tier.productId, surface: 'packs' });
    try {
      // Crash durability: persist a pending-credit marker BEFORE the StoreKit
      // charge. Consumables never appear in RevenueCat entitlements, so if
      // the app dies between the charge completing and the pack being
      // granted + saved, this marker is the only record that money changed
      // hands — the mount-time reconciler below re-grants it. Cleared on
      // cancel and after a successful grant.
      // ...but the marker alone is NOT proof of payment. It is written
      // un-charged and only promoted once the store confirms, otherwise any
      // failed attempt (offline, force-quit on the sheet) left a record the
      // reconciler happily granted — a free, repeatable paid pack.
      const marker = { productId: tier.productId, tierKey, timestamp: Date.now(), slot: activeSlot, charged: false };
      writePendingPackCredit(marker);
      const purchased = await purchaseConsumable(tier.productId);
      if (!purchased) {
        // User cancelled or store unavailable — no charge, drop the marker.
        track('purchase_cancelled', { productId: tier.productId, surface: 'packs' });
        clearPendingPackCredit();
        return;
      }
      // Charge confirmed. Promote the marker BEFORE granting, so a crash
      // between here and the save still reconciles into a real credit.
      writePendingPackCredit({ ...marker, charged: true });
      const result = openPack(tierKey, { method, skipPayment: true });
      if (!result.success || !result.players) {
        if (result.paidButRejected) {
          // Money was taken but the grant was blocked — KEEP the pending
          // marker so the reconciler retries once the blocker clears.
          addGameBreadcrumb('purchase', 'pack paid but blocked', { surface: 'packs', tierKey });
          errorToast(
            'Pack will be credited shortly',
            `${result.message} Your payment went through and we'll credit the pack automatically — reopen the app if it hasn't appeared. Contact support if it's still missing after 24 hours.`,
          );
        } else {
          clearPendingPackCredit();
          errorToast('Could not open pack', result.message);
        }
        return;
      }
      // Order matters: the marker is the only evidence of payment, so it is
      // cleared only once the paid players are durably on disk. `saveGame()`
      // here was the debounced idle path and routinely a no-op, which meant
      // the marker could be deleted while the grant existed in memory only.
      flushSave();
      if (useGameStore.getState().saveStatus !== 'failed') clearPendingPackCredit();
      successToast('Purchase complete', `${tier.label} unlocked.`);
      track('purchase_completed', { productId: tier.productId, surface: 'packs' });
      const claimedBonus = weeklyBonusCardsFor(tierKey, 'iap') === 0 ? bonusAtPurchase : 0;
      if (claimedBonus > 0) track('weekly_bonus_claimed', { tierKey, bonusCards: claimedBonus });
      track('pack_opened', { tierKey, method, pityTriggered: result.pityTriggered === true, bonusCards: claimedBonus });
      setOpening({ tier: tierKey, players: result.players, pityTriggered: result.pityTriggered });
    } catch (err) {
      // Capture the actual error to Sentry — silent catch was making it
      // impossible to triage real IAP failures (receipt validation throws,
      // RevenueCat SDK errors mid-purchase, etc.). The user toast stays
      // generic to avoid leaking implementation details.
      // The marker is kept ONLY when the throw could have followed a charge —
      // RevenueCat can throw on receipt validation after taking the money, and
      // a rare unearned re-grant beats losing a real payment. A failure that
      // never reached the store (offline, product unavailable) is definitively
      // un-charged and its marker is dropped; keeping it was the exploit.
      if (isPurchaseNotAttempted(err)) clearPendingPackCredit();
      addGameBreadcrumb('purchase', 'pack iap threw', { surface: 'packs', tierKey, notAttempted: isPurchaseNotAttempted(err) });
      Sentry.captureException(err, { tags: { context: 'PacksPage.iap' }, extra: { tierKey } });
      track('purchase_failed', { productId: tier.productId, surface: 'packs' });
      errorToast('Purchase failed', 'Please try again.');
    } finally {
      iapInFlight = false;
      setBusy(false);
    }
  };

  const recentPacks = openedPacks.slice(0, RECENT_PULLS_LIMIT);

  return (
    <div className="max-w-lg mx-auto">
      <PageHint screen="packs" title={PAGE_HINTS.packs.title} body={PAGE_HINTS.packs.body} />

      <div className="px-4 pb-6 space-y-3">
        {/* Compact status row — budget + squad + reset countdown all on
            one line. The "Player Packs" title block above this used to
            cost ~60px of vertical space before the pack tile even
            started, on a page where the user is already on the Packs
            tab — redundant signage. Now it's one dense row so the
            featured pack image is visible above the fold on a 375px
            phone (audit finding). */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest">
            <span className={cn(
              'px-2 py-1 rounded-md border flex items-center gap-1',
              squadSize >= MAX_SQUAD_SIZE
                ? 'border-destructive/40 text-destructive bg-destructive/10'
                : 'border-border/60 text-muted-foreground bg-muted/20',
            )}>
              <Package className="w-3 h-3" /> Squad {squadSize}/{MAX_SQUAD_SIZE}
            </span>
            {dailyAllowanceUsed && (
              <span
                className="px-2 py-1 rounded-md border border-primary/40 text-primary bg-primary/10 flex items-center gap-1 tabular-nums"
                aria-live="polite"
                aria-label={`Free packs reset in ${formatCountdown(msToReset)}`}
              >
                <Clock className="w-3 h-3" /> Resets in {formatCountdown(msToReset)}
              </span>
            )}
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

        {/* ── THIS WEEK ──
            One paid pack, featured for a real week, whose first purchase this
            week carries a bonus card. Only ONE offer gets the hero slot and it
            is never the free pack: a store's headline should be the thing worth
            paying for, and the old rotation put Silver — a free pack — in the
            featured slot one week in six. */}
        <section aria-labelledby="market-week">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-primary" />
              <h3 id="market-week" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                This Week
              </h3>
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums flex items-center gap-1">
              <Clock className="w-3 h-3" /> {weeklyCountdown} left
            </span>
          </div>
          <PackShopCard
            featured
            tier={featured}
            affordable={isAffordable(featured)}
            squadOk={squadSize + featured.cards + featuredBonus <= MAX_SQUAD_SIZE}
            onSelect={() => { void handleOpen(featured.key); }}
            onShowOdds={() => showOdds(featured.key)}
            method={activeMethodFor(featured)}
            freeRemaining={freeRemaining(featured)}
            adRemaining={adRemaining(featured)}
            resetCountdown={dailyAllowanceUsed ? formatCountdown(msToReset) : undefined}
            bonusCards={featuredBonus}
            weeklyCountdown={weeklyCountdown}
          />
          {featuredBonus === 0 && (
            <p className="text-[10px] text-muted-foreground mt-1 px-0.5">
              This week&apos;s bonus card is claimed. The pack is still available at its
              normal contents — the next bonus arrives in {weeklyCountdown}.
            </p>
          )}
        </section>

        {/* ── FREE TODAY ──
            Exactly one free pack, whose floor rises with the login streak. It
            replaced three flat free packs that dominated one another and
            delivered ~11 players a day into a 40-man squad. */}
        <section aria-labelledby="market-free">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Gift className="w-3.5 h-3.5 text-emerald-400" />
            <h3 id="market-free" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Free Today
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PackShopCard
              tier={freeTier}
              affordable={isAffordable(freeTier)}
              squadOk={squadSize + freeTier.cards <= MAX_SQUAD_SIZE}
              onSelect={() => { void handleOpen(freeTier.key); }}
              onShowOdds={() => showOdds(freeTier.key)}
              method={activeMethodFor(freeTier)}
              freeRemaining={freeRemaining(freeTier)}
              adRemaining={adRemaining(freeTier)}
              resetCountdown={dailyAllowanceUsed ? formatCountdown(msToReset) : undefined}
              streak={streak}
            />
            {/* Streak panel — the free pack's second half. Without it the
                escalation is invisible and the player has no reason to know
                tomorrow is worth more than today. */}
            <GlassPanel className="p-3 flex flex-col justify-center gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Login streak
              </p>
              <p className="text-2xl font-display font-bold text-foreground tabular-nums leading-none">
                {streak} <span className="text-xs font-normal text-muted-foreground">day{streak === 1 ? '' : 's'}</span>
              </p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {nextBand === null
                  ? 'Top tier reached — your Daily Pack is as good as it gets. Keep the run going to hold it.'
                  : `Day ${nextBand} lifts your Daily Pack to a guaranteed ${nextBandFloor}+.`}
              </p>
            </GlassPanel>
          </div>
        </section>

        {/* ── PACKS ──
            The paid ladder, cheapest first. The featured pack is absent because
            it is the hero above; listing it twice was the old layout's worst
            habit. */}
        <section aria-labelledby="market-packs">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Store className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 id="market-packs" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Packs
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {paidTiers.map(tier => (
              <PackShopCard
                key={tier.key}
                tier={tier}
                affordable={isAffordable(tier)}
                squadOk={squadSize + tier.cards <= MAX_SQUAD_SIZE}
                onSelect={() => { void handleOpen(tier.key); }}
                onShowOdds={() => showOdds(tier.key)}
                method={activeMethodFor(tier)}
                freeRemaining={freeRemaining(tier)}
                adRemaining={adRemaining(tier)}
                resetCountdown={dailyAllowanceUsed ? formatCountdown(msToReset) : undefined}
              />
            ))}
          </div>
        </section>

        {/* Guarantee Tracker — premium "what's coming next" reward meter.
            Three visual states keyed off pityRemaining:
              ready   (0): glowing gold panel, "Guaranteed 80+ Next Pack"
              close (1–2): amber-tinted, "Almost there"
              normal (3+): muted gold accent, just the progress
            All three share the same panel chrome so the transition
            between states reads as the same object evolving. */}
        {(() => {
          const ready = pityRemaining === 0;
          const close = pityRemaining > 0 && pityRemaining <= 2;
          return (
            <GlassPanel
              className={cn(
                'p-3 relative overflow-hidden transition-[box-shadow] duration-500',
                ready && 'shadow-[0_0_28px_-4px_rgba(251,191,36,0.55),inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-amber-300/40',
                close && !ready && 'ring-1 ring-amber-300/15',
              )}
            >
              {/* Soft gold radial backlight on the ready state — pulses
                  gently to telegraph "this is unlocked, go open one". */}
              {ready && (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(120% 100% at 50% -20%, rgba(251,191,36,0.25) 0%, rgba(251,191,36,0.06) 35%, transparent 70%)',
                  }}
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <div className="relative flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'font-display font-bold uppercase tracking-[0.16em] text-[10px]',
                      ready ? 'text-amber-200' : 'text-foreground/90',
                    )}
                  >
                    Guarantee Tracker
                  </span>
                  {ready && (
                    <motion.span
                      className="text-amber-200"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                      aria-hidden
                    >
                      ✦
                    </motion.span>
                  )}
                </div>
                <span
                  className={cn(
                    'tabular-nums',
                    ready ? 'text-amber-200 font-display font-bold uppercase tracking-[0.12em]' : 'text-muted-foreground',
                    close && !ready && 'text-amber-100/90 font-semibold',
                  )}
                >
                  {ready
                    ? 'Guaranteed 80+ Next Pack'
                    : pityRemaining === 1
                      ? '1 pack to guaranteed gold'
                      : `${pityRemaining} packs to guaranteed gold`}
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-muted/40 overflow-hidden">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    ready
                      ? 'bg-gradient-to-r from-amber-200 via-amber-300 to-amber-400'
                      : close
                        ? 'bg-gradient-to-r from-amber-300/70 to-amber-300'
                        : 'bg-gradient-to-r from-primary/60 to-primary',
                  )}
                  initial={false}
                  animate={{ width: `${pityProgressPct}%` }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
                {ready && (
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 w-1/3"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                      mixBlendMode: 'overlay',
                    }}
                    initial={{ x: '-100%' }}
                    animate={{ x: '350%' }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.3 }}
                  />
                )}
              </div>
            </GlassPanel>
          );
        })()}

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
                    onClick={() => { hapticLight(); setReplay({ tier: rec.tier, players: pulled }); }}
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

      {/* Drop-rate disclosure. Reachable from every pack card, which is what
          Guideline 3.1.1 asks for: the odds are available before the buy. */}
      <AnimatePresence>
        {oddsTier && (
          <PackOddsSheet
            // The featured slot's sheet must carry the same NAME the card
            // does, or a player checking the odds on "The Dynasty Pack" is
            // shown a sheet headed "World Class Pack" and has no way to know
            // it is the same offer.
            tier={oddsTier === featuredKey ? featured : PACK_TIER_MAP[oddsTier]}
            streak={oddsTier === FREE_PACK_TIER ? streak : undefined}
            bonusCards={oddsTier === featuredKey ? featuredBonus : 0}
            onClose={() => setOddsTier(null)}
          />
        )}
      </AnimatePresence>

      {/* Pack Opening Overlay */}
      <AnimatePresence>
        {opening && (
          <PackOpeningOverlay
            tier={opening.tier}
            players={opening.players}
            pityTriggered={opening.pityTriggered}
            improvement={openingImprovement}
            onClose={() => {
              const { tier } = opening;
              setOpening(null);
              // Peak-satisfaction moment right after a Gold-or-better reveal —
              // ask for a store review. Self-throttled (60-day gap, 4 lifetime)
              // inside maybeRequestReview, so it never nags.
              if (isReviewWorthyPackTier(tier)) {
                void maybeRequestReview('pack-elite-open');
              }
            }}
            onKeep={handleKeep}
            onQuickSell={handleQuickSell}
            onKeepAll={handleKeepAll}
            onSellAll={handleSellAll}
            placement={openingPlacement}
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

      {/* Visible busy overlay during the 1-30s ad-watch / IAP-confirm
          gap. Previously the only feedback was a disabled state on the
          pack tile — users tapped, nothing visible happened for 1-2s,
          and they retapped. Now a centered spinner blocks the page and
          confirms the action is in flight. */}
      {busy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto"
          role="status"
          aria-label={t('packsPage.processingPurchase')}
        >
          <div className="flex flex-col items-center gap-3 bg-card/90 border border-border/50 rounded-2xl px-6 py-5 shadow-xl">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
            <p className="text-xs font-medium text-foreground">Processing…</p>
            <p className="text-[10px] text-muted-foreground text-center max-w-[200px]">Do not close the app until this finishes.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PacksPage;
