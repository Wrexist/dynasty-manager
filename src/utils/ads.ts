/**
 * AdMob rewarded ad wrapper for Dynasty Manager.
 * All ads are opt-in only — the player chooses to watch for a reward.
 *
 * V1 STATUS: ads are disabled. NATIVE_ADS_READY = false keeps the SDK
 * dormant (no AdMob.initialize, no plist reads, no ATT prompt). The iOS
 * Info.plist also has NSUserTrackingUsageDescription / GADApplicationIdentifier
 * / SKAdNetworkItems removed to match. Re-enable in a future build by
 * flipping the flag, restoring the plist keys, and updating App Privacy
 * to declare tracking via Device ID for Third-Party Advertising.
 */

import { Capacitor } from '@capacitor/core';

// Ad unit IDs — set via environment variables for production, falls back to Google's test IDs
const REWARDED_AD_UNIT_IOS = import.meta.env.VITE_ADMOB_REWARDED_IOS || 'ca-app-pub-3940256099942544/1712485313';
const REWARDED_AD_UNIT_ANDROID = import.meta.env.VITE_ADMOB_REWARDED_ANDROID || 'ca-app-pub-3940256099942544/5224354917';

/** Set to true once production AdMob IDs are configured, the iOS Info.plist
 *  re-includes NSUserTrackingUsageDescription / GADApplicationIdentifier /
 *  SKAdNetworkItems, and App Privacy declares tracking. */
export const NATIVE_ADS_READY = false;

let adInitialized = false;

/** Initialize the AdMob SDK. Call once at app startup. No-op when ads are disabled. */
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

/** Show a rewarded ad. Resolves true if the user watched the full ad,
 *  false if the ad couldn't load or ads are disabled in this build. */
export async function showRewardedAd(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !NATIVE_ADS_READY) {
    return false;
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
    if (import.meta.env.DEV) console.error('[Ads] Rewarded ad error:', err);
    return false;
  }
}
