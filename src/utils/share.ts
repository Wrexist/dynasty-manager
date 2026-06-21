import * as Sentry from '@sentry/react';

/** Outcome of a share attempt, so callers can tailor their toast. */
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Share text (and an optional URL) via the platform share sheet.
 *
 * Uses the Web Share API (`navigator.share`), which surfaces the native iOS
 * share sheet inside Capacitor's WKWebView when invoked from a user gesture —
 * no extra plugin/dependency required. Falls back to copying the message to
 * the clipboard on platforms without share support (desktop web / dev), and
 * reports the outcome so the caller can show the right confirmation.
 *
 * A user-cancelled share (`AbortError`) is distinguished from a real failure
 * so we don't toast an error when the user simply dismissed the sheet.
 */
export async function shareText(text: string, url?: string): Promise<ShareResult> {
  const message = url ? `${text} ${url}` : text;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(url ? { text, url } : { text });
      return 'shared';
    } catch (err) {
      // User dismissed the share sheet — not an error.
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
        return 'cancelled';
      }
      // Fall through to clipboard on any other share failure.
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(message);
      return 'copied';
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'share.clipboard' } });
      return 'failed';
    }
  }

  return 'failed';
}
