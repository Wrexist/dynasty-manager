import * as Sentry from '@sentry/react';
import { useGameStore } from '@/store/gameStore';
import { PACK_TIER_MAP } from '@/config/packs';
import { infoToast, successToast } from '@/utils/gameToast';
import { readPendingPackCredit, writePendingPackCredit, clearPendingPackCredit } from '@/store/helpers/persistence';
import { safeRandomUUID } from '@/utils/helpers';
import { track } from '@/utils/analytics';
import { readConsumableHistory } from '@/utils/purchases';
import type { OpenPackResult, PackTierKey } from '@/types/game';

let purchaseInFlight = false;
let reconciling = false;

/** Shared by both mount surfaces and the store-sheet flow. */
export function isPackPurchaseInFlight(): boolean {
  return purchaseInFlight || reconciling;
}

export function setPackPurchaseInFlight(value: boolean): void {
  purchaseInFlight = value;
}

/** Deliver once into the paying slot, then wait for durable storage before
 * clearing proof of payment. Confirmed credits never expire. The record id is
 * written before generation, so a crash after save but before marker deletion
 * cannot generate a second pack. Concurrent mount effects share this gate. */
export async function reconcilePendingPackCreditAtLaunch(notify = true): Promise<OpenPackResult | undefined> {
  if (purchaseInFlight || reconciling) return;
  let state = useGameStore.getState();
  if (state.gameMode === 'world-cup') return;
  let pending = readPendingPackCredit();
  if (!pending || pending.slot !== state.activeSlot) return;
  const tier = PACK_TIER_MAP[pending.tierKey as PackTierKey];
  if (!tier || tier.productId !== pending.productId || !state.clubs[state.playerClubId]) return;
  reconciling = true;
  try {
    if (pending.charged === false) {
      if (!pending.customerId || !pending.priorTransactionIds) {
        if (notify) infoToast('Purchase needs verification', 'Contact support to check the interrupted purchase before buying another pack.');
        return;
      }
      const history = await readConsumableHistory(pending.productId, true);
      const currentPending = readPendingPackCredit();
      const liveState = useGameStore.getState();
      if (!currentPending || currentPending.timestamp !== pending.timestamp || currentPending.productId !== pending.productId
        || currentPending.slot !== pending.slot || liveState.activeSlot !== pending.slot || liveState.gameMode === 'world-cup'
        || liveState.playerClubId !== state.playerClubId) return;
      state = liveState;
      const newIds = history.transactionIds.filter(id => !pending!.priorTransactionIds!.includes(id));
      if (history.customerId !== pending.customerId || newIds.length !== 1) {
        if (notify) infoToast('Purchase verification pending', 'Reconnect and reopen the Market. If the purchase was cancelled, contact support to clear the pending payment.');
        return;
      }
      pending = { ...pending, charged: true, transactionId: newIds[0] };
    }
    const marker = { ...pending, recordId: pending.recordId ?? safeRandomUUID() };
    if (!writePendingPackCredit(marker)) {
      infoToast('Purchase is waiting', 'Free up device storage, then reopen the Market to receive your pack.');
      return;
    }
    const existing = state.openedPacks.find(pack => pack.id === marker.recordId);
    const result: OpenPackResult = existing
      ? { success: true, message: 'Pack already credited.', players: existing.playerIds.map(id => state.players[id]).filter(Boolean) }
      : state.openPack(pending.tierKey as PackTierKey, {
        method: 'iap', skipPayment: true, recordId: marker.recordId, bonusCards: marker.bonusCards ?? 0,
        purchaseWeek: marker.purchaseWeek,
        suppressPaidRejectSentry: pending.reported === true,
      });
    if (!result.success) {
      infoToast(`Your paid ${tier.label} is waiting`, result.message || 'Free up squad space, then reopen the Market.');
      if (!marker.reported) writePendingPackCredit({ ...marker, reported: true });
      return result;
    }
    const durable = await state.flushSave();
    const current = readPendingPackCredit();
    if (durable && current?.recordId === marker.recordId) clearPendingPackCredit();
    if (!durable) {
      infoToast('Pack received, save pending', 'Keep the app open and free up device storage. Your purchase recovery record has been kept.');
    }
    if (!existing && notify) {
      successToast('Purchase restored', `Your paid ${tier.label} has been credited.`);
      track('purchase_completed', { productId: pending.productId, surface: 'packs' });
      track('pack_opened', { tierKey: pending.tierKey, method: 'iap', pityTriggered: result.pityTriggered === true });
    }
    return result;
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'packs.recovery' } });
    infoToast('Purchase is waiting', 'Your recovery record has been kept. Reopen the Market to try again, or contact support.');
    return;
  } finally {
    reconciling = false;
  }
}
