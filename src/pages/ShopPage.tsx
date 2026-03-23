import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PurchaseModal } from '@/components/game/PurchaseModal';
import { Crown, Check, Sparkles, Package, Shield, Timer, CreditCard, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRODUCTS, PRO_FEATURE_LABELS, PRO_FEATURES, STARTER_KIT } from '@/config/monetization';
import { isPro, hasProduct, isStarterKitAvailable, getStarterKitRemainingMs, getOwnedCosmetics, getActiveCosmetic, isSubscriptionActive } from '@/utils/monetization';
import type { CosmeticCategory } from '@/types/game';
import type { ProductId, ProFeature } from '@/types/game';
import { purchaseProduct as purchaseViaSDK, restorePurchases as restoreViaSDK, presentPaywall, getEntitlements, getCustomerInfo, extractSubscriptionInfo, openSubscriptionManagement } from '@/utils/purchases';
import { hapticMedium } from '@/utils/haptics';

const formatPrice = (usd: number) => `$${usd.toFixed(2)}`;

const formatTimeRemaining = (ms: number) => {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h remaining`;
};

const FEATURE_ICONS: Record<ProFeature, React.ElementType> = {
  ad_free: Shield,
  advanced_analytics: Sparkles,
  custom_tactics: Crown,
  expanded_press: Package,
  historical_records: Sparkles,
  instant_sim: Timer,
  pro_badge: Crown,
};

const SUBSCRIPTION_PRODUCTS: ProductId[] = [
  'com.dynastymanager.pro.monthly',
  'com.dynastymanager.pro.yearly',
  'com.dynastymanager.pro.lifetime',
];

const ShopPage = () => {
  const { monetization, restoreEntitlements, updateSubscription, setCosmetic, clearCosmetic } = useGameStore();
  const [purchaseProduct, setPurchaseProduct] = useState<ProductId | null>(null);
  const [restoring, setRestoring] = useState(false);
  const userIsPro = isPro(monetization);
  const hasActiveSub = isSubscriptionActive(monetization);
  const starterKitAvailable = isStarterKitAvailable(monetization);
  const starterKitMs = getStarterKitRemainingMs(monetization);

  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = (productId: ProductId) => {
    setPurchaseError(null);
    setPurchaseProduct(productId);
  };

  /** Sync entitlements + subscription from RevenueCat after a purchase or restore */
  const syncAfterPurchase = async () => {
    const ids = await getEntitlements();
    if (ids.length > 0) restoreEntitlements(ids);
    const info = await getCustomerInfo();
    if (info) updateSubscription(extractSubscriptionInfo(info));
  };

  const handleConfirmPurchase = async () => {
    if (!purchaseProduct || purchasing) return;
    setPurchasing(true);
    setPurchaseError(null);
    try {
      const granted = await purchaseViaSDK(purchaseProduct);
      if (granted.length > 0) {
        restoreEntitlements(granted);
      }
      await syncAfterPurchase();
      hapticMedium();
      setPurchaseProduct(null);
    } catch {
      setPurchaseError('Purchase failed. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setPurchaseError(null);
    try {
      const granted = await restoreViaSDK();
      if (granted.length > 0) {
        restoreEntitlements(granted);
      }
      await syncAfterPurchase();
    } catch {
      setPurchaseError('Restore failed. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const handlePresentPaywall = async () => {
    setPurchaseError(null);
    const result = await presentPaywall();
    if (result === 'purchased' || result === 'restored') {
      await syncAfterPurchase();
      hapticMedium();
    } else if (result === 'error') {
      setPurchaseError('Could not load paywall. Try purchasing below.');
    }
    // 'not_presented' on web — fall through to inline UI
  };

  const handleManageSubscription = async () => {
    const opened = await openSubscriptionManagement();
    if (!opened) {
      setPurchaseError('Could not open subscription management. Please visit your App Store or Play Store settings.');
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold text-foreground">Shop</h2>
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

      {/* Starter Kit Time-Limited Offer */}
      {starterKitAvailable && (
        <GlassPanel className="p-4 border-primary/50 bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-sm font-semibold text-primary">Limited Offer</span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {formatTimeRemaining(starterKitMs)}
            </span>
          </div>
          <h3 className="text-base font-display font-bold text-foreground">{STARTER_KIT.name}</h3>
          <p className="text-xs text-muted-foreground mt-1">{STARTER_KIT.description}</p>
          <button
            onClick={() => handlePurchase('com.dynastymanager.pack.manager')}
            className="mt-3 w-full py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm active:scale-[0.98] transition-transform"
          >
            {formatPrice(STARTER_KIT.priceUsd)}
          </button>
        </GlassPanel>
      )}

      {/* Subscription Plans */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Subscription Plans
          </p>
          {!userIsPro && (
            <button
              onClick={handlePresentPaywall}
              className="text-[10px] text-primary font-semibold hover:text-primary/80 transition-colors flex items-center gap-1"
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

        {/* Subscription Cards */}
        {!userIsPro && (
          <div className="space-y-3">
            {SUBSCRIPTION_PRODUCTS.map(productId => {
              const product = PRODUCTS[productId];
              const isYearly = product.subscriptionTier === 'yearly';
              return (
                <GlassPanel
                  key={productId}
                  className={cn('p-4', isYearly && 'border-primary/30 bg-primary/5')}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-foreground">{product.name}</h4>
                    {isYearly && (
                      <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">
                        Best Value
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{product.description}</p>
                  <button
                    onClick={() => handlePurchase(productId)}
                    className={cn(
                      'w-full py-2 rounded-lg font-semibold text-sm active:scale-[0.98] transition-all',
                      isYearly
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 hover:bg-muted text-foreground'
                    )}
                  >
                    {formatPrice(product.priceUsd)}{product.billingPeriod && product.billingPeriod !== 'one-time' ? product.billingPeriod : ''}
                  </button>
                </GlassPanel>
              );
            })}
          </div>
        )}
      </div>

      {/* Dynasty Pro (one-time) */}
      <GlassPanel className={cn('p-4', userIsPro ? 'border-emerald-500/30' : 'border-primary/30')}>
        <div className="flex items-center gap-2 mb-3">
          <Crown className={cn('w-5 h-5', userIsPro ? 'text-emerald-400' : 'text-primary')} />
          <h3 className="text-base font-display font-bold text-foreground">
            {PRODUCTS['com.dynastymanager.pro'].name}
          </h3>
          {userIsPro && (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold ml-auto">
              Owned
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {PRODUCTS['com.dynastymanager.pro'].description}
        </p>

        {/* Feature list */}
        <div className="space-y-2 mb-4">
          {PRO_FEATURES.map(feature => {
            const Icon = FEATURE_ICONS[feature];
            return (
              <div key={feature} className="flex items-center gap-2">
                {userIsPro ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                )}
                <span className="text-xs text-foreground">{PRO_FEATURE_LABELS[feature]}</span>
              </div>
            );
          })}
        </div>

        {!userIsPro && (
          <button
            onClick={() => handlePurchase('com.dynastymanager.pro')}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm active:scale-[0.98] transition-transform"
          >
            Upgrade — {formatPrice(PRODUCTS['com.dynastymanager.pro'].priceUsd)}
          </button>
        )}
      </GlassPanel>

      {/* Cosmetic Packs */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
          Cosmetic Packs
        </p>
        <div className="space-y-3">
          {(['com.dynastymanager.pack.manager', 'com.dynastymanager.pack.stadium', 'com.dynastymanager.pack.legends'] as ProductId[]).map(productId => {
            const product = PRODUCTS[productId];
            const owned = hasProduct(monetization, productId);
            return (
              <GlassPanel key={productId} className={cn('p-4', owned && 'border-emerald-500/20')}>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold text-foreground">{product.name}</h4>
                  {owned && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                      Owned
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{product.description}</p>
                {!owned && (
                  <button
                    onClick={() => handlePurchase(productId)}
                    className="w-full py-2 rounded-lg bg-muted/50 hover:bg-muted text-foreground font-semibold text-sm active:scale-[0.98] transition-all"
                  >
                    {formatPrice(product.priceUsd)}
                  </button>
                )}
              </GlassPanel>
            );
          })}
        </div>
      </div>

      {/* Dynasty Edition Bundle */}
      {!hasProduct(monetization, 'com.dynastymanager.bundle.all') && (
        <GlassPanel className="p-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-primary" />
            <h3 className="text-base font-display font-bold text-foreground">
              {PRODUCTS['com.dynastymanager.bundle.all'].name}
            </h3>
            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold ml-auto">
              Best Value
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {PRODUCTS['com.dynastymanager.bundle.all'].description}
          </p>
          <button
            onClick={() => handlePurchase('com.dynastymanager.bundle.all')}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm active:scale-[0.98] transition-transform"
          >
            Get Everything — {formatPrice(PRODUCTS['com.dynastymanager.bundle.all'].priceUsd)}
          </button>
        </GlassPanel>
      )}

      {/* My Cosmetics Selector */}
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
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
              My Cosmetics
            </p>
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

      {/* Fine print */}
      <p className="text-[10px] text-muted-foreground/60 text-center px-4 pb-4">
        One-time purchases and subscriptions available. Subscriptions auto-renew until cancelled.
        Purchases can be restored on any device linked to your App Store / Play Store account.
      </p>

      {/* Purchase Confirmation Modal */}
      {purchaseProduct && (
        <PurchaseModal
          productId={purchaseProduct}
          onConfirm={handleConfirmPurchase}
          onCancel={() => setPurchaseProduct(null)}
          loading={purchasing}
        />
      )}
    </div>
  );
};

export default ShopPage;
