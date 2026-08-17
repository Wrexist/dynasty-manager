/**
 * Regression: the standings must reflect the results, and an unemployed
 * career must not freeze the world.
 *
 * 1. **`buildLeagueTable` memoised on how MANY fixtures were played, not on
 *    what they said.** Two different scorelines at the same played count in the
 *    same league shared a cache entry. The `invincible` perk reaches exactly
 *    that state: `rewindMatch` restores the pre-match fixtures and table (it
 *    does not clear the cache), the player replays the tie, and the rebuild
 *    afterwards has the same fixture count and the same clubs — so the table
 *    from the match they just erased came back and was written into
 *    `leagueTable`/`divisionTables`. On the final week of a season, that is the
 *    table `endSeasonImpl` records the season's history from. The key now
 *    includes a hash of the results, so a stale hit is impossible rather than
 *    merely avoided by convention.
 *
 * 2. **The unemployed week used `m.week !== newWeek`** where the employed path
 *    deliberately uses `>` to catch up. A mid-season sacking leaves `week`
 *    already advanced past the week it simulated, so the first unemployed tick
 *    skipped a whole round for every division, with no catch-up to recover it.
 *
 * 3. **The unemployed week updated `divisionTables` but not `leagueTable`.** A
 *    season that ended while unemployed therefore recorded its history from a
 *    table frozen at the week of the sacking.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { buildLeagueTable, clearLeagueTableCache } from '@/data/league';
import { useGameStore } from '@/store/gameStore';
import type { Match } from '@/types/game';

const CLUB = 'manchester-city';

function fixture(id: string, home: string, away: string, hg: number, ag: number): Match {
  return { id, week: 1, homeClubId: home, awayClubId: away, homeGoals: hg, awayGoals: ag, played: true, competition: 'league' } as Match;
}

describe('buildLeagueTable keys on results, not on how many there are', () => {
  beforeEach(() => clearLeagueTableCache());

  it('a changed scoreline at a constant played count changes the table', () => {
    const ids = ['a', 'b'];
    const won = buildLeagueTable([fixture('m1', 'a', 'b', 3, 0)], ids);
    expect(won[0].clubId).toBe('a');
    expect(won[0].points).toBe(3);

    // Same league, same fixture id, same played count — the exact shape a
    // rewind-and-replay produces. This must NOT return the cached table.
    const lost = buildLeagueTable([fixture('m1', 'a', 'b', 0, 3)], ids);
    expect(lost).not.toBe(won);
    expect(lost[0].clubId).toBe('b');
    expect(lost.find(e => e.clubId === 'a')!.points).toBe(0);
  });

  it('an identical fixture set still hits the cache', () => {
    const ids = ['a', 'b'];
    const first = buildLeagueTable([fixture('m1', 'a', 'b', 1, 1)], ids);
    const second = buildLeagueTable([fixture('m1', 'a', 'b', 1, 1)], ids);
    expect(second).toBe(first);
  });
});

describe('an unemployed career keeps the world moving', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    localStorage.clear();
    useGameStore.getState().initGame(CLUB);
  });

  it('does not leave a round of fixtures behind after a mid-season sacking', () => {
    // Put the manager out of work with the season part-played, and desync
    // `week` from the last simulated week exactly as a mid-season sacking does.
    useGameStore.setState({
      gameMode: 'career',
      careerManager: { ...(useGameStore.getState().careerManager ?? {}), contract: null, unemployedWeeks: 0 } as never,
      week: 6,
    });

    useGameStore.getState().advanceWeek();
    useGameStore.getState().advanceWeek();

    const s = useGameStore.getState();
    const stranded: string[] = [];
    for (const [leagueId, fixtures] of Object.entries(s.divisionFixtures)) {
      for (const m of fixtures) {
        if (!m.played && m.week < s.week) stranded.push(`${leagueId}:${m.id}@w${m.week}`);
      }
    }
    expect(stranded, `fixtures left unplayed behind week ${s.week}`).toEqual([]);
  });

  it('keeps leagueTable in step with divisionTables', () => {
    useGameStore.setState({
      gameMode: 'career',
      careerManager: { ...(useGameStore.getState().careerManager ?? {}), contract: null, unemployedWeeks: 0 } as never,
    });

    useGameStore.getState().advanceWeek();

    const s = useGameStore.getState();
    const div = s.divisionTables[s.playerDivision];
    expect(div).toBeTruthy();
    // The season-end path reads `leagueTable`; a stale one recorded a
    // half-played season into history.
    expect(s.leagueTable.map(e => `${e.clubId}:${e.points}`))
      .toEqual(div.map(e => `${e.clubId}:${e.points}`));
  });
});
