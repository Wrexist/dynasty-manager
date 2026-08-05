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
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { getPlayerPlayoffCandidates } from '@/store/slices/orchestration/playoff';
import { buildLeagueTable, LEAGUES } from '@/data/league';
import { determineProRelZones } from '@/utils/promotionRelegation';

/** A club that lands in the playoff ZONE from a fresh init.
 *
 *  This matters and is not arbitrary. At init no fixtures are played, so the
 *  table is all-zero and `buildLeagueTable` breaks ties on `clubId.localeCompare`
 *  — which puts eng-2 positions 3-6 at burnley, cardiff-city, coventry-city,
 *  derby-county. The first draft of this file used `leeds-united`, which sits
 *  OUTSIDE that zone, so every playoff assertion fell through an escape hatch
 *  and the file passed while testing none of the feature. */
const PLAYOFF_CLUB = 'coventry-city';
/** A top-tier club, whose league has playoffSpots: 0. */
const TOP_TIER_CLUB = 'manchester-city';

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
  beforeEach(() => { useGameStore.getState().initGame(PLAYOFF_CLUB); });

  it('the club sits in a league that actually has a playoff', () => {
    const s = useGameStore.getState();
    const league = LEAGUES.find(l => l.id === s.playerDivision)!;
    expect(league.playoffSpots).toBeGreaterThanOrEqual(2);
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
    // Drive the club into the playoff zone by hand: the phase machinery is what
    // is under test, not the league simulation that would get us there.
    const s0 = useGameStore.getState();
    // Hard assertion, no escape hatch: if the club stops qualifying this test
    // must FAIL rather than quietly verify nothing.
    const detected = getPlayerPlayoffCandidates(useGameStore.getState());
    expect(detected, `${PLAYOFF_CLUB} must start inside the playoff zone`).not.toBeNull();
    expect(detected!.candidates).toContain(PLAYOFF_CLUB);

    const season = s0.season;
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
      const played = useGameStore.getState().playCurrentMatch();
      expect(played).not.toBeNull();
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
