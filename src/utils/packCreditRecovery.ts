import * as Sentry from '@sentry/react';
import { useGameStore } from '@/store/gameStore';
import { PACK_TIER_MAP } from '@/config/packs';
import { infoToast, successToast } from '@/utils/gameToast';
import {
  readPendingPackCredit, writePendingPackCredit, clearPendingPackCredit, readSaveSlot, isSlotHydrated,
  type PendingPackCredit,
} from '@/store/helpers/persistence';
import { PACK_DEFERRED_SETTLE_MS, PACK_UNCONFIRMED_SETTLE_MS, PACK_UNVERIFIABLE_MARKER_MS } from '@/config/monetization';
import { addGameBreadcrumb } from '@/utils/sentry';
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

/** How long an un-charged marker waits for the store before release. */
function settleWindowMs(pending: PendingPackCredit): number {
  return pending.deferred ? PACK_DEFERRED_SETTLE_MS : PACK_UNCONFIRMED_SETTLE_MS;
}

/** A save slot that IndexedDB has actually been read for and that holds no
 *  save. A paid credit bound to it can never be claimed where it was bought. */
function isSlotAbandoned(slot: number): boolean {
  return isSlotHydrated(slot) && readSaveSlot(slot) === null;
}

/** Deliver once into the paying slot, then wait for durable storage before
 * clearing proof of payment. Confirmed credits never expire. The record id is
 * written before generation, so a crash after save but before marker deletion
 * cannot generate a second pack. Concurrent mount effects share this gate.
 *
 * An UN-charged marker is verified against the store's purchase history from
 * any slot (the history is per store account, not per save): one new
 * transaction promotes it, and none after the settle window releases it. The
 * Market refuses new purchases while any marker exists, so a marker that could
 * never resolve used to lock the device out of pack purchases for good. */
export async function reconcilePendingPackCreditAtLaunch(notify = true): Promise<OpenPackResult | undefined> {
  if (purchaseInFlight || reconciling) return;
  let state = useGameStore.getState();
  if (state.gameMode === 'world-cup') return;
  let pending = readPendingPackCredit();
  if (!pending) return;
  const tier = PACK_TIER_MAP[pending.tierKey as PackTierKey];
  if (!tier || tier.productId !== pending.productId || !state.clubs[state.playerClubId]) return;
  // A confirmed payment whose save was deleted would otherwise be stranded
  // (and block every future purchase): deliver it to the career being played.
  if (pending.charged !== false && pending.slot !== state.activeSlot && isSlotAbandoned(pending.slot)) {
    pending = { ...pending, slot: state.activeSlot };
    if (!writePendingPackCredit(pending)) return;
  }
  const ownSlot = pending.slot === state.activeSlot;
  if (!ownSlot && pending.charged !== false) return;
  reconciling = true;
  try {
    if (pending.charged === false) {
      const ageMs = Date.now() - pending.timestamp;
      if (!pending.customerId || !pending.priorTransactionIds) {
        if (ageMs >= PACK_UNVERIFIABLE_MARKER_MS) {
          clearPendingPackCredit();
          addGameBreadcrumb('purchase', 'unverifiable pack marker released', { productId: pending.productId });
          return;
        }
        if (notify) infoToast('Purchase needs verification', 'Contact support to check the interrupted purchase before buying another pack.');
        return;
      }
      const history = await readConsumableHistory(pending.productId, true);
      const currentPending = readPendingPackCredit();
      const liveState = useGameStore.getState();
      if (!currentPending || currentPending.timestamp !== pending.timestamp || currentPending.productId !== pending.productId
        || currentPending.slot !== pending.slot || liveState.activeSlot !== state.activeSlot || liveState.gameMode === 'world-cup'
        || liveState.playerClubId !== state.playerClubId) return;
      state = liveState;
      const newIds = history.transactionIds.filter(id => !pending!.priorTransactionIds!.includes(id));
      const sameCustomer = history.customerId === pending.customerId;
      if (sameCustomer && newIds.length === 0 && ageMs >= settleWindowMs(pending)) {
        clearPendingPackCredit();
        addGameBreadcrumb('purchase', 'unconfirmed pack marker released', { productId: pending.productId, deferred: pending.deferred === true });
        if (notify) infoToast('No charge was made', `Your interrupted ${tier.label} purchase never completed, so the Market is open again.`);
        return;
      }
      if (!sameCustomer || newIds.length !== 1) {
        if (notify) {
          if (sameCustomer && newIds.length === 0) {
            infoToast('Checking your last purchase', pending.deferred
              ? 'Your pack purchase is waiting for approval. It will be credited once approved.'
              : 'No payment has arrived yet. If none does, the Market unlocks again automatically.');
          } else {
            infoToast('Purchase verification pending', 'Reconnect and reopen the Market. If the purchase was cancelled, contact support to clear the pending payment.');
          }
        }
        return;
      }
      pending = { ...pending, charged: true, transactionId: newIds[0] };
      if (!ownSlot) {
        // Paid, but by another career: record the proof and let that save claim it.
        writePendingPackCredit(pending);
        return;
      }
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
