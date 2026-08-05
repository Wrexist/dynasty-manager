/**
 * Four rollover defects that all shared one root cause: the season was not
 * SETTLED before things started reading league tables off it.
 *
 * `endSeasonImpl` fast-forwards every division's outstanding fixtures before
 * building the final tables. The promotion playoff was seeded BEFORE that ran,
 * off a different table. Symptoms, all reproduced by driving the real store:
 *
 *   1. A club seeded into the playoff off the pre-catch-up table could be
 *      auto-relegated by the post-catch-up one — removed from its league once
 *      but added to two. eng-2 grew to 25 clubs and stayed there, ~1 rollover
 *      in 10.
 *   2. `divisionFixtures` only re-syncs with `fixtures` inside `advanceWeek`,
 *      so ending the season straight after the final match left that match
 *      unplayed in `divisionFixtures` — and the catch-up invented a different
 *      scoreline for it, into the table that decides promotion.
 *   3. `playoffState` was consumed by rollover but never cleared, so the NEXT
 *      season's rollover replayed last season's bracket and last season's
 *      scorelines. A 19th-placed club was handed a promotion playoff.
 *   4. When a playoff produced no winner, the promotion slot went unfilled and
 *      the two tiers drifted apart permanently.
 *
 * These are integration tests on purpose. Every one of these passed unit-level
 * scrutiny of the function it lived in; they only appear when the pieces run
 * in the order the game runs them.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { applyPromotionRelegation } from '@/utils/promotionRelegation';
import { LEAGUES } from '@/data/league';
import type { LeagueTableEntry } from '@/types/game';

/** eng-2: four playoff spots, so the player can plausibly land in the zone. */
const SECOND_TIER_CLUB = 'coventry-city';

/** Roll the season, playing out any interactive playoff the player enters. */
function rollSeason(): { playedTies: string[] } {
  const tie = (m: { homeClubId: string; homeGoals: number; awayGoals: number; awayClubId: string }) =>
    `${m.homeClubId} ${m.homeGoals}-${m.awayGoals} ${m.awayClubId}`;
  useGameStore.getState().endSeason();
  const playedTies: string[] = [];
  // Bounded: a 4-team bracket is 2 rounds, and the guard means a bug that fails
  // to end the phase shows up as a failed assertion rather than a hung test.
  for (let guard = 0; guard < 6; guard++) {
    const s = useGameStore.getState();
    if (s.seasonPhase !== 'playoff' || !s.playoffState?.pendingMatch) break;
    const played = useGameStore.getState().playCurrentMatch();
    expect(played).not.toBeNull();
    playedTies.push(tie(played!));
  }
  return { playedTies };
}

const leagueSizes = () =>
  Object.fromEntries(
    Object.entries(useGameStore.getState().divisionClubs).map(([k, v]) => [k, v.length]),
  );

describe('season rollover — league sizes are conserved', () => {
  beforeEach(() => { useGameStore.getState().initGame(SECOND_TIER_CLUB); });

  // The drift only appeared when the playoff winner was ALSO in the final
  // table's relegation zone, which is a minority of rollovers. A single
  // rollover missed it; the original test passed for days.
  it('every league keeps its size across repeated rollovers', () => {
    const before = leagueSizes();
    for (let season = 0; season < 12; season++) {
      rollSeason();
      const after = leagueSizes();
      for (const [leagueId, size] of Object.entries(before)) {
        expect(after[leagueId], `${leagueId} drifted in season ${season + 1}`).toBe(size);
      }
    }
  });
});

describe('season rollover — the playoff belongs to the season that ran it', () => {
  beforeEach(() => { useGameStore.getState().initGame(SECOND_TIER_CLUB); });

  it('playoffState is cleared once rollover has consumed it', () => {
    rollSeason();
    expect(useGameStore.getState().seasonPhase).toBe('regular');
    // Left set, this is the pin the NEXT rollover seeds its bracket from.
    expect(useGameStore.getState().playoffState).toBeNull();
  });

  it('a club outside the playoff zone never gets a playoff run recorded', () => {
    for (let season = 0; season < 12; season++) {
      const { playedTies } = rollSeason();
      const history = useGameStore.getState().seasonHistory.slice(-1)[0];
      const recorded = (history?.playoffRun ?? []).map(
        r => `${r.homeClubId} ${r.homeGoals}-${r.awayGoals} ${r.awayClubId}`,
      );

      // A recorded run with no ties played is never legitimate: it means
      // rollover simulated the player's own playoff behind their back, which is
      // exactly what the interactive playoff exists to prevent.
      expect(recorded, `season ${season + 1}: playoff decided without the player`)
        .toEqual(playedTies);
    }
  });
});

describe('season rollover — the player\'s own results are authoritative', () => {
  beforeEach(() => { useGameStore.getState().initGame(SECOND_TIER_CLUB); });

  /**
   * Asserts the CONTRACT of the fix rather than a downstream outcome.
   *
   * The tempting test — force a season, roll it, check the club went up or down
   * — cannot tell the two versions apart. At init only the player's club has a
   * stored lineup, so the catch-up's forfeit rule ("no XI = concede") produces
   * standings that happen to agree with a forced table. Two drafts of this test
   * passed against the broken code for exactly that reason.
   *
   * What the fix actually guarantees is narrower and directly observable:
   * `endSeason` settles the league from `state.fixtures` and COMMITS it, so the
   * player's own results are in `divisionFixtures` before anything reads a table.
   * Pre-fix, `endSeason` never wrote fixtures at all.
   */
  it('endSeason commits the settled league, seeded from `fixtures`', () => {
    const s = useGameStore.getState();
    const div = s.playerDivision;
    const playerClub = s.playerClubId;

    // A scoreline nothing else in the codebase produces, so its presence is
    // proof these exact results survived rather than being re-invented.
    const played = s.fixtures.map(f => ({
      ...f, played: true, events: [],
      homeGoals: f.homeClubId === playerClub ? 7 : 1,
      awayGoals: f.awayClubId === playerClub ? 7 : 1,
    }));
    useGameStore.setState({
      fixtures: played,
      divisionFixtures: {
        ...s.divisionFixtures,
        [div]: s.divisionFixtures[div].map(f => ({ ...f, played: false })),
      },
    });
    expect(useGameStore.getState().divisionFixtures[div].every(f => !f.played)).toBe(true);

    // Rollover regenerates fixtures for the new season, so the committed settle
    // is only visible while it happens. The settle `set` is the first store
    // write `endSeason` makes, so the first snapshot in which the player's
    // division is played is the one rollover went on to consume.
    let settledDivision: typeof played | null = null;
    const unsubscribe = useGameStore.subscribe(state => {
      if (settledDivision) return;
      const dv = state.divisionFixtures[div];
      if (dv?.length && dv.every(f => f.played)) settledDivision = dv as typeof played;
    });
    try {
      useGameStore.getState().endSeason();
    } finally {
      unsubscribe();
    }

    expect(settledDivision, 'endSeason did not commit a settled league').not.toBeNull();
    const playerGames = settledDivision!.filter(
      f => f.homeClubId === playerClub || f.awayClubId === playerClub,
    );
    expect(playerGames.length).toBeGreaterThan(0);
    for (const f of playerGames) {
      const forHim = f.homeClubId === playerClub ? f.homeGoals : f.awayGoals;
      expect(forHim, 'a played result was overwritten by the catch-up').toBe(7);
    }
  });
});

describe('applyPromotionRelegation — promotions and relegations balance', () => {
  const table = (ids: string[]): LeagueTableEntry[] =>
    ids.map(clubId => ({
      clubId, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
    })) as LeagueTableEntry[];

  const clubsFor = (byLeague: Record<string, string[]>) =>
    Object.fromEntries(
      Object.entries(byLeague).flatMap(([divisionId, ids]) =>
        ids.map(id => [id, { id, divisionId, budget: 1_000_000, reputation: 3 } as never]),
      ),
    );

  /** The full English pyramid, populated.
   *
   *  Populating only TWO tiers is not enough to reproduce the double-move: the
   *  loop skips any pair with an empty table, so tier 2's relegation leg never
   *  runs and a club promoted out of tier 2 is never also sent down to tier 3.
   *  The first draft did exactly that and passed against the broken code. */
  function pyramid() {
    // `countryId`, NOT `country` — `getLeaguesByCountry` filters on the former,
    // so 'England' here makes `applyPromotionRelegation` return early and the
    // whole test vacuously pass.
    const tiers = LEAGUES.filter(l => l.countryId === 'eng').sort((a, b) => a.tier - b.tier);
    const ids: Record<string, string[]> = {};
    for (const t of tiers) {
      ids[t.id] = Array.from({ length: t.teamCount }, (_, i) => `${t.id}-c${i}`);
    }
    const tables = Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, table(v)]));
    return { tiers, ids, tables };
  }

  it('never promotes and relegates the same club in one pass', () => {
    const { tiers, ids, tables } = pyramid();
    const lower = tiers[1];
    // The bottom club of tier 2, pinned into the playoff as the sole candidate.
    // That is exactly the disagreement the pre-catch-up seeding produced: a club
    // the final table relegates, seeded off a table that had it in the playoff
    // zone. Unguarded it is removed from tier 2 once and added to BOTH tier 1
    // and tier 3.
    const doomed = ids[lower.id][ids[lower.id].length - 1];

    const result = applyPromotionRelegation(
      'eng', ids, tables, clubsFor(ids) as never, `${tiers[0].id}-c0`,
      (home) => home,
      { leagueId: lower.id, candidates: [doomed] },
    );

    const landedIn = Object.entries(result.updatedDivisionClubs)
      .filter(([, clubIds]) => clubIds.includes(doomed))
      .map(([id]) => id);
    expect(landedIn, `${doomed} ended up in ${landedIn.join(' and ')}`).toHaveLength(1);
  });

  it('keeps every tier at its configured size', () => {
    const { tiers, ids, tables } = pyramid();
    const lower = tiers[1];
    // Seeding pinned entirely onto clubs the final table auto-relegates: every
    // candidate is filtered out, so the playoff yields no winner and tier 2 has
    // one fewer club going up than tier 1 has coming down.
    const result = applyPromotionRelegation(
      'eng', ids, tables, clubsFor(ids) as never, `${tiers[0].id}-c0`,
      (home) => home,
      { leagueId: lower.id, candidates: ids[lower.id].slice(-lower.relegationSpots) },
    );

    for (const t of tiers) {
      // The bottom tier is deliberately left short by `replacedSlots` — the
      // caller generates the replacement clubs after this returns. Every tier
      // above it must balance exactly.
      const expected = t.id === tiers[tiers.length - 1].id
        ? t.teamCount - t.replacedSlots
        : t.teamCount;
      expect(result.updatedDivisionClubs[t.id], `${t.id} changed size`)
        .toHaveLength(expected);
    }
  });
});
