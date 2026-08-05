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
 * `NATIVE_ADS_READY = false` keeps every callsite (AdRewardButton, PacksPage,
 * AdOfferModal / AdOfferHost) gracefully gated off.
 *
 * THE APP-SIDE AD SYSTEM IS COMPLETE AND WAITING ON THIS FILE.
 * Already built and tested, all of it inert until the two flags below flip:
 *   - `config/ads.ts`        — placements + escalating/capped pacing policy
 *   - `utils/adPacing.ts`    — pure pacing decisions (24 unit tests)
 *   - `AdOfferModal`         — the popup; Pro claims without watching
 *   - `AdOfferHost`          — contextual placement selection, mounted in GameShell
 *   - `monetization.adEngagement` — persisted counters (save schema v79)
 *
 * So the ONLY remaining work is the native SDK below. When it lands, flip
 * `NATIVE_ADS_READY` to true AND `REWARDED_AD_IMPL_IS_STUB` to false in the
 * same commit, and the whole system turns on for free and Pro users together.
 *
 * Re-enable ads in a future build by:
 *   1. `npm install @capacitor-community/admob`
 *   2. Re-add the package + product to `ios/App/CapApp-SPM/Package.swift`
 *      (or run `npx cap sync ios` to regenerate it).
 *   3. Restore `GADApplicationIdentifier`, `NSUserTrackingUsageDescription`,
 *      and `SKAdNetworkItems` in Info.plist, plus the localized purpose
 *      strings in `ios/App/App/*.lproj/InfoPlist.strings`.
 *   4. Update App Privacy to declare Device ID -> tracking, Third-Party Ads
 *      and the privacy policy at docs/privacy.html.
 *   5. Replace `showRewardedAd()` below with a real implementation that calls
 *      `AdMob.initialize()` at startup and resolves true ONLY on a completed
 *      view (the reward callback), never on dismiss or error.
 *   6. Flip `NATIVE_ADS_READY = true` and `REWARDED_AD_IMPL_IS_STUB = false`
 *      together. The guardrail tests in `launchCrashGuardrails.test.ts` pin
 *      them as a pair precisely so one cannot ship without the other.
 *   7. Sequence the ATT prompt against the existing first-launch
 *      `AnalyticsConsentModal` so the user does not get two system-looking
 *      dialogs back to back, and add Google UMP for EEA consent.
 *
 * Nothing above can be done or verified from a headless environment — it needs
 * Xcode, a device, and an App Store Connect privacy update.
 */

/** Set to true once AdMob is reinstalled and configured for production. */
export const NATIVE_ADS_READY = false;

/**
 * True while `showRewardedAd` below is still the stub that always resolves
 * false. Flip this in the SAME commit that replaces it with a real
 * implementation — never before.
 *
 * This exists because flipping `NATIVE_ADS_READY` on its own is a trap.
 * AdRewardButton grants Pro users their reward instantly (they skip the ad)
 * and sends free users through `showRewardedAd()`. If the plugin flag were
 * true while this file still returned false, Pro would collect every budget
 * reward and free users would collect none — re-creating precisely the
 * Pro-only economic buff that the comment in AdRewardButton says was removed,
 * and breaking the "monetization never touches sim parameters" contract.
 */
const REWARDED_AD_IMPL_IS_STUB = true;

/**
 * The single gate the UI should use. Rewarded ads are usable only when the
 * plugin is enabled AND a real implementation is wired up, so no single flag
 * flip can create a reward only paying users can claim.
 */
export const REWARDED_ADS_USABLE = NATIVE_ADS_READY && !REWARDED_AD_IMPL_IS_STUB;

/** Initialize the AdMob SDK. No-op while ads are disabled. */
export async function initAds(): Promise<void> {
  // Intentionally empty. The plugin is not installed in V1.
}

/** Show a rewarded ad. Always resolves false while ads are disabled. */
export async function showRewardedAd(): Promise<boolean> {
  return false;
}
