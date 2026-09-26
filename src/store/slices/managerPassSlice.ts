/**
 * Manager Pass slice — the store face of the device-global Pass record.
 *
 * `managerPass` is a RENDER CACHE of the stored record, not the source of
 * truth: every action loads the stored record, rolls it into the current
 * season, applies its change and writes it back, so a stale in-memory copy can
 * never overwrite newer progress. Storage is localStorage with a write-through
 * IndexedDB copy, reconciled at start-up (`hydratePassStorage`) before the
 * first write-through. It is deliberately absent from the save
 * payload — the pass belongs to the device, not to a slot (see
 * `config/managerPass.ts`) — so there is no save-schema change.
 *
 * Pro gating reads `isPro()` and nothing else (entitlement invariant 1).
 */
import type { GameState } from '../storeTypes';
import type { CosmeticItem, ManagerPassEvent, ManagerPassRecord, ManagerPassTrack } from '@/types/game';
import { COSMETIC_ITEMS } from '@/config/monetization';
import { isPro } from '@/utils/monetization';
import { observeClock } from '@/store/helpers/persistence';
import {
  getManagerPassSeason,
  loadPassRecord,
  savePassRecord,
  rollPassSeason,
  applyPassCheckIn,
  applyPassEvents,
  applyPassClaim,
  claimablePassRewards,
  carriedProRewards,
  applyCarriedProClaim,
  passRewardId,
  isEarnedCosmeticOwned,
  hydratePassStorage,
  onPassStorageRestored,
} from '@/utils/managerPass';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

/** "Now" for the pass: the furthest time this device has seen, so winding the
 *  clock back can neither re-open a check-in nor reach an earlier season. */
const passNow = () => new Date(observeClock());

const itemById = (id: string | undefined): CosmeticItem | null =>
  (id && COSMETIC_ITEMS.find(c => c.id === id)) || null;

export function createManagerPassSlice(_set: Set, _get: Get) {
  /** Load the stored record rolled into the current season. */
  const current = (): { record: ManagerPassRecord; now: Date } => {
    const now = passNow();
    const season = getManagerPassSeason(now);
    return { record: rollPassSeason(loadPassRecord(season), season, isPro(_get().monetization)), now };
  };

  /** Persist and publish. Always writes: a roll alone is a change worth keeping. */
  const commit = (record: ManagerPassRecord): ManagerPassRecord => {
    const saved = savePassRecord(record);
    _set({ managerPass: saved });
    return saved;
  };

  // Reconcile the localStorage and IndexedDB copies once per session (retried
  // by the next save if IndexedDB does not answer). Only a restore (IndexedDB
  // was newer) changes what the render cache should show.
  onPassStorageRestored(() => _set({ managerPass: loadPassRecord(getManagerPassSeason(passNow())) }));
  void hydratePassStorage();

  return {
    // Storage reads never throw (persistence swallows availability errors).
    managerPass: loadPassRecord(getManagerPassSeason(new Date())),

    /** Re-read storage (and roll the season). Call on mount of any Pass surface. */
    refreshManagerPass: (): ManagerPassRecord => commit(current().record),

    /** Daily check-in. Returns the Pass XP gained, or null if already taken today. */
    checkInManagerPass: (): number | null => {
      const { record, now } = current();
      const next = applyPassCheckIn(record, now);
      if (next === record) {
        commit(record);
        return null;
      }
      commit(next);
      return next.xp - record.xp;
    },

    /** Collect one reward. Returns the cosmetic, or null if it was not claimable
     *  (locked, already collected, or a Pro reward without Pro). */
    claimManagerPassReward: (tier: number, track: ManagerPassTrack): CosmeticItem | null => {
      const { record } = current();
      const next = applyPassClaim(record, tier, track, isPro(_get().monetization));
      commit(next);
      return next === record ? null : itemById(passRewardId(tier, track));
    },

    /** Collect everything collectable, including last season's carried Pro
     *  rewards once Pro is confirmed. Returns what was collected. */
    claimAllManagerPassRewards: (): CosmeticItem[] => {
      const { record } = current();
      const pro = isPro(_get().monetization);
      const claims = claimablePassRewards(record, pro);
      const claimed = claims.reduce((r, c) => applyPassClaim(r, c.tier, c.track, pro), record);
      const carried = carriedProRewards(claimed, pro);
      commit(applyCarriedProClaim(claimed, pro));
      return [...claims.map(c => passRewardId(c.tier, c.track)), ...carried]
        .map(itemById).filter(Boolean) as CosmeticItem[];
    },

    /** Apply observed game events (see `attachManagerPassObserver`). Returns
     *  the Pass XP gained — 0 when every event was a replay or over the cap. */
    recordManagerPassEvents: (events: ManagerPassEvent[]): number => {
      if (events.length === 0) return 0;
      const { record, now } = current();
      const next = applyPassEvents(record, events, now);
      if (next === record) return 0;
      commit(next);
      return next.xp - record.xp;
    },

    /** Wear an earned cosmetic (Manager Pass or Legacy). Purchased cosmetics
     *  keep going through `setCosmetic`, which checks `entitlements`. */
    equipEarnedCosmetic: (cosmeticId: string): boolean => {
      const item = COSMETIC_ITEMS.find(c => c.id === cosmeticId && c.earnedBy);
      if (!item || !isEarnedCosmeticOwned(item)) return false;
      _set(s => ({
        monetization: {
          ...s.monetization,
          activeCosmetics: { ...s.monetization.activeCosmetics, [item.category]: item.id },
        },
      }));
      return true;
    },
  };
}
