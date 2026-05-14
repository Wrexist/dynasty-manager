import * as Sentry from '@sentry/react';
import { Capacitor } from '@capacitor/core';

/**
 * Open an external URL in a system-managed browser.
 *
 * On iOS / Android (Capacitor native) this routes through @capacitor/browser
 * which opens SFSafariViewController on iOS — a system-rendered in-app
 * browser that the user can close back to the app. Crucially, SFSafari
 * works even with `limitsNavigationsToAppBoundDomains: true` in
 * `capacitor.config.ts` (which blocks `window.open` and `<a target="_blank">`
 * from navigating WKWebView to non-app-bound domains).
 *
 * On web (vitest / dev / desktop preview) it falls back to `window.open`.
 *
 * Use this helper for ALL external URLs (Terms of Use, Privacy Policy,
 * support links, etc.) — Apple Guideline 3.1.2(c) requires Terms/Privacy
 * links inside the subscription flow to be functional, and bare
 * `window.open` calls are silently no-ops on native iOS due to the App
 * Bound Domains restriction.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url, presentationStyle: 'popover' });
      return;
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'externalUrl.native' }, extra: { url } });
      // Fall through to window.open as a last-ditch attempt.
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
