import * as Sentry from '@sentry/react';
import { useGameStore } from '@/store/gameStore';
import { PACK_TIER_MAP } from '@/config/packs';
import { PENDING_CREDIT_TTL_MS } from '@/config/monetization';
import { infoToast, successToast } from '@/utils/gameToast';
import { readPendingPackCredit, writePendingPackCredit, clearPendingPackCredit } from '@/store/helpers/persistence';
import type { PackTierKey } from '@/types/game';

/**
 * Launch-time reconciliation of a crash-stranded paid pack credit.
 *
 * The PacksPage mount reconciler only runs when the player opens the Packs
 * screen — a crash between charge and grant stays invisible until then, and
 * if the player never revisits Packs the marker silently TTL-expires with
 * their money taken. This variant runs once per game-session mount
 * (GameShell), so the credit is restored on the first session after the
 * crash without requiring any specific navigation.
 *
 * Same invariants as the PacksPage reconciler:
 * - Only `charged` markers are grantable (existence alone proves nothing).
 * - The credit is only granted into the save slot that paid.
 * - Durable-first ordering: flush the save BEFORE clearing the marker.
 * - A blocked grant (e.g. squad full) keeps the marker and marks it reported.
 *
 * World Cup sessions are skipped: a stranded CLUB pack must not be granted
 * into the nation-squad session that happens to share the save slot.
 */
export function reconcilePendingPackCreditAtLaunch(): void {
  const state = useGameStore.getState();
  if (state.gameMode === 'world-cup') return;

  const pending = readPendingPackCredit();
  if (!pending) return;
  if (pending.slot !== state.activeSlot) return; // credit belongs to another save

  // Proof of payment, not merely evidence of an attempt — see
  // PendingPackCredit.charged in persistence.ts.
  if (pending.charged === false) {
    Sentry.captureMessage('[Packs] Dropping unconfirmed pack credit at launch', 'info');
    clearPendingPackCredit();
    return;
  }

  // Stale markers expire (backstop for permanently-blocked grants); with
  // launch reconciliation a genuine crash-stranded credit is reclaimed long
  // before this window closes.
  if (pending.timestamp > 0 && Date.now() - pending.timestamp > PENDING_CREDIT_TTL_MS) {
    Sentry.captureMessage('[Packs] Dropping expired pack credit at launch', 'warning');
    clearPendingPackCredit();
    return;
  }

  const tier = PACK_TIER_MAP[pending.tierKey as PackTierKey];
  if (!tier) { clearPendingPackCredit(); return; } // tier removed — nothing we can grant
  if (!state.clubs[state.playerClubId]) return; // club not hydrated yet — leave for the next surface

  const result = state.openPack(pending.tierKey as PackTierKey, {
    method: 'iap',
    skipPayment: true,
    // Suppress the slice's Sentry alert once we've already reported this
    // stranded marker — otherwise a persistently-blocked claim re-fires on
    // every session mount.
    suppressPaidRejectSentry: pending.reported === true,
  });

  if (result.success && result.players) {
    // Durable first, clear second — mirrors the purchase path.
    state.flushSave();
    if (useGameStore.getState().saveStatus !== 'failed') clearPendingPackCredit();
    successToast('Purchase restored', `Your paid ${tier.label} from the previous session has been credited.`);
  } else {
    // Grant is blocked — keep the marker so the claim survives, and keep
    // telling the player exactly what's in the way (once per session).
    infoToast(
      `Your paid ${tier.label} is waiting`,
      result.message || 'Free up a squad slot, then reopen the Packs screen to claim it.',
    );
    if (!pending.reported) writePendingPackCredit({ ...pending, reported: true });
  }
}
