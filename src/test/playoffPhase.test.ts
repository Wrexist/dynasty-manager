/**
 * The interactive promotion playoff, driven through the real store.
 *
 * These are the tests `docs/PLAN-interactive-playoff.md` asks for before the
 * feature is wired up. They exercise the store the way the game does —
 * `endSeason()`, `playCurrentMatch()` — so the store layer is verified without
 * needing to render anything.
 *
 * The 90% path matters most: a club NOT in a playoff must roll the season
 * exactly as before. That is asserted first and deliberately.
 *
 * WHY THE TABLE IS BUILT BY HAND. The first version of this file leaned on the
 * fact that a freshly-initialised save has an all-zero table, which
 * `buildLeagueTable` breaks on `clubId.localeCompare` — so positions 3-6 of
 * eng-2 were a known alphabetical slice. `endSeason` now settles the league
 * before anything reads a table off it (see `seasonRolloverIntegrity.test.ts`),
 * so the standings at rollover are simulated ones and nobody is deterministically
 * in the playoff zone. Forcing the results is both more honest and more precise:
 * the club under test is placed at an exact position rather than an assumed one.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { getPlayerPlayoffCandidates } from '@/store/slices/orchestration/playoff';
import { buildLeagueTable, LEAGUES } from '@/data/league';
import { determineProRelZones } from '@/utils/promotionRelegation';

/** A second-tier club — eng-2 has four playoff spots. */
const PLAYOFF_CLUB = 'coventry-city';
/** A top-tier club, whose league has playoffSpots: 0. */
const TOP_TIER_CLUB = 'manchester-city';

/**
 * Play out the player's division so the final table is exactly `order`.
 *
 * Every fixture is decided in favour of the better-ranked side, so in a double
 * round-robin the club at rank i finishes on 2*(n-1-i) wins — strictly
 * decreasing, hence no tie-breaks and no ambiguity.
 *
 * Writes BOTH `fixtures` and `divisionFixtures[div]`: the season-settling step
 * only leaves results alone when they are already `played`.
 */
function forceFinalTable(order: string[]): void {
  const s = useGameStore.getState();
  const div = s.playerDivision;
  const rank = new Map(order.map((id, i) => [id, i]));
  const decided = s.fixtures.map(f => {
    const homeBetter = (rank.get(f.homeClubId) ?? 99) < (rank.get(f.awayClubId) ?? 99);
    return {
      ...f, played: true, events: [],
      homeGoals: homeBetter ? 1 : 0,
      awayGoals: homeBetter ? 0 : 1,
    };
  });
  useGameStore.setState({
    fixtures: decided,
    divisionFixtures: { ...s.divisionFixtures, [div]: decided },
    week: s.totalWeeks,
  });
}

/** Put `clubId` at `position` (1-indexed) and everyone else around it. */
function placeAt(clubId: string, position: number): string[] {
  const s = useGameStore.getState();
  const rest = (s.divisionClubs[s.playerDivision] || []).filter(id => id !== clubId);
  const order = [...rest];
  order.splice(position - 1, 0, clubId);
  forceFinalTable(order);
  return order;
}

/** The playoff zone as the game computes it, straight from the current table. */
function playoffZoneFromTable(): string[] {
  const s = useGameStore.getState();
  const league = LEAGUES.find(l => l.id === s.playerDivision)!;
  const clubIds = s.divisionClubs[s.playerDivision] || [];
  const table = buildLeagueTable(s.fixtures, clubIds);
  return determineProRelZones(table, league).playoffCandidates;
}

describe('playoff phase — the non-playoff path is untouched', () => {
  beforeEach(() => { useGameStore.getState().initGame(TOP_TIER_CLUB); });

  it('a top-tier club has no playoff and rolls the season normally', () => {
    const before = useGameStore.getState();
    expect(LEAGUES.find(l => l.id === before.playerDivision)!.playoffSpots).toBe(0);
    expect(getPlayerPlayoffCandidates(before)).toBeNull();

    const season = before.season;
    useGameStore.getState().endSeason();
    const after = useGameStore.getState();

    // Season rolled: phase stayed regular, no playoff state, history appended.
    expect(after.seasonPhase).not.toBe('playoff');
    expect(after.playoffState).toBeNull();
    expect(after.seasonHistory.some(h => h.season === season)).toBe(true);
    expect(after.season).toBe(season + 1);
  });
});

describe('playoff phase — a qualifying club', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(PLAYOFF_CLUB);
    // 3rd: first outside automatic promotion, top seed of a four-team bracket.
    placeAt(PLAYOFF_CLUB, 3);
  });

  it('the club sits in a league that actually has a playoff', () => {
    const s = useGameStore.getState();
    expect(LEAGUES.find(l => l.id === s.playerDivision)!.playoffSpots).toBeGreaterThanOrEqual(2);
  });

  it('detection agrees with the zone helper, and the club is in the zone', () => {
    const candidates = playoffZoneFromTable();
    const s = useGameStore.getState();
    expect(candidates).toContain(s.playerClubId);
    const detected = getPlayerPlayoffCandidates(s);
    expect(detected).not.toBeNull();
    expect(detected!.candidates).toEqual(candidates);
  });

  it('entering the playoff defers the rollover, and playing it out completes the season', () => {
    // Hard assertion, no escape hatch: if the club stops qualifying this test
    // must FAIL rather than quietly verify nothing.
    const detected = getPlayerPlayoffCandidates(useGameStore.getState());
    expect(detected, `${PLAYOFF_CLUB} must start inside the playoff zone`).not.toBeNull();
    expect(detected!.candidates).toContain(PLAYOFF_CLUB);

    const season = useGameStore.getState().season;
    useGameStore.getState().endSeason();
    const entered = useGameStore.getState();

    expect(entered.seasonPhase).toBe('playoff');
    expect(entered.playoffState).not.toBeNull();
    expect(entered.playoffState!.pendingMatch).not.toBeNull();
    // Rollover is DEFERRED — this is the whole point.
    expect(entered.seasonHistory.some(h => h.season === season)).toBe(false);

    const tie = entered.playoffState!.pendingMatch!;
    expect([tie.homeClubId, tie.awayClubId]).toContain(entered.playerClubId);
    expect(entered.playoffState!.candidates).toContain(entered.playerClubId);

    // Play every tie the bracket hands us, to a bounded depth.
    for (let guard = 0; guard < 4; guard++) {
      const cur = useGameStore.getState();
      if (cur.seasonPhase !== 'playoff' || !cur.playoffState?.pendingMatch) break;
      expect(useGameStore.getState().playCurrentMatch()).not.toBeNull();
    }

    const done = useGameStore.getState();
    // The season has now rolled, exactly once.
    expect(done.seasonPhase).not.toBe('playoff');
    expect(done.seasonHistory.filter(h => h.season === season)).toHaveLength(1);
    expect(done.season).toBe(season + 1);

    // Every tie the player played is on the record, and the summary can show it.
    const history = done.seasonHistory.find(h => h.season === season)!;
    expect(history.playoffRun).toBeDefined();
    expect(history.playoffRun!.length).toBeGreaterThan(0);
    for (const r of history.playoffRun!) {
      expect([r.homeClubId, r.awayClubId]).toContain(PLAYOFF_CLUB);
      expect(r.homeGoals).toBeGreaterThanOrEqual(0);
      expect(r.awayGoals).toBeGreaterThanOrEqual(0);
    }
  });

  it('league sizes are unchanged after a playoff season rolls', () => {
    const before = useGameStore.getState();
    const sizesBefore = Object.fromEntries(
      Object.entries(before.divisionClubs).map(([k, v]) => [k, v.length]),
    );

    useGameStore.getState().endSeason();
    for (let guard = 0; guard < 4; guard++) {
      const cur = useGameStore.getState();
      if (cur.seasonPhase !== 'playoff' || !cur.playoffState?.pendingMatch) break;
      useGameStore.getState().playCurrentMatch();
    }

    const after = useGameStore.getState();
    for (const [leagueId, size] of Object.entries(sizesBefore)) {
      expect(after.divisionClubs[leagueId]?.length, `${leagueId} changed size`).toBe(size);
    }
  });
});

describe('playoff phase — the UI and the engine agree on which match is next', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(PLAYOFF_CLUB);
    placeAt(PLAYOFF_CLUB, 3);
  });

  it('the pending tie is what a screen reading the store would show', () => {
    useGameStore.getState().endSeason();
    const s = useGameStore.getState();
    expect(s.seasonPhase).toBe('playoff');

    const pending = s.playoffState!.pendingMatch!;
    // `useCurrentMatch` resolves the playoff FIRST, so Dashboard, MatchPrep and
    // MatchDay name the same opponent the engine is about to play. Returning a
    // stale league fixture here is the failure the tournament-priority note in
    // useGameSelectors describes: one opponent on screen, another on the pitch,
    // possibly with home/away flipped.
    const isHome = pending.homeClubId === s.playerClubId;
    const opponentId = isHome ? pending.awayClubId : pending.homeClubId;
    expect(s.clubs[opponentId]).toBeDefined();
    expect(opponentId).not.toBe(s.playerClubId);

    // The round label the badge derives from is present and sane.
    expect([2, 4]).toContain(s.playoffState!.teamsInRound);

    // And the engine plays exactly that match.
    const played = useGameStore.getState().playCurrentMatch();
    expect(played).not.toBeNull();
    expect([played!.homeClubId, played!.awayClubId].sort())
      .toEqual([pending.homeClubId, pending.awayClubId].sort());
  });

  it('the playoff tie never enters the league fixture list', () => {
    const fixturesBefore = useGameStore.getState().fixtures.length;
    useGameStore.getState().endSeason();
    const pending = useGameStore.getState().playoffState!.pendingMatch!;
    useGameStore.getState().playCurrentMatch();

    const after = useGameStore.getState();
    // The final table is rebuilt from `fixtures` at rollover, so a playoff tie
    // living there would corrupt the standings the bracket was seeded from.
    expect(after.fixtures.some(f => f.id === pending.id)).toBe(false);
    expect(after.fixtures.length).toBeLessThanOrEqual(fixturesBefore);
  });
});
