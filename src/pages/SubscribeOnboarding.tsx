import * as Sentry from '@sentry/react';
import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import {
  Crown,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { successToast, errorToast, infoToast } from '@/utils/gameToast';
import { setFlag, STORAGE_KEYS } from '@/store/helpers/persistence';
import {
  purchaseProduct,
  restorePurchases,
  getEntitlements,
  getCustomerInfo,
  extractSubscriptionInfo,
  getStorePrices,
} from '@/utils/purchases';
import {
  FREE_TRIAL_DAYS,
  PRODUCTS,
  SUB_TRIAL_PRODUCT_IDS,
} from '@/config/monetization';
import { TERMS_URL, PRIVACY_URL } from '@/config/legal';
import { openExternalUrl } from '@/utils/externalUrl';
import type { ProductId } from '@/types/game';
import { track } from '@/utils/analytics';
import { subscribeSlotContextMissing } from '@/utils/paywallTiming';

/**
 * Apple-compliant in-app paywall (Guideline 3.1.2(c)).
 *
 * Requirements covered here, in the purchase flow itself:
 * - Subscription title (e.g. "Dynasty Pro Annual")
 * - Length of subscription (Yearly / Monthly / Lifetime one-time)
 * - Price of subscription, with billed amount displayed most prominently
 * - Functional links to Terms of Use (EULA) and Privacy Policy
 * - Restore Purchases entry point
 * - Free-trial copy is subordinate to the billed amount (font, size, weight)
 *
 * This screen REPLACES the RevenueCat-hosted paywall (`presentPaywall`)
 * because that paywall is configured in the RC dashboard and shipped with
 * missing tier labels + missing legal links, triggering App Store review
 * rejections. All Pro purchase flows now route here.
 */

const PRO_FEATURE_BULLETS: { title: string; description: string }[] = [
  { title: 'Ad-Free Experience', description: 'No banners, no video pre-rolls. Ever.' },
  { title: 'Instant Match Sim', description: 'Long-press to fast-forward a match in under a second.' },
  { title: 'Advanced Analytics', description: 'Possession, conversion, and per-match performance reads.' },
  { title: 'Custom Tactics Creator', description: 'Save up to 5 tactical presets and switch mid-season.' },
  { title: 'Expanded Press Conferences', description: 'More tones, deeper questions, dynamic fan reactions.' },
  { title: 'Historical Record Book', description: 'Every signing, season, and cup run preserved.' },
  { title: 'Pro Manager Badge', description: 'Premium gold ring on your avatar across the app.' },
];

interface PlanRow {
  productId: ProductId;
  /** Bold, prominent title shown on the row. */
  title: string;
  /** Length of subscription, shown plainly to satisfy Apple 3.1.2(c). */
  lengthLabel: string;
  /** Optional small caption shown ABOVE the price (subordinate). */
  trialCaption?: string;
  /** Optional badge displayed at the right (e.g. "BEST VALUE", "POPULAR"). */
  badge?: string;
}

const PLAN_ROWS: PlanRow[] = [
  {
    productId: 'com.dynastymanager.pro.annual',
    title: 'Pro Yearly',
    lengthLabel: '12 months · auto-renews yearly',
    trialCaption: `${FREE_TRIAL_DAYS}-day free trial included`,
    badge: 'BEST VALUE',
  },
  {
    productId: 'com.dynastymanager.pro.lifetime',
    title: 'Pro Lifetime',
    lengthLabel: 'One-time purchase · no renewal',
  },
  {
    productId: 'com.dynastymanager.pro.monthly',
    title: 'Pro Monthly',
    lengthLabel: 'Auto-renews monthly',
    trialCaption: `${FREE_TRIAL_DAYS}-day free trial included`,
  },
];

const SubscribeOnboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const grantEntitlement = useGameStore(s => s.grantEntitlement);
  const startFreeTrial = useGameStore(s => s.startFreeTrial);
  const restoreEntitlementsAction = useGameStore(s => s.restoreEntitlements);
  const updateSubscription = useGameStore(s => s.updateSubscription);
  const monetization = useGameStore(s => s.monetization);
  // Trial framing is only shown to users with NO subscription record at all.
  // Apple grants the introductory offer once per Apple ID — a lapsed/existing
  // record means the user would be charged full price immediately, so showing
  // "free trial" copy (caption, CTA, success toast) to them would be a lie
  // and a 3.1.2(c) exposure. Mirrors startFreeTrial()'s own guard.
  const trialEligible = monetization.subscription == null;

  const navState = (location.state as { slot?: number; communityPackEnabled?: boolean; returnTo?: string }) || {};
  // A webview reload / deep link on #/subscribe loses nav state. Without a slot
  // AND without an explicit in-app return context, `slot ?? 1` used to default
  // to 1 and the onboarding continuation could silently overwrite save slot 1.
  // Redirect to the title instead, mirroring ModeSelect/ClubSelection's guard.
  const missingSlot = subscribeSlotContextMissing(navState);
  useEffect(() => {
    if (missingSlot) navigate('/', { replace: true });
  }, [missingSlot, navigate]);
  // No `?? 1` fallback — in-app upsells (Shop/Settings) intentionally omit the
  // slot and return to '/game' or '/', which never enter club setup.
  const slot = navState.slot;
  const communityPackEnabled = navState.communityPackEnabled === true;
  const returnTo = navState.returnTo || '/mode-select';

  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // Default to Yearly — it's the best value AND the row whose billed amount
  // Apple needs to see prominently displayed.
  const [selected, setSelected] = useState<ProductId>('com.dynastymanager.pro.annual');

  // Localised store prices fetched from RevenueCat. Empty on web/dev — falls
  // back to the USD config price for display.
  const [storePrices, setStorePrices] = useState<Partial<Record<ProductId, string>>>({});
  useEffect(() => {
    let cancelled = false;
    getStorePrices().then(prices => { if (!cancelled) setStorePrices(prices); });
    return () => { cancelled = true; };
  }, []);

  const priceFor = (productId: ProductId) =>
    storePrices[productId] || `$${PRODUCTS[productId].priceUsd.toFixed(2)}`;

  const finish = () => {
    setFlag(STORAGE_KEYS.SUBSCRIBE_ONBOARDING_SEEN);
    navigate(returnTo, { state: { slot, communityPackEnabled } });
  };

  const syncAfterPurchase = async () => {
    const ids = await getEntitlements();
    if (ids.length > 0) restoreEntitlementsAction(ids);
    const info = await getCustomerInfo();
    // Only write a confirmed, non-null sub — a transient/empty customerInfo
    // must not clear an active subscription (expiry handled via expiresAt).
    const sub = extractSubscriptionInfo(info);
    if (sub) updateSubscription(sub);
  };

  const handleSubscribe = async () => {
    hapticMedium();
    setPurchasing(true);
    track('purchase_initiated', { productId: selected });
    try {
      const result = await purchaseProduct(selected);
      if (result.cancelled) {
        // User cancelled the StoreKit dialog. (Only `cancelled` means no
        // charge — a completed subscription purchase legitimately returns
        // an empty `granted` list, since sub status flows through
        // subscription.expiresAt, not entitlements.)
        track('purchase_cancelled', { productId: selected });
        infoToast('Purchase Cancelled', 'No charge was made.');
        return;
      }

      result.granted.forEach(id => grantEntitlement(id));

      // If the user picked a trial-bearing plan, the App Store Connect
      // introductory offer grants the free trial automatically — mirror it
      // locally so gated features unlock immediately.
      const isTrial = trialEligible && SUB_TRIAL_PRODUCT_IDS.includes(selected);
      if (isTrial) startFreeTrial(selected);

      await syncAfterPurchase();
      track('purchase_completed', { productId: selected });

      const product = PRODUCTS[selected];
      successToast(
        isTrial ? `${FREE_TRIAL_DAYS}-Day Free Trial Started!` : 'Welcome to Dynasty Pro!',
        isTrial
          ? `Pro is unlocked. You'll be charged ${priceFor(selected)}${product.billingPeriod || ''} after the trial unless you cancel.`
          : `${product.name} is now active.`,
      );
      finish();
    } catch (err) {
      track('purchase_failed', { productId: selected });
      Sentry.captureException(err, { tags: { context: 'subscribe-onboarding.subscribe' }, extra: { productId: selected } });
      errorToast(
        'Purchase Could Not Complete',
        'Something went wrong with the App Store. You can try again from Settings later.',
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (restoring || purchasing) return;
    hapticLight();
    setRestoring(true);
    track('restore_clicked', {});
    try {
      const granted = await restorePurchases();
      if (granted.length > 0) {
        restoreEntitlementsAction(granted);
        await syncAfterPurchase();
        successToast('Purchases Restored', `${granted.length} product${granted.length > 1 ? 's' : ''} restored.`);
        track('restore_completed', { restoredCount: granted.length });
        finish();
      } else {
        infoToast('No Purchases Found', 'No previous purchases were found for this account.');
        track('restore_completed', { restoredCount: 0 });
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'subscribe-onboarding.restore' } });
      errorToast('Restore Failed', 'Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const handleSkip = () => {
    hapticLight();
    setFlag(STORAGE_KEYS.SUBSCRIBE_ONBOARDING_SEEN);
    finish();
  };

  const openLegal = (url: string) => () => {
    hapticLight();
    void openExternalUrl(url);
  };

  const selectedProduct = PRODUCTS[selected];
  const isTrialPlan = trialEligible && SUB_TRIAL_PRODUCT_IDS.includes(selected);
  const billingSummary = useMemo(() => {
    if (isTrialPlan) {
      const period = selectedProduct.billingPeriod?.replace('/', '') || 'period';
      return `Free for ${FREE_TRIAL_DAYS} days, then ${priceFor(selected)} per ${period}. Auto-renews until cancelled.`;
    }
    if (selectedProduct.type === 'subscription') {
      const period = selectedProduct.billingPeriod?.replace('/', '') || 'period';
      return `${priceFor(selected)} per ${period}. Auto-renews until cancelled.`;
    }
    return `${priceFor(selected)} one-time payment. No subscription, no renewal.`;
    // priceFor is recomputed every render — depending on storePrices captures it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, storePrices, isTrialPlan, selectedProduct]);

  // Redirecting to the title (no slot / no in-app context) — render nothing.
  // Placed after all hooks to satisfy the Rules of Hooks.
  if (missingSlot) return null;

  return (
    <div className="h-screen bg-background flex flex-col items-center px-4 sm:px-5 relative overflow-hidden safe-area-top safe-area-bottom">
      {/* Ambient halo */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: [
            'radial-gradient(60% 50% at 50% 18%, hsl(43 80% 55% / 0.16) 0%, transparent 65%)',
            'radial-gradient(70% 55% at 50% 22%, hsl(43 80% 55% / 0.20) 0%, transparent 65%)',
            'radial-gradient(60% 50% at 50% 18%, hsl(43 80% 55% / 0.16) 0%, transparent 65%)',
          ],
        }}
        transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* Header — skip button (top-right) */}
      <div className="relative z-10 w-full max-w-md flex items-center justify-end pt-3 pb-1 shrink-0">
        <button
          type="button"
          onClick={handleSkip}
          disabled={purchasing}
          aria-label="Close paywall"
          className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.06] border border-white/10 text-foreground/80 hover:text-foreground transition-colors disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable region — title + benefits. The purchase controls below
          are pinned, so the CTA is always visible regardless of screen size. */}
      <div className="relative z-10 w-full max-w-md flex-1 min-h-0 overflow-y-auto">
        {/* Title block */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-center mb-4"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/40 mb-2 shadow-[0_0_24px_hsl(var(--primary)/0.35)]">
            <Crown className="w-7 h-7 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
          </div>
          <h1 className="text-2xl font-black text-foreground font-display tracking-tight">
            Unlock Dynasty Pro
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Full toolkit. Cancel anytime in Settings → Apple ID → Subscriptions.
          </p>
        </motion.div>

        {/* Feature bullets — two columns so they take half the vertical space. */}
        <ul className="grid grid-cols-2 gap-x-3 gap-y-2 pb-2">
          {PRO_FEATURE_BULLETS.map(({ title, description }) => (
            <li key={title} className="flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-emerald-300" strokeWidth={3} />
              </span>
              <div className="min-w-0 leading-snug">
                <p className="text-[12px] font-semibold text-foreground leading-tight">{title}</p>
                <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Pinned purchase controls — plans + summary + CTA + legal stay on
          screen so the user never has to scroll to act. */}
      <div className="relative z-10 w-full max-w-md shrink-0 pt-3 pb-2 border-t border-white/[0.07]">
        {/* Plan rows */}
        <div className="space-y-2 mb-3">
          {PLAN_ROWS.map(row => {
            const product = PRODUCTS[row.productId];
            const isSelected = selected === row.productId;
            const isAnnualBest = row.badge === 'BEST VALUE';
            // Apple 3.1.2(c) — billed amount must be the most prominent
            // pricing element. We show the full price + cadence in bold,
            // and any per-month framing in a smaller, lighter caption.
            const billedAmount = row.productId === 'com.dynastymanager.pro.lifetime'
              ? priceFor(row.productId)
              : `${priceFor(row.productId)}${product.billingPeriod || ''}`;

            return (
              <button
                key={row.productId}
                type="button"
                onClick={() => { hapticLight(); setSelected(row.productId); }}
                disabled={purchasing}
                aria-pressed={isSelected}
                className={cn(
                  'w-full text-left rounded-2xl border px-4 py-2.5 transition-colors flex items-center gap-3',
                  'bg-card/60 backdrop-blur-xl',
                  isSelected
                    ? 'border-primary/60 bg-primary/[0.06] shadow-[0_0_0_1px_hsl(var(--primary)/0.6)_inset]'
                    : 'border-border/60 hover:border-border',
                  isAnnualBest && !isSelected && 'border-[hsl(var(--gold)/0.35)]',
                  'disabled:opacity-60',
                )}
              >
                {/* Radio indicator */}
                <span
                  aria-hidden
                  className={cn(
                    'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                    isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                  )}
                >
                  {isSelected && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-bold text-foreground truncate">{row.title}</span>
                    {row.badge && (
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-[hsl(var(--gold)/0.18)] text-[hsl(var(--gold))] px-1.5 py-0.5 rounded">
                        {row.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {row.lengthLabel}
                  </p>
                  {row.trialCaption && trialEligible && (
                    <p className="text-[10px] text-muted-foreground/80 leading-snug mt-0.5">
                      {row.trialCaption}
                    </p>
                  )}
                </div>

                {/* Price — billed amount must be the most prominent
                    element per Apple 3.1.2(c). Heavier weight, larger text,
                    and primary colour vs the muted subtitle. */}
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-black text-foreground leading-tight tracking-tight font-display">
                    {billedAmount}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Billing summary — explicit, non-misleading sentence describing what
            the user will be charged. Apple wants the billed amount to be the
            clearest element; this paragraph spells it out in plain text. */}
        <p className="text-[11px] text-foreground/80 text-center leading-relaxed px-2 mb-2.5">
          {billingSummary}
        </p>

        {/* Primary CTA */}
        <motion.button
          type="button"
          whileTap={{ scale: purchasing ? 1 : 0.985 }}
          onClick={handleSubscribe}
          disabled={purchasing || restoring}
          className={cn(
            'relative w-full h-13 py-3.5 rounded-2xl font-bold text-base overflow-hidden',
            'bg-gradient-to-b from-primary/95 to-primary/75 text-primary-foreground',
            'border border-primary/40',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(0,0,0,0.4),0_18px_38px_-10px_hsl(43_96%_46%/0.6)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
            'disabled:opacity-70 disabled:cursor-default',
          )}
        >
          <span className="absolute inset-x-3 top-0.5 h-px rounded-full bg-white/45" aria-hidden />
          {!reduceMotion && !purchasing && (
            <motion.span
              aria-hidden
              className="absolute inset-y-0 w-1/3"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.32) 50%, transparent 100%)',
              }}
              initial={{ x: '-120%' }}
              animate={{ x: '320%' }}
              transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
            />
          )}
          <span className="relative flex items-center justify-center gap-2">
            {purchasing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                {isTrialPlan
                  ? `Try ${FREE_TRIAL_DAYS} Days Free`
                  : `Continue — ${priceFor(selected)}${selectedProduct.billingPeriod || ''}`}
              </>
            )}
          </span>
        </motion.button>

        {/* Trial reassurance — subordinate to the billed amount per 3.1.2(c):
            small, muted, and the price/renewal terms stay in billingSummary. */}
        {isTrialPlan && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Check className="w-3 h-3 text-emerald-400" aria-hidden />
            No payment due now · cancel anytime
          </p>
        )}

        {/* Footer: Restore + Terms + Privacy — required by Apple 3.1.2(c). */}
        <div className="mt-2.5 flex items-center justify-center gap-4 text-[11px] font-semibold">
          <button
            type="button"
            onClick={handleRestore}
            disabled={restoring || purchasing}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3 h-3', restoring && 'animate-spin')} />
            {restoring ? 'Restoring…' : 'Restore Purchases'}
          </button>
          <span aria-hidden className="text-muted-foreground/40">·</span>
          <button
            type="button"
            onClick={openLegal(TERMS_URL)}
            className="text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            Terms of Use
          </button>
          <span aria-hidden className="text-muted-foreground/40">·</span>
          <button
            type="button"
            onClick={openLegal(PRIVACY_URL)}
            className="text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            Privacy Policy
          </button>
        </div>

        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/70 leading-snug px-2">
          Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period.
          Manage or cancel anytime in Settings → Apple ID → Subscriptions.
        </p>
      </div>
    </div>
  );
};

export default SubscribeOnboarding;
