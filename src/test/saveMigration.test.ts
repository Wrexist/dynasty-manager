import { describe, it, expect } from 'vitest';
import { migrateSaveData, CURRENT_VERSION } from '@/utils/saveMigration';

/**
 * The uniform wage scaling applied by the v90 → v91 migration. Tests that
 * assert an absolute wage after a FULL chain migration have to account for it;
 * tests about a single earlier step should assert ratios instead.
 */
const WAGE_EASING_V91 = 0.85;

describe('saveMigration', () => {
  it('should have current version set to 90', () => {
    expect(CURRENT_VERSION).toBe(91);
  });

  it('v85 → v86 upgrades a Sunday save to sub-schema v3', () => {
    const out = migrateSaveData({
      version: 85,
      playerClubId: 'sunday-club',
      clubs: { 'sunday-club': {} },
      season: 3, week: 9,
      sunday: {
        v: 2,
        eventQueue: [],
        eventLog: [
          { season: 1, week: 4, defId: 'social-media', summary: 'x' },
          { season: 2, week: 6, defId: 'broke', summary: 'y' },
          { season: 2, week: 9, defId: 'broke', summary: 'z' },
        ],
        lastMatch: { matchId: 'm', goalsFor: 2, goalsAgainst: 1, motmPlayerId: 'a' },
      },
    }) as Record<string, unknown>;
    expect(out.version).toBe(CURRENT_VERSION);
    const sunday = out.sunday as Record<string, unknown>;
    expect(sunday.v).toBe(3);
    // The dead queue is gone, not carried forward as an empty array.
    expect('eventQueue' in sunday).toBe(false);
    expect(sunday.pendingLedger).toEqual([]);
    // Left empty on purpose: `sundayStyleOf` re-derives each AI club's style
    // from its squad, so an old save meets a varied division without the
    // migration having to reproduce the fit metric. See the step's comment.
    expect(sunday.divisionStyles).toEqual({});
    // Seeded from whatever the capped log still remembers, deduplicated.
    expect(sunday.onceFiredIds).toEqual(['social-media', 'broke']);
    const lastMatch = sunday.lastMatch as Record<string, unknown>;
    expect(lastMatch.redCards).toBe(0);
    expect(lastMatch.injuries).toBe(0);
    expect(lastMatch.motmName).toBeNull();
    expect(lastMatch.lowlightName).toBeNull();
    // Everything that was already there survives.
    expect(lastMatch.goalsFor).toBe(2);
    expect(lastMatch.motmPlayerId).toBe('a');
  });

  it('v85 → v86 leaves a save with no Sunday state alone', () => {
    const out = migrateSaveData({ version: 85, playerClubId: 'x', clubs: { x: {} }, sunday: null });
    expect(out.version).toBe(CURRENT_VERSION);
    expect(out.sunday).toBeNull();
    expect(out.migrationError).toBeUndefined();
  });

  it('v84 → v85 upgrades a Sunday save to sub-schema v2 with empty stories', () => {
    const out = migrateSaveData({
      version: 84,
      playerClubId: 'sunday-club',
      clubs: { 'sunday-club': {} },
      season: 2, week: 5,
      sunday: {
        v: 1,
        squad: [{ playerId: 'a', happiness: 60 }],
        rivalry: { clubId: 'r', name: 'The Rec Derby', wins: 1, draws: 0, losses: 2, heat: 6, lastTaunt: null },
      },
    }) as Record<string, Record<string, unknown>>;
    expect(out.version).toBe(CURRENT_VERSION);
    const sunday = out.sunday as Record<string, unknown>;
    // The chain runs all the way to CURRENT_VERSION, so the sub-schema arrives
    // at v3; what this case pins is that the v2 fields are backfilled on the way.
    expect(sunday.v).toBe(3);
    expect((sunday.squad as Record<string, unknown>[])[0].memories).toEqual([]);
    expect((sunday.squad as Record<string, unknown>[])[0].promise).toBeNull();
    expect((sunday.rivalry as Record<string, unknown>).story).toEqual([]);
    expect((sunday.rivalry as Record<string, unknown>).defector).toBeNull();
    expect(sunday.flags).toEqual({});
    expect(sunday.arrival).toBeNull();
  });

  it('v83 → v84 introduces the Sunday League key as null on every older save', () => {
    const out = migrateSaveData({ version: 83, playerClubId: 'x', clubs: { x: {} }, season: 1, week: 1 });
    expect(out.version).toBe(CURRENT_VERSION);
    expect(out.sunday).toBeNull();
    expect(out.migrationError).toBeUndefined();
  });

  it('v78 → v79 backfills monetization.adEngagement', () => {
    const out = migrateSaveData({
      version: 78,
      monetization: { entitlements: ['com.dynastymanager.pro'], subscription: null },
    });
    expect(out.version).toBe(CURRENT_VERSION);
    const m = out.monetization as Record<string, unknown>;
    // Existing purchase state must survive untouched.
    expect(m.entitlements).toEqual(['com.dynastymanager.pro']);
    const ad = m.adEngagement as Record<string, unknown>;
    expect(ad).toBeDefined();
    // Empty dayKey so the first read rolls the day rather than trusting a
    // stale date from whenever the save was written.
    expect(ad.dayKey).toBe('');
    expect(ad.watchedToday).toBe(0);
    expect(ad.promptsToday).toBe(0);
    expect(ad.consecutiveDismissals).toBe(0);
    expect(ad.totalWatched).toBe(0);
  });

  it('v78 → v79 tolerates a save with no monetization block', () => {
    const out = migrateSaveData({ version: 78 });
    expect(out.version).toBe(CURRENT_VERSION);
    expect(out.migrationError).toBeUndefined();
  });

  it('v69 → v70 backfills settings.performanceMode (default off)', () => {
    const v69: Record<string, unknown> = { version: 69, settings: { reducedMotion: true } };
    const migrated = migrateSaveData(v69) as { version: number; settings: Record<string, unknown> };
    expect(migrated.version).toBe(CURRENT_VERSION);
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
    expect(migrated.version).toBe(CURRENT_VERSION);
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
    // v62→v63 keeps the bucket and v63→v64 converts it into the dailyPackOpens
    // shape; v86→v87 then CLEARS both buckets, because the Market redesign
    // retired the tiers those counts were counted against. The date label
    // survives so the mirror still says which day it describes.
    expect(result.dailyPackOpens).toEqual({
      date: '2026-04-26',
      free: {},
      ad: {},
    });
  });

  it('v63 → v64 converts adPackOpens into dailyPackOpens with free + ad buckets', () => {
    const v63Data: Record<string, unknown> = {
      version: 63,
      adPackOpens: { date: '2026-04-26', counts: { bronze: 2, silver: 1 } },
    };
    const result = migrateSaveData(v63Data) as Record<string, unknown>;
    // Cleared again at v86→v87 — see the note on the v62 case above.
    expect(result.dailyPackOpens).toEqual({
      date: '2026-04-26',
      free: {},
      ad: {},
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
    // The v90 → v91 wage easing scales every wage by 0.85 later in the chain,
    // so a common player's wage arrives eased rather than untouched. Value is
    // not eased, which is why only the wage carries the factor.
    expect(players.squad.wage).toBe(Math.round(50_000 * WAGE_EASING_V91));
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
    // v86→v87 clears both buckets: bronze/silver are archived tiers and their
    // counts are counts against allowances that no longer exist.
    expect(dp.ad).toEqual({});
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
    // v67 must not deflate the wage; the only reduction along the chain is the
    // v91 easing, which is uniform and deliberate, so the floor moves with it.
    expect(players.bronze.wage).toBeGreaterThanOrEqual(Math.round(2_000 * WAGE_EASING_V91));
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
    expect(out.version).toBe(CURRENT_VERSION);
    expect(out.boardUltimatum).toBeNull();
  });

  it('preserves an existing boardUltimatum object if present', () => {
    const ult = { issuedSeason: 2, issuedWeek: 15, deadlineWeek: 21, targetPosition: 12 };
    const v72: Record<string, unknown> = { version: 72, boardUltimatum: ult };
    const out = migrateSaveData(v72) as Record<string, unknown>;
    expect(out.boardUltimatum).toEqual(ult);
  });
});

describe('v73 → v74 (subscription anchoring, retirement flag)', () => {
  it('rejects a save with no numeric version instead of driving it through the v22 clean break', () => {
    // A save that lost its `version` field used to be treated as v1, which drove
    // it through migration 22 — a deliberate clean break that discards ALL game
    // state — and then failed validation. Refuse up front so the caller can
    // offer recovery on the real data.
    const out = migrateSaveData({ playerClubId: 'ars', clubs: {} } as Record<string, unknown>) as Record<string, unknown>;
    expect(out.migrationError).toBe(true);
    expect(out.playerClubId).toBe('ars');
  });

  it('defaults careerRetired to false', () => {
    const out = migrateSaveData({ version: 73 }) as Record<string, unknown>;
    expect(out.version).toBe(CURRENT_VERSION);
    expect(out.careerRetired).toBe(false);
  });

  it('anchors a dated subscription with grantedAt and keeps it', () => {
    const expiresAt = new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString();
    const out = migrateSaveData({
      version: 73,
      monetization: { entitlements: [], subscription: { tier: 'monthly', productId: 'com.dynastymanager.pro.monthly', expiresAt } },
    }) as Record<string, unknown>;
    const sub = (out.monetization as Record<string, unknown>).subscription as Record<string, unknown>;
    expect(sub.expiresAt).toBe(expiresAt);
    expect(typeof sub.grantedAt).toBe('string');
  });

  it('clears a recurring subscription that has neither expiry nor anchor', () => {
    // These are exactly the records that used to grant permanent Pro for one
    // month's payment (expiresAt == null read as "lifetime"). They cannot be
    // verified locally, so drop them and let the next RevenueCat sync re-grant.
    const out = migrateSaveData({
      version: 73,
      monetization: { entitlements: [], subscription: { tier: 'monthly', productId: 'com.dynastymanager.pro.monthly', expiresAt: null } },
    }) as Record<string, unknown>;
    expect((out.monetization as Record<string, unknown>).subscription).toBeNull();
  });

  it('keeps a lifetime record with no expiry', () => {
    const out = migrateSaveData({
      version: 73,
      monetization: { entitlements: [], subscription: { tier: 'lifetime', productId: 'com.dynastymanager.pro.lifetime', expiresAt: null } },
    }) as Record<string, unknown>;
    const sub = (out.monetization as Record<string, unknown>).subscription as Record<string, unknown>;
    expect(sub).not.toBeNull();
    expect(sub.tier).toBe('lifetime');
  });
});

describe('v90 → v91: the wage easing reaches existing saves', () => {
  // v89 eased WAGE_EXP_BASE 10 → 8.5 but migrated nothing, on the belief that
  // players re-price on a development tick. They do not — that path calls
  // `recomputePlayerValueOnly`, which never writes `wage` — so pre-v89 squads
  // stayed 15% expensive forever while every new arrival came in cheap.
  const save = (players: Record<string, unknown>, clubs: Record<string, unknown> = {}) =>
    migrateSaveData({ version: 90, players, clubs });

  it('scales existing player wages by 0.85', () => {
    const out = migrateSaveData({ version: 90, players: { a: { wage: 100_000 } }, clubs: {} });
    expect((out.players as Record<string, { wage: number }>).a.wage).toBe(85_000);
    expect(out.version).toBe(CURRENT_VERSION);
  });

  it('scales the club wage bill by the same factor', () => {
    const out = save({ a: { wage: 100_000 } }, { c: { wageBill: 1_000_000 } });
    expect((out.clubs as Record<string, { wageBill: number }>).c.wageBill).toBe(850_000);
  });

  it('preserves the RATIO between contracts rather than re-deriving from overall', () => {
    // A transfer-signed wage, a pack pull's wageFactor discount and a free
    // agent's 0.8x are all deliberate departures from the curve. Re-deriving
    // would erase them; scaling must not.
    const out = save({
      curve: { wage: 100_000, overall: 80 },
      discounted: { wage: 40_000, overall: 80 },
    });
    const players = out.players as Record<string, { wage: number }>;
    expect(players.curve.wage).toBe(85_000);
    expect(players.discounted.wage).toBe(34_000);
    expect(players.discounted.wage / players.curve.wage).toBeCloseTo(0.4, 5);
  });

  it('never takes a wage below the floor', () => {
    const out = save({ a: { wage: 500 } });
    expect((out.players as Record<string, { wage: number }>).a.wage).toBe(500);
  });

  it('leaves a player with no wage field alone instead of inventing one', () => {
    const out = save({ a: { overall: 70 } });
    expect((out.players as Record<string, { wage?: number }>).a.wage).toBeUndefined();
  });

  it('survives malformed players and clubs', () => {
    const out = migrateSaveData({
      version: 90,
      players: { a: null, b: { wage: 'lots' }, c: { wage: 20_000 } },
      clubs: { x: null, y: { wageBill: undefined }, z: { wageBill: 200_000 } },
    });
    const players = out.players as Record<string, { wage?: unknown }>;
    expect(players.b.wage).toBe('lots');
    expect(players.c.wage).toBe(17_000);
    expect((out.clubs as Record<string, { wageBill?: number }>).z.wageBill).toBe(170_000);
    expect(out.version).toBe(CURRENT_VERSION);
  });

  it('does not run twice on a save already at the current version', () => {
    const once = migrateSaveData({ version: 90, players: { a: { wage: 100_000 } }, clubs: {} });
    const twice = migrateSaveData(once);
    expect((twice.players as Record<string, { wage: number }>).a.wage).toBe(85_000);
  });
});
