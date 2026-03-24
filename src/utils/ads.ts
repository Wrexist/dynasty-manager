/**
 * AdMob rewarded ad wrapper for Dynasty Manager.
 * All ads are opt-in only — the player chooses to watch for a reward.
 *
 * SETUP REQUIRED:
 * 1. Create an AdMob account at https://admob.google.com
 * 2. Create a rewarded ad unit for iOS and Android
 * 3. Replace the placeholder ad unit IDs below with your real IDs
 */

import { Capacitor } from '@capacitor/core';

// TODO: Replace with real ad unit IDs from AdMob dashboard before monetization launch
// Currently using Google's official test rewarded ad unit IDs
const REWARDED_AD_UNIT_IOS = 'ca-app-pub-3940256099942544/1712485313';
const REWARDED_AD_UNIT_ANDROID = 'ca-app-pub-3940256099942544/5224354917';

/** Set to true once production AdMob IDs are configured and native plugin restored. */
const NATIVE_ADS_READY = false;

let adInitialized = false;

/** Initialize the AdMob SDK. Call once at app startup. */
export async function initAds(): Promise<void> {
  if (adInitialized) return;
  if (!Capacitor.isNativePlatform() || !NATIVE_ADS_READY) {
    adInitialized = true;
    return;
  }

  try {
    const { AdMob } = await import('@capacitor-community/admob');

    // Request tracking authorization first (iOS 14+ ATT requirement).
    // This must happen before AdMob.initialize() to avoid SDK issues.
    try { await AdMob.requestTrackingAuthorization(); }
    catch { /* User denied or not supported — proceed without tracking */ }

    // Wrap in a timeout so a stuck SDK doesn't block app startup forever
    await Promise.race([
      AdMob.initialize({ initializeForTesting: import.meta.env.DEV }),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('AdMob init timeout')), 5000)),
    ]);
    adInitialized = true;
  } catch (err) {
    console.warn('[Ads] Failed to initialize AdMob:', err);
    // Mark initialized to prevent retry loops — ads simply won't show
    adInitialized = true;
  }
}

/** Show a rewarded ad. Resolves true if the user watched the full ad. */
export async function showRewardedAd(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !NATIVE_ADS_READY) {
    return true;
  }

  try {
    const { AdMob } = await import('@capacitor-community/admob');
    const adId = Capacitor.getPlatform() === 'ios' ? REWARDED_AD_UNIT_IOS : REWARDED_AD_UNIT_ANDROID;

    await AdMob.prepareRewardVideoAd({ adId });
    const result = await AdMob.showRewardVideoAd();
    // result.type will be 'RewardedAdReward' if user earned the reward
    return !!result;
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'AD_NOT_READY' || error.code === 'AD_NOT_LOADED') {
      console.warn('[Ads] No ad available');
      return false;
    }
    console.error('[Ads] Rewarded ad error:', err);
    return false;
  }
}
