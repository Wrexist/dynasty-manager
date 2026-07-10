import { describe, it, expect } from 'vitest';
import { migrateSaveData, CURRENT_VERSION } from '@/utils/saveMigration';

describe('saveMigration', () => {
  it('should have current version set to 73', () => {
    expect(CURRENT_VERSION).toBe(73);
  });

  it('v69 → v70 backfills settings.performanceMode (default off)', () => {
    const v69: Record<string, unknown> = { version: 69, settings: { reducedMotion: true } };
    const migrated = migrateSaveData(v69) as { version: number; settings: Record<string, unknown> };
    expect(migrated.version).toBe(73);
    expect(migrated.settings.performanceMode).toBe(false);
    expect(migrated.settings.reducedMotion).toBe(true);
  });

  it('v70 → v71 marks already-completed objectives as claimed (no double-pay)', () => {
    const v70: Record<string, unknown> = {
      version: 70,
      weeklyObjectives: [
        { objectiveId: 'a', completed: true },
        { objectiveId: 'b', completed: false },
      ],
    };
    const migrated = migrateSaveData(v70) as { version: number; weeklyObjectives: Array<Record<string, unknown>> };
    expect(migrated.version).toBe(73);
    expect(migrated.weeklyObjectives[0].claimed).toBe(true);
    expect(migrated.weeklyObjectives[1].claimed).toBe(false);
  });

  it('v68 → v69 is a clean version bump (negotiation field is optional)', () => {
    const v68: Record<string, unknown> = { version: 68, sponsorOffers: [{ id: 'o1' }] };
    const result = migrateSaveData(v68);
    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.sponsorOffers).toEqual([{ id: 'o1' }]);
  });

  it('v67 → v68 backfills the 13 previously-unsaved GameState fields', () => {
    const v67: Record<string, unknown> = { version: 67, playerClubId: 'celtic' };
    const out = migrateSaveData(v67) as Record<string, unknown>;
    expect(out.version).toBe(CURRENT_VERSION);
    expect(out.contractStrikes).toEqual({});
    expect(out.tacticalPresets).toEqual([]);
    expect(out.transferFilters).toMatchObject({ tab: 'market', sortBy: 'overall' });
    expect(out.pendingGemReveal).toBeNull();
    expect(out.pendingTransferTalk).toBeNull();
    expect(out.seasonStartAvgOVR).toBe(0);
    expect(out.seasonTransfersBought).toEqual([]);
    expect(out.seasonTransfersSold).toEqual([]);
    expect(out.seasonTotalIncome).toBe(0);
    expect(out.seasonTotalExpenses).toBe(0);
    expect(out.clubPowerRankings).toEqual({});
    expect(out.communityPackEnabled).toBe(false);
    expect(out.cpPool).toMatchObject({ cursor: 0, usedFcIds: [] });
  });

  it('v67 → v68 preserves real values when fields are already populated', () => {
    const v67: Record<string, unknown> = {
      version: 67,
      playerClubId: 'celtic',
      seasonTotalExpenses: 4_850_000,
      seasonTotalIncome: 12_000_000,
      communityPackEnabled: true,
      tacticalPresets: [{ id: 'p1', name: 'Press hard' }],
      contractStrikes: { 'player-1': { strikes: 1 } },
    };
    const out = migrateSaveData(v67) as Record<string, unknown>;
    expect(out.seasonTotalExpenses).toBe(4_850_000);
    expect(out.seasonTotalIncome).toBe(12_000_000);
    expect(out.communityPackEnabled).toBe(true);
    expect(out.tacticalPresets).toEqual([{ id: 'p1', name: 'Press hard' }]);
    expect(out.contractStrikes).toEqual({ 'player-1': { strikes: 1 } });
  });

  it('v57 → v59 chains cleanly with a realistic halfTimeState payload', () => {
    // A save taken mid-match under v57 would still carry the legacy Set
    // serialization in halfTimeState. Chain through v57→v58→v59 and confirm
    // the final state has a plain array *and* other half-time fields survive.
    const v57: Record<string, unknown> = {
      version: 57,
      halfTimeState: {
        homeGoals: 1,
        awayGoals: 0,
        events: [{ minute: 22, type: 'goal', clubId: 'foo', description: 'Goal!' }],
        usedCommentaryLines: {},
      },
    };
    const out = migrateSaveData(v57) as Record<string, unknown>;
    expect(out.version).toBe(CURRENT_VERSION);
    const half = out.halfTimeState as Record<string, unknown>;
    expect(Array.isArray(half.usedCommentaryLines)).toBe(true);
    expect(half.homeGoals).toBe(1);
    expect(Array.isArray(half.events)).toBe(true);
  });

  it('v58 → v59 survives corrupt halfTimeState shapes', () => {
    // Defensive: a save where halfTimeState is a string / number / array
    // should not crash the migration — it should skip normalization.
    const cases: unknown[] = ['corrupt', 42, [], null];
    for (const bad of cases) {
      const data: Record<string, unknown> = { version: 58, halfTimeState: bad };
      expect(() => migrateSaveData(data)).not.toThrow();
      const out = migrateSaveData(data) as Record<string, unknown>;
      expect(out.version).toBe(CURRENT_VERSION);
    }
  });

  it('v58 → v59 normalizes halfTimeState.usedCommentaryLines to an array', () => {
    // A Set<string> written via JSON.stringify serialized to `{}`. The new
    // schema is a plain string[]; legacy saves must self-heal on load.
    const v58LegacySet: Record<string, unknown> = {
      version: 58,
      halfTimeState: { usedCommentaryLines: {} },
    };
    const healed = migrateSaveData(v58LegacySet) as Record<string, unknown>;
    const half = healed.halfTimeState as { usedCommentaryLines: unknown };
    expect(Array.isArray(half.usedCommentaryLines)).toBe(true);
    expect((half.usedCommentaryLines as unknown[]).length).toBe(0);

    // A save that already uses string[] passes through intact.
    const v58AlreadyArray: Record<string, unknown> = {
      version: 58,
      halfTimeState: { usedCommentaryLines: ['pressure on the ball!'] },
    };
    const passthru = migrateSaveData(v58AlreadyArray) as Record<string, unknown>;
    const passHalf = passthru.halfTimeState as { usedCommentaryLines: unknown };
    expect(passHalf.usedCommentaryLines).toEqual(['pressure on the ball!']);

    // A save with no halfTimeState (no match in flight) skips normalization.
    const v58NoMatch: Record<string, unknown> = { version: 58 };
    const skipped = migrateSaveData(v58NoMatch) as Record<string, unknown>;
    expect(skipped.halfTimeState).toBeUndefined();
  });

  it('should migrate v1 data to current version', () => {
    const v1Data: Record<string, unknown> = { version: 1, name: 'test' };
    const result = migrateSaveData(v1Data);
    expect(result.version).toBe(CURRENT_VERSION);
  });

  it('v56 → v57 defaults the four pack fields', () => {
    // Direct migration test: a v56 save with no pack fields should pick up
    // empty defaults so the slice's `(state.field || ...)` guards still
    // work and the cooldown / pity counter start from zero.
    const v56Data: Record<string, unknown> = { version: 56 };
    const result = migrateSaveData(v56Data) as Record<string, unknown>;
    // Migration may chain past v57 if newer migrations exist later; what we
    // care about is the v57-introduced fields landed correctly.
    expect(result.openedPacks).toEqual([]);
    expect(result.packPityCounter).toBe(0);
    expect(result.lastPackWeek).toBe(0);
    expect(result.lastPackSeason).toBe(0);
  });

  it('v56 → v57 preserves existing pack fields when present', () => {
    const v56Data: Record<string, unknown> = {
      version: 56,
      openedPacks: [{ id: 'x', tier: 'bronze', season: 2, week: 5, timestamp: 0, playerIds: ['p1'], topOvr: 65 }],
      packPityCounter: 4,
      lastPackWeek: 5,
      lastPackSeason: 2,
    };
    const result = migrateSaveData(v56Data) as Record<string, unknown>;
    expect(Array.isArray(result.openedPacks)).toBe(true);
    expect((result.openedPacks as unknown[]).length).toBe(1);
    expect(result.packPityCounter).toBe(4);
    expect(result.lastPackWeek).toBe(5);
    expect(result.lastPackSeason).toBe(2);
  });

  it('v62 → v63 seeds an empty adPackOpens bucket for the new daily-limit gate', () => {
    const v62Data: Record<string, unknown> = { version: 62 };
    const result = migrateSaveData(v62Data) as Record<string, unknown>;
    expect(result.adPackOpens).toEqual({ date: '', counts: {} });
  });

  it('v62 → v63 preserves an existing adPackOpens bucket', () => {
    const existing = { date: '2026-04-26', counts: { bronze: 2 } };
    const v62Data: Record<string, unknown> = { version: 62, adPackOpens: existing };
    const result = migrateSaveData(v62Data) as Record<string, unknown>;
    // v62→v63 keeps the bucket; v63→v64 then converts it into the new
    // dailyPackOpens shape, preserving the ad counts and starting free at 0.
    expect(result.dailyPackOpens).toEqual({
      date: '2026-04-26',
      free: {},
      ad: { bronze: 2 },
    });
  });

  it('v63 → v64 converts adPackOpens into dailyPackOpens with free + ad buckets', () => {
    const v63Data: Record<string, unknown> = {
      version: 63,
      adPackOpens: { date: '2026-04-26', counts: { bronze: 2, silver: 1 } },
    };
    const result = migrateSaveData(v63Data) as Record<string, unknown>;
    expect(result.dailyPackOpens).toEqual({
      date: '2026-04-26',
      free: {},
      ad: { bronze: 2, silver: 1 },
    });
  });

  it('v63 → v64 falls back to empty buckets when adPackOpens is missing', () => {
    const v63Data: Record<string, unknown> = { version: 63 };
    const result = migrateSaveData(v63Data) as Record<string, unknown>;
    expect(result.dailyPackOpens).toEqual({ date: '', free: {}, ad: {} });
  });

  it('v66 → v67 backfills rarity tier on every player', () => {
    const v66Data: Record<string, unknown> = {
      version: 66,
      players: {
        legend: { id: 'legend', overall: 95, value: 100_000_000, wage: 400_000, ballonDOrPlacements: [] },
        icon: { id: 'icon', overall: 89, value: 80_000_000, wage: 250_000, ballonDOrPlacements: [] },
        squad: { id: 'squad', overall: 70, value: 5_000_000, wage: 50_000, ballonDOrPlacements: [] },
      },
    };
    const result = migrateSaveData(v66Data) as Record<string, unknown>;
    const players = result.players as Record<string, { rarity: string; value: number; wage: number }>;
    expect(players.legend.rarity).toBe('legend');
    expect(players.icon.rarity).toBe('icon');
    expect(players.squad.rarity).toBe('common');
    // Legends/icons get value+wage inflated by the rarity multiplier; common is untouched.
    expect(players.legend.value).toBeGreaterThan(100_000_000);
    expect(players.icon.value).toBeGreaterThan(80_000_000);
    expect(players.legend.wage).toBeGreaterThan(400_000);
    expect(players.icon.wage).toBeGreaterThan(250_000);
    expect(players.squad.value).toBe(5_000_000);
    expect(players.squad.wage).toBe(50_000);
  });

  it('v66 → v67 leaves saves without a players map untouched', () => {
    const v66Data: Record<string, unknown> = { version: 66 };
    const result = migrateSaveData(v66Data) as Record<string, unknown>;
    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.players).toBeUndefined();
  });

  it('should perform clean break at v22→v23 (European leagues expansion)', () => {
    const v22Data: Record<string, unknown> = {
      version: 22,
      playerClubId: 'crown-city',
      season: 5,
      clubs: { 'crown-city': { id: 'crown-city' } },
      playerDivision: 'div-1',
    };
    const result = migrateSaveData(v22Data);
    expect(result.version).toBe(CURRENT_VERSION);
    // Clean break: game state is reset
    expect(result.gameStarted).toBe(false);
    expect(result.playerClubId).toBe('');
    expect(result.playerDivision).toBe('eng');
  });

  it('should survive a corrupted migration step gracefully', () => {
    const corruptData: Record<string, unknown> = { version: 1 };
    const result = migrateSaveData(corruptData);
    expect(result.version).toBe(CURRENT_VERSION);
  });

  it('should not modify data already at current version', () => {
    const current: Record<string, unknown> = { version: CURRENT_VERSION, foo: 'bar' };
    const result = migrateSaveData(current);
    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.foo).toBe('bar');
  });

  it('should reset old saves from pre-v22 through clean break', () => {
    const v1Data: Record<string, unknown> = { version: 1, playerClubId: 'abc', season: 3 };
    const result = migrateSaveData(v1Data);
    // After v22→v23 clean break, old data is wiped
    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.gameStarted).toBe(false);
  });

  it('v61 → v62 expands abbreviated firstName fields on saved players', () => {
    const v61: Record<string, unknown> = {
      version: 61,
      players: {
        p1: { id: 'p1', firstName: 'E.', lastName: 'Haaland', nationality: 'Norway' },
        p2: { id: 'p2', firstName: 'L.', lastName: 'Martínez', nationality: 'Argentina' },
        p3: { id: 'p3', firstName: 'Erling', lastName: 'Solo', nationality: 'Norway' },
        p4: { id: 'p4', firstName: 'A. Van', lastName: 'Berg', nationality: 'Netherlands' },
      },
    };
    const result = migrateSaveData(v61) as Record<string, unknown>;
    const players = result.players as Record<string, { firstName: string }>;
    expect(players.p1.firstName).not.toBe('E.');
    expect(players.p1.firstName.startsWith('E')).toBe(true);
    expect(players.p2.firstName.startsWith('L')).toBe(true);
    expect(players.p3.firstName).toBe('Erling'); // unchanged
    expect(players.p4.firstName.endsWith(' Van')).toBe(true);
  });

  it('v61 → v62 leaves saves without a players map untouched', () => {
    const v61: Record<string, unknown> = { version: 61 };
    expect(() => migrateSaveData(v61)).not.toThrow();
    const result = migrateSaveData(v61) as Record<string, unknown>;
    expect(result.version).toBe(CURRENT_VERSION);
  });

  // ─── Targeted v59 → v67 step coverage ─────────────────────────────────
  // Each test starts at the version BEFORE the schema change and asserts
  // the specific field added/transformed by that step survives the chain
  // up to CURRENT_VERSION. Catches schema regressions when CURRENT_VERSION
  // bumps without a corresponding migration step.

  it('v59 → v60 seeds communityPackEnabled and cpPool defaults', () => {
    const v59: Record<string, unknown> = { version: 59 };
    const out = migrateSaveData(v59) as Record<string, unknown>;
    expect(out.communityPackEnabled).toBe(false);
    const cp = out.cpPool as Record<string, unknown>;
    expect(cp).toBeDefined();
    expect(cp.shuffleSeed).toBe(0);
    expect(cp.cursor).toBe(0);
    expect(Array.isArray(cp.usedFcIds)).toBe(true);
    expect(Array.isArray(cp.marketListings)).toBe(true);
    expect(cp.lastMarketRefreshWeek).toBe(0);
  });

  it('v59 → v60 preserves an existing cpPool if already present', () => {
    const v59: Record<string, unknown> = {
      version: 59,
      cpPool: { shuffleSeed: 42, cursor: 7, usedFcIds: ['x'], marketListings: ['y'], lastMarketRefreshWeek: 12 },
      communityPackEnabled: true,
    };
    const out = migrateSaveData(v59) as Record<string, unknown>;
    expect(out.communityPackEnabled).toBe(true);
    const cp = out.cpPool as Record<string, unknown>;
    expect(cp.shuffleSeed).toBe(42);
    expect(cp.cursor).toBe(7);
    expect(cp.usedFcIds).toEqual(['x']);
  });

  it('v60 → v61 adds cpPool.lastSeedSeason = 99 for old saves', () => {
    // Default 99 means "treat in-progress saves as past the seed window"
    // so we don't retro-inject FAs into mid-game state.
    const v60: Record<string, unknown> = {
      version: 60,
      cpPool: { shuffleSeed: 0, cursor: 0, usedFcIds: [], marketListings: [], lastMarketRefreshWeek: 0 },
    };
    const out = migrateSaveData(v60) as Record<string, unknown>;
    const cp = out.cpPool as Record<string, unknown>;
    expect(cp.lastSeedSeason).toBe(99);
  });

  it('v60 → v61 preserves an existing lastSeedSeason value', () => {
    const v60: Record<string, unknown> = {
      version: 60,
      cpPool: { shuffleSeed: 0, cursor: 0, usedFcIds: [], marketListings: [], lastMarketRefreshWeek: 0, lastSeedSeason: 3 },
    };
    const out = migrateSaveData(v60) as Record<string, unknown>;
    const cp = out.cpPool as Record<string, unknown>;
    expect(cp.lastSeedSeason).toBe(3);
  });

  it('v62 → v63 backfills adPackOpens with empty bucket', () => {
    const v62: Record<string, unknown> = { version: 62 };
    const out = migrateSaveData(v62) as Record<string, unknown>;
    const ap = out.adPackOpens as Record<string, unknown>;
    expect(ap).toBeDefined();
    expect(ap.date).toBe('');
    expect(ap.counts).toEqual({});
  });

  it('v63 → v64 carries old adPackOpens.counts into dailyPackOpens.ad', () => {
    const v63: Record<string, unknown> = {
      version: 63,
      adPackOpens: { date: '2026-04-29', counts: { bronze: 2, silver: 1 } },
    };
    const out = migrateSaveData(v63) as Record<string, unknown>;
    const dp = out.dailyPackOpens as Record<string, unknown>;
    expect(dp.date).toBe('2026-04-29');
    expect(dp.ad).toEqual({ bronze: 2, silver: 1 });
    expect(dp.free).toEqual({}); // fresh bucket so today's free pack is available
  });

  it('v63 → v64 falls back gracefully when adPackOpens is missing', () => {
    const v63: Record<string, unknown> = { version: 63 };
    const out = migrateSaveData(v63) as Record<string, unknown>;
    const dp = out.dailyPackOpens as Record<string, unknown>;
    expect(dp.date).toBe('');
    expect(dp.free).toEqual({});
    expect(dp.ad).toEqual({});
  });

  it('v64 → v65 recomputes nationalTeam.fifaRanking from canonical NATIONS data', () => {
    // The pre-fix bug hardcoded fifaRanking to 25 on init for every nation;
    // v64→v65 backfills from NATIONS[].baseRanking. France should NOT remain
    // at the bogus 25 — the migration writes whatever NATIONS has.
    const v64: Record<string, unknown> = {
      version: 64,
      nationalTeam: { nationality: 'France', fifaRanking: 25, squad: [], lineup: [], subs: [], formation: '4-3-3', caps: {}, internationalGoals: {}, results: [], poolPlayerIds: [] },
    };
    const out = migrateSaveData(v64) as Record<string, unknown>;
    const nt = out.nationalTeam as { nationality: string; fifaRanking: number };
    expect(nt.nationality).toBe('France');
    // Whatever ranking NATIONS carries for France, it should not be 25 (the bug).
    expect(nt.fifaRanking).not.toBe(25);
    expect(typeof nt.fifaRanking).toBe('number');
  });

  it('v64 → v65 marks pre-existing tournaments as squadConfirmed', () => {
    const v64: Record<string, unknown> = {
      version: 64,
      internationalTournament: { type: 'world-cup', season: 1, groups: [], knockoutTies: [] },
    };
    const out = migrateSaveData(v64) as Record<string, unknown>;
    const tourney = out.internationalTournament as { squadConfirmed?: boolean };
    expect(tourney.squadConfirmed).toBe(true);
  });

  it('v64 → v65 leaves squadConfirmed alone when already set', () => {
    const v64: Record<string, unknown> = {
      version: 64,
      internationalTournament: { type: 'continental', season: 2, squadConfirmed: false, groups: [], knockoutTies: [] },
    };
    const out = migrateSaveData(v64) as Record<string, unknown>;
    const tourney = out.internationalTournament as { squadConfirmed: boolean };
    expect(tourney.squadConfirmed).toBe(false);
  });

  it('v65 → v66 backfills staff member fields with sane defaults', () => {
    const v65: Record<string, unknown> = {
      version: 65,
      staff: {
        members: [
          { id: 's1', firstName: 'Alex', lastName: 'Coach', role: 'head-coach', quality: 80, wage: 5000 },
        ],
        availableHires: [],
      },
    };
    const out = migrateSaveData(v65) as Record<string, unknown>;
    const staff = out.staff as { members: Array<Record<string, unknown>> };
    const m = staff.members[0];
    expect(m.morale).toBe(70);
    expect(m.traits).toEqual([]);
    expect(m.contractYearsRemaining).toBe(2);
    expect(m.seasonsAtClub).toBe(0);
    expect(m.performance).toBeDefined();
  });

  it('v65 → v66 adds youthAcademy.spotlightUsesRemaining default', () => {
    const v65: Record<string, unknown> = {
      version: 65,
      youthAcademy: { prospects: [], nextIntakePreview: [], youthPreviewEnhanced: false },
    };
    const out = migrateSaveData(v65) as Record<string, unknown>;
    const ya = out.youthAcademy as Record<string, unknown>;
    expect(ya.spotlightUsesRemaining).toBe(2);
  });

  it('v65 → v66 backfills merchandise signature-drop fields when merchandise exists', () => {
    const v65: Record<string, unknown> = {
      version: 65,
      merchandise: { strategy: 'balanced' },
    };
    const out = migrateSaveData(v65) as Record<string, unknown>;
    const merch = out.merchandise as Record<string, unknown>;
    expect(merch.signatureDrop).toBeNull();
    expect(merch.signatureDropCooldownWeeks).toBe(0);
    expect(merch.winStreak).toBe(0);
    expect(merch.derbyBuzzWeeks).toBe(0);
  });

  it('v66 → v67 stamps every player with a rarity field', () => {
    const v66: Record<string, unknown> = {
      version: 66,
      players: {
        p1: { id: 'p1', firstName: 'A', lastName: 'B', overall: 92, age: 28, value: 100_000_000, wage: 500_000, ballonDOrPlacements: [{ season: 1, rank: 1, score: 999 }] },
        p2: { id: 'p2', firstName: 'C', lastName: 'D', overall: 65, age: 21, value: 1_000_000, wage: 5_000, ballonDOrPlacements: [] },
      },
    };
    const out = migrateSaveData(v66) as Record<string, unknown>;
    const players = out.players as Record<string, { rarity?: string; value?: number; wage?: number }>;
    expect(players.p1.rarity).toBeDefined();
    expect(typeof players.p1.rarity).toBe('string');
    expect(players.p2.rarity).toBeDefined();
  });

  it('v66 → v67 only inflates value/wage by rarity multiplier — never deflates', () => {
    // Bronze-tier players have multiplier <= 1; the migration explicitly
    // skips that branch so tweaked saves don't lose money.
    const v66: Record<string, unknown> = {
      version: 66,
      players: {
        bronze: { id: 'bronze', firstName: 'L', lastName: 'M', overall: 55, age: 30, value: 500_000, wage: 2_000, ballonDOrPlacements: [] },
      },
    };
    const out = migrateSaveData(v66) as Record<string, unknown>;
    const players = out.players as Record<string, { value: number; wage: number }>;
    expect(players.bronze.value).toBeGreaterThanOrEqual(500_000);
    expect(players.bronze.wage).toBeGreaterThanOrEqual(2_000);
  });

  it('v66 → v67 leaves saves without players untouched', () => {
    const v66: Record<string, unknown> = { version: 66 };
    expect(() => migrateSaveData(v66)).not.toThrow();
    const out = migrateSaveData(v66) as Record<string, unknown>;
    expect(out.version).toBe(CURRENT_VERSION);
  });
});

describe('v72 → v73 (board ultimatum)', () => {
  it('defaults boardUltimatum to null on old saves', () => {
    const v72: Record<string, unknown> = { version: 72 };
    const out = migrateSaveData(v72) as Record<string, unknown>;
    expect(out.version).toBe(73);
    expect(out.boardUltimatum).toBeNull();
  });

  it('preserves an existing boardUltimatum object if present', () => {
    const ult = { issuedSeason: 2, issuedWeek: 15, deadlineWeek: 21, targetPosition: 12 };
    const v72: Record<string, unknown> = { version: 72, boardUltimatum: ult };
    const out = migrateSaveData(v72) as Record<string, unknown>;
    expect(out.boardUltimatum).toEqual(ult);
  });
});
