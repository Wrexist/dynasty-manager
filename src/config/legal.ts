/**
 * Legal / compliance URLs.
 * Linked from the Shop, Settings, and Purchase confirmation screens
 * to satisfy App Store and Play Store requirements.
 *
 * NOTE: These URLs MUST resolve. Apple Guideline 3.1.2(c) requires
 * functional links to Terms of Use (EULA) and Privacy Policy from the
 * subscription purchase flow — a 404 or DNS failure is rejection grounds.
 *
 * Terms of Use defaults to Apple's standard EULA — Apple explicitly
 * accepts this and it spares us from hosting/maintaining a custom EULA.
 * To use a custom EULA, replace TERMS_URL below AND upload the same EULA
 * to App Store Connect → App Information → EULA.
 */

export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const PRIVACY_URL = 'https://wrexist.github.io/dynasty-manager/privacy.html';

/** Google Play's Terms of Service — the terms that govern a Play purchase,
 *  and the Android counterpart of Apple's standard EULA above. */
export const GOOGLE_PLAY_TERMS_URL = 'https://play.google.com/about/play-terms/';

/** The Terms of Use to link at a point of purchase on `platform`
 *  (`Capacitor.getPlatform()`): Apple's EULA governs nothing on Google Play. */
export function termsUrlFor(platform: string): string {
  return platform === 'android' ? GOOGLE_PLAY_TERMS_URL : TERMS_URL;
}

/** Where a subscriber on `platform` manages or cancels a subscription. */
export function subscriptionSettingsPathFor(platform: string): string {
  return platform === 'android'
    ? 'Google Play → Payments & subscriptions'
    : 'Settings → Apple ID → Subscriptions';
}

/** Public App Store listing for Dynasty Manager (id 6760918006). Used in
 *  share messages so recipients can install the app. */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6760918006';
