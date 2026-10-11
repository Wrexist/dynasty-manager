/**
 * The win-time reminder prompt gets one re-ask.
 *
 * It used to be shown once per device, on the first win, and never again. A
 * player who tapped "Not now" (which never reaches the iOS system prompt) could
 * then only find reminders in Settings. Now "Not now" opens one more ask on a
 * later win, `NOTIF_REASK_AFTER_DAYS` later; anyone who answered the system
 * prompt is never asked again.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isFirstWinPromptEligible,
  signalFirstWinForNotifications,
  isFirstWinPromptPending,
  resolveFirstWinPrompt,
  __resetFirstWinPromptForTests,
} from '@/utils/notifications';
import { writeNotificationsEnabled } from '@/store/helpers/persistence';
import { NOTIF_REASK_AFTER_DAYS } from '@/config/ui';

const DAY = 86_400_000;

describe('reminder prompt re-ask', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetFirstWinPromptForTests();
  });

  it('is eligible before it has ever been shown', () => {
    expect(isFirstWinPromptEligible()).toBe(true);
    signalFirstWinForNotifications();
    expect(isFirstWinPromptPending()).toBe(true);
  });

  it('after "Not now", waits the re-ask gap, then asks once more', () => {
    signalFirstWinForNotifications();
    resolveFirstWinPrompt(true);
    const now = Date.now();
    expect(isFirstWinPromptEligible(now + (NOTIF_REASK_AFTER_DAYS - 1) * DAY)).toBe(false);
    expect(isFirstWinPromptEligible(now + NOTIF_REASK_AFTER_DAYS * DAY + 1000)).toBe(true);
  });

  it('the re-ask is spent once shown, whatever the answer', () => {
    signalFirstWinForNotifications();
    resolveFirstWinPrompt(true);
    localStorage.setItem('dynasty-notif-prompt-dismissed-at', String(Date.now() - (NOTIF_REASK_AFTER_DAYS + 1) * DAY));
    signalFirstWinForNotifications();
    expect(isFirstWinPromptPending()).toBe(true);
    resolveFirstWinPrompt(true);
    expect(isFirstWinPromptEligible(Date.now() + 365 * DAY)).toBe(false);
  });

  it('never re-asks after the system prompt was answered', () => {
    signalFirstWinForNotifications();
    writeNotificationsEnabled(false); // enabled, then denied at the OS prompt
    resolveFirstWinPrompt();
    expect(isFirstWinPromptEligible(Date.now() + 365 * DAY)).toBe(false);
  });

  it('a first showing resolved without "Not now" opens no re-ask', () => {
    signalFirstWinForNotifications();
    resolveFirstWinPrompt(); // off-device retirement or an answered prompt
    expect(isFirstWinPromptEligible(Date.now() + 365 * DAY)).toBe(false);
  });
});
