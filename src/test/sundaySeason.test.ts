/**
 * Season structure — the calendar, the cup, the table, and the rollover.
 *
 * The calendar assertions are the load-bearing ones: the elite game documents
 * at length what happens when a cup round collides with a league fixture, and
 * this mode's fixture builder is designed so it cannot.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import {
  advanceSundayCup, buildSundayFixtures, buildSundayTable, developSundayPlayer,
  drawSundayCup, isSundayCupRoundComplete, qualifiesAsLegend, recordSundayRecord,
  resolveSundayOutcome, sundayCupRoundName, sundayCupWeeks, sundayLeagueRounds,
  sundayPosition, sundaySeasonWeeks,
} from '@/utils/sunday/season';
import { createSundayRng } from '@/utils/sunday/rng';
import { generateSundayDivision, generateSundayPlayer } from '@/utils/sunday/generation';
import { assertSundayState } from '@/utils/sunday/invariants';
import {
  SUNDAY_CUP_ROUNDS, SUNDAY_DIVISIONS, getSundayDivision, sundayOppositionLift,
  SUNDAY_OPP_SCALE_MAX, SUNDAY_REPUTATION_START,
} from '@/config/sundayLeague';
import type { Match } from '@/types/game';

const CLUBS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

describe('the calendar', () => {
  it('plays a full double round-robin with nobody playing twice in a week', () => {
    for (const div of SUNDAY_DIVISIONS) {
      const ids = Array.from({ length: div.teamCount }, (_, i) => `c${i}`);
      const fixtures = buildSundayFixtures(createSundayRng(5, 0), div.id, ids);
      expect(fixtures).toHaveLength(div.teamCount * (div.teamCount - 1));

      // Every ordered pair exactly once.
      const pairs = new Set(fixtures.map(m => `${m.homeClubId}>${m.awayClubId}`));
      expect(pairs.size).toBe(fixtures.length);

      // Nobody plays twice in a week.
      const perWeek = new Map<string, number>();
      for (const m of fixtures) {
        for (const cid of [m.homeClubId, m.awayClubId]) {
          const key = `${m.week}:${cid}`;
          perWeek.set(key, (perWeek.get(key) ?? 0) + 1);
        }
      }
      expect([...perWeek.values()].every(n => n === 1)).toBe(true);
    }
  });

  it('never puts a league fixture on a cup week', () => {
    for (const div of SUNDAY_DIVISIONS) {
      const ids = Array.from({ length: div.teamCount }, (_, i) => `c${i}`);
      const cupWeeks = new Set(sundayCupWeeks(div.id));
      const fixtures = buildSundayFixtures(createSundayRng(9, 0), div.id, ids);
      for (const m of fixtures) {
        expect(cupWeeks.has(m.week), `${div.id} week ${m.week}`).toBe(false);
      }
    }
  });

  it('fits the whole season inside its own week count', () => {
    for (const div of SUNDAY_DIVISIONS) {
      const ids = Array.from({ length: div.teamCount }, (_, i) => `c${i}`);
      const total = sundaySeasonWeeks(div.id);
      const fixtures = buildSundayFixtures(createSundayRng(3, 0), div.id, ids);
      expect(Math.max(...fixtures.map(m => m.week))).toBeLessThanOrEqual(total);
      expect(Math.max(...sundayCupWeeks(div.id))).toBeLessThanOrEqual(total);
      expect(sundayLeagueRounds(div.teamCount)).toBe(div.teamCount % 2 === 0 ? 2 * (div.teamCount - 1) : 2 * div.teamCount);
    }
  });

  it('is reproducible from its seed and different across seeds', () => {
    const a = buildSundayFixtures(createSundayRng(1, 0), 'sun-4', CLUBS).map(m => `${m.week}:${m.homeClubId}:${m.awayClubId}`).join('|');
    const b = buildSundayFixtures(createSundayRng(1, 0), 'sun-4', CLUBS).map(m => `${m.week}:${m.homeClubId}:${m.awayClubId}`).join('|');
    const c = buildSundayFixtures(createSundayRng(2, 0), 'sun-4', CLUBS).map(m => `${m.week}:${m.homeClubId}:${m.awayClubId}`).join('|');
    expect(b).toBe(a);
    expect(c).not.toBe(a);
  });

  it('gives every club a roughly even split of home and away', () => {
    const fixtures = buildSundayFixtures(createSundayRng(4, 0), 'sun-4', CLUBS);
    for (const id of CLUBS) {
      const home = fixtures.filter(m => m.homeClubId === id).length;
      const away = fixtures.filter(m => m.awayClubId === id).length;
      expect(home).toBe(away);
    }
  });
});

describe('the cup', () => {
  it('draws eight entrants and four first-round ties with the player in', () => {
    const cup = drawSundayCup(createSundayRng(1, 0), 'sun-4', CLUBS, 'a');
    expect(cup.entrants).toHaveLength(8);
    expect(cup.entrants).toContain('a');
    expect(new Set(cup.entrants).size).toBe(8);
    expect(cup.ties.filter(t => t.round === 1)).toHaveLength(4);
    expect(cup.ties.every(t => t.homeClubId !== t.awayClubId)).toBe(true);
  });

  it('only advances a round once every tie in it is played', () => {
    let cup = drawSundayCup(createSundayRng(2, 0), 'sun-4', CLUBS, 'a');
    expect(isSundayCupRoundComplete(cup, 1)).toBe(false);
    expect(advanceSundayCup(cup, 'sun-4', 1).ties.filter(t => t.round === 2)).toHaveLength(0);

    cup = { ...cup, ties: cup.ties.map(t => ({ ...t, played: true, homeGoals: 1, awayGoals: 0, winnerClubId: t.homeClubId })) };
    expect(isSundayCupRoundComplete(cup, 1)).toBe(true);
    const next = advanceSundayCup(cup, 'sun-4', 1);
    expect(next.ties.filter(t => t.round === 2)).toHaveLength(2);
  });

  it('is idempotent — advancing twice does not duplicate the bracket', () => {
    let cup = drawSundayCup(createSundayRng(3, 0), 'sun-4', CLUBS, 'a');
    cup = { ...cup, ties: cup.ties.map(t => ({ ...t, played: true, homeGoals: 2, awayGoals: 1, winnerClubId: t.homeClubId })) };
    const once = advanceSundayCup(cup, 'sun-4', 1);
    const twice = advanceSundayCup(once, 'sun-4', 1);
    expect(twice.ties.filter(t => t.round === 2)).toHaveLength(2);
  });

  it('never puts a knocked-out club into a later round', () => {
    let cup = drawSundayCup(createSundayRng(4, 0), 'sun-4', CLUBS, 'a');
    // Round each club went out in. A club that lost in round 2 may legitimately
    // appear in rounds 1 and 2 — the assertion is that it appears in NO round
    // after that.
    const eliminatedIn = new Map<string, number>();
    for (let round = 1; round <= SUNDAY_CUP_ROUNDS; round++) {
      cup = {
        ...cup,
        ties: cup.ties.map(t => {
          if (t.round !== round || t.played) return t;
          eliminatedIn.set(t.awayClubId, round);
          return { ...t, played: true, homeGoals: 1, awayGoals: 0, winnerClubId: t.homeClubId };
        }),
      };
      cup = advanceSundayCup(cup, 'sun-4', round);
    }
    for (const tie of cup.ties) {
      for (const cid of [tie.homeClubId, tie.awayClubId]) {
        const out = eliminatedIn.get(cid);
        if (out != null) expect(tie.round, `${cid} was out in round ${out}`).toBeLessThanOrEqual(out);
      }
    }
    expect(cup.winnerClubId).toBeTruthy();
    expect(eliminatedIn.has(cup.winnerClubId!)).toBe(false);
  });

  it('names its rounds from the end', () => {
    expect(sundayCupRoundName(SUNDAY_CUP_ROUNDS)).toBe('Final');
    expect(sundayCupRoundName(SUNDAY_CUP_ROUNDS - 1)).toBe('Semi-Final');
  });
});

describe('the table', () => {
  const fx = (week: number, home: string, away: string, hg: number, ag: number): Match => ({
    id: `${week}-${home}-${away}`, week, homeClubId: home, awayClubId: away,
    played: true, homeGoals: hg, awayGoals: ag, events: [],
  });

  it('awards points, tracks goal difference and orders correctly', () => {
    const table = buildSundayTable([
      fx(1, 'a', 'b', 3, 0),
      fx(2, 'c', 'a', 1, 1),
      fx(3, 'b', 'c', 0, 2),
    ], ['a', 'b', 'c']);
    expect(table[0].clubId).toBe('a');
    expect(table[0].points).toBe(4);
    expect(table[0].goalDifference).toBe(3);
    expect(table.find(r => r.clubId === 'b')!.points).toBe(0);
    expect(table.find(r => r.clubId === 'c')!.points).toBe(4);
    // a and c are level on points; a is ahead on goal difference.
    expect(table[1].clubId).toBe('c');
  });

  it('ignores unplayed fixtures and unknown clubs', () => {
    const table = buildSundayTable([
      { ...fx(1, 'a', 'b', 0, 0), played: false },
      fx(2, 'a', 'zzz', 5, 0),
    ], ['a', 'b']);
    expect(table.every(r => r.played === 0)).toBe(true);
  });

  it('counts clean sheets', () => {
    const table = buildSundayTable([fx(1, 'a', 'b', 2, 0)], ['a', 'b']);
    expect(table.find(r => r.clubId === 'a')!.cleanSheets).toBe(1);
    expect(table.find(r => r.clubId === 'b')!.cleanSheets).toBe(0);
  });

  it('reports a position for every club, and a stable one for an absent club', () => {
    const table = buildSundayTable([], ['a', 'b']);
    expect(sundayPosition(table, 'a')).toBeGreaterThan(0);
    expect(sundayPosition(table, 'nope')).toBe(table.length);
  });
});

describe('the league keeps up with you', () => {
  const meanOverall = (os: ReturnType<typeof generateSundayDivision>) =>
    os.flatMap(o => o.players).reduce((n, p) => n + p.overall, 0)
    / os.flatMap(o => o.players).length;

  it('lifts generated opposition for a club with a name and trophies, and caps it', () => {
    // A brand-new club gets no lift at all: the ceiling only exists to stop the
    // top of the pyramid becoming a formality by season seven.
    expect(sundayOppositionLift(SUNDAY_REPUTATION_START, 0)).toBe(0);
    expect(sundayOppositionLift(100, 6)).toBe(SUNDAY_OPP_SCALE_MAX);
    // Monotonic in both inputs, and never above the cap.
    let previous = -1;
    for (let rep = 0; rep <= 100; rep += 5) {
      const lift = sundayOppositionLift(rep, 0);
      expect(lift).toBeGreaterThanOrEqual(previous);
      expect(lift).toBeLessThanOrEqual(SUNDAY_OPP_SCALE_MAX);
      previous = lift;
    }
    expect(sundayOppositionLift(50, 2)).toBeGreaterThan(sundayOppositionLift(50, 0));
  });

  it('is a real but small difference in the squads it generates', () => {
    const plain = generateSundayDivision(4242, 'sun-prem', 11, 3, [], 0);
    const lifted = generateSundayDivision(4242, 'sun-prem', 11, 3, [], SUNDAY_OPP_SCALE_MAX);
    expect(meanOverall(lifted)).toBeGreaterThan(meanOverall(plain));
    // Bounded. MEASURED at the cap: +5.02 mean overall across 11 generated
    // squads (132 players), against a division step of +4.7 in the same
    // measurement — overall is not linear in quality near the ceiling, which
    // is why the bound is stated in overall points rather than by comparing
    // the raw quality constants. Five points of opposition is a top-division
    // club that can still be hurt; it is not a second promotion.
    expect(meanOverall(lifted) - meanOverall(plain)).toBeLessThan(SUNDAY_OPP_SCALE_MAX + 2);
  });

  it('touches nothing but the opposition — same ids, same names, same grounds', () => {
    const plain = generateSundayDivision(4242, 'sun-2', 9, 2, [], 0);
    const lifted = generateSundayDivision(4242, 'sun-2', 9, 2, [], SUNDAY_OPP_SCALE_MAX);
    expect(lifted.map(o => o.club.id)).toEqual(plain.map(o => o.club.id));
    expect(lifted.map(o => o.club.name)).toEqual(plain.map(o => o.club.name));
    expect(lifted.map(o => o.club.stadiumName)).toEqual(plain.map(o => o.club.stadiumName));
  });
});

describe('opponent identity', () => {
  it('keeps a club\'s name, colours and ground across seasons but re-forms its squad', () => {
    const s1 = generateSundayDivision(4242, 'sun-4', 7, 1, ['Marsh Lane FC']);
    const s5 = generateSundayDivision(4242, 'sun-4', 7, 5, ['Marsh Lane FC']);
    expect(s1.map(o => o.club.id)).toEqual(s5.map(o => o.club.id));
    // Identity survives — this is what makes a rivalry, a defector and a
    // head-to-head record mean anything across a rollover.
    expect(s5.map(o => o.club.name)).toEqual(s1.map(o => o.club.name));
    expect(s5.map(o => o.club.shortName)).toEqual(s1.map(o => o.club.shortName));
    expect(s5.map(o => o.club.color)).toEqual(s1.map(o => o.club.color));
    expect(s5.map(o => o.club.stadiumName)).toEqual(s1.map(o => o.club.stadiumName));
    // The people in it do not: Sunday teams re-form every summer.
    const names = (os: ReturnType<typeof generateSundayDivision>) =>
      os.flatMap(o => o.players.map(p => `${p.firstName} ${p.lastName}`)).join('|');
    expect(names(s5)).not.toBe(names(s1));
  });

  it('still builds a different world from a different seed', () => {
    const a = generateSundayDivision(4242, 'sun-4', 7, 1, []);
    const b = generateSundayDivision(9001, 'sun-4', 7, 1, []);
    expect(b.map(o => o.club.name).join('|')).not.toBe(a.map(o => o.club.name).join('|'));
  });

  it('never ships two clubs with the same name', () => {
    for (const seed of [1, 77, 4242, 90210]) {
      for (const div of SUNDAY_DIVISIONS) {
        const names = generateSundayDivision(seed, div.id, div.teamCount - 1, 3, ['Marsh Lane FC'])
          .map(o => o.club.name);
        expect(new Set(names).size, `${seed}/${div.id}`).toBe(names.length);
      }
    }
  });
});

describe('promotion and relegation', () => {
  it('promotes from the top, relegates from the bottom, and clamps at the ends', () => {
    const bottom = SUNDAY_DIVISIONS[0];
    const top = SUNDAY_DIVISIONS[SUNDAY_DIVISIONS.length - 1];

    const promoted = resolveSundayOutcome(bottom.id, 1, bottom.teamCount);
    expect(promoted.promoted).toBe(true);
    expect(promoted.champion).toBe(true);
    expect(promoted.nextDivisionId).toBe(SUNDAY_DIVISIONS[1].id);

    // The bottom division has nowhere to fall.
    const last = resolveSundayOutcome(bottom.id, bottom.teamCount, bottom.teamCount);
    expect(last.relegated).toBe(false);
    expect(last.nextDivisionId).toBe(bottom.id);

    // The top division has nowhere to climb.
    const won = resolveSundayOutcome(top.id, 1, top.teamCount);
    expect(won.promoted).toBe(false);
    expect(won.champion).toBe(true);
    expect(won.nextDivisionId).toBe(top.id);

    const dropped = resolveSundayOutcome(top.id, top.teamCount, top.teamCount);
    expect(dropped.relegated).toBe(true);
    expect(dropped.nextDivisionId).not.toBe(top.id);
  });
});

describe('development', () => {
  const member = {
    playerId: 'p', archetype: 'journeyman' as const, job: 'j', commitment: 15,
    punctuality: 12, ego: 8, loyalty: 12, temper: 8, influence: 8, condition: 12,
    injuryProne: 8, happiness: 60, benchedStreak: 0, startedStreak: 0, clubApps: 0,
    clubGoals: 0, clubAssists: 0, clubMotm: 0, joinedSeason: 1,
    availability: { status: 'available' as const, reason: null, note: null, warned: true, weeksRemaining: 0 },
    friends: [], rivals: [], formerTeammates: [], appsWith: {},
    unsettled: false, subsOwed: 0, memories: [], promise: null,
  };

  it('improves a young player who played and barely moves one who did not', () => {
    const { player } = generateSundayPlayer({
      rng: createSundayRng(1, 0), id: 'y', clubId: 'c', position: 'CM', quality: 40,
      ageMin: 19, ageMax: 19, season: 1, personality: 'youth', archetype: 'prospect',
    });
    const played = developSundayPlayer(createSundayRng(2, 0), { ...player, minutesPlayed: 900 }, member, 0);
    const benched = developSundayPlayer(createSundayRng(2, 0), { ...player, minutesPlayed: 0 }, member, 0);
    expect(played.player.overall).toBeGreaterThanOrEqual(benched.player.overall);
  });

  it('takes pace off a veteran and gives him experience', () => {
    const { player } = generateSundayPlayer({
      rng: createSundayRng(3, 0), id: 'o', clubId: 'c', position: 'CB', quality: 50,
      ageMin: 36, ageMax: 36, season: 1, personality: 'pub', archetype: 'captain',
    });
    const after = developSundayPlayer(createSundayRng(4, 0), { ...player, minutesPlayed: 900 }, member, 0);
    expect(after.player.attributes.pace).toBeLessThan(player.attributes.pace);
    expect(after.player.attributes.mental).toBeGreaterThanOrEqual(player.attributes.mental);
    expect(after.player.age).toBe(37);
  });

  it('resets season counters and clears injuries and bans', () => {
    const { player } = generateSundayPlayer({
      rng: createSundayRng(5, 0), id: 'z', clubId: 'c', position: 'ST', quality: 45,
      ageMin: 27, ageMax: 27, season: 1, personality: 'pub',
    });
    const used = { ...player, goals: 12, appearances: 20, minutesPlayed: 1500, yellowCards: 4, injured: true, injuryWeeks: 3, suspendedUntilWeek: 30 };
    const after = developSundayPlayer(createSundayRng(6, 0), used, member, 0).player;
    expect(after.goals).toBe(0);
    expect(after.appearances).toBe(0);
    expect(after.minutesPlayed).toBe(0);
    expect(after.yellowCards).toBe(0);
    expect(after.injured).toBe(false);
    expect(after.suspendedUntilWeek).toBeUndefined();
    expect(after.fitness).toBe(100);
  });
});

describe('records and legends', () => {
  it('only replaces a record when it is actually beaten', () => {
    let records = recordSundayRecord([], 'biggest-win', '3-goal win', 3, 1, 5);
    expect(records).toHaveLength(1);
    records = recordSundayRecord(records, 'biggest-win', '2-goal win', 2, 1, 6);
    expect(records[0].value).toBe('3-goal win');
    records = recordSundayRecord(records, 'biggest-win', '5-goal win', 5, 1, 7);
    expect(records[0].value).toBe('5-goal win');
    expect(records).toHaveLength(1);
  });

  it('remembers a servant and forgets a passer-by', () => {
    const base = { clubApps: 0, clubGoals: 0 } as never;
    void base;
    expect(qualifiesAsLegend({ clubApps: 60, clubGoals: 0 } as never)).toBe(true);
    expect(qualifiesAsLegend({ clubApps: 3, clubGoals: 40 } as never)).toBe(true);
    expect(qualifiesAsLegend({ clubApps: 3, clubGoals: 1 } as never)).toBe(false);
  });
});

describe('the rollover, in the running game', () => {
  beforeEach(async () => {
    useGameStore.getState().resetGame();
    await useGameStore.getState().startSundayLeague({ personality: 'serious', seed: 777 });
  });

  it('refuses to roll a season that is not finished', async () => {
    const season = useGameStore.getState().season;
    await useGameStore.getState().endSundaySeason();
    expect(useGameStore.getState().season).toBe(season);
  });

  it('rolls into a clean new season with a fresh division and history kept', async () => {
    const total = sundaySeasonWeeks('sun-4');
    for (let i = 0; i < total + 2; i++) {
      const s = useGameStore.getState();
      if (s.sunday!.pendingEvent) await s.resolveSundayEvent(s.sunday!.pendingEvent.choices[0].id);
      if (s.sunday!.folded || s.sunday!.seasonComplete) break;
      await useGameStore.getState().advanceWeek();
    }
    if (useGameStore.getState().sunday!.folded) return;

    const before = useGameStore.getState();
    const squadIdsBefore = new Set(before.sunday!.squad.map(m => m.playerId));
    await useGameStore.getState().endSundaySeason();
    const after = useGameStore.getState();

    expect(after.season).toBe(before.season + 1);
    expect(after.week).toBe(1);
    expect(after.sunday!.history).toHaveLength(1);
    expect(after.sunday!.history[0].season).toBe(before.season);
    expect(after.fixtures.every(m => !m.played)).toBe(true);
    expect(after.sunday!.cup!.ties.every(t => !t.played)).toBe(true);
    expect(after.sunday!.lastMatch).toBeNull();
    expect(after.sunday!.seasonStats.played).toBe(0);

    // Last season's opposition and their players are gone; the club's own
    // players (minus retirements) are not.
    const clubIds = new Set(Object.keys(after.clubs));
    expect(clubIds.size).toBe(getSundayDivision(after.sunday!.divisionId).teamCount);
    for (const m of after.sunday!.squad) {
      expect(squadIdsBefore.has(m.playerId)).toBe(true);
      expect(after.players[m.playerId]).toBeTruthy();
    }
    // Nothing orphaned: every player in the map belongs to a club in the world.
    for (const p of Object.values(after.players)) {
      expect(clubIds.has(p.clubId)).toBe(true);
    }
    // A club that is still in the division is still the SAME club. The feud,
    // the defector and the taunts all carry over by id, so a renamed opponent
    // would have made every one of those lines a lie.
    for (const id of after.sunday!.divisionClubIds) {
      const was = before.clubs[id];
      if (was) expect(after.clubs[id].name, id).toBe(was.name);
    }
    assertSundayState({
      sunday: after.sunday!, players: after.players, clubs: after.clubs,
      playerClubId: after.playerClubId, fixtures: after.fixtures, week: after.week,
    });
  });
});
