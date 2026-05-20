import { useEffect } from 'react';
import { PRODUCTS } from '@/config/monetization';
import type { ProductId } from '@/types/game';
import { Crown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TERMS_URL, PRIVACY_URL } from '@/config/legal';
import { openExternalUrl } from '@/utils/externalUrl';
import { useScrollLock } from '@/hooks/useScrollLock';
import { hapticLight, hapticMedium } from '@/utils/haptics';

interface PurchaseModalProps {
  productId: ProductId;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  /** Optional localised price string from the store (e.g. "kr 149,99").
   *  Falls back to the USD config price when omitted. */
  storePrice?: string;
}

export function PurchaseModal({ productId, onConfirm, onCancel, loading, storePrice }: PurchaseModalProps) {
  useScrollLock(true);

  const handleConfirm = () => { hapticMedium(); onConfirm(); };
  const handleCancel = () => { hapticLight(); onCancel(); };

  // Escape-to-dismiss. App Store review flags payment screens that aren't
  // dismissable by standard means. `loading` blocks dismissal mid-purchase
  // so the user can't cancel a transaction that's already in flight.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) { e.preventDefault(); handleCancel(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // handleCancel is recreated each render but only closes over onCancel/haptic;
    // re-binding per render is cheap and keeps the listener current.
  });

  const product = PRODUCTS[productId];
  if (!product) return null;

  const isSubscription = product.type === 'subscription';
  const basePrice = storePrice || `$${product.priceUsd.toFixed(2)}`;
  const priceLabel = isSubscription && product.billingPeriod && product.billingPeriod !== 'one-time'
    ? `${basePrice}${product.billingPeriod}`
    : basePrice;

  return (
    <AnimatePresence>
      <motion.div
        key="purchase-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleCancel}
      >
        <motion.div
          key="purchase-card"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl p-6 max-w-sm w-full space-y-4"
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="purchase-modal-title"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              <h3 id="purchase-modal-title" className="text-base font-display font-bold text-foreground">
                {isSubscription ? 'Confirm Subscription' : 'Confirm Purchase'}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              aria-label={isSubscription ? 'Close subscription dialog' : 'Close purchase dialog'}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] -m-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{product.name}</p>
            <p className="text-xs text-muted-foreground">{product.description}</p>
          </div>

          <div className="border-t border-border/50 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-display font-bold text-primary">{priceLabel}</span>
            </div>

            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {loading ? 'Processing...' : isSubscription ? 'Subscribe' : 'Purchase'}
            </button>

            <button
              onClick={handleCancel}
              disabled={loading}
              className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground/50 text-center">
            {isSubscription && product.billingPeriod !== 'one-time'
              ? 'Auto-renews until cancelled. Manage in your App Store or Play Store settings.'
              : 'One-time purchase. Works offline. No recurring charges.'}
            {' '}
            <button
              type="button"
              onClick={() => { void openExternalUrl(TERMS_URL); }}
              className="underline hover:text-muted-foreground transition-colors"
            >
              Terms
            </button>
            {' · '}
            <button
              type="button"
              onClick={() => { void openExternalUrl(PRIVACY_URL); }}
              className="underline hover:text-muted-foreground transition-colors"
            >
              Privacy
            </button>
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
