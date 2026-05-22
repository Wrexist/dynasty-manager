/**
 * AdMob integration for Dynasty Manager.
 *
 * Ships the Google Mobile Ads SDK via `@capacitor-community/admob`. Only the
 * rewarded-video format is used — every ad in the game is opt-in (the player
 * taps "Watch Ad" to open a pack or claim a boost). No banners, no
 * interstitials, no app-open ads.
 *
 * ⚠️ Launch-crash history: the GMA SDK throws
 * `GADApplicationVerifyPublisherInitializedCorrectly` from a background
 * dispatch block when it is linked into the binary but `AdMob.initialize()`
 * is never called — this crashed TestFlight builds 134 and 136. `initAds()`
 * MUST run at startup (it is wired into `initNative()` in `src/main.tsx`).
 * `launchCrashGuardrails.test.ts` enforces that this file calls
 * `AdMob.initialize` and that `main.tsx` calls `initAds()`.
 *
 * Test ad unit IDs are wired by default so the integration is safe to ship
 * before a real AdMob account exists. For production, set
 * `VITE_ADMOB_PRODUCTION=true` and supply real unit IDs via
 * `VITE_ADMOB_REWARDED_IOS` / `VITE_ADMOB_REWARDED_ANDROID`.
 */
import * as Sentry from '@sentry/react';
import { Capacitor } from '@capacitor/core';

/** True now that the AdMob plugin is installed and wired. Callsites
 *  (`PacksPage`, `AdRewardButton`) gate the "Watch Ad" affordance on this. */
export const NATIVE_ADS_READY = true;

/** Serve Google's test ads instead of real inventory. Stays true until a
 *  real AdMob account + ad units exist — flip via `VITE_ADMOB_PRODUCTION`. */
const USE_TEST_ADS = import.meta.env.VITE_ADMOB_PRODUCTION !== 'true';

/** Google's official test rewarded-video ad unit IDs. Safe to ship — they
 *  always fill, serve test creatives, and never trigger invalid-traffic
 *  strikes. Real IDs are injected via env for production builds. */
const TEST_REWARDED_IOS = 'ca-app-pub-3940256099942544/1712485313';
const TEST_REWARDED_ANDROID = 'ca-app-pub-3940256099942544/5224354917';

function rewardedAdUnitId(): string {
  if (Capacitor.getPlatform() === 'android') {
    return import.meta.env.VITE_ADMOB_REWARDED_ANDROID || TEST_REWARDED_ANDROID;
  }
  return import.meta.env.VITE_ADMOB_REWARDED_IOS || TEST_REWARDED_IOS;
}

let initPromise: Promise<void> | null = null;

/**
 * Initialise the AdMob SDK. Memoised — safe to call repeatedly. No-op when
 * running off-device. Calling `AdMob.initialize()` is the step that makes
 * the linked GMA SDK crash-safe, so this must run at startup.
 */
export async function initAds(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !NATIVE_ADS_READY) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const { AdMob } = await import('@capacitor-community/admob');
      await AdMob.initialize({ initializeForTesting: USE_TEST_ADS, testingDevices: [] });
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[Ads] AdMob init failed:', err);
      Sentry.captureException(err, { tags: { context: 'ads.init' } });
      // Clear the cached promise so a later call can retry.
      initPromise = null;
    }
  })();
  return initPromise;
}

/**
 * Show a rewarded video ad. Resolves `true` only when the user earned the
 * reward (watched the ad to completion). Resolves `false` on a
 * dismiss-before-reward, a load/show failure, or any error — callers must
 * NOT grant the reward when this resolves false.
 *
 * On web/dev (no native plugin) it resolves `true` so the pack and boost
 * flows can be exercised end-to-end without a device — mirrors
 * `purchaseConsumable`'s dev behaviour.
 */
export async function showRewardedAd(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !NATIVE_ADS_READY) return true;

  try {
    await initAds();
    const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');

    // The `Rewarded` event is the authoritative signal that the user
    // actually earned the reward. `showRewardVideoAd()` resolving only
    // means the ad finished its lifecycle (which includes early dismiss).
    let rewarded = false;
    const listener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      rewarded = true;
    });

    try {
      await AdMob.prepareRewardVideoAd({ adId: rewardedAdUnitId(), isTesting: USE_TEST_ADS });
      await AdMob.showRewardVideoAd();
    } finally {
      await listener.remove();
    }
    return rewarded;
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[Ads] Rewarded ad failed:', err);
    Sentry.captureException(err, { tags: { context: 'ads.showRewardedAd' } });
    return false;
  }
}
