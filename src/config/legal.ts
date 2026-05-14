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
