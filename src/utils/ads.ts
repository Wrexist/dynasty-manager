/**
 * Ads stub for Dynasty Manager.
 *
 * V1 STATUS: ads are disabled at every layer. The Google Mobile Ads SDK
 * (`@capacitor-community/admob`) was previously linked but dormant — its
 * internal `GADApplicationVerifyPublisherInitializedCorrectly` check fired
 * from a background dispatch block at launch and crashed TestFlight builds
 * because `[GADMobileAds.sharedInstance startWithCompletionHandler:]` was
 * never called. Adding `GADApplicationIdentifier` to Info.plist alone is no
 * longer enough on GMA SDK v12+; the SDK requires a real `start()` call.
 *
 * Rather than initialize a tracking SDK we don't use, the plugin has been
 * fully removed for V1. It's gone from `package.json`, from
 * `ios/App/CapApp-SPM/Package.swift`, and the AdMob-related Info.plist
 * keys (`GADApplicationIdentifier`, `NSUserTrackingUsageDescription`,
 * `SKAdNetworkItems`) plus the matching `*.lproj/InfoPlist.strings`
 * translations have all been deleted — no ATT-using SDK is linked, so
 * App Store review won't request the purpose string (ITMS-90683 was
 * caused by AdMob's reference to the ATT API). App Privacy stays "no
 * tracking" with no linked ad framework.
 *
 * `NATIVE_ADS_READY = false` keeps every callsite (AdRewardButton, PacksPage)
 * gracefully gated off. Re-enable ads in a future build by:
 *   1. `npm install @capacitor-community/admob`
 *   2. Re-add the package + product to `ios/App/CapApp-SPM/Package.swift`
 *      (or run `npx cap sync ios` to regenerate it).
 *   3. Restore `GADApplicationIdentifier`, `NSUserTrackingUsageDescription`,
 *      and `SKAdNetworkItems` in Info.plist, plus the localized purpose
 *      strings in `ios/App/App/*.lproj/InfoPlist.strings`.
 *   4. Update App Privacy to declare Device ID -> tracking, Third-Party Ads
 *      and the privacy policy at docs/privacy.html.
 *   5. Replace this file with a real implementation that calls
 *      `AdMob.initialize()` at startup.
 */

/** Set to true once AdMob is reinstalled and configured for production. */
export const NATIVE_ADS_READY = false;

/** Initialize the AdMob SDK. No-op while ads are disabled. */
export async function initAds(): Promise<void> {
  // Intentionally empty. The plugin is not installed in V1.
}

/** Show a rewarded ad. Always resolves false while ads are disabled. */
export async function showRewardedAd(): Promise<boolean> {
  return false;
}
