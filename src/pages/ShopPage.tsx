import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PurchaseModal } from '@/components/game/PurchaseModal';
import { Crown, Check, Sparkles, Package, Shield, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRODUCTS, PRO_FEATURE_LABELS, PRO_FEATURES, STARTER_KIT } from '@/config/monetization';
import { isPro, hasProduct, isStarterKitAvailable, getStarterKitRemainingMs } from '@/utils/monetization';
import type { ProductId, ProFeature } from '@/types/game';

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

const ShopPage = () => {
  const { monetization, grantEntitlement } = useGameStore();
  const [purchaseProduct, setPurchaseProduct] = useState<ProductId | null>(null);
  const [restoring, setRestoring] = useState(false);
  const userIsPro = isPro(monetization);
  const starterKitAvailable = isStarterKitAvailable(monetization);
  const starterKitMs = getStarterKitRemainingMs(monetization);

  const handlePurchase = (productId: ProductId) => {
    // In production, this would go through RevenueCat SDK.
    // For now, directly grant the entitlement for development.
    setPurchaseProduct(productId);
  };

  const handleConfirmPurchase = () => {
    if (purchaseProduct) {
      grantEntitlement(purchaseProduct);
      setPurchaseProduct(null);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    // In production: await Purchases.restorePurchases()
    // For now, simulate a brief delay
    setTimeout(() => setRestoring(false), 1000);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold text-foreground">Shop</h2>
        <button
          onClick={handleRestore}
          disabled={restoring}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {restoring ? 'Restoring...' : 'Restore Purchases'}
        </button>
      </div>

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

      {/* Dynasty Pro */}
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

      {/* Fine print */}
      <p className="text-[10px] text-muted-foreground/60 text-center px-4 pb-4">
        All purchases are one-time payments. No subscriptions. All features work offline after purchase.
        Purchases can be restored on any device linked to your App Store / Play Store account.
      </p>

      {/* Purchase Confirmation Modal */}
      {purchaseProduct && (
        <PurchaseModal
          productId={purchaseProduct}
          onConfirm={handleConfirmPurchase}
          onCancel={() => setPurchaseProduct(null)}
        />
      )}
    </div>
  );
};

export default ShopPage;
