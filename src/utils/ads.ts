/**
 * AdMob rewarded ad wrapper for Dynasty Manager.
 * All ads are opt-in only — the player chooses to watch for a reward.
 *
 * V1 STATUS: ads are disabled at the JS layer. NATIVE_ADS_READY = false
 * keeps AdMob.initialize() from being called, so no ATT prompt fires and
 * no ad requests go out.
 *
 * iOS Info.plist on this branch:
 *   - NSUserTrackingUsageDescription: KEPT — App Store review error 90683
 *     requires this string because the bundled AdMob SDK references the
 *     ATT API, even though we never call requestTrackingAuthorization()
 *     while NATIVE_ADS_READY is false. Localized per-locale in
 *     ios/App/App/*.lproj/InfoPlist.strings. Including the string does
 *     not by itself change App Privacy declarations.
 *   - SKAdNetworkItems:               REMOVED (no ad attribution networks)
 *   - GADApplicationIdentifier:       KEPT — the Google Mobile Ads SDK
 *     crashes the app on launch if this key is missing, even when
 *     AdMob.initialize() is never called. Keeping it does not enable
 *     tracking and does not affect App Review.
 *
 * Re-enable ads in a future build by:
 *   1. Flip NATIVE_ADS_READY = true (below)
 *   2. Restore SKAdNetworkItems in Info.plist (NSUserTrackingUsageDescription
 *      is already present)
 *   3. Update App Privacy to declare Device ID -> tracking, Third-Party Ads
 *   4. Update the privacy policy at docs/privacy.html to mention advertising
 */

import { Capacitor } from '@capacitor/core';

// Ad unit IDs — set via environment variables for production, falls back to Google's test IDs
const REWARDED_AD_UNIT_IOS = import.meta.env.VITE_ADMOB_REWARDED_IOS || 'ca-app-pub-3940256099942544/1712485313';
const REWARDED_AD_UNIT_ANDROID = import.meta.env.VITE_ADMOB_REWARDED_ANDROID || 'ca-app-pub-3940256099942544/5224354917';

/** Set to true once production AdMob IDs are configured, the iOS Info.plist
 *  re-includes SKAdNetworkItems, and App Privacy declares tracking.
 *  NSUserTrackingUsageDescription / GADApplicationIdentifier are already
 *  present so the SDK can be linked without crashing on launch. */
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
