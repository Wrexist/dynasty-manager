import * as Sentry from '@sentry/react';
import { errorToast } from '@/utils/gameToast';

/**
 * Guard a store action that may return `Promise<void> | void` (e.g. store
 * actions that only become async when a dynamic-imported dataset is needed).
 *
 * If the action returns a promise and rejects, we:
 *  - Forward the error to Sentry tagged with `context`.
 *  - Optionally show a user-visible toast so the failure isn't silent.
 *
 * If the action returned void (sync path), this is a no-op.
 *
 * Without this wrapper, an unhandled rejection propagates to the
 * window-level `unhandledrejection` listener in `main.tsx`. That still
 * reaches Sentry but leaves the user staring at an unchanged screen with
 * no clue what happened.
 */
export function guardAsync(
  result: Promise<void> | void,
  context: string,
  userMessage?: { title: string; body?: string },
): void {
  if (!result || typeof (result as Promise<void>).then !== 'function') return;
  (result as Promise<void>).catch((err: unknown) => {
    Sentry.captureException(err, { tags: { context } });
    if (userMessage) errorToast(userMessage.title, userMessage.body);
  });
}
