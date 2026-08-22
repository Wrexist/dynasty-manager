/**
 * Persistence — a Sunday save must survive a round trip, and must not leak
 * into any other mode.
 *
 * The migration case matters most: every save written before v84 predates the
 * mode entirely, so `sunday` must come back as null rather than as a
 * half-present shape that the UI would try to render.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { __resetSaveStorageForTests, readSaveSlot } from '@/store/helpers/persistence';
import { CURRENT_VERSION, migrateSaveData, validateSaveShape } from '@/utils/saveMigration';
import { assertSundayState } from '@/utils/sunday/invariants';
import { pruneSundayFlags } from '@/utils/sunday/events';
import {
  SUNDAY_INJURY_COST, SUNDAY_RED_CARD_FINE, SUNDAY_SHIRT_MAX, SUNDAY_SHIRT_MIN,
} from '@/config/sundayLeague';
import { sundayShirtNumber } from '@/utils/sunday/generation';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';

const SEED = 20250;

beforeEach(() => {
  __resetAutosaveSchedulerForTests();
  __resetSaveStorageForTests();
  localStorage.clear();
  useGameStore.getState().resetGame();
});

afterEach(() => {
  __resetSaveStorageForTests();
  localStorage.clear();
});

describe('save round trip', () => {
  it('survives a save and load with the mode intact', async () => {
    await useGameStore.getState().startSundayLeague({ personality: 'family', seed: SEED });
    // Play a few weeks so the state is not the boot state.
    for (let i = 0; i < 4; i++) {
      const s = useGameStore.getState();
      if (s.sunday!.pendingEvent) await s.resolveSundayEvent(s.sunday!.pendingEvent.choices[0].id);
      await useGameStore.getState().advanceWeek();
    }
    const before = useGameStore.getState();
    const snapshot = {
      season: before.season, week: before.week,
      balance: before.sunday!.balance,
      reputation: before.sunday!.reputation,
      morale: before.sunday!.teamMorale,
      squad: before.sunday!.squad.length,
      seed: before.sunday!.seed,
      cursor: before.sunday!.rngCursor,
      identity: before.sunday!.identity.name,
      ledger: before.sunday!.ledger.length,
      playedFixtures: before.fixtures.filter(m => m.played).length,
    };

    before.saveGame(1);
    before.flushSave();
    expect(readSaveSlot(1)).toBeTruthy();

    // Wipe the store completely, then load.
    useGameStore.getState().resetGame(2);
    useGameStore.setState({ sunday: null, gameMode: 'sandbox' });
    expect(useGameStore.getState().loadGame(1)).toBe(true);

    const after = useGameStore.getState();
    expect(after.gameMode).toBe('sunday');
    expect(after.sunday).not.toBeNull();
    expect(after.season).toBe(snapshot.season);
    expect(after.week).toBe(snapshot.week);
    expect(after.sunday!.balance).toBe(snapshot.balance);
    expect(after.sunday!.reputation).toBe(snapshot.reputation);
    expect(after.sunday!.teamMorale).toBe(snapshot.morale);
    expect(after.sunday!.squad).toHaveLength(snapshot.squad);
    expect(after.sunday!.seed).toBe(snapshot.seed);
    expect(after.sunday!.rngCursor).toBe(snapshot.cursor);
    expect(after.sunday!.identity.name).toBe(snapshot.identity);
    expect(after.sunday!.ledger).toHaveLength(snapshot.ledger);
    expect(after.fixtures.filter(m => m.played)).toHaveLength(snapshot.playedFixtures);
    expect(after.currentScreen).toBe('sunday-hub');

    assertSundayState({
      sunday: after.sunday!, players: after.players, clubs: after.clubs,
      playerClubId: after.playerClubId, fixtures: after.fixtures, week: after.week,
    });
  });

  it('continues the same story after a reload rather than re-rolling it', async () => {
    await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
    useGameStore.getState().saveGame(1);
    useGameStore.getState().flushSave();

    // What the seeded design guarantees across a reload of the SAME week: the
    // doubts resolve the same way, the same guests get drafted, the weather is
    // the same, and the persistent cursor is untouched by the weekly loop. The
    // SCORELINE is explicitly not guaranteed — the shared engine is unseeded
    // (see the header of `utils/sunday/rng.ts`) — and neither is anything
    // downstream of it, availability next week included, because benched
    // streaks and happiness are fed by the match that differed.
    const playWeekOne = async () => {
      const report = (await useGameStore.getState().playSundayMatch())!;
      return {
        startedWith: report.startedWith,
        ringers: report.ringersUsed,
        weather: useGameStore.getState().currentMatchResult?.weather ?? null,
        cursor: useGameStore.getState().sunday!.rngCursor,
      };
    };

    const pathA = await playWeekOne();
    useGameStore.getState().loadGame(1);
    const pathB = await playWeekOne();

    expect(pathB.startedWith).toBe(pathA.startedWith);
    expect(pathB.ringers).toBe(pathA.ringers);
    expect(pathB.weather).toEqual(pathA.weather);
    // The weekly loop draws from week-keyed streams precisely so the engine's
    // unseeded internals cannot leak into the persistent cursor's position. If
    // this fails, some loop code has started drawing from the persistent
    // stream again.
    expect(pathB.cursor).toBe(pathA.cursor);
  });

  it('still charges the red-card fine and the treatment bill after a reload', async () => {
    // The save-scum this closes: the game autosaves the moment the whistle
    // goes, and the weekly settlement used to read the counts off
    // `currentMatchResult`, which is not persisted. Reload, tap Next Week, and
    // the fines vanished. The counts now live on the persisted report.
    await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
    await useGameStore.getState().playSundayMatch();

    // Force the counts rather than waiting for the (unseeded) engine to produce
    // a sending-off: what is under test is where the numbers are READ from.
    const played = useGameStore.getState();
    useGameStore.setState({
      sunday: {
        ...played.sunday!,
        upgrades: [], // no physio, so the treatment bill is charged
        lastMatch: { ...played.sunday!.lastMatch!, redCards: 2, injuries: 1 },
      },
    });

    useGameStore.getState().saveGame(1);
    useGameStore.getState().flushSave();
    useGameStore.getState().loadGame(1);
    expect(useGameStore.getState().currentMatchResult).toBeNull();

    await useGameStore.getState().advanceWeek();
    const ledger = useGameStore.getState().sunday!.ledger;
    const lines = ledger[ledger.length - 1].lines;
    const fine = lines.find(l => l.kind === 'fine');
    expect(fine, JSON.stringify(lines)).toBeTruthy();
    expect(fine!.amount).toBe(-2 * SUNDAY_RED_CARD_FINE);
    const medical = lines.find(l => l.kind === 'medical');
    expect(medical, JSON.stringify(lines)).toBeTruthy();
    expect(medical!.amount).toBe(-SUNDAY_INJURY_COST);
  });

  it('writes a save that passes the shape validator', async () => {
    await useGameStore.getState().startSundayLeague({ personality: 'chaos', seed: SEED });
    useGameStore.getState().saveGame(1);
    useGameStore.getState().flushSave();
    const raw = readSaveSlot(1)!;
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(CURRENT_VERSION);
    expect(parsed.gameMode).toBe('sunday');
    expect(parsed.sunday).toBeTruthy();
    expect(validateSaveShape(parsed).ok).toBe(true);
  });
});

describe('migration', () => {
  it('brings a pre-Sunday save forward with the mode absent', () => {
    const old = {
      version: 83, playerClubId: 'x', clubs: { x: {} }, season: 1, week: 1,
      gameMode: 'sandbox',
    };
    const migrated = migrateSaveData(old) as Record<string, unknown>;
    expect(migrated.migrationError).toBeUndefined();
    expect(migrated.version).toBe(CURRENT_VERSION);
    expect(migrated.sunday).toBeNull();
  });

  it('does not disturb a Sunday save that is already current', () => {
    const current = {
      version: CURRENT_VERSION, playerClubId: 'x', clubs: { x: {} }, season: 2, week: 5,
      gameMode: 'sunday', sunday: { v: 1, balance: 123 },
    };
    const migrated = migrateSaveData(current) as Record<string, unknown>;
    expect(migrated.sunday).toEqual({ v: 1, balance: 123 });
  });

  it('gives a v85 Sunday save an empty chain list', () => {
    const old = {
      version: 85, playerClubId: 'sunday-club', clubs: {}, season: 1, week: 6,
      gameMode: 'sunday', sunday: { v: 2, balance: 200, flags: {}, squad: [] },
    };
    const migrated = migrateSaveData(old) as Record<string, unknown>;
    const sunday = migrated.sunday as Record<string, unknown>;
    expect(sunday.v).toBe(3);
    expect(sunday.chains).toEqual([]);
  });

  it('backfills the last report with the fields the settlement and the header read', () => {
    const old = {
      version: 85, playerClubId: 'sunday-club', clubs: {}, season: 2, week: 9,
      gameMode: 'sunday',
      sunday: {
        v: 2, balance: 200, flags: {}, squad: [],
        lastMatch: { matchId: 'm', season: 2, week: 8, goalsFor: 1, goalsAgainst: 1 },
      },
    };
    const sunday = (migrateSaveData(old) as Record<string, unknown>).sunday as Record<string, unknown>;
    const lastMatch = sunday.lastMatch as Record<string, unknown>;
    expect(lastMatch.redCards).toBe(0);
    expect(lastMatch.injuries).toBe(0);
    expect(lastMatch.motmName).toBeNull();
    // Every old fixture WAS presented as routine; claiming otherwise would need
    // a table this save no longer has.
    expect(lastMatch.tier).toBe('routine');
    // The weather is rolled inside `prepareSundayMatch` off the match-week
    // stream, so it cannot be reconstructed without replaying that stream — and
    // replaying it would change the result of every match in every save. Null
    // is the honest answer: nobody wrote it down at the time.
    expect(lastMatch.weather).toBeNull();
  });

  it('keeps a weather reading a newer report already carried', () => {
    const old = {
      version: 85, playerClubId: 'sunday-club', clubs: {}, season: 2, week: 9,
      gameMode: 'sunday',
      sunday: {
        v: 2, balance: 200, flags: {}, squad: [],
        lastMatch: { matchId: 'm', weather: { weather: 'rain', pitch: 'poor' } },
      },
    };
    const sunday = (migrateSaveData(old) as Record<string, unknown>).sunday as Record<string, unknown>;
    expect((sunday.lastMatch as Record<string, unknown>).weather).toEqual({ weather: 'rain', pitch: 'poor' });
  });

  /**
   * SQUAD NUMBERS — the one field in this wave that cannot be derived.
   *
   * A number taken from a position in the `squad` array changes the moment
   * somebody signs or retires, so it has to be assigned once and then owned by
   * the save. Which means old saves need one handing out, and the rule that
   * hands it out has to hold two things: unique, and inside 1-99.
   */
  it('hands an old squad a unique, in-range shirt number each', () => {
    const old = {
      version: 85, playerClubId: 'sunday-club', clubs: {}, season: 3, week: 4,
      gameMode: 'sunday',
      players: {
        a: { position: 'CB' }, b: { position: 'GK' }, c: { position: 'ST' }, d: { position: 'GK' },
      },
      sunday: {
        v: 2, balance: 200, flags: {},
        squad: [{ playerId: 'a' }, { playerId: 'b' }, { playerId: 'c' }, { playerId: 'd' }],
      },
    };
    const sunday = (migrateSaveData(old) as Record<string, unknown>).sunday as Record<string, unknown>;
    const squad = sunday.squad as { playerId: string; shirtNumber: number }[];
    const numbers = squad.map(m => m.shirtNumber);
    expect(new Set(numbers).size).toBe(squad.length);
    for (const n of numbers) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(SUNDAY_SHIRT_MIN);
      expect(n).toBeLessThanOrEqual(SUNDAY_SHIRT_MAX);
    }
    // The first keeper in squad order takes the one everybody expects. The
    // second is just another man in the queue.
    expect(squad.find(m => m.playerId === 'b')!.shirtNumber).toBe(1);
    expect(squad.find(m => m.playerId === 'd')!.shirtNumber).not.toBe(1);
  });

  it('never re-issues a number a save already carried', () => {
    // Re-running the chain (or extending this step again) must not renumber a
    // squad: the number is the man's, not the migration's.
    const old = {
      version: 85, playerClubId: 'sunday-club', clubs: {}, season: 3, week: 4,
      gameMode: 'sunday',
      players: { a: { position: 'GK' }, b: { position: 'CM' } },
      sunday: {
        v: 2, balance: 200, flags: {},
        squad: [{ playerId: 'a', shirtNumber: 7 }, { playerId: 'b' }],
      },
    };
    const sunday = (migrateSaveData(old) as Record<string, unknown>).sunday as Record<string, unknown>;
    const squad = sunday.squad as { playerId: string; shirtNumber: number }[];
    expect(squad[0].shirtNumber).toBe(7);
    expect(squad[1].shirtNumber).not.toBe(7);
  });

  it('agrees with the live shirt-number rule about range and uniqueness', () => {
    // The migration inlines its own copy of the rule, because
    // `utils/sunday/generation.ts` is a lazy chunk and must never be pulled
    // into the eagerly-loaded migration (same reasoning as the flag rule
    // above). This pins the two copies together on the properties that matter.
    const positions = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'ST'] as const;
    const old = {
      version: 85, playerClubId: 'sunday-club', clubs: {}, season: 1, week: 1,
      gameMode: 'sunday',
      players: Object.fromEntries(positions.map((p, i) => [`p${i}`, { position: p }])),
      sunday: {
        v: 2, balance: 0, flags: {},
        squad: positions.map((_, i) => ({ playerId: `p${i}` })),
      },
    };
    const migrated = ((migrateSaveData(old) as Record<string, unknown>).sunday as Record<string, unknown>)
      .squad as { shirtNumber: number }[];

    const live: number[] = [];
    for (const pos of positions) live.push(sundayShirtNumber(pos, live));

    for (const set of [migrated.map(m => m.shirtNumber), live]) {
      expect(new Set(set).size).toBe(positions.length);
      expect(Math.min(...set)).toBeGreaterThanOrEqual(SUNDAY_SHIRT_MIN);
      expect(Math.max(...set)).toBeLessThanOrEqual(SUNDAY_SHIRT_MAX);
    }
    // And both give the keeper the shirt a keeper wears.
    expect(migrated[0].shirtNumber).toBe(1);
    expect(live[0]).toBe(1);
  });

  it('scrubs friends and rivals who left the club seasons ago', () => {
    // The bug the relationships layer closes: nothing maintained these lists,
    // so an old save can name mates who have not been near the ground in
    // years. The migration repairs it once; every departure keeps it repaired.
    const old = {
      version: 85, playerClubId: 'sunday-club', clubs: {}, season: 4, week: 12,
      gameMode: 'sunday',
      sunday: {
        v: 2, balance: 200, flags: {},
        squad: [
          { playerId: 'a', friends: ['b', 'ghost', 'b', 'a'], rivals: ['b', 'gone'] },
          { playerId: 'b', friends: ['a'], rivals: [] },
        ],
        recruits: [{ id: 'r1', member: { friends: ['ghost'], rivals: [] } }],
      },
    };
    const sunday = (migrateSaveData(old) as Record<string, unknown>).sunday as Record<string, unknown>;
    const squad = sunday.squad as Record<string, unknown>[];
    // Departed ids gone, duplicates gone, self-reference gone.
    expect(squad[0].friends).toEqual(['b']);
    // And a man cannot be both — the friendship wins, which is the invariant.
    expect(squad[0].rivals).toEqual([]);
    // The new fields are backfilled empty: nobody counted shared afternoons
    // before this version, so the count honestly starts now.
    expect(squad[0].formerTeammates).toEqual([]);
    expect(squad[0].appsWith).toEqual({});
    const recruits = sunday.recruits as Record<string, unknown>[];
    expect(recruits[0].voucherId).toBeNull();
    expect((recruits[0].member as Record<string, unknown>).friends).toEqual([]);
  });

  it('backfills the counters wave 5 added, without closing a window mid-season', () => {
    const old = {
      version: 85, playerClubId: 'sunday-club', clubs: {}, season: 4, week: 11,
      gameMode: 'sunday', sunday: { v: 2, balance: 200, flags: {}, squad: [] },
    };
    const sunday = (migrateSaveData(old) as Record<string, unknown>).sunday as Record<string, unknown>;
    // Zero is the only honest backfill for both: the save was written when
    // signings and phone calls were uncapped, so any other number would take
    // away something the manager had already been told he could do.
    expect(sunday.signingsThisSeason).toBe(0);
    expect(sunday.ringRoundsThisWeek).toBe(0);
  });

  it('leaves a counter that is already present alone', () => {
    const old = {
      version: 85, playerClubId: 'sunday-club', clubs: {}, season: 2, week: 3,
      gameMode: 'sunday',
      sunday: { v: 2, balance: 200, flags: {}, squad: [], signingsThisSeason: 2, ringRoundsThisWeek: 1 },
    };
    const sunday = (migrateSaveData(old) as Record<string, unknown>).sunday as Record<string, unknown>;
    expect(sunday.signingsThisSeason).toBe(2);
    expect(sunday.ringRoundsThisWeek).toBe(1);
  });

  it('carries a mid-story wants-out flag forward as a live chain', () => {
    // The one chain that shipped as an ad-hoc flag. A save reloaded mid-story
    // must continue it, not lose it: the flag selects nothing now, and the
    // payoff beat only fires for a live chain.
    const old = {
      version: 85, playerClubId: 'sunday-club', clubs: {}, season: 3, week: 9,
      gameMode: 'sunday',
      players: { 'sun-p-1': { firstName: 'Danny', lastName: 'Vaughan' } },
      sunday: {
        v: 2, balance: 200, flags: { 'wants-out:sun-p-1': 7 },
        squad: [{ playerId: 'sun-p-1' }],
      },
    };
    const migrated = migrateSaveData(old) as Record<string, unknown>;
    const sunday = migrated.sunday as Record<string, unknown>;
    expect(sunday.flags).toEqual({});
    expect(sunday.chains).toEqual([{
      id: 'rival-defection',
      step: 2,
      subjectId: 'sun-p-1',
      startedWeek: 7,
      startedSeason: 3,
      dueWeek: 11,
      data: { name: 'Danny' },
    }]);
  });

  it('will not mint a chain about a man who has already left', () => {
    // The expected input, not a hypothetical: the v85 baseline swept flags by
    // AGE alone and never by squad membership, so a save can genuinely carry a
    // wants-out flag about somebody who walked out weeks ago. Converting it
    // produced a chain the validator rejects ("chain rival-defection is about
    // X, who is not in the squad") whose beats could never fire.
    const old = {
      version: 85, playerClubId: 'sunday-club', clubs: {}, season: 3, week: 9,
      gameMode: 'sunday',
      players: { 'sun-p-2': { firstName: 'Kev' } },
      sunday: {
        v: 2, balance: 200,
        flags: { 'wants-out:sun-p-gone': 7 },
        squad: [{ playerId: 'sun-p-2' }],
      },
    };
    const sunday = (migrateSaveData(old) as Record<string, unknown>).sunday as Record<string, unknown>;
    expect(sunday.chains).toEqual([]);
    // And the flag goes with it, rather than sitting there naming a ghost.
    expect(sunday.flags).toEqual({});
  });

  it('scrubs dangling story flags by exactly the rule the validator uses', () => {
    // The migration is the one load path that never runs `pruneSundayFlags` —
    // the mode's own code prunes on every departure — so it carries its own
    // copy of the rule. This pins the copy to the original.
    const flags = {
      'wants-out:sun-p-1': 3,      // live subject, and chains already exist so it is not converted
      'sulking:sun-p-gone': 4,     // departed subject
      'rough-week': 5,             // no subject at all
      'derby-bet:not-a-player-id': 6, // a colon, but not a player id
    };
    const old = {
      version: 85, playerClubId: 'sunday-club', clubs: {}, season: 2, week: 6,
      gameMode: 'sunday',
      sunday: {
        v: 2, balance: 200, flags, chains: [],
        squad: [{ playerId: 'sun-p-1' }, { playerId: 'sun-p-2' }],
      },
    };
    const sunday = (migrateSaveData(old) as Record<string, unknown>).sunday as Record<string, unknown>;
    expect(sunday.flags).toEqual(pruneSundayFlags(flags, new Set(['sun-p-1', 'sun-p-2'])));
    expect(sunday.flags).toEqual({
      'wants-out:sun-p-1': 3, 'rough-week': 5, 'derby-bet:not-a-player-id': 6,
    });
  });
});

describe('mode isolation', () => {
  it('leaves no Sunday state behind when a new sandbox game starts', async () => {
    await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
    expect(useGameStore.getState().sunday).not.toBeNull();

    useGameStore.getState().resetGame();
    expect(useGameStore.getState().sunday).toBeNull();
    expect(useGameStore.getState().gameMode).toBe('sandbox');

    await useGameStore.getState().initGame('celtic');
    expect(useGameStore.getState().sunday).toBeNull();
    expect(useGameStore.getState().gameMode).toBe('sandbox');
    // The club game must be intact: a real league, a real budget.
    expect(useGameStore.getState().fixtures.length).toBeGreaterThan(0);
    expect(useGameStore.getState().clubs[useGameStore.getState().playerClubId].budget).toBeGreaterThan(0);
  });

  it('leaves no club-game state behind when a Sunday game starts', async () => {
    await useGameStore.getState().initGame('celtic');
    await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
    const s = useGameStore.getState();
    expect(s.gameMode).toBe('sunday');
    expect(s.careerManager).toBeNull();
    expect(s.transferMarket).toHaveLength(0);
    expect(s.incomingOffers).toHaveLength(0);
    expect(s.championsCup).toBeNull();
    expect(s.cup.ties).toHaveLength(0);
    expect(s.seasonHistory).toHaveLength(0);
    // The only clubs in the world are the Sunday division.
    expect(Object.keys(s.clubs)).toHaveLength(s.sunday!.divisionClubIds.length);
  });
});
