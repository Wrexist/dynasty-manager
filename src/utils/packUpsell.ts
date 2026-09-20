import { observeClock, recordPackUpsell } from '@/store/helpers/persistence';

let shownThisSession = false;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) shownThisSession = false;
  });
}

/** Record on display, not on dismissal; force-quitting cannot evade the cap. */
export function claimPackUpsell(now = observeClock(), maxPerDay = 2): boolean {
  if (shownThisSession) return false;
  if (!recordPackUpsell(now, maxPerDay)) return false;
  shownThisSession = true;
  return true;
}
