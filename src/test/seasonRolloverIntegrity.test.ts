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
import { buildLeagueTable, LEAGUES } from '@/data/league';
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

  it('a result in `fixtures` is not re-simulated from stale `divisionFixtures`', () => {
    const s = useGameStore.getState();
    const div = s.playerDivision;
    const playerClub = s.playerClubId;

    // Play out the player's whole division in `fixtures` with lopsided results
    // that make the standings unambiguous, and leave `divisionFixtures` — which
    // only re-syncs inside `advanceWeek` — entirely unplayed.
    const fixtures = s.fixtures.map(f => ({
      ...f,
      played: true,
      homeGoals: f.homeClubId === playerClub ? 5 : 0,
      awayGoals: f.awayClubId === playerClub ? 5 : 0,
      events: [],
    }));
    useGameStore.setState({
      fixtures,
      divisionFixtures: { ...s.divisionFixtures, [div]: s.divisionFixtures[div].map(f => ({ ...f, played: false })) },
    });

    // Winning every game by five must top the table. If the catch-up overwrote
    // those results with invented ones, it won't.
    const expected = buildLeagueTable(fixtures, s.divisionClubs[div]);
    expect(expected[0].clubId).toBe(playerClub);

    useGameStore.getState().endSeason();
    // Rollover regenerates fixtures, so the recorded final position is the only
    // durable evidence of the table it actually decided from. Deliberately NOT
    // "did they get promoted" — a randomly re-simulated season promotes the
    // player about one time in eight, so that assertion passed on the broken
    // code often enough to be worthless.
    const history = useGameStore.getState().seasonHistory.slice(-1)[0];
    expect(history?.position, 'a season won by five goals a game did not finish 1st')
      .toBe(1);
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
