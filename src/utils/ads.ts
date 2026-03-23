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

// Placeholder ad unit IDs — replace with real IDs from AdMob dashboard
// Use test IDs during development: https://developers.google.com/admob/android/test-ads
const REWARDED_AD_UNIT_IOS = 'ca-app-pub-2286247955186424~9847041449';
const REWARDED_AD_UNIT_ANDROID = 'ca-app-pub-2286247955186424~9847041449';

let adInitialized = false;

/** Initialize the AdMob SDK. Call once at app startup. */
export async function initAds(): Promise<void> {
  if (adInitialized) return;
  if (!Capacitor.isNativePlatform()) {
    adInitialized = true;
    return;
  }

  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.initialize({ initializeForTesting: true });
    adInitialized = true;
  } catch (err) {
    console.warn('[Ads] Failed to initialize AdMob:', err);
  }
}

/** Show a rewarded ad. Resolves true if the user watched the full ad. */
export async function showRewardedAd(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // Web/dev mode: simulate a successful ad view
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
