import * as Sentry from '@sentry/react';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import {
  Crown,
  Zap,
  LineChart,
  Mic2,
  ScrollText,
  Layers,
  Shield,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Gift,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { successToast, errorToast } from '@/utils/gameToast';
import { setFlag, STORAGE_KEYS } from '@/store/helpers/persistence';
import { purchaseProduct } from '@/utils/purchases';
import {
  FREE_TRIAL_DAYS,
  PRODUCTS,
  TRIAL_TARGET_PRODUCT_ID,
} from '@/config/monetization';

interface FeatureCard {
  id: string;
  icon: typeof Crown;
  title: string;
  tagline: string;
  description: string;
  /** HSL hue for the accent ring/glow on this card */
  hue: number;
}

const FEATURES: FeatureCard[] = [
  {
    id: 'ad_free',
    icon: Shield,
    title: 'Ad-Free Forever',
    tagline: 'Pure focus on the football',
    description:
      'Manage matches, transfers, and seasons without a single interruption. No banners. No video pre-rolls. Ever.',
    hue: 215,
  },
  {
    id: 'instant_sim',
    icon: Zap,
    title: 'Instant Match Sim',
    tagline: 'Skip to the result',
    description:
      'Long-press to fast-forward an entire match in under a second. Perfect for grinding late-season fixtures.',
    hue: 43,
  },
  {
    id: 'analytics',
    icon: LineChart,
    title: 'Match Insights',
    tagline: 'Tactical reads after every match',
    description:
      'Possession reads, conversion analysis, and a per-match performance summary — the patterns the box-score hides.',
    hue: 280,
  },
  {
    id: 'tactics',
    icon: Layers,
    title: 'Custom Tactics Creator',
    tagline: 'Save up to 5 tactical presets',
    description:
      'Design your gegenpress, your park-the-bus, and your big-game pragmatic — switch between them mid-season.',
    hue: 165,
  },
  {
    id: 'press',
    icon: Mic2,
    title: 'Expanded Press Conferences',
    tagline: 'More voice, more drama',
    description:
      'Unlock extra response tones, deeper journalist questions, and dynamic fanbase reactions to every word.',
    hue: 25,
  },
  {
    id: 'records',
    icon: ScrollText,
    title: 'Historical Record Book',
    tagline: 'Your dynasty, immortalised',
    description:
      'Track every signing, every season, every cup run across the entire history of your save.',
    hue: 320,
  },
  {
    id: 'optimize',
    icon: Sparkles,
    title: 'Optimize Lineup',
    tagline: 'Tap once. Best XI.',
    description:
      'Let the assistant pick your sharpest, fittest, in-form starting eleven for any fixture in one tap.',
    hue: 200,
  },
  {
    id: 'badge',
    icon: Crown,
    title: 'Pro Manager Badge',
    tagline: 'Wear it on every menu',
    description:
      'A premium gold ring around your manager avatar — visible in every press shot, lineup, and Hall of Managers entry.',
    hue: 43,
  },
];

const SubscribeOnboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const grantEntitlement = useGameStore(s => s.grantEntitlement);
  const startFreeTrial = useGameStore(s => s.startFreeTrial);

  const navState = (location.state as { slot?: number; communityPackEnabled?: boolean; returnTo?: string }) || {};
  const slot = navState.slot ?? 1;
  const communityPackEnabled = navState.communityPackEnabled === true;
  const returnTo = navState.returnTo || '/mode-select';

  const [step, setStep] = useState(0);
  const [purchasing, setPurchasing] = useState(false);

  const monthlyProduct = PRODUCTS[TRIAL_TARGET_PRODUCT_ID];
  const monthlyPrice = `$${monthlyProduct.priceUsd.toFixed(2)}`;

  // Auto-advance through feature cards every 3.2s. Pauses while purchasing,
  // and the user can step manually with the chevrons / dots — manual
  // interaction resets the timer.
  const [autoAdvanceKey, setAutoAdvanceKey] = useState(0);
  useEffect(() => {
    if (reduceMotion || purchasing) return;
    const id = setTimeout(() => {
      setStep(s => (s + 1) % FEATURES.length);
    }, 3200);
    return () => clearTimeout(id);
  }, [step, autoAdvanceKey, reduceMotion, purchasing]);

  const goNextStep = () => {
    hapticLight();
    setStep(s => (s + 1) % FEATURES.length);
    setAutoAdvanceKey(k => k + 1);
  };

  const goPrevStep = () => {
    hapticLight();
    setStep(s => (s - 1 + FEATURES.length) % FEATURES.length);
    setAutoAdvanceKey(k => k + 1);
  };

  const finish = () => {
    setFlag(STORAGE_KEYS.SUBSCRIBE_ONBOARDING_SEEN);
    navigate(returnTo, { state: { slot, communityPackEnabled } });
  };

  const handleStartTrial = async () => {
    hapticMedium();
    setPurchasing(true);
    try {
      // Trigger the native paywall flow. On iOS / Android, the App Store /
      // Play Store handles the introductory free-trial pricing automatically
      // for the monthly product (configure the introductory offer in App
      // Store Connect / Google Play Console for full free trial).
      const granted = await purchaseProduct(TRIAL_TARGET_PRODUCT_ID);

      // Mark the user as Pro-via-trial locally so all gated features unlock
      // immediately. On native, the entitlement listener will pick up the
      // real subscription info shortly after; until then this is the source
      // of truth used by `isPro()`.
      startFreeTrial();
      if (granted.length > 0) {
        granted.forEach(id => grantEntitlement(id));
      }

      successToast(
        `${FREE_TRIAL_DAYS}-Day Trial Started!`,
        `Pro is unlocked. You'll be charged ${monthlyPrice}/month after the trial unless you cancel.`,
      );
      finish();
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'subscribe-onboarding.startTrial' } });
      errorToast(
        'Trial Could Not Start',
        'Something went wrong with the App Store. You can try again from Settings later.',
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleSkip = () => {
    hapticLight();
    setFlag(STORAGE_KEYS.SUBSCRIBE_ONBOARDING_SEEN);
    finish();
  };

  // Pre-compute a soft tinted radial halo for the current feature, used
  // both behind the icon and as the page-level ambient glow.
  const accentHue = FEATURES[step].hue;
  const accentColor = useMemo(() => `hsl(${accentHue} 80% 60%)`, [accentHue]);
  const accentColorAlpha = useMemo(
    () => (alpha: number) => `hsl(${accentHue} 80% 60% / ${alpha})`,
    [accentHue],
  );

  const ActiveIcon = FEATURES[step].icon;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-5 pt-8 pb-6 relative overflow-hidden safe-area-top safe-area-bottom">
      {/* Ambient halo — pulses subtly with the current feature accent. */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: [
            `radial-gradient(60% 50% at 50% 18%, hsl(${accentHue} 80% 55% / 0.18) 0%, transparent 65%)`,
            `radial-gradient(70% 55% at 50% 22%, hsl(${accentHue} 80% 55% / 0.22) 0%, transparent 65%)`,
            `radial-gradient(60% 50% at 50% 18%, hsl(${accentHue} 80% 55% / 0.18) 0%, transparent 65%)`,
          ],
        }}
        transition={{ duration: 5, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* Floating background orbs — pure CSS drift, GPU-friendly. */}
      <div
        aria-hidden
        className="title-float-circle absolute rounded-full blur-3xl pointer-events-none"
        style={{
          width: 320,
          height: 320,
          left: '10%',
          top: '8%',
          backgroundColor: `hsl(${accentHue} 90% 55%)`,
          opacity: 0.08,
          animation: 'float-drift 24s ease-in-out infinite',
          ['--drift-x' as string]: '70px',
          ['--drift-y' as string]: '50px',
        } as React.CSSProperties}
      />
      <div
        aria-hidden
        className="title-float-circle absolute rounded-full blur-3xl pointer-events-none"
        style={{
          width: 240,
          height: 240,
          right: '6%',
          bottom: '12%',
          backgroundColor: `hsl(${(accentHue + 60) % 360} 90% 55%)`,
          opacity: 0.06,
          animation: 'float-drift 28s ease-in-out infinite',
          ['--drift-x' as string]: '-50px',
          ['--drift-y' as string]: '-40px',
        } as React.CSSProperties}
      />

      {/* Header — Skip pill (top-right). */}
      <div className="relative z-10 w-full max-w-md flex items-center justify-between mb-3">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full bg-amber-400/[0.08] border border-amber-300/30 backdrop-blur-md text-[11px] font-semibold text-amber-200 tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
        >
          <Gift className="w-3.5 h-3.5" />
          <span>{FREE_TRIAL_DAYS}-Day Free Trial</span>
        </motion.div>

        <motion.button
          type="button"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          whileTap={{ scale: 0.94 }}
          onClick={handleSkip}
          disabled={purchasing}
          className="text-[11px] font-semibold text-muted-foreground/80 hover:text-foreground transition-colors px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md disabled:opacity-40"
        >
          Maybe later
        </motion.button>
      </div>

      {/* Title block — Dynasty Pro */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 text-center mb-5"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Crown className="w-5 h-5 text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.55)]" />
          <p className="text-[10px] uppercase tracking-[0.42em] text-primary/90 font-semibold font-display">
            Dynasty Pro
          </p>
          <Crown className="w-5 h-5 text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.55)]" />
        </div>
        <h1 className="text-[2rem] leading-[1.05] font-black text-foreground tracking-tight font-display">
          Manage like a legend.
        </h1>
        <p className="text-sm text-muted-foreground mt-2 px-2">
          Unlock the full toolkit. Try it free for {FREE_TRIAL_DAYS} days.
        </p>
      </motion.div>

      {/* Feature carousel — interactive Liquid Glass card */}
      <div className="relative z-10 w-full max-w-md flex-1 flex flex-col">
        <div className="relative">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={FEATURES[step].id}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeOut' }}
              className={cn(
                'relative overflow-hidden rounded-3xl px-5 py-7 transform-gpu',
                'bg-gradient-to-br from-[hsl(222_35%_14%/0.78)] via-[hsl(222_30%_9%/0.82)] to-[hsl(222_40%_7%/0.88)]',
                'backdrop-blur-2xl backdrop-saturate-150',
                'shadow-[0_0_0_0.5px_rgba(255,255,255,0.18)_inset,inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.45),0_30px_70px_-20px_rgba(0,0,0,0.7)]',
              )}
            >
              {/* Specular crescent — bright sky reflected on polished glass */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                style={{
                  background:
                    'radial-gradient(120% 90% at 50% -20%, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0) 62%)',
                  mixBlendMode: 'screen',
                }}
              />
              {/* Edge refraction streaks at the rim */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-3xl"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 6%, rgba(255,255,255,0) 94%, rgba(255,255,255,0.12) 100%)',
                }}
              />
              {/* Slow shimmer sweep across the card */}
              {!reduceMotion && (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.07) 50%, transparent 60%)',
                  }}
                  initial={{ x: '-100%' }}
                  animate={{ x: '120%' }}
                  transition={{ duration: 4, repeat: Infinity, repeatDelay: 3.5, ease: 'easeInOut' }}
                />
              )}
              {/* Tinted halo behind the icon */}
              <div
                aria-hidden
                className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl"
                style={{
                  background: `radial-gradient(closest-side, ${accentColorAlpha(0.35)}, transparent 70%)`,
                  opacity: 0.55,
                }}
              />

              <div className="relative flex flex-col items-center text-center">
                {/* Icon plate */}
                <motion.div
                  initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ duration: 0.45, ease: 'backOut' }}
                  className={cn(
                    'relative w-20 h-20 rounded-2xl flex items-center justify-center mb-5',
                    'border backdrop-blur-xl',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.4),0_18px_42px_-12px_rgba(0,0,0,0.55)]',
                  )}
                  style={{
                    background: `linear-gradient(160deg, ${accentColor} 0%, hsl(${accentHue} 50% 28%) 100%)`,
                    borderColor: `hsl(${accentHue} 80% 70% / 0.45)`,
                  }}
                >
                  <ActiveIcon className="w-10 h-10 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]" />
                  {/* Inner specular highlight on the icon plate */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-2xl"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 50%)',
                      mixBlendMode: 'screen',
                    }}
                  />
                </motion.div>

                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.32em] mb-1.5"
                  style={{ color: `hsl(${accentHue} 85% 75%)` }}
                >
                  {FEATURES[step].tagline}
                </p>
                <h2 className="text-2xl font-black text-foreground font-display tracking-tight mb-2.5">
                  {FEATURES[step].title}
                </h2>
                <p className="text-sm text-foreground/80 leading-relaxed max-w-[28ch]">
                  {FEATURES[step].description}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Step chevrons — appear on the card edges so they read as part of the carousel */}
          <button
            type="button"
            onClick={goPrevStep}
            disabled={purchasing}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-9 h-9 rounded-full flex items-center justify-center text-foreground/70 hover:text-foreground bg-black/30 backdrop-blur-md border border-white/10 transition-colors disabled:opacity-30"
            aria-label="Previous feature"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goNextStep}
            disabled={purchasing}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-9 h-9 rounded-full flex items-center justify-center text-foreground/70 hover:text-foreground bg-black/30 backdrop-blur-md border border-white/10 transition-colors disabled:opacity-30"
            aria-label="Next feature"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {FEATURES.map((f, i) => {
            const active = i === step;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => { hapticLight(); setStep(i); setAutoAdvanceKey(k => k + 1); }}
                aria-label={`Show feature: ${f.title}`}
                className={cn(
                  'rounded-full transition-all duration-300',
                  active ? 'w-6 h-1.5 bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.55)]' : 'w-1.5 h-1.5 bg-white/25 hover:bg-white/40',
                )}
              />
            );
          })}
        </div>

        {/* Trust row */}
        <div className="mt-5 flex items-center justify-center gap-4 text-[10px] text-muted-foreground/80 font-medium">
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-400" /> Cancel anytime
          </span>
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-400" /> No charge for {FREE_TRIAL_DAYS} days
          </span>
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-400" /> {monthlyPrice}/mo after
          </span>
        </div>
      </div>

      {/* Sticky CTA — primary trial button + secondary skip */}
      <div className="relative z-10 w-full max-w-md mt-5 flex flex-col gap-2.5">
        <motion.button
          type="button"
          whileTap={{ scale: purchasing ? 1 : 0.985 }}
          onClick={handleStartTrial}
          disabled={purchasing}
          className={cn(
            'relative w-full h-14 rounded-2xl font-bold text-base overflow-hidden',
            'bg-gradient-to-b from-primary/95 to-primary/75 text-primary-foreground',
            'border border-primary/40',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(0,0,0,0.4),0_18px_38px_-10px_hsl(43_96%_46%/0.6)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
            'disabled:opacity-70 disabled:cursor-default',
          )}
        >
          {/* Inner top highlight stripe */}
          <span
            aria-hidden
            className="absolute inset-x-3 top-0.5 h-px rounded-full bg-white/45"
          />
          {/* Shimmer sweep across CTA — disabled while purchasing */}
          {!reduceMotion && !purchasing && (
            <motion.span
              aria-hidden
              className="absolute inset-y-0 w-1/3"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
              }}
              initial={{ x: '-120%' }}
              animate={{ x: '320%' }}
              transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
            />
          )}
          <span className="relative flex items-center justify-center gap-2.5">
            {purchasing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Starting Trial…
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Start {FREE_TRIAL_DAYS}-Day Free Trial
              </>
            )}
          </span>
        </motion.button>

        <p className="text-center text-[10px] text-muted-foreground/70 leading-snug">
          Free for {FREE_TRIAL_DAYS} days, then {monthlyPrice}/month. Auto-renews until cancelled in your{' '}
          App Store account settings. Manage anytime from Settings → Purchases.
        </p>
      </div>
    </div>
  );
};

export default SubscribeOnboarding;
