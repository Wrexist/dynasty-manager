import * as Sentry from '@sentry/react';
import { useTranslation } from '@/hooks/useTranslation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import {
  AlertTriangle,
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
  getStoreAvailability,
  checkIntroOfferEligibility,
} from '@/utils/purchases';
import { purchaseAndSync, restoreAndSync } from '@/utils/purchaseSync';
import {
  PRODUCTS,
  SUB_TRIAL_PRODUCT_IDS,
} from '@/config/monetization';
import { Capacitor } from '@capacitor/core';
import { resolvePaywallTrials, preferredPaywallPlan, formatPerPeriodPrice, getFreeTrialDaysRemaining } from '@/utils/monetization';
import { addGameBreadcrumb } from '@/utils/sentry';
import { TERMS_URL, PRIVACY_URL } from '@/config/legal';
import { openExternalUrl } from '@/utils/externalUrl';
import type { ProductId } from '@/types/game';
import { track } from '@/utils/analytics';
import { subscribeSlotContextMissing } from '@/utils/paywallTiming';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { NATIVE_ADS_READY } from '@/utils/ads';

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

// The "Ad-Free Experience" bullet is gated on ads actually existing. With
// `NATIVE_ADS_READY` false, AdMob is fully removed and nobody — free or paying —
// sees an ad, so promising its removal on a paid screen sold a benefit that
// does not exist. Kept in step with `PRO_FEATURES` in config/monetization.ts;
// both come back together when the flag flips.
const PRO_FEATURE_BULLETS: { title: string; description: string }[] = [
  ...(NATIVE_ADS_READY
    ? [{ title: 'Ad-Free Experience', description: 'No banners, no video pre-rolls. Ever.' }]
    : []),
  { title: 'Instant Match Sim', description: 'Long-press to fast-forward a match in under a second.' },
  { title: 'Advanced Analytics', description: 'Possession, conversion, and per-match performance reads.' },
  { title: 'Custom Tactics Creator', description: 'Save up to 5 tactical presets and switch mid-season.' },
  { title: 'Expanded Press Conferences', description: 'More tones, deeper questions, dynamic fan reactions.' },
  { title: 'Historical Record Book', description: 'Every signing, season, and cup run preserved.' },
  { title: 'Pro Manager Badge', description: 'Premium gold ring on your avatar across the app.' },
  // Cosmetic only — `manager_pass_pro` in PRO_FEATURES. Never word this as a
  // gameplay advantage: the Pro row pays titles, celebrations and banners.
  { title: 'Manager Pass Pro Track', description: '30 Pro-only rewards: titles, celebrations and banners.' },
];

interface PlanRow {
  productId: ProductId;
  /** Bold, prominent title shown on the row. */
  title: string;
  /** Length of subscription, shown plainly to satisfy Apple 3.1.2(c). */
  lengthLabel: string;
  /** Optional badge displayed at the right (e.g. "BEST VALUE", "POPULAR"). */
  badge?: string;
}

const PLAN_ROWS: PlanRow[] = [
  {
    productId: 'com.dynastymanager.pro.yearly',
    title: 'Pro Yearly',
    lengthLabel: '12 months · auto-renews yearly',
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
  },
];

const SubscribeOnboarding = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotionPref();
  const monetization = useGameStore(s => s.monetization);
  // Trial framing requires BOTH a clean local record and, where the store can
  // tell us, the store's confirmation.
  //
  // The local check alone is not sufficient: Apple grants the introductory
  // offer once per Apple ID, but `monetization.subscription` is null on every
  // fresh install — so a lapsed subscriber who reinstalls looked eligible and
  // was shown "7 days free" on a purchase the store charges immediately. That
  // is a false claim, a 3.1.2(c) exposure and a refund request.
  //
  // Eligibility and the offer itself are asked per product: the store decides
  // which plan carries a free trial and for how long, and an unknown answer
  // never qualifies on device (see `resolvePaywallTrials`). Off-device the
  // local heuristic drives the mocked flow so web/dev testing still shows it.
  const locallyTrialEligible = monetization.subscription == null;
  const [storeEligibility, setStoreEligibility] = useState<Partial<Record<ProductId, boolean | null>>>({});
  useEffect(() => {
    let cancelled = false;
    checkIntroOfferEligibility(SUB_TRIAL_PRODUCT_IDS)
      .then(v => { if (!cancelled) setStoreEligibility(v); })
      .catch(() => { if (!cancelled) setStoreEligibility({}); });
    return () => { cancelled = true; };
  }, []);

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
  const [selected, setSelected] = useState<ProductId>('com.dynastymanager.pro.yearly');

  // Store availability probe. Presenting a buy button that can only ever fail
  // is exactly what got build 174 rejected under Guideline 2.1.0 (App
  // Completeness) — the reviewer tapped the CTA and got an error banner. We
  // now ask the store what it will actually sell BEFORE offering to sell it,
  // and fall back to a retry state when it can't be reached.
  const [storeStatus, setStoreStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  // Localised store prices. Empty on web/dev — falls back to the USD config price.
  const [storePrices, setStorePrices] = useState<Partial<Record<ProductId, string>>>({});
  // Free intro-offer length per product, read from the store — the trial the
  // paywall advertises is the one App Store Connect actually configured.
  const [storeTrialDays, setStoreTrialDays] = useState<Partial<Record<ProductId, number>>>({});
  // Numeric prices in the storefront's own currency. Every comparative claim
  // on this screen ("SAVE 58%", the per-month line) is computed from these and
  // NOT from `priceUsd` — Apple's price tiers do not preserve the USD ratios,
  // so a percentage derived from config is wrong in most storefronts even
  // before the currency symbol is. Same convention as ShopPage.
  const [storeAmounts, setStoreAmounts] = useState<Partial<Record<ProductId, number>>>({});
  // ISO currency of the storefront those amounts are in, for Intl formatting.
  const [storeCurrency, setStoreCurrency] = useState<string | undefined>(undefined);
  const [availableIds, setAvailableIds] = useState<ProductId[] | null>(null);
  const [probeNonce, setProbeNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStoreStatus('loading');
    getStoreAvailability(PLAN_ROWS.map(r => r.productId))
      .then(({ supported, available, prices, amounts, currencyCode, freeTrialDays }) => {
        if (cancelled) return;
        setStorePrices(prices);
        setStoreTrialDays(freeTrialDays || {});
        setStoreAmounts(amounts || {});
        setStoreCurrency(currencyCode);
        // Off-device (web/dev) purchases are mocked — every plan stays live so
        // the flow remains testable in the browser.
        if (!supported) {
          setAvailableIds(null);
          setStoreStatus('ready');
          return;
        }
        // A plan the store does not return is dropped from the list silently,
        // and the selection falls through to whatever DID come back — so a
        // product that is live in App Store Connect but not attached to the
        // RevenueCat Offering simply never appears, and looks from the outside
        // like nobody chose it. Say so instead: this is the only signal that
        // distinguishes "players prefer monthly" from "yearly was never on the
        // screen", and there is no analytics endpoint configured to answer it.
        const missing = PLAN_ROWS.map(r => r.productId).filter(id => !available.includes(id));
        if (missing.length > 0) {
          if (import.meta.env.DEV) console.warn('[subscribe] store did not return:', missing);
          Sentry.captureMessage('subscribe: store did not return every configured plan', {
            level: 'warning',
            tags: { context: 'subscribe-onboarding.availability' },
            extra: { missing, returned: available },
          });
        }
        setAvailableIds(available);
        setStoreStatus(available.length > 0 ? 'ready' : 'unavailable');
      })
      .catch(() => { if (!cancelled) setStoreStatus('unavailable'); });
    return () => { cancelled = true; };
  }, [probeNonce]);

  // Rows the store confirmed it can sell (all of them off-device).
  const visibleRows = useMemo(
    () => (availableIds === null ? PLAN_ROWS : PLAN_ROWS.filter(r => availableIds.includes(r.productId))),
    [availableIds],
  );

  // Plans that may be sold with a free trial right now, with the store's length.
  const trials = useMemo(() => resolvePaywallTrials({
    planIds: visibleRows.map(r => r.productId),
    native: Capacitor.isNativePlatform(),
    locallyEligible: locallyTrialEligible,
    eligibility: storeEligibility,
    storeTrialDays,
  }), [visibleRows, locallyTrialEligible, storeEligibility, storeTrialDays]);
  const trialEligible = Object.keys(trials).length > 0;

  // Keep the selection on a row that is actually purchasable, and until the
  // player picks one themselves, on the plan that carries the free trial — if
  // Yearly didn't come back from the store or has no trial, fall through
  // rather than leaving a dead CTA or a trial-less plan selected.
  const userPickedRef = useRef(false);
  useEffect(() => {
    if (visibleRows.length === 0) return;
    const ids = visibleRows.map(r => r.productId);
    if (!userPickedRef.current) {
      const preferred = preferredPaywallPlan(ids, trials);
      if (preferred && preferred !== selected) setSelected(preferred);
      return;
    }
    if (!ids.includes(selected)) setSelected(ids[0]);
  }, [visibleRows, selected, trials]);

  // ── Paywall funnel instrumentation ──
  const paywallMountedAtRef = useRef(Date.now());
  const paywallViewedRef = useRef(false);
  // "Viewed" fires when the paywall is actually usable (store probe answered),
  // not on bare mount. Caveat: on device the intro-offer probe may still be in
  // flight, so `trialEligible` can read false at fire time; `trial_started` is
  // the authoritative trial signal, this flag is advisory.
  useEffect(() => {
    if (storeStatus !== 'ready' || paywallViewedRef.current) return;
    paywallViewedRef.current = true;
    track('paywall_viewed', { surface: 'onboarding', trialEligible });
  }, [storeStatus, trialEligible]);

  const priceFor = (productId: ProductId) =>
    storePrices[productId] || `$${PRODUCTS[productId].priceUsd.toFixed(2)}`;

  // ── Comparative claims: storefront-correct, or omitted ──
  //
  // `amountFor` returns the store's real local amount when it gave us one, and
  // falls back to the USD config price ONLY when the store has not answered at
  // all (web/dev/off-device) — where no claim is being made to a real buyer.
  // On device, an unanswered SKU yields null and the claim is dropped rather
  // than guessed.
  const storeAnswered = Object.keys(storeAmounts).length > 0;
  const amountFor = (id: ProductId): number | null =>
    storeAmounts[id] ?? (storeAnswered ? null : PRODUCTS[id].priceUsd);

  const monthlyAmount = amountFor('com.dynastymanager.pro.monthly');
  const annualAmount = amountFor('com.dynastymanager.pro.yearly');
  /** Percent Yearly saves against twelve months of Monthly, or null if either
   *  price is unknown or the saving is not actually positive. */
  const annualSavingsPct = (() => {
    if (monthlyAmount == null || annualAmount == null) return null;
    const full = monthlyAmount * 12;
    if (full <= 0 || annualAmount > full) return null;
    const pct = Math.round((1 - annualAmount / full) * 100);
    return pct > 0 ? pct : null;
  })();

  /** Yearly expressed per month in the storefront's currency, via Intl. Same
   *  fallback rule as `amountFor`: USD only when the store has not answered at
   *  all (web/dev); on device, no currency code means no line. */
  const annualPerMonth = formatPerPeriodPrice(
    annualAmount,
    12,
    storeCurrency ?? (storeAnswered ? undefined : 'USD'),
  );

  const finish = () => {
    // Every exit path funnels through here (skip, purchase success, restore
    // success) — record how long the paywall held the user. Per-surface CVR
    // is completed/viewed; dismissed is the complement detail.
    track('paywall_dismissed', {
      surface: 'onboarding',
      secondsOnScreen: Math.round((Date.now() - paywallMountedAtRef.current) / 1000),
    });
    setFlag(STORAGE_KEYS.SUBSCRIBE_ONBOARDING_SEEN);
    navigate(returnTo, { state: { slot, communityPackEnabled } });
  };

  const handleSubscribe = async () => {
    if (purchasing || storeStatus !== 'ready') return;
    hapticMedium();
    setPurchasing(true);
    track('purchase_initiated', { productId: selected, surface: 'onboarding' });
    addGameBreadcrumb('purchase', 'subscribe initiated', { surface: 'onboarding', productId: selected });
    try {
      // The trial length this row advertised. The store's own record wins
      // wherever it answers; this only seeds the local fallback record when
      // the customer record has not caught up with a completed purchase.
      const trialDays = trials[selected];
      const outcome = await purchaseAndSync(selected, { trialDays });

      if (outcome.status === 'cancelled') {
        // User cancelled the StoreKit dialog — the only outcome that means
        // "no charge". (A completed subscription legitimately grants no
        // entitlement ID; its status lives in subscription.expiresAt.)
        track('purchase_cancelled', { productId: selected, surface: 'onboarding' });
        infoToast('Purchase Cancelled', 'No charge was made.');
        return;
      }

      if (outcome.status === 'pending') {
        // Ask to Buy: not a failure, and nothing is charged yet. Pro arrives
        // through the customer-info listener if it is approved, so let the
        // player carry on into the game instead of parking them here.
        infoToast(t('iap.pendingTitle'), t('iap.pendingBody'));
        finish();
        return;
      }

      if (outcome.status === 'failed') {
        track('purchase_failed', { productId: selected, surface: 'onboarding' });
        addGameBreadcrumb('purchase', 'subscribe unrecovered', { surface: 'onboarding', productId: selected });
        Sentry.captureException(outcome.error, { tags: { context: 'subscribe-onboarding.subscribe' }, extra: { productId: selected } });
        errorToast(
          'Purchase Could Not Complete',
          'If you were charged, tap Restore Purchases below to unlock Pro. Otherwise you can try again from Settings later.',
        );
        // Re-probe: if the store itself is unreachable, the screen switches to
        // its retry state instead of leaving a CTA that keeps failing.
        setProbeNonce(n => n + 1);
        return;
      }

      if (outcome.recovered) {
        // The SDK threw AFTER the charge; the re-sync proved it landed.
        track('purchase_completed', { productId: selected, surface: 'onboarding' });
        successToast('Welcome to Dynasty Pro!', 'Your purchase was confirmed.');
        finish();
        return;
      }

      // `trial_started` is the authoritative trial signal — the
      // `trialEligible` flag on paywall_viewed is advisory only. It follows
      // what the store actually recorded, not what the row advertised.
      const isTrial = outcome.isTrial === true;
      if (isTrial) track('trial_started', { productId: selected, surface: 'onboarding' });
      track('purchase_completed', { productId: selected, surface: 'onboarding' });

      const product = PRODUCTS[selected];
      const shownTrialDays = trialDays ?? getFreeTrialDaysRemaining(useGameStore.getState().monetization);
      successToast(
        isTrial ? t('iap.trialStartedTitle', { days: shownTrialDays }) : 'Welcome to Dynasty Pro!',
        isTrial
          ? t('iap.trialStartedBody', { price: `${priceFor(selected)}${product.billingPeriod || ''}` })
          : `${product.name} is now active.`,
      );
      finish();
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
      // Always syncs, even when nothing non-consumable came back — a
      // subscription-only customer's Pro is recoverable only through the
      // subscription record (see restoreAndSync).
      const { restored, proActive } = await restoreAndSync();
      if (restored.length > 0 || proActive) {
        const detail = restored.length > 0
          ? `${restored.length} product${restored.length > 1 ? 's' : ''} restored.`
          : 'Your Pro subscription is active.';
        successToast('Purchases Restored', detail);
        track('restore_completed', { restoredCount: restored.length });
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
  const selectedTrialDays = trials[selected];
  const isTrialPlan = selectedTrialDays != null;
  const billingSummary = useMemo(() => {
    if (isTrialPlan) {
      const period = selectedProduct.billingPeriod?.replace('/', '') || 'period';
      return `Free for ${selectedTrialDays} days, then ${priceFor(selected)} per ${period}. Auto-renews until cancelled.`;
    }
    if (selectedProduct.type === 'subscription') {
      const period = selectedProduct.billingPeriod?.replace('/', '') || 'period';
      return `${priceFor(selected)} per ${period}. Auto-renews until cancelled.`;
    }
    return `${priceFor(selected)} one-time payment. No subscription, no renewal.`;
    // priceFor is recomputed every render — depending on storePrices captures it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, storePrices, isTrialPlan, selectedTrialDays, selectedProduct]);

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

      {/* Keep the free path explicit before the player has seen the game. */}
      <div className="relative z-10 w-full max-w-md flex items-center justify-end pt-3 pb-1 shrink-0">
        <button
          type="button"
          onClick={handleSkip}
          disabled={purchasing}
          className="min-h-11 px-4 rounded-full flex items-center justify-center gap-2 bg-white/[0.06] border border-white/10 text-sm font-semibold text-foreground/80 hover:text-foreground transition-colors disabled:opacity-40"
        >
          {t('subscribeOnboarding.continueFree')}
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Scrollable region — title + benefits. The purchase controls below
          are pinned, so the CTA is always visible regardless of screen size.
          The inner wrapper is `min-h-full` + centered so tall screens (iPad)
          don't strand the content at the top above a dead gap, while short
          screens still scroll from the top instead of clipping. */}
      <div className="relative z-10 w-full max-w-md flex-1 min-h-0 overflow-y-auto">
        <div className="min-h-full flex flex-col justify-center py-2">
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
      </div>

      {/* Pinned purchase controls — plans + summary + CTA + legal stay on
          screen so the user never has to scroll to act. */}
      <div className="relative z-10 w-full max-w-md shrink-0 pt-3 pb-2 border-t border-white/[0.07]">
        {storeStatus === 'unavailable' ? (
          /* The store returned nothing purchasable (no connection, sandbox
             hiccup, products still propagating). Offering a buy button here
             would guarantee an error — show an honest retry instead. Restore,
             Terms and Privacy below stay available either way. */
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl px-4 py-4 mb-3 text-center">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-amber-500/15 border border-amber-400/30 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-300" />
            </div>
            <p className="text-sm font-bold text-foreground">Store Temporarily Unavailable</p>
            <p className="text-[11px] text-muted-foreground leading-snug mt-1">
              We couldn't reach the App Store to load Dynasty Pro pricing. Check your
              connection and try again — you can keep playing for free in the meantime.
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => { hapticLight(); setProbeNonce(n => n + 1); }}
                className="px-4 py-2 rounded-xl text-[12px] font-bold bg-primary/90 text-primary-foreground border border-primary/40"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-muted-foreground border border-border/60"
              >
                {t('subscribeOnboarding.continueFree')}
              </button>
            </div>
          </div>
        ) : (
          <>
        {/* Plan rows */}
        <div className="space-y-2 mb-3">
          {visibleRows.map(row => {
            const product = PRODUCTS[row.productId];
            const isSelected = selected === row.productId;
            const isAnnualBest = row.badge === 'BEST VALUE';
            // A measured saving outsells a generic superlative — but only when
            // it is a real number from this storefront. Falls back to the
            // static badge whenever the store has not priced both plans.
            const badgeText = isAnnualBest && annualSavingsPct != null
              ? `SAVE ${annualSavingsPct}%`
              : row.badge;
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
                onClick={() => { hapticLight(); userPickedRef.current = true; setSelected(row.productId); }}
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
                    {badgeText && (
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-[hsl(var(--gold)/0.18)] text-[hsl(var(--gold))] px-1.5 py-0.5 rounded">
                        {badgeText}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {row.lengthLabel}
                  </p>
                  {/* Per-month framing of the yearly price. Deliberately
                      smaller and lighter than the billed amount on the right —
                      Apple 3.1.2(c) requires the actual charge to be the most
                      prominent pricing element, and the cadence is spelled out
                      in full by `lengthLabel` directly above. */}
                  {isAnnualBest && annualPerMonth && (
                    <p className="text-[10px] text-muted-foreground/70 leading-snug mt-0.5">
                      Works out at {annualPerMonth}/month
                    </p>
                  )}
                  {trials[row.productId] != null && (
                    <p className="text-[10px] text-muted-foreground/80 leading-snug mt-0.5">
                      {trials[row.productId]}-day free trial included
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
          disabled={purchasing || restoring || storeStatus !== 'ready'}
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
            {purchasing || storeStatus === 'loading' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {purchasing ? 'Processing…' : 'Contacting App Store…'}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                {isTrialPlan
                  ? `Try ${selectedTrialDays} Days Free`
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
          </>
        )}

        {/* Footer: Restore + Terms + Privacy — required by Apple 3.1.2(c).
            Each link is a full 44px-tall target (they measured 17px) while the
            type stays small and muted: the height is padding, not visual
            weight, so the links do not compete with the purchase button. */}
        <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={handleRestore}
            disabled={restoring || purchasing}
            className="min-h-11 px-1 flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3 h-3', restoring && 'animate-spin')} />
            {restoring ? 'Restoring…' : 'Restore Purchases'}
          </button>
          <span aria-hidden className="text-muted-foreground/40">·</span>
          <button
            type="button"
            onClick={openLegal(TERMS_URL)}
            className="min-h-11 px-1 text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            Terms of Use
          </button>
          <span aria-hidden className="text-muted-foreground/40">·</span>
          <button
            type="button"
            onClick={openLegal(PRIVACY_URL)}
            className="min-h-11 px-1 text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            Privacy Policy
          </button>
        </div>

        <p className="mt-0.5 text-center text-[10px] text-muted-foreground/70 leading-snug px-2">
          Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period.
          Manage or cancel anytime in Settings → Apple ID → Subscriptions.
        </p>
      </div>
    </div>
  );
};

export default SubscribeOnboarding;
