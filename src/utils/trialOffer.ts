import { Capacitor } from '@capacitor/core';
import { SUB_TRIAL_PRODUCT_IDS } from '@/config/monetization';
import { getStoreAvailability, checkIntroOfferEligibility } from '@/utils/purchases';
import { resolvePaywallTrials, preferredPaywallPlan } from '@/utils/monetization';
import type { ProductId } from '@/types/game';

/** How long one store answer is reused before the next surface asks again. */
const TRIAL_PROBE_TTL_MS = 10 * 60 * 1000;

let probe: { at: number; trials: Promise<Partial<Record<ProductId, number>>> } | null = null;

/**
 * The free trial, in days, each subscription plan would carry for this Apple
 * ID right now — keyed by product, absent where there is none (no free intro
 * offer on that plan, eligibility refused or unknown, plan not on sale, store
 * unreachable).
 *
 * The paywall's own rule (`resolvePaywallTrials`) evaluated per plan, so a
 * surface that lists plans side by side (the Shop) names the trial on exactly
 * the plans the store confirms — both, one or none — and never on another.
 * Local eligibility (no subscription record on this install) is the caller's
 * check. Shared and time-boxed so the in-game upsells and the Shop do not each
 * hit the store on every mount.
 */
export function probePaywallTrials(now: number = Date.now()): Promise<Partial<Record<ProductId, number>>> {
  if (probe && now - probe.at < TRIAL_PROBE_TTL_MS) return probe.trials;
  const trials = Promise.all([
    getStoreAvailability(SUB_TRIAL_PRODUCT_IDS),
    checkIntroOfferEligibility(SUB_TRIAL_PRODUCT_IDS),
  ])
    .then(([store, eligibility]) => resolvePaywallTrials({
      planIds: store.supported ? store.available : SUB_TRIAL_PRODUCT_IDS,
      native: Capacitor.isNativePlatform(),
      locallyEligible: true,
      eligibility,
      storeTrialDays: store.freeTrialDays || {},
    }))
    .catch((): Partial<Record<ProductId, number>> => ({}));
  probe = { at: now, trials };
  return trials;
}

/**
 * Length in days of the free trial the paywall would lead with for this Apple
 * ID, or null when it would offer none.
 *
 * Same rule as the paywall (`resolvePaywallTrials` + `preferredPaywallPlan`),
 * so an in-game surface never advertises a trial the paywall it opens then
 * withholds.
 */
export function probeTrialOfferDays(now: number = Date.now()): Promise<number | null> {
  return probePaywallTrials(now).then(trials => {
    const plan = preferredPaywallPlan(SUB_TRIAL_PRODUCT_IDS.filter(id => trials[id] != null), trials);
    return (plan && trials[plan]) ?? null;
  });
}

/** Forget the cached answer (tests; after a purchase changes eligibility). */
export function resetTrialOfferProbe(): void {
  probe = null;
}
