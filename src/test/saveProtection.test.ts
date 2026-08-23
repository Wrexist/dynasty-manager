/**
 * Save corruption protection tests.
 *
 * Covers the four guarantees from docs/release-triage.md Phase B.4:
 *   1. Schema validation on load.
 *   2. Atomic writes via a per-slot tmp key.
 *   3. One-deep backup rotation.
 *   4. Version guard refuses future-version saves.
 *
 * "Manual corruption test" (prompt requirement) is covered by the
 * corrupt-primary-recovers-from-backup case and the
 * unrecoverable-both-corrupt case.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import {
  STORAGE_KEYS,
  writeSaveSlot,
  readSaveSlot,
  readSaveSlotBackup,
  readSaveSlotTmp,
  recoverStaleSaveTmp,
  __resetSaveStorageForTests,
  readDeviceEntitlements,
} from '@/store/helpers/persistence';
import {
  validateSaveShape,
  isSaveFromNewerVersion,
  CURRENT_VERSION,
} from '@/utils/saveMigration';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import { isPro } from '@/utils/monetization';
import { DEFAULT_MONETIZATION_STATE } from '@/config/monetization';

/** Reset every save-storage layer (memory cache + localStorage) between
 *  tests. Required now that the memory cache outlives a `localStorage.clear()`
 *  and can leak a previous test's state into the next one. */
function clearAllSaveStorage() {
  __resetSaveStorageForTests();
  localStorage.clear();
}

const SLOT = 1;

/** A minimal save payload that passes every guard (version, shape, migration)
 *  but weighs well under the jsdom 5 MB localStorage quota. Real initGame()
 *  saves are ~2.5 MB each — having two copies (main + backup) in jsdom hits
 *  the quota. These hand-crafted payloads let us exercise the
 *  parse-primary-fails → recover-from-backup flow without that noise. */
function makeMinimalSave(): string {
  return JSON.stringify({
    version: CURRENT_VERSION,
    playerClubId: 'c1',
    clubs: { c1: { id: 'c1', name: 'Minimal FC', playerIds: [] } },
    players: {},
    fixtures: [],
    season: 1,
    week: 1,
    divisionFixtures: { eng: [] },
    divisionClubs: { eng: ['c1'] },
    playerDivision: 'eng',
    divisionTables: { eng: [] },
    messages: [],
    seasonHistory: [],
    communityPackEnabled: false,
    cpPool: { shuffleSeed: 0, cursor: 0, usedFcIds: [], marketListings: [], lastMarketRefreshWeek: 0 },
  });
}

describe('validateSaveShape', () => {
  it('accepts a well-formed save payload', () => {
    const good = { playerClubId: 'c1', clubs: { c1: {} }, season: 1, week: 1, version: CURRENT_VERSION };
    expect(validateSaveShape(good)).toEqual({ ok: true });
  });

  it('rejects null and non-object roots', () => {
    expect(validateSaveShape(null).ok).toBe(false);
    expect(validateSaveShape('nope').ok).toBe(false);
    expect(validateSaveShape([]).ok).toBe(false);
  });

  it('rejects missing required fields', () => {
    const base = { playerClubId: 'c1', clubs: { c1: {} }, season: 1, week: 1 };
    expect(validateSaveShape({ ...base, playerClubId: undefined }).ok).toBe(false);
    expect(validateSaveShape({ ...base, clubs: undefined }).ok).toBe(false);
    expect(validateSaveShape({ ...base, season: undefined }).ok).toBe(false);
    expect(validateSaveShape({ ...base, week: undefined }).ok).toBe(false);
  });

  it('rejects playerClubId not present in clubs map', () => {
    const orphan = { playerClubId: 'ghost', clubs: { c1: {} }, season: 1, week: 1 };
    const r = validateSaveShape(orphan);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.reason).toMatch(/not present/);
  });
});

describe('isSaveFromNewerVersion', () => {
  it('returns true when save.version > CURRENT_VERSION', () => {
    expect(isSaveFromNewerVersion({ version: CURRENT_VERSION + 1 })).toBe(true);
    expect(isSaveFromNewerVersion({ version: CURRENT_VERSION + 99 })).toBe(true);
  });

  it('returns false for current or older versions', () => {
    expect(isSaveFromNewerVersion({ version: CURRENT_VERSION })).toBe(false);
    expect(isSaveFromNewerVersion({ version: CURRENT_VERSION - 1 })).toBe(false);
    expect(isSaveFromNewerVersion({ version: 1 })).toBe(false);
  });

  it('returns false when version is missing or not a number', () => {
    expect(isSaveFromNewerVersion({})).toBe(false);
    expect(isSaveFromNewerVersion({ version: 'abc' })).toBe(false);
    expect(isSaveFromNewerVersion(null)).toBe(false);
  });
});

describe('atomic writeSaveSlot', () => {
  beforeEach(() => {
    clearAllSaveStorage();
  });

  it('leaves no tmp key after a successful write', () => {
    writeSaveSlot(SLOT, '{"hello":"world"}');
    expect(readSaveSlot(SLOT)).toBe('{"hello":"world"}');
    expect(readSaveSlotTmp(SLOT)).toBeNull();
  });

  it('rotates the previous main into the backup key', () => {
    writeSaveSlot(SLOT, '{"save":"one"}');
    writeSaveSlot(SLOT, '{"save":"two"}');
    expect(readSaveSlot(SLOT)).toBe('{"save":"two"}');
    expect(readSaveSlotBackup(SLOT)).toBe('{"save":"one"}');
  });

  it('only keeps one backup deep (second rotation drops oldest)', () => {
    writeSaveSlot(SLOT, '{"save":"one"}');
    writeSaveSlot(SLOT, '{"save":"two"}');
    writeSaveSlot(SLOT, '{"save":"three"}');
    expect(readSaveSlot(SLOT)).toBe('{"save":"three"}');
    expect(readSaveSlotBackup(SLOT)).toBe('{"save":"two"}');
  });

  it('cleans a stale tmp from a previous crashed write', () => {
    // Simulate a crash between "stage tmp" and "promote": tmp set, main not yet
    // updated.
    localStorage.setItem(STORAGE_KEYS.saveSlotTmp(SLOT), '{"crashed":"write"}');
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), '{"save":"one"}');
    writeSaveSlot(SLOT, '{"save":"two"}');
    expect(readSaveSlotTmp(SLOT)).toBeNull();
    expect(readSaveSlot(SLOT)).toBe('{"save":"two"}');
    // The first valid main value rotates to backup.
    expect(readSaveSlotBackup(SLOT)).toBe('{"save":"one"}');
  });
});

describe('recoverStaleSaveTmp', () => {
  beforeEach(() => { clearAllSaveStorage(); });

  it('promotes a valid tmp when primary is missing (simulated crash recovery)', () => {
    // Write succeeded at step 1 (stage tmp) but crashed before step 4 (promote).
    localStorage.setItem(STORAGE_KEYS.saveSlotTmp(SLOT), '{"version":1,"staged":true}');
    expect(readSaveSlot(SLOT)).toBeNull();
    recoverStaleSaveTmp();
    expect(readSaveSlot(SLOT)).toBe('{"version":1,"staged":true}');
    expect(readSaveSlotTmp(SLOT)).toBeNull();
  });

  it('drops a tmp with invalid JSON', () => {
    localStorage.setItem(STORAGE_KEYS.saveSlotTmp(SLOT), '<garbage>');
    recoverStaleSaveTmp();
    expect(readSaveSlotTmp(SLOT)).toBeNull();
    expect(readSaveSlot(SLOT)).toBeNull();
  });

  it('leaves primary untouched when both primary and tmp exist', () => {
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), '{"main":"ok"}');
    localStorage.setItem(STORAGE_KEYS.saveSlotTmp(SLOT), '{"stale":"tmp"}');
    recoverStaleSaveTmp();
    expect(readSaveSlot(SLOT)).toBe('{"main":"ok"}');
    // Stale tmp cleaned.
    expect(readSaveSlotTmp(SLOT)).toBeNull();
  });
});

describe('loadGame — corruption + version guard', () => {
  beforeEach(() => { clearAllSaveStorage(); });

  it('sets loadError when slot JSON is invalid AND no backup exists', () => {
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), 'not-json{{{');
    const ok = useGameStore.getState().loadGame(SLOT);
    expect(ok).toBe(false);
    const err = useGameStore.getState().loadError;
    expect(err?.kind).toBe('corrupt');
    expect(err?.canRecover).toBe(false);
  });

  it('transparently recovers from backup when primary JSON is corrupted', () => {
    vi.useFakeTimers();
    __resetAutosaveSchedulerForTests();
    useGameStore.getState().resetGame();
    const goodRaw = makeMinimalSave();
    // Primary is garbage; backup holds a valid save.
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), 'corrupt{');
    localStorage.setItem(STORAGE_KEYS.saveSlotBackup(SLOT), goodRaw);
    const ok = useGameStore.getState().loadGame(SLOT);
    expect(ok).toBe(true);
    expect(useGameStore.getState().loadError).toBeNull();
    // Backup promoted to primary; the backup key itself is dropped by
    // promoteSaveBackup() to avoid holding two identical copies.
    expect(readSaveSlot(SLOT)).toBe(goodRaw);
  });

  it('refuses a save written by a newer app version', () => {
    const futureSave = JSON.stringify({
      version: CURRENT_VERSION + 5,
      playerClubId: 'c1',
      clubs: { c1: {} },
      season: 1,
      week: 1,
    });
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), futureSave);
    const ok = useGameStore.getState().loadGame(SLOT);
    expect(ok).toBe(false);
    const err = useGameStore.getState().loadError;
    expect(err?.kind).toBe('newer_version');
    expect(err?.saveVersion).toBe(CURRENT_VERSION + 5);
  });

  it('rejects a save whose shape is missing required fields (validation_failed)', () => {
    // Parseable, current version, but missing `clubs`.
    const malformed = JSON.stringify({
      version: CURRENT_VERSION,
      playerClubId: 'c1',
      season: 1,
      week: 1,
    });
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), malformed);
    const ok = useGameStore.getState().loadGame(SLOT);
    expect(ok).toBe(false);
    expect(useGameStore.getState().loadError?.kind).toBe('validation_failed');
  });

  it('clearLoadError() wipes the banner', () => {
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), 'not-json');
    useGameStore.getState().loadGame(SLOT);
    expect(useGameStore.getState().loadError).not.toBeNull();
    useGameStore.getState().clearLoadError();
    expect(useGameStore.getState().loadError).toBeNull();
  });
});

describe('attemptSaveRecovery', () => {
  beforeEach(() => { clearAllSaveStorage(); });

  it('loads from the backup slot when user opts to recover', () => {
    vi.useFakeTimers();
    __resetAutosaveSchedulerForTests();
    useGameStore.getState().resetGame();
    const goodRaw = makeMinimalSave();
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), 'corrupt{');
    localStorage.setItem(STORAGE_KEYS.saveSlotBackup(SLOT), goodRaw);

    // Exercise attemptSaveRecovery directly. In practice loadGame would
    // have surfaced the loadError that prompted the user to click "Try
    // Recovery"; we skip straight to the recovery action.
    const ok = useGameStore.getState().attemptSaveRecovery(SLOT);
    expect(ok).toBe(true);
    expect(useGameStore.getState().loadError).toBeNull();
    expect(readSaveSlot(SLOT)).toBe(goodRaw);
  });

  it('sets loadError corrupt when no backup exists', () => {
    localStorage.setItem(STORAGE_KEYS.saveSlot(SLOT), 'not-json{{{');
    useGameStore.getState().loadGame(SLOT); // fills loadError with corrupt
    useGameStore.getState().clearLoadError();
    // Now call recovery — no backup to draw from.
    const ok = useGameStore.getState().attemptSaveRecovery(SLOT);
    expect(ok).toBe(false);
    const err = useGameStore.getState().loadError;
    expect(err?.kind).toBe('corrupt');
    expect(err?.canRecover).toBe(false);
  });
});

describe('saveGame/loadGame — previously-unsaved fields (v68 fix)', () => {
  beforeEach(() => { clearAllSaveStorage(); });

  it('round-trips the 13 fields that were silently dropped before v68', () => {
    vi.useFakeTimers();
    __resetAutosaveSchedulerForTests();
    useGameStore.getState().initGame('celtic');

    useGameStore.setState({
      seasonTotalExpenses: 4_850_000,
      seasonTotalIncome: 12_300_000,
      seasonStartAvgOVR: 71,
      seasonTransfersBought: [{ playerName: 'Test In', fee: 5_000_000 }],
      seasonTransfersSold: [{ playerName: 'Test Out', fee: 7_000_000 }],
      contractStrikes: { 'p-1': { strikes: 2 } },
      tacticalPresets: [{ id: 'p1', name: 'Press hard' } as never],
      transferFilters: { ...useGameStore.getState().transferFilters, sortBy: 'price', hideUnaffordable: true },
      pendingGemReveal: { playerId: 'p-gem', region: 'eng' },
      clubPowerRankings: { celtic: 1850, rangers: 1700 },
      communityPackEnabled: true,
    });

    useGameStore.getState().saveGame(SLOT);
    vi.runAllTimers();
    useGameStore.getState().flushSave();

    // Wipe in-memory state so we know the post-load values came from disk,
    // not the still-resident pre-save state.
    useGameStore.setState({
      seasonTotalExpenses: 0,
      seasonTotalIncome: 0,
      seasonStartAvgOVR: 0,
      seasonTransfersBought: [],
      seasonTransfersSold: [],
      contractStrikes: {},
      tacticalPresets: [],
      transferFilters: { ...useGameStore.getState().transferFilters, sortBy: 'overall', hideUnaffordable: false },
      pendingGemReveal: null,
      clubPowerRankings: {},
      communityPackEnabled: false,
    });

    useGameStore.getState().loadGame(SLOT);
    const after = useGameStore.getState();
    expect(after.seasonTotalExpenses).toBe(4_850_000);
    expect(after.seasonTotalIncome).toBe(12_300_000);
    expect(after.seasonStartAvgOVR).toBe(71);
    expect(after.seasonTransfersBought).toEqual([{ playerName: 'Test In', fee: 5_000_000 }]);
    expect(after.seasonTransfersSold).toEqual([{ playerName: 'Test Out', fee: 7_000_000 }]);
    expect(after.contractStrikes['p-1']?.strikes).toBe(2);
    expect(after.tacticalPresets).toHaveLength(1);
    expect(after.transferFilters.sortBy).toBe('price');
    expect(after.transferFilters.hideUnaffordable).toBe(true);
    expect(after.pendingGemReveal).toEqual({ playerId: 'p-gem', region: 'eng' });
    expect(after.clubPowerRankings.celtic).toBe(1850);
    expect(after.communityPackEnabled).toBe(true);

    vi.useRealTimers();
  });
});

describe('saveGame/loadGame — Invincible pre-match snapshot (G6)', () => {
  beforeEach(() => { clearAllSaveStorage(); });

  it('writes preMatchSnapshot into the payload and restores it on load', () => {
    vi.useFakeTimers();
    __resetAutosaveSchedulerForTests();
    useGameStore.getState().initGame('celtic');

    const pid = useGameStore.getState().playerClubId;
    const foreignMatch = { id: 'ai', week: 1, homeClubId: 'x', awayClubId: 'y', played: true, homeGoals: 1, awayGoals: 0, events: [{ minute: 10, type: 'goal' }] };
    const ownMatch = { id: 'me', week: 1, homeClubId: pid, awayClubId: 'z', played: true, homeGoals: 2, awayGoals: 2, events: [{ minute: 5, type: 'goal' }] };

    useGameStore.setState({
      // Minimal but structurally-complete snapshot — only the fields the save
      // path reads (fixtures/divisionFixtures) need real data here.
      preMatchSnapshot: {
        fixtures: [foreignMatch, ownMatch] as never,
        divisionFixtures: { eng: [foreignMatch, ownMatch] } as never,
        divisionTables: {},
        players: {},
        boardConfidence: 55,
        leagueTable: [],
      },
    });

    useGameStore.getState().saveGame(SLOT);
    vi.runAllTimers();
    useGameStore.getState().flushSave();

    // The persisted payload must include the snapshot...
    const raw = readSaveSlot(SLOT);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.preMatchSnapshot).toBeTruthy();
    expect(parsed.preMatchSnapshot.boardConfidence).toBe(55);

    // ...with the AI-vs-AI fixture's events stripped (trimmed like the main
    // payload) but the player's own fixture events kept for review.
    const savedForeign = parsed.preMatchSnapshot.fixtures.find((m: { id: string }) => m.id === 'ai');
    const savedOwn = parsed.preMatchSnapshot.fixtures.find((m: { id: string }) => m.id === 'me');
    expect(savedForeign.events).toBeUndefined();
    expect(savedOwn.events).toHaveLength(1);

    // Wipe the live snapshot, then confirm load restores it from disk.
    useGameStore.setState({ preMatchSnapshot: null });
    useGameStore.getState().loadGame(SLOT);
    const after = useGameStore.getState();
    expect(after.preMatchSnapshot).toBeTruthy();
    expect(after.preMatchSnapshot!.boardConfidence).toBe(55);

    vi.useRealTimers();
  });
});

describe('loadGame — purchases survive in BOTH directions', () => {
  beforeEach(() => { clearAllSaveStorage(); });

  const liveSub = () => ({
    tier: 'monthly' as const,
    productId: 'com.dynastymanager.pro.monthly' as const,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    isInGracePeriod: false,
    willRenew: true,
  });

  /**
   * Direction 1 — live is ahead of the save. The user buys Pro, then loads a
   * slot written before the purchase. Taking the save's block would revoke Pro
   * from a paying customer.
   */
  it('keeps a live purchase when loading a slot saved before it', () => {
    vi.useFakeTimers();
    __resetAutosaveSchedulerForTests();
    useGameStore.getState().initGame('celtic');

    useGameStore.setState({
      monetization: {
        ...useGameStore.getState().monetization,
        entitlements: [], subscription: null, firstLaunchTimestamp: 1_000,
      },
    });
    useGameStore.getState().saveGame(SLOT);
    vi.runAllTimers();
    useGameStore.getState().flushSave();

    const sub = liveSub();
    useGameStore.setState({
      monetization: {
        ...useGameStore.getState().monetization,
        entitlements: ['com.dynastymanager.pro'], subscription: sub, firstLaunchTimestamp: 2_000,
      },
    });
    expect(isPro(useGameStore.getState().monetization)).toBe(true);

    useGameStore.getState().loadGame(SLOT);

    const after = useGameStore.getState().monetization;
    expect(after.entitlements).toContain('com.dynastymanager.pro');
    expect(after.subscription).toEqual(sub);
    expect(isPro(after)).toBe(true);
    vi.useRealTimers();
  });

  /**
   * Direction 2 — the SAVE is ahead of live, which is the cold-launch case and
   * the more common one. loadGame runs from TitleScreen while the store still
   * holds DEFAULT_MONETIZATION_STATE (GameShell's RevenueCat sync only runs
   * after navigation), so pinning to live state would wipe the purchase record
   * and the next autosave would persist that loss to disk.
   */
  it('keeps a saved purchase when live state is still un-hydrated (cold launch)', () => {
    vi.useFakeTimers();
    __resetAutosaveSchedulerForTests();
    useGameStore.getState().initGame('celtic');

    const sub = liveSub();
    useGameStore.setState({
      monetization: {
        ...useGameStore.getState().monetization,
        entitlements: ['com.dynastymanager.pro'], subscription: sub, firstLaunchTimestamp: 1_000,
      },
    });
    useGameStore.getState().saveGame(SLOT);
    vi.runAllTimers();
    useGameStore.getState().flushSave();

    // Simulate a cold launch: the store is back to defaults, nothing synced yet.
    useGameStore.setState({
      monetization: { ...DEFAULT_MONETIZATION_STATE, entitlements: [], subscription: null, firstLaunchTimestamp: 0 },
    });
    expect(isPro(useGameStore.getState().monetization)).toBe(false);

    useGameStore.getState().loadGame(SLOT);

    const after = useGameStore.getState().monetization;
    expect(after.entitlements).toContain('com.dynastymanager.pro');
    expect(after.subscription).toEqual(sub);
    expect(isPro(after)).toBe(true);
    // The Starter Kit window must measure from genuine first launch, not re-arm.
    expect(after.firstLaunchTimestamp).toBe(1_000);
    vi.useRealTimers();
  });

  it('still restores slot-scoped monetization progress from the save', () => {
    vi.useFakeTimers();
    __resetAutosaveSchedulerForTests();
    useGameStore.getState().initGame('celtic');

    useGameStore.setState({
      monetization: {
        ...useGameStore.getState().monetization,
        activeCosmetics: { stadium_theme: 'floodlit' },
        adRewardsClaimed: { transfer_budget: 3 },
        starterKitDismissed: true,
      },
    });
    useGameStore.getState().saveGame(SLOT);
    vi.runAllTimers();
    useGameStore.getState().flushSave();

    useGameStore.setState({
      monetization: {
        ...useGameStore.getState().monetization,
        activeCosmetics: {}, adRewardsClaimed: {}, starterKitDismissed: false,
      },
    });

    useGameStore.getState().loadGame(SLOT);

    const after = useGameStore.getState().monetization;
    expect(after.activeCosmetics).toEqual({ stadium_theme: 'floodlit' });
    expect(after.adRewardsClaimed).toEqual({ transfer_budget: 3 });
    expect(after.starterKitDismissed).toBe(true);
    vi.useRealTimers();
  });
});

describe('device-scoped purchase record', () => {
  beforeEach(() => { clearAllSaveStorage(); });

  /**
   * Purchases belong to the device, not to a save slot. Before this record
   * existed, the only durable copy lived inside the slot — so "New Game", and
   * anything else that does not load a slot, started with no Pro until a
   * RevenueCat sync landed after navigation.
   */
  it('mirrors entitlements, subscription and first-launch stamp on every mutation', () => {
    useGameStore.setState({ monetization: { ...DEFAULT_MONETIZATION_STATE } });

    useGameStore.getState().grantEntitlement('com.dynastymanager.pro');
    expect(readDeviceEntitlements()?.entitlements).toContain('com.dynastymanager.pro');

    const sub = {
      tier: 'annual' as const,
      productId: 'com.dynastymanager.pro.annual' as const,
      expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      isInGracePeriod: false,
      willRenew: true,
    };
    useGameStore.getState().updateSubscription(sub);
    expect(readDeviceEntitlements()?.subscription).toEqual(sub);

    useGameStore.getState().initMonetizationTimestamp();
    expect(readDeviceEntitlements()!.firstLaunchTimestamp).toBeGreaterThan(0);
  });

  it('expands a bundle into the device record, without persisting banned SKUs', () => {
    useGameStore.setState({ monetization: { ...DEFAULT_MONETIZATION_STATE } });
    useGameStore.getState().grantEntitlement('com.dynastymanager.bundle.all');

    const stored = readDeviceEntitlements()!.entitlements;
    expect(stored).toContain('com.dynastymanager.bundle.all');
    // The bundle's Pro component is Lifetime — `com.dynastymanager.pro` is
    // retired and no longer produced by any grant path.
    expect(stored).toContain('com.dynastymanager.pro.lifetime');
    expect(stored).toContain('com.dynastymanager.pack.manager');
    // Subscription and consumable SKUs must never reach the record.
    expect(stored).not.toContain('com.dynastymanager.pro.monthly');
    expect(stored).not.toContain('com.dynastymanager.pack.gold');
  });

  it('clears the record when dev-tools resets entitlements', () => {
    useGameStore.setState({ monetization: { ...DEFAULT_MONETIZATION_STATE } });
    useGameStore.getState().grantEntitlement('com.dynastymanager.pro');
    expect(readDeviceEntitlements()?.entitlements.length).toBeGreaterThan(0);

    // Without this, the next launch would re-hydrate exactly what was wiped.
    useGameStore.getState().resetEntitlementsForTesting();
    expect(readDeviceEntitlements()?.entitlements).toEqual([]);
  });

  it('tolerates a corrupt record rather than throwing at launch', () => {
    localStorage.setItem(STORAGE_KEYS.DEVICE_ENTITLEMENTS, 'not-json{{{');
    expect(readDeviceEntitlements()).toBeNull();

    localStorage.setItem(STORAGE_KEYS.DEVICE_ENTITLEMENTS, JSON.stringify({ entitlements: 'nope' }));
    const r = readDeviceEntitlements();
    expect(r?.entitlements).toEqual([]);
    expect(r?.firstLaunchTimestamp).toBe(0);
  });
});
