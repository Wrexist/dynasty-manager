import * as Sentry from '@sentry/react';
import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PurchaseModal } from '@/components/game/PurchaseModal';
import { Crown, Check, Sparkles, Package, Shield, Timer, CreditCard, ExternalLink, RefreshCw, ChevronDown, ChevronUp, Star, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRODUCTS, PRO_FEATURE_LABELS, PRO_FEATURES, STARTER_KIT, COSMETIC_ITEMS } from '@/config/monetization';
import { isPro, hasProduct, isStarterKitAvailable, getOwnedCosmetics, getActiveCosmetic, isSubscriptionActive } from '@/utils/monetization';
import type { CosmeticCategory } from '@/types/game';
import type { ProductId, ProFeature } from '@/types/game';
import { useNavigate } from 'react-router-dom';
import { purchaseProduct as purchaseViaSDK, restorePurchases as restoreViaSDK, getEntitlements, getCustomerInfo, extractSubscriptionInfo, openSubscriptionManagement, getStoreAvailability } from '@/utils/purchases';
import { hapticMedium } from '@/utils/haptics';
import { infoToast, successToast, errorToast } from '@/utils/gameToast';
import { TERMS_URL, PRIVACY_URL } from '@/config/legal';
import { openExternalUrl } from '@/utils/externalUrl';
import { track } from '@/utils/analytics';
import { addGameBreadcrumb } from '@/utils/sentry';

const formatPrice = (usd: number) => `$${usd.toFixed(2)}`;

const FEATURE_ICONS: Record<ProFeature, React.ElementType> = {
  ad_free: Shield,
  advanced_analytics: Sparkles,
  custom_tactics: Crown,
  expanded_press: Package,
  historical_records: Sparkles,
  instant_sim: Timer,
  optimize_lineup: Zap,
  pro_badge: Crown,
};

/** Render order for the subscription cards — Yearly first, Monthly last.
 *
 *  This listed Monthly first, so the plainest plan led the page while Yearly
 *  (the one carrying the emerald highlight, the "Save N%" badge and the
 *  "$X/month billed yearly" line) sat below it. `SubscribeOnboarding` already
 *  orders and preselects Yearly; the two paywalls now agree. Display order
 *  only — nothing here decides what is purchasable or what is granted. */
const SUBSCRIPTION_PRODUCTS: ProductId[] = [
  'com.dynastymanager.pro.yearly',
  'com.dynastymanager.pro.lifetime',
  'com.dynastymanager.pro.monthly',
];

/** Exactly the SKUs this page can sell — the availability probe is scoped to
 *  these so an unconfigured consumable elsewhere in the catalog cannot blank
 *  the products that are configured. Consumable player packs are sold on
 *  PacksPage, not here, so they are deliberately absent. */
const SHOP_PROBE_IDS: ProductId[] = [
  // `com.dynastymanager.pro` is deliberately absent — it is retired from sale
  // (see RETIRED_PRODUCT_IDS). Probing a SKU nothing renders only widens the
  // batch that one unconfigured product can drag down.
  'com.dynastymanager.pro.monthly',
  'com.dynastymanager.pro.yearly',
  'com.dynastymanager.pro.lifetime',
  'com.dynastymanager.bundle.all',
  'com.dynastymanager.pack.manager',
  'com.dynastymanager.pack.stadium',
  'com.dynastymanager.pack.legends',
];

const COSMETIC_PACK_IDS: ProductId[] = [
  'com.dynastymanager.pack.manager',
  'com.dynastymanager.pack.stadium',
  'com.dynastymanager.pack.legends',
];

// NOTE: the USD-derived constants that used to live here (BUNDLE_SAVINGS_PCT,
// ANNUAL_SAVINGS_PCT, MONTHLY_PER_DAY, ANNUAL_PER_MONTH,
// BUNDLE_INDIVIDUAL_TOTAL) were rendered as claims — "Save 12%", "just
// $1.25/month", a struck-through "$28.96". All four are false outside the US:
// the figures are in the wrong currency and Apple's price tiers do not
// preserve the USD ratios, so the percentages are wrong even ignoring the
// symbol. They are now computed per-storefront from the store's numeric
// prices inside the component, and omitted entirely when the store has not
// answered. Do not reintroduce a comparative claim derived from priceUsd.

const ShopPage = () => {
  const navigate = useNavigate();
  const monetization = useGameStore(s => s.monetization);
  const restoreEntitlements = useGameStore(s => s.restoreEntitlements);
  const updateSubscription = useGameStore(s => s.updateSubscription);
  const setCosmetic = useGameStore(s => s.setCosmetic);
  const clearCosmetic = useGameStore(s => s.clearCosmetic);
  const [purchaseProduct, setPurchaseProduct] = useState<ProductId | null>(null);
  const [restoring, setRestoring] = useState(false);
  const userIsPro = isPro(monetization);
  const hasActiveSub = isSubscriptionActive(monetization);
  const onMonthlyPlan = monetization.subscription?.tier === 'monthly';
  const starterKitAvailable = isStarterKitAvailable(monetization);

  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [expandedPack, setExpandedPack] = useState<ProductId | null>(null);
  // Localised store prices fetched from RevenueCat. Empty on web/dev — falls
  // back to the USD config price for display.
  const [storePrices, setStorePrices] = useState<Partial<Record<ProductId, string>>>({});
  // Product IDs the store confirmed it can actually sell. `null` = not probed
  // yet (or off-device), which means "show everything" — the same convention
  // SubscribeOnboarding uses for `availableIds`.
  //
  // Without this, a SKU pulled from sale in App Store Connect still renders a
  // buy button here, and tapping it can only fail. That is the Guideline 2.1.0
  // condition that got build 174 rejected, and it is the sequencing hazard for
  // any price-ladder change that retires a SKU.
  const [availableIds, setAvailableIds] = useState<ProductId[] | null>(null);
  // Numeric prices in the storefront currency. Every comparative claim below
  // ("Save 12%", "just $1.25/month", the strikethrough total) is computed from
  // these — NOT from the USD constants, which are a false price claim in any
  // non-US storefront, and whose ratios do not survive Apple's price tiers.
  // When the store hasn't answered, the claims are suppressed rather than
  // guessed.
  const [storeAmounts, setStoreAmounts] = useState<Partial<Record<ProductId, number>>>({});

  useEffect(() => {
    let cancelled = false;
    // Probe ONLY the SKUs this page can sell. Probing the whole catalog means a
    // single unconfigured product (e.g. a consumable pack missing from the
    // RevenueCat offering) drags down the batch and can blank the one-time
    // catalog that IS configured.
    getStoreAvailability(SHOP_PROBE_IDS)
      .then(({ supported, available, prices, amounts }) => {
        if (cancelled) return;
        setStorePrices(prices);
        setStoreAmounts(amounts || {});
        // `supported` false means off-device / plugin absent — not a store
        // verdict, so keep the full catalog visible for web + dev testing.
        // When the store IS supported we trust its answer even if it is empty:
        // an empty list means it could sell nothing, and rendering CTAs then is
        // the Guideline 2.1.0 failure this gate exists to prevent. Treating
        // empty as "show everything" would fail open in exactly that case.
        setAvailableIds(supported ? available : null);
      })
      .catch(() => { if (!cancelled) setAvailableIds(null); });
    return () => { cancelled = true; };
  }, []);

  /** Can the store actually sell this? Off-device / unprobed answers yes. */
  const isPurchasable = (productId: ProductId) =>
    availableIds === null || availableIds.includes(productId);

  /** True once the store has answered and said it can sell nothing at all. */
  const storeSellsNothing = availableIds !== null && availableIds.length === 0;

  // ── Comparative price claims, storefront-correct or omitted ──
  //
  // `amountFor` returns the real local price when the store gave us one, and
  // the USD config price ONLY when the store isn't answering at all
  // (web/dev/off-device), where nothing is being claimed to a real buyer.
  const storeAnswered = Object.keys(storeAmounts).length > 0;
  const amountFor = (id: ProductId): number | null =>
    storeAmounts[id] ?? (storeAnswered ? null : PRODUCTS[id].priceUsd);

  /** Percentage saved by `discounted` vs `full`, or null if either is unknown. */
  const savingsPct = (full: number | null, discounted: number | null): number | null => {
    if (full == null || discounted == null || full <= 0 || discounted > full) return null;
    const pct = Math.round((1 - discounted / full) * 100);
    return pct > 0 ? pct : null;
  };

  const bundleIndividualTotal = (() => {
    const parts = ([
      'com.dynastymanager.pro.lifetime',
      'com.dynastymanager.pack.manager',
      'com.dynastymanager.pack.stadium',
      'com.dynastymanager.pack.legends',
    ] as ProductId[]).map(amountFor);
    return parts.every(p => p != null) ? (parts as number[]).reduce((a, b) => a + b, 0) : null;
  })();
  const bundleSavingsPct = savingsPct(bundleIndividualTotal, amountFor('com.dynastymanager.bundle.all'));

  const monthlyAmount = amountFor('com.dynastymanager.pro.monthly');
  const annualAmount = amountFor('com.dynastymanager.pro.yearly');
  const annualSavingsPct = savingsPct(monthlyAmount != null ? monthlyAmount * 12 : null, annualAmount);

  /** Format a derived per-period amount in the storefront's own formatting by
   *  reusing the store's price string shape. Falls back to null (caller omits
   *  the line) when we have no localized string to model. */
  const perPeriod = (id: ProductId, divisor: number): string | null => {
    const amount = amountFor(id);
    if (amount == null) return null;
    const localized = storePrices[id];
    const value = amount / divisor;
    if (!localized) return `$${value.toFixed(2)}`;
    // Swap the numeric portion of the store's own localized string so the
    // currency symbol, placement and separators stay correct for the storefront.
    const numeric = localized.match(/[\d.,]+/);
    if (!numeric) return null;
    return localized.replace(numeric[0], value.toFixed(2));
  };

  /** Display price — store-localised when available, USD config price otherwise. */
  const priceFor = (productId: ProductId) =>
    storePrices[productId] || formatPrice(PRODUCTS[productId].priceUsd);

  const handlePurchase = (productId: ProductId) => {
    setPurchaseError(null);
    setPurchaseProduct(productId);
  };

  /** Sync entitlements + subscription from RevenueCat after a purchase or restore */
  const syncAfterPurchase = async () => {
    const ids = await getEntitlements();
    if (ids.length > 0) restoreEntitlements(ids);
    const info = await getCustomerInfo();
    // Only write a confirmed, non-null subscription — a transient/empty
    // customerInfo must never clear an active sub (isSubscriptionActive handles
    // real expiry via expiresAt). See purchases.extractSubscriptionInfo.
    const sub = extractSubscriptionInfo(info);
    if (sub) updateSubscription(sub);
  };

  const handleConfirmPurchase = async () => {
    if (!purchaseProduct || purchasing) return;
    const productId = purchaseProduct;
    setPurchasing(true);
    setPurchaseError(null);
    addGameBreadcrumb('purchase', 'shop purchase initiated', { surface: 'shop', productId });
    // Fired here (confirm tap), not when the modal opens — an abandoned modal
    // must not inflate the initiated denominator.
    track('purchase_initiated', { productId, surface: 'shop' });
    try {
      const result = await purchaseViaSDK(productId);
      // Only an explicit cancel means no charge. A completed purchase with an
      // empty granted list (entitlement-mapping lag) still proceeds to the
      // sync below, which re-reads entitlements from RevenueCat.
      if (result.cancelled) {
        track('purchase_cancelled', { productId, surface: 'shop' });
        infoToast('Purchase Cancelled', 'No charge was made.');
        setPurchaseProduct(null);
        return;
      }
      restoreEntitlements(result.granted);
      await syncAfterPurchase();
      hapticMedium();
      track('purchase_completed', { productId, surface: 'shop' });
      successToast('Purchase complete!');
      setPurchaseProduct(null);
    } catch (err) {
      // The throw could come from before OR after the App Store charge —
      // RevenueCat's SDK doesn't always distinguish receipt-validation
      // failures from network errors. Defensive recovery: attempt a
      // post-failure sync so a successful charge gets picked up on the
      // next entitlement read (RevenueCat re-fetches receipt). Capture
      // the actual error to Sentry so we can triage real-money issues.
      addGameBreadcrumb('purchase', 'shop purchase threw', { surface: 'shop', productId });
      Sentry.captureException(err, { tags: { context: 'ShopPage.purchase' }, extra: { productId } });
      try { await syncAfterPurchase(); } catch { /* second-stage sync best-effort */ }
      track('purchase_failed', { productId, surface: 'shop' });
      setPurchaseError(
        'Purchase could not be confirmed. If you were charged, restore purchases from Settings — your entitlement will be granted. Contact support if it persists.',
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setPurchaseError(null);
    track('restore_clicked', {});
    try {
      const granted = await restoreViaSDK();
      if (granted.length > 0) restoreEntitlements(granted);

      // Sync BEFORE deciding what to tell the user. `mapEntitlements`
      // deliberately excludes subscription SKUs (they would outlive the sub in
      // `entitlements`), so a monthly/annual customer's restore legitimately
      // returns [] — their Pro comes back only through extractSubscriptionInfo.
      // Toasting off `granted.length` alone told every subscription-only
      // customer "No Purchases Found" moments before their sub was restored.
      // SettingsPage and SubscribeOnboarding already do this; the Shop never
      // did.
      await syncAfterPurchase();

      const proActive = isPro(useGameStore.getState().monetization);
      if (granted.length > 0) {
        successToast('Purchases Restored', `${granted.length} product${granted.length > 1 ? 's' : ''} restored.`);
      } else if (proActive) {
        successToast('Purchases Restored', 'Your Pro subscription is active.');
      } else {
        infoToast('No Purchases Found', 'No previous purchases were found for this account.');
      }
      track('restore_completed', { restoredCount: granted.length });
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'ShopPage.restore' } });
      errorToast('Restore Failed', 'Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const handlePresentPaywall = () => {
    setPurchaseError(null);
    navigate('/subscribe', { state: { returnTo: '/game' } });
  };

  const handleManageSubscription = async () => {
    const opened = await openSubscriptionManagement();
    if (!opened) {
      setPurchaseError('Could not open subscription management. Please visit your App Store or Play Store settings.');
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-[hsl(var(--gold))]" />
          <h2 className="text-lg font-display font-bold text-foreground">Shop</h2>
        </div>
        <button
          onClick={handleRestore}
          disabled={restoring}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <RefreshCw className={cn('w-3 h-3', restoring && 'animate-spin')} />
          {restoring ? 'Restoring...' : 'Restore Purchases'}
        </button>
      </div>

      {/* Error Display */}
      {purchaseError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-xs text-destructive">
          {purchaseError}
        </div>
      )}

      {/* ─── Dynasty Edition Hero Banner (Anchoring — best deal first) ─── */}
      {!hasProduct(monetization, 'com.dynastymanager.bundle.all') && !userIsPro && isPurchasable('com.dynastymanager.bundle.all') && (
        <GlassPanel className="p-0 overflow-hidden border-[hsl(var(--gold)/0.3)]">
          <div className="bg-gradient-to-br from-[hsl(var(--gold)/0.12)] via-transparent to-[hsl(var(--gold)/0.05)] p-4">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-[hsl(var(--gold))] fill-[hsl(var(--gold))]" />
              <span className="text-xs font-bold text-[hsl(var(--gold))] uppercase tracking-wider">Best Deal</span>
              {bundleSavingsPct != null && (
                <span className="text-[10px] bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold))] px-2 py-0.5 rounded-full font-bold ml-auto">
                  Save {bundleSavingsPct}%
                </span>
              )}
            </div>
            <h3 className="text-base font-display font-bold text-foreground mt-2">
              {PRODUCTS['com.dynastymanager.bundle.all'].name}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Everything in one purchase — Pro features + all 3 cosmetic packs.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <span className="text-[9px] bg-[hsl(var(--gold)/0.1)] text-[hsl(var(--gold)/0.8)] px-2 py-0.5 rounded-full font-medium">Dynasty Pro</span>
              <span className="text-[9px] bg-[hsl(var(--gold)/0.1)] text-[hsl(var(--gold)/0.8)] px-2 py-0.5 rounded-full font-medium">Manager Pack</span>
              <span className="text-[9px] bg-[hsl(var(--gold)/0.1)] text-[hsl(var(--gold)/0.8)] px-2 py-0.5 rounded-full font-medium">Stadium Pack</span>
              <span className="text-[9px] bg-[hsl(var(--gold)/0.1)] text-[hsl(var(--gold)/0.8)] px-2 py-0.5 rounded-full font-medium">Legends Pack</span>
            </div>
            <div className="flex items-baseline gap-2 mt-3 mb-3">
              <span className="text-lg font-bold text-[hsl(var(--gold))]">
                {priceFor('com.dynastymanager.bundle.all')}
              </span>
              {bundleIndividualTotal != null && (
                <span className="text-xs text-muted-foreground/60 line-through">
                  {formatPrice(bundleIndividualTotal)}
                </span>
              )}
            </div>
            <button
              onClick={() => handlePurchase('com.dynastymanager.bundle.all')}
              className="w-full py-2.5 rounded-lg bg-[hsl(var(--gold))] text-[hsl(30,20%,10%)] font-bold text-sm active:scale-[0.98] transition-transform shadow-[0_0_16px_hsl(var(--gold)/0.25)]"
            >
              Get Everything
            </button>
          </div>
        </GlassPanel>
      )}

      {/* ─── Starter Kit — new-manager recommendation (NOT a limited offer:
              same product, same price as the Manager Identity Pack below; shown
              to new managers as a "start here" suggestion, no fake countdown) ─── */}
      {starterKitAvailable && isPurchasable('com.dynastymanager.pack.manager') && (
        <GlassPanel className="p-4 border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--gold)/0.04)]">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-[hsl(var(--gold))]" />
            <span className="text-sm font-semibold text-[hsl(var(--gold))]">Recommended for New Managers</span>
          </div>
          <h3 className="text-base font-display font-bold text-foreground">{STARTER_KIT.name}</h3>
          <p className="text-xs text-muted-foreground mt-1">{STARTER_KIT.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-[9px] bg-muted/40 text-muted-foreground px-2 py-0.5 rounded-full">12 Avatars</span>
            <span className="text-[9px] bg-muted/40 text-muted-foreground px-2 py-0.5 rounded-full">8 Title Badges</span>
            <span className="text-[9px] bg-muted/40 text-muted-foreground px-2 py-0.5 rounded-full">3 Celebration Texts</span>
          </div>
          <button
            onClick={() => handlePurchase('com.dynastymanager.pack.manager')}
            className="mt-3 w-full py-2 rounded-lg bg-[hsl(var(--gold))] text-[hsl(30,20%,10%)] font-bold text-sm active:scale-[0.98] transition-transform"
          >
            Get — {priceFor('com.dynastymanager.pack.manager')}
          </button>
        </GlassPanel>
      )}

      {/* ─── Dynasty Pro Section ─── */}
      {(!userIsPro || hasActiveSub) && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-[hsl(var(--gold))]" />
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Go Pro</p>
            {!userIsPro && (
              <button
                onClick={handlePresentPaywall}
                className="text-[10px] text-[hsl(var(--gold))] font-semibold hover:text-[hsl(var(--gold)/0.8)] transition-colors flex items-center gap-1 ml-auto"
              >
                <CreditCard className="w-3 h-3" />
                View Plans
              </button>
            )}
          </div>

          {/* Active Subscription Banner */}
          {hasActiveSub && monetization.subscription && (
            <GlassPanel className="p-4 border-emerald-500/30 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Active Subscription</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold ml-auto capitalize">
                  {monetization.subscription.tier}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {PRODUCTS[monetization.subscription.productId]?.name || 'Dynasty Pro'}
              </p>
              {monetization.subscription.expiresAt && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {monetization.subscription.willRenew ? 'Renews' : 'Expires'}:{' '}
                  {new Date(monetization.subscription.expiresAt).toLocaleDateString()}
                </p>
              )}
              {monetization.subscription.isInGracePeriod && (
                <p className="text-[10px] text-amber-400 mt-1">
                  Payment issue detected. Please update your payment method.
                </p>
              )}
              <button
                onClick={handleManageSubscription}
                className="mt-3 w-full py-2 rounded-lg bg-muted/50 hover:bg-muted text-foreground font-semibold text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3 h-3" />
                Manage Subscription
              </button>
            </GlassPanel>
          )}

          {/* Annual upsell — shown only when the user is on the monthly plan
              and would save by switching. The actual swap happens in the
              store (App Store / Play Store) once they purchase the annual
              SKU; RevenueCat handles the proration / cross-grade. */}
          {onMonthlyPlan && (
            <GlassPanel className="p-4 border-emerald-500/30 bg-emerald-500/[0.04] mb-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Switch to Annual</span>
                {annualSavingsPct != null && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold ml-auto">
                    Save {annualSavingsPct}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Pay yearly and save vs your current monthly plan — same Pro features.
              </p>
              <p className="text-[10px] text-muted-foreground/60 mb-3">
                {perPeriod('com.dynastymanager.pro.yearly', 12) && `Just ${perPeriod('com.dynastymanager.pro.yearly', 12)}/month billed yearly`}
              </p>
              {isPurchasable('com.dynastymanager.pro.yearly') && <button
                onClick={() => handlePurchase('com.dynastymanager.pro.yearly')}
                className="w-full py-2.5 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white font-bold text-sm active:scale-[0.98] transition-all shadow-[0_0_12px_rgba(16,185,129,0.25)]"
              >
                Upgrade — {priceFor('com.dynastymanager.pro.yearly')}/year
              </button>}
            </GlassPanel>
          )}

          {/* Store reachable but selling nothing — say so instead of rendering
              an empty section the user cannot act on. */}
          {!userIsPro && storeSellsNothing && (
            <GlassPanel className="p-4">
              <p className="text-sm font-semibold text-foreground">Store unavailable</p>
              <p className="text-xs text-muted-foreground mt-1">
                The App Store isn't reachable right now, so purchases can't be shown.
                Check your connection and try again in a moment.
              </p>
            </GlassPanel>
          )}

          {/* Subscription Tier Cards */}
          {!userIsPro && !storeSellsNothing && (
            <div className="space-y-3">
              {SUBSCRIPTION_PRODUCTS.filter(id => isPurchasable(id) || hasProduct(monetization, id)).map(productId => {
                const product = PRODUCTS[productId];
                const isLifetime = product.subscriptionTier === 'lifetime';
                const isMonthly = product.subscriptionTier === 'monthly';
                const isAnnual = product.subscriptionTier === 'annual';

                return (
                  <GlassPanel
                    key={productId}
                    className={cn(
                      'p-4 relative',
                      isLifetime && 'border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold)/0.04)]',
                      isAnnual && 'border-emerald-500/40 bg-emerald-500/[0.04]',
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-semibold text-foreground">{product.name}</h4>
                      <div className="flex items-center gap-1.5">
                        {isAnnual && annualSavingsPct != null && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                            Save {annualSavingsPct}%
                          </span>
                        )}
                        {isLifetime && (
                          <span className="text-[10px] bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold))] px-2 py-0.5 rounded-full font-bold">
                            Best Value
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{product.description}</p>
                    {isMonthly && perPeriod('com.dynastymanager.pro.monthly', 30) && (
                      <p className="text-[10px] text-muted-foreground/60 mb-2">Just {perPeriod('com.dynastymanager.pro.monthly', 30)}/day — cancel anytime</p>
                    )}
                    {isAnnual && perPeriod('com.dynastymanager.pro.yearly', 12) && (
                      <p className="text-[10px] text-muted-foreground/60 mb-2">Just {perPeriod('com.dynastymanager.pro.yearly', 12)}/month — billed yearly</p>
                    )}
                    {isLifetime && (
                      <p className="text-[10px] text-muted-foreground/60 mb-2">One-time purchase, yours forever</p>
                    )}
                    <button
                      onClick={() => handlePurchase(productId)}
                      className={cn(
                        'w-full py-2.5 rounded-lg font-bold text-sm active:scale-[0.98] transition-all',
                        isLifetime
                          ? 'bg-[hsl(var(--gold))] text-[hsl(30,20%,10%)] shadow-[0_0_12px_hsl(var(--gold)/0.2)]'
                          : isAnnual
                            ? 'bg-emerald-500/90 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                            : 'bg-muted/50 hover:bg-muted text-foreground border border-border/50'
                      )}
                    >
                      {priceFor(productId)}{product.billingPeriod && product.billingPeriod !== 'one-time' ? product.billingPeriod : ''}
                    </button>
                  </GlassPanel>
                );
              })}

              {/* The "or buy once" row used to sell `com.dynastymanager.pro`
                  here for $7.99 — the same permanent Pro entitlement Lifetime
                  grants, at a fraction of the price, directly beneath the
                  subscription cards it made unsellable. The SKU is retired
                  (RETIRED_PRODUCT_IDS); Lifetime above is now the only
                  buy-once route to Pro. Existing owners keep it through
                  `restoreEntitlements` — nothing about that path changed. */}
            </div>
          )}
        </div>
      )}

      {/* ─── Pro Features Grid ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Crown className={cn('w-4 h-4', userIsPro ? 'text-emerald-400' : 'text-[hsl(var(--gold))]')} />
          <p className="text-xs font-bold text-foreground uppercase tracking-wider">
            {userIsPro ? 'Your Pro Features' : 'What You Get'}
          </p>
          {userIsPro && (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold ml-auto">
              Unlocked
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PRO_FEATURES.map(feature => {
            const Icon = FEATURE_ICONS[feature];
            return (
              <div
                key={feature}
                className={cn(
                  // Mini liquid-glass tile — matches drawer/quick-access look.
                  'relative overflow-hidden flex items-center gap-2 p-2.5 rounded-xl transform-gpu',
                  'bg-gradient-to-br from-[hsl(222_35%_14%/0.55)] via-[hsl(222_28%_10%/0.65)] to-[hsl(222_40%_7%/0.75)]',
                  'backdrop-blur-xl backdrop-saturate-150',
                  userIsPro
                    ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.28),0_0_0_1px_rgba(16,185,129,0.18)_inset]'
                    : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.28),0_0_0_1px_rgba(255,255,255,0.05)_inset]',
                )}
              >
                {userIsPro ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 relative" />
                ) : (
                  <Icon className="w-3.5 h-3.5 text-[hsl(var(--gold))] shrink-0 relative drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]" />
                )}
                <span className="text-[11px] text-foreground font-medium leading-tight relative">{PRO_FEATURE_LABELS[feature]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Cosmetic Packs ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-[hsl(var(--gold))]" />
          <p className="text-xs font-bold text-foreground uppercase tracking-wider">Customization Packs</p>
        </div>
        <div className="space-y-3">
          {/* An owned pack stays visible even if the store can no longer sell
              it — the card is how the user sees what they already have. Only
              its (already `!owned`-gated) buy button would be dead. */}
          {COSMETIC_PACK_IDS.filter(id => isPurchasable(id) || hasProduct(monetization, id)).map(productId => {
            const product = PRODUCTS[productId];
            const owned = hasProduct(monetization, productId);
            const isExpanded = expandedPack === productId;
            const packItems = COSMETIC_ITEMS.filter(c => c.pack === productId);
            return (
              <GlassPanel key={productId} className={cn('p-4', owned && 'border-emerald-500/20')}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{product.name}</h4>
                    <span className="text-[9px] bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded-full">
                      {packItems.length} items
                    </span>
                  </div>
                  {owned && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                      Owned
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">{product.description}</p>
                <button
                  onClick={() => setExpandedPack(isExpanded ? null : productId)}
                  className="flex items-center gap-1 text-[10px] text-primary font-semibold mb-2 hover:text-primary/80 transition-colors"
                >
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {isExpanded ? 'Hide contents' : `View all ${packItems.length} items`}
                </button>
                {isExpanded && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {packItems.map(item => (
                      <span key={item.id} className="text-[9px] bg-muted/40 text-muted-foreground px-2 py-0.5 rounded-full">
                        {item.name}
                      </span>
                    ))}
                  </div>
                )}
                {!owned && (
                  <button
                    onClick={() => handlePurchase(productId)}
                    className="w-full py-2 rounded-lg bg-muted/50 hover:bg-muted text-foreground font-semibold text-sm active:scale-[0.98] transition-all border border-border/50"
                  >
                    {priceFor(productId)}
                  </button>
                )}
              </GlassPanel>
            );
          })}
        </div>
      </div>

      {/* ─── Dynasty Edition (for Pro users who may want cosmetics) ─── */}
      {!hasProduct(monetization, 'com.dynastymanager.bundle.all') && userIsPro && isPurchasable('com.dynastymanager.bundle.all') && (
        <GlassPanel className="p-4 border-[hsl(var(--gold)/0.2)] bg-gradient-to-br from-[hsl(var(--gold)/0.05)] to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-[hsl(var(--gold))]" />
            <h3 className="text-base font-display font-bold text-foreground">
              {PRODUCTS['com.dynastymanager.bundle.all'].name}
            </h3>
            {bundleSavingsPct != null && (
              <span className="text-[10px] bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold))] px-2 py-0.5 rounded-full font-bold ml-auto">
                Save {bundleSavingsPct}%
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {PRODUCTS['com.dynastymanager.bundle.all'].description}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mb-3">
            {bundleIndividualTotal != null && (
              <><span className="line-through">{formatPrice(bundleIndividualTotal)}</span> individually</>
            )}
          </p>
          <button
            onClick={() => handlePurchase('com.dynastymanager.bundle.all')}
            className="w-full py-2.5 rounded-lg bg-[hsl(var(--gold))] text-[hsl(30,20%,10%)] font-bold text-sm active:scale-[0.98] transition-transform shadow-[0_0_12px_hsl(var(--gold)/0.2)]"
          >
            Get Everything — {priceFor('com.dynastymanager.bundle.all')}
          </button>
        </GlassPanel>
      )}

      {/* ─── My Cosmetics Selector ─── */}
      {(() => {
        const categories: { key: CosmeticCategory; label: string }[] = [
          { key: 'avatar', label: 'Avatar' },
          { key: 'title_badge', label: 'Title Badge' },
          { key: 'celebration_text', label: 'Celebration Text' },
          { key: 'stadium_theme', label: 'Stadium Theme' },
          { key: 'pitch_skin', label: 'Pitch Skin' },
          { key: 'confetti_style', label: 'Confetti Style' },
          { key: 'cabinet_style', label: 'Cabinet Style' },
          { key: 'prestige_badge', label: 'Prestige Badge' },
          { key: 'hom_frame', label: 'HoM Frame' },
        ];
        const ownedCategories = categories.filter(c => getOwnedCosmetics(monetization, c.key).length > 0);
        if (ownedCategories.length === 0) return null;
        return (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[hsl(var(--gold))]" />
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">My Cosmetics</p>
            </div>
            <div className="space-y-3">
              {ownedCategories.map(({ key, label }) => {
                const items = getOwnedCosmetics(monetization, key);
                const active = getActiveCosmetic(monetization, key);
                return (
                  <GlassPanel key={key} className="p-3">
                    <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => clearCosmetic(key)}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all',
                          !active ? 'bg-primary/20 text-primary' : 'bg-muted/30 text-muted-foreground'
                        )}
                      >
                        Default
                      </button>
                      {items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => setCosmetic(key, item.id)}
                          className={cn(
                            'px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all',
                            active === item.id ? 'bg-primary/20 text-primary' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                          )}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </GlassPanel>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ─── Fine Print ─── */}
      <div className="text-[10px] text-muted-foreground/60 text-center px-4 pb-4 space-y-1">
        <p>
          One-time purchases and subscriptions available. Subscriptions auto-renew until cancelled.
          Purchases can be restored on any device linked to your App Store / Play Store account.
        </p>
        <p>
          <button
            type="button"
            onClick={() => { void openExternalUrl(TERMS_URL); }}
            className="underline hover:text-muted-foreground transition-colors"
          >
            Terms of Service
          </button>
          {' · '}
          <button
            type="button"
            onClick={() => { void openExternalUrl(PRIVACY_URL); }}
            className="underline hover:text-muted-foreground transition-colors"
          >
            Privacy Policy
          </button>
        </p>
      </div>

      {/* Purchase Confirmation Modal */}
      {purchaseProduct && (
        <PurchaseModal
          productId={purchaseProduct}
          storePrice={storePrices[purchaseProduct]}
          onConfirm={handleConfirmPurchase}
          onCancel={() => {
            // An abandoned confirm modal is a funnel exit — record it or every
            // initiated event from a dismissed modal becomes an orphan.
            if (purchaseProduct) track('purchase_cancelled', { productId: purchaseProduct, surface: 'shop' });
            setPurchaseProduct(null);
          }}
          loading={purchasing}
        />
      )}
    </div>
  );
};

export default ShopPage;
