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
  Calendar,
  ShieldCheck,
  Bell,
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
  TRIAL_TARGET_PRODUCT_ID,
} from '@/config/monetization';
import { TERMS_URL, PRIVACY_URL } from '@/config/legal';
import { openExternalUrl } from '@/utils/externalUrl';
import type { ProductId } from '@/types/game';
import { track } from '@/utils/analytics';

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

/** Date the user's first charge would land on if they start the trial right
 *  now. Trial = FREE_TRIAL_DAYS calendar days; we add one day to land on the
 *  charge date itself (Apple bills on day N+1, not day N). Locale-aware so a
 *  user in Tokyo sees a date in their format, not a US default. */
function formatFirstChargeDate(): string {
  const d = new Date(Date.now() + (FREE_TRIAL_DAYS + 1) * 24 * 60 * 60 * 1000);
  try {
    return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  } catch {
    // Fallback for engines that don't support `undefined` locale.
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
}

/** Tolerant numeric parse for localised store prices. Handles every
 *  format App Store / Play Store hands back: "$1.99", "€14,99", "¥1,500",
 *  "US$120.00", "€1.200,00", etc. Returns null when no usable number can
 *  be extracted — callers MUST treat the supportive captions as optional
 *  so we never render "NaN/mo". */
function parsePriceAmount(display: string): number | null {
  const cleaned = display.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  let normalised = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Both separators present — the LAST one is the decimal.
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    normalised = lastComma > lastDot ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  } else if (cleaned.includes(',') && /,\d{1,2}$/.test(cleaned)) {
    // Single separator, comma with 1-2 trailing digits → comma is decimal.
    normalised = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Treat any remaining commas as thousands separators.
    normalised = cleaned.replace(/,/g, '');
  }
  const n = parseFloat(normalised);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "$14.99" → "$1.25" (per-month equivalent of the yearly plan).
 *  Returns null when the input can't be parsed. */
function perMonthFromYearly(yearlyDisplay: string): string | null {
  const yearly = parsePriceAmount(yearlyDisplay);
  if (yearly === null) return null;
  const monthly = yearly / 12;
  // Preserve the currency symbol from the yearly display so we don't have to
  // hardcode `$`. Grab everything that isn't a digit / dot / comma.
  const currencyPrefix = yearlyDisplay.match(/^[^\d.,\s-]+/)?.[0] || '$';
  return `${currencyPrefix}${monthly.toFixed(2)}`;
}

/** Yearly vs. monthly savings as a rounded percent ("37%"). Returns null
 *  when either price can't be parsed. */
function yearlyDiscountPercent(yearlyDisplay: string, monthlyDisplay: string): number | null {
  const yearly = parsePriceAmount(yearlyDisplay);
  const monthly = parsePriceAmount(monthlyDisplay);
  if (yearly === null || monthly === null) return null;
  const yearlyPerMonth = yearly / 12;
  const saving = Math.round((1 - yearlyPerMonth / monthly) * 100);
  return saving > 0 ? saving : null;
}

const PLAN_ROWS: PlanRow[] = [
  {
    productId: 'com.dynastymanager.pro.annual',
    title: 'Dynasty Pro — Yearly',
    lengthLabel: '12 months · auto-renews yearly',
    badge: 'BEST VALUE',
  },
  {
    productId: 'com.dynastymanager.pro.lifetime',
    title: 'Dynasty Pro — Lifetime',
    lengthLabel: 'One-time purchase · no renewal',
  },
  {
    productId: 'com.dynastymanager.pro.monthly',
    title: 'Dynasty Pro — Monthly',
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

  const navState = (location.state as { slot?: number; communityPackEnabled?: boolean; returnTo?: string }) || {};
  const slot = navState.slot ?? 1;
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
    if (info) updateSubscription(extractSubscriptionInfo(info));
  };

  const handleSubscribe = async () => {
    hapticMedium();
    setPurchasing(true);
    track('purchase_initiated', { productId: selected });
    try {
      const granted = await purchaseProduct(selected);
      if (granted.length === 0) {
        // User cancelled the StoreKit dialog.
        track('purchase_cancelled', { productId: selected });
        infoToast('Purchase Cancelled', 'No charge was made.');
        return;
      }

      granted.forEach(id => grantEntitlement(id));

      // If the user picked the monthly plan, the App Store Connect
      // introductory offer grants the free trial automatically — mirror it
      // locally so gated features unlock immediately.
      if (selected === TRIAL_TARGET_PRODUCT_ID) startFreeTrial();

      await syncAfterPurchase();
      track('purchase_completed', { productId: selected });

      const product = PRODUCTS[selected];
      const isTrial = selected === TRIAL_TARGET_PRODUCT_ID;
      successToast(
        isTrial ? `${FREE_TRIAL_DAYS}-Day Trial Started!` : 'Welcome to Dynasty Pro!',
        isTrial
          ? `Pro is unlocked. You'll be charged ${priceFor(selected)}/month after the trial unless you cancel.`
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
  const isTrialPlan = selected === TRIAL_TARGET_PRODUCT_ID;
  const billingSummary = useMemo(() => {
    if (isTrialPlan) {
      return `Free for ${FREE_TRIAL_DAYS} days, then ${priceFor(selected)} per month. Auto-renews until cancelled.`;
    }
    if (selectedProduct.type === 'subscription') {
      const period = selectedProduct.billingPeriod?.replace('/', '') || 'period';
      return `${priceFor(selected)} per ${period}. Auto-renews until cancelled.`;
    }
    return `${priceFor(selected)} one-time payment. No subscription, no renewal.`;
    // priceFor is recomputed every render — depending on storePrices captures it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, storePrices, isTrialPlan, selectedProduct]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 sm:px-5 pt-6 pb-6 relative overflow-hidden safe-area-top safe-area-bottom">
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
      <div className="relative z-10 w-full max-w-md flex items-center justify-end mb-2">
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

      {/* Title block */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 text-center mb-4 w-full max-w-md"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/40 mb-3 shadow-[0_0_24px_hsl(var(--primary)/0.35)]">
          <Crown className="w-8 h-8 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
        </div>
        <h1 className="text-2xl font-black text-foreground font-display tracking-tight">
          Unlock Dynasty Pro
        </h1>
        <p className="text-xs text-muted-foreground mt-1.5">
          Full toolkit. Cancel anytime in Settings → Apple ID → Subscriptions.
        </p>
      </motion.div>

      {/* Feature bullets */}
      <div className="relative z-10 w-full max-w-md mb-5">
        <ul className="space-y-1.5">
          {PRO_FEATURE_BULLETS.map(({ title, description }) => (
            <li key={title} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-emerald-300" strokeWidth={3} />
              </span>
              <div className="leading-snug">
                <span className="text-[13px] font-semibold text-foreground">{title}</span>
                <span className="text-[11px] text-muted-foreground"> — {description}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Plan rows */}
      <div className="relative z-10 w-full max-w-md space-y-2 mb-4">
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
          // Yearly plan: surface the per-month equivalent as a SUBORDINATE
          // caption (smaller, lighter) so it never out-competes the billed
          // amount above it — Apple 3.1.2(c) is unforgiving on this.
          // Conversion research (RevenueCat, Apple ASA) consistently shows
          // per-month framing on yearly plans lifts conversion 15-30%
          // because users mentally compare it to the monthly row.
          const annualPerMonth = row.productId === 'com.dynastymanager.pro.annual'
            ? perMonthFromYearly(priceFor(row.productId))
            : null;
          const monthlyDiscount = row.productId === 'com.dynastymanager.pro.annual'
            ? yearlyDiscountPercent(priceFor(row.productId), priceFor('com.dynastymanager.pro.monthly'))
            : null;

          return (
            <button
              key={row.productId}
              type="button"
              onClick={() => { hapticLight(); setSelected(row.productId); }}
              disabled={purchasing}
              aria-pressed={isSelected}
              className={cn(
                'w-full text-left rounded-2xl border px-4 py-3 transition-colors flex items-center gap-3',
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
                {annualPerMonth && (
                  <p className="text-[10px] text-emerald-300/90 leading-snug mt-0.5 font-semibold">
                    Just {annualPerMonth}/mo
                    {monthlyDiscount != null && (
                      <span className="text-emerald-300/70 font-medium"> · Save {monthlyDiscount}% vs monthly</span>
                    )}
                  </p>
                )}
                {row.trialCaption && (
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

      {/* Trial-anxiety reducer — only when the Monthly trial plan is selected.
          Three things converge to push hesitating users over the line:
            1. A loud "Pay $0 Today" headline (the literal worry).
            2. The exact first-charge date in plain language (no math required).
            3. A reminder that Apple sends a heads-up before billing.
          Apple compliance: the BILLED AMOUNT ($X/month) still wins prominence
          because the plan row above shows it in `text-lg font-black`, while
          this callout uses smaller weights and a supporting tone. The "Free"
          framing is paired with the explicit charge date — not a misleading
          standalone "Free!" claim. */}
      {isTrialPlan && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="relative z-10 w-full max-w-md mb-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.08] px-4 py-3"
        >
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[13px] font-bold text-emerald-300 uppercase tracking-wider">
              Pay $0 Today
            </span>
            <span className="text-[10px] text-emerald-200/70 font-medium">
              No payment required now
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] text-foreground/85">
              <Calendar className="w-3 h-3 text-emerald-300 flex-shrink-0" />
              <span>
                First charge on <strong className="text-foreground">{formatFirstChargeDate()}</strong> — {priceFor(selected)}/month
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-foreground/85">
              <Bell className="w-3 h-3 text-emerald-300 flex-shrink-0" />
              <span>Apple emails you a reminder before billing starts</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-foreground/85">
              <ShieldCheck className="w-3 h-3 text-emerald-300 flex-shrink-0" />
              <span>Cancel anytime during the trial — pay nothing</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Billing summary — explicit, non-misleading sentence describing what
          the user will be charged. Apple wants the billed amount to be the
          clearest element; this paragraph spells it out in plain text. */}
      <div className="relative z-10 w-full max-w-md mb-3">
        <p className="text-[11px] text-foreground/80 text-center leading-relaxed px-2">
          {billingSummary}
        </p>
      </div>

      {/* Primary CTA */}
      <div className="relative z-10 w-full max-w-md">
        <motion.button
          type="button"
          whileTap={{ scale: purchasing ? 1 : 0.985 }}
          onClick={handleSubscribe}
          disabled={purchasing || restoring}
          className={cn(
            'relative w-full min-h-[52px] py-3.5 rounded-2xl font-bold text-base overflow-hidden',
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
            ) : isTrialPlan ? (
              <span className="relative flex flex-col items-center justify-center leading-none">
                <span className="flex items-center gap-2 text-base font-bold">
                  <Sparkles className="w-5 h-5" />
                  Try Pro Free for {FREE_TRIAL_DAYS} Days
                </span>
                <span className="text-[10px] font-medium text-primary-foreground/80 mt-1">
                  $0 today · cancel anytime
                </span>
              </span>
            ) : selected === 'com.dynastymanager.pro.lifetime' ? (
              <>
                <Sparkles className="w-5 h-5" />
                Unlock Pro Forever — {priceFor(selected)}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Unlock Pro — {priceFor(selected)}{selectedProduct.billingPeriod || ''}
              </>
            )}
          </span>
        </motion.button>
      </div>

      {/* Footer: Restore + Terms + Privacy — required by Apple 3.1.2(c).
          Equal-weight links sit directly under the CTA so they are visible
          inside the same purchase flow without scrolling. */}
      <div className="relative z-10 w-full max-w-md mt-3 flex items-center justify-center gap-4 text-[11px] font-semibold">
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

      <p className="relative z-10 w-full max-w-md mt-2 text-center text-[10px] text-muted-foreground/70 leading-snug px-2">
        Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period.
        Manage or cancel anytime in Settings → Apple ID → Subscriptions.
      </p>
    </div>
  );
};

export default SubscribeOnboarding;
