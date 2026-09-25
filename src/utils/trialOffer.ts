import { Capacitor } from '@capacitor/core';
import { SUB_TRIAL_PRODUCT_IDS } from '@/config/monetization';
import { getStoreAvailability, checkIntroOfferEligibility } from '@/utils/purchases';
import { resolvePaywallTrials, preferredPaywallPlan } from '@/utils/monetization';

/** How long one store answer is reused before the next surface asks again. */
const TRIAL_PROBE_TTL_MS = 10 * 60 * 1000;

let probe: { at: number; days: Promise<number | null> } | null = null;

/**
 * Length in days of the free trial the paywall would offer this Apple ID, or
 * null when it would offer none (no free intro offer on a plan the store can
 * sell, eligibility refused or unknown, store unreachable).
 *
 * Same rule as the paywall (`resolvePaywallTrials` + `preferredPaywallPlan`),
 * so an in-game surface never advertises a trial the paywall it opens then
 * withholds. Local eligibility (no subscription record on this install) is the
 * caller's check. Shared and time-boxed so the five Pro upsells do not each
 * hit the store on every mount.
 */
export function probeTrialOfferDays(now: number = Date.now()): Promise<number | null> {
  if (probe && now - probe.at < TRIAL_PROBE_TTL_MS) return probe.days;
  const days = Promise.all([
    getStoreAvailability(SUB_TRIAL_PRODUCT_IDS),
    checkIntroOfferEligibility(SUB_TRIAL_PRODUCT_IDS),
  ])
    .then(([store, eligibility]) => {
      const planIds = store.supported ? store.available : SUB_TRIAL_PRODUCT_IDS;
      const trials = resolvePaywallTrials({
        planIds,
        native: Capacitor.isNativePlatform(),
        locallyEligible: true,
        eligibility,
        storeTrialDays: store.freeTrialDays || {},
      });
      const plan = preferredPaywallPlan(planIds, trials);
      return (plan && trials[plan]) ?? null;
    })
    .catch(() => null);
  probe = { at: now, days };
  return days;
}

/** Forget the cached answer (tests; after a purchase changes eligibility). */
export function resetTrialOfferProbe(): void {
  probe = null;
}
