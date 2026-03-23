import { PRODUCTS } from '@/config/monetization';
import type { ProductId } from '@/types/game';
import { Crown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PurchaseModalProps {
  productId: ProductId;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function PurchaseModal({ productId, onConfirm, onCancel, loading }: PurchaseModalProps) {
  const product = PRODUCTS[productId];
  if (!product) return null;

  const isSubscription = product.type === 'subscription';
  const priceLabel = isSubscription && product.billingPeriod && product.billingPeriod !== 'one-time'
    ? `$${product.priceUsd.toFixed(2)}${product.billingPeriod}`
    : `$${product.priceUsd.toFixed(2)}`;

  return (
    <AnimatePresence>
      <motion.div
        key="purchase-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onCancel}
      >
        <motion.div
          key="purchase-card"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl p-6 max-w-sm w-full space-y-4"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              <h3 className="text-base font-display font-bold text-foreground">
                {isSubscription ? 'Confirm Subscription' : 'Confirm Purchase'}
              </h3>
            </div>
            <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
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
              onClick={onConfirm}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {loading ? 'Processing...' : isSubscription ? 'Subscribe' : 'Purchase'}
            </button>

            <button
              onClick={onCancel}
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
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
