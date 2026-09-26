/**
 * An unemployed career manager must not stop the football calendar
 * (audit 2026-09-25, S5 remainder).
 *
 * The unemployed week returns before the employed game loop, and it simulated
 * LEAGUE fixtures only. So a season spent out of work had no domestic Cup or
 * League Cup rounds, no Super Cups, and every continental tournament frozen in
 * its group stage: the Cup reached rollover with `winner: null`, and next
 * season's qualification and coefficients were computed off that frozen state.
 *
 * Both branches now run the same `progressCompetitionsWeek`. The unemployed one
 * passes `''` as the managed club, so every due tie — the ex-club's included —
 * is simulated and nothing is posted to the inbox.
 *
 * A full season of simulation — listed in SLOW_SUITES (vitest.config.ts). The
 * group-stage verdict guard that makes the no-club caller safe is pinned,
 * quickly, in continentalGroupVerdict.test.ts.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { generateContinentalDraw } from '@/data/continentalDraw';
import { createDefaultManager } from '@/utils/managerCareer';
import { tick } from '@/test/helpers/eventLoop';
import type { ContinentalCompetition, SuperCupMatch } from '@/types/game';

const CLUB = 'manchester-city';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const realRandom = Math.random;

/** Season 1 has no continental football or Super Cups (they are drawn at the
 *  first rollover), so give the world a season-2-shaped calendar directly:
 *  three 32-club continental draws from the strongest real clubs, and both
 *  Super Cups. The user's club is deliberately left out of all of it. */
function seedSeasonTwoCompetitions(): void {
  const s = useGameStore.getState();
  const ranked = Object.values(s.clubs)
    .filter(c => c.id !== CLUB)
    .sort((a, b) => b.reputation - a.reputation || a.id.localeCompare(b.id))
    .map(c => c.id);
  const draw = (comp: ContinentalCompetition, ids: string[]) =>
    generateContinentalDraw(comp, s.season, ids, {}, CLUB, {}, s.totalWeeks);
  const superCup = (type: 'domestic' | 'continental', home: string, away: string, week: number): SuperCupMatch => ({
    type, homeClubId: home, awayClubId: away, played: false, homeGoals: 0, awayGoals: 0, week, winnerId: null,
  });
  const english = ranked.filter(id => s.clubs[id].divisionId === 'eng');
  useGameStore.setState({
    championsCup: draw('champions_cup', ranked.slice(0, 32)),
    shieldCup: draw('shield_cup', ranked.slice(32, 64)),
    conferenceCup: draw('conference_cup', ranked.slice(64, 96)),
    domesticSuperCup: superCup('domestic', english[0], english[1], 1),
    continentalSuperCup: superCup('continental', ranked[0], ranked[2], 2),
  });
}

describe('an unemployed season still plays every competition', () => {
  beforeEach(async () => {
    Math.random = mulberry32(0x5EA5);
    useGameStore.getState().resetGame();
    localStorage.clear();
    await useGameStore.getState().initGame(CLUB);
    useGameStore.setState({ settings: { ...useGameStore.getState().settings, autoSave: false } });
  });
  afterEach(() => { Math.random = realRandom; });

  it('crowns a Cup, League Cup and continental winner and plays both Super Cups', { timeout: 300_000 }, async () => {
    seedSeasonTwoCompetitions();
    useGameStore.setState({
      gameMode: 'career',
      // 40 is far from retirement, so 38 weeks out of work cannot trigger the
      // forced-retirement exit before the season is over.
      careerManager: createDefaultManager('Test Manager', 'England', 40, []),
    });
    const totalWeeks = useGameStore.getState().totalWeeks;
    const season = useGameStore.getState().season;
    const inboxBefore = useGameStore.getState().messages.length;

    // The unemployed tick plays week `week + 1`, so every scheduled week up to
    // `totalWeeks` has been played once `week` reaches it; the next tick rolls
    // the season over.
    while (useGameStore.getState().week < totalWeeks) {
      await useGameStore.getState().advanceWeek();
      await tick();
    }
    const s = useGameStore.getState();
    expect(s.season).toBe(season);
    expect(s.careerManager?.contract).toBeNull();

    expect(s.cup.winner, 'domestic Cup winner').toBeTruthy();
    expect(s.cup.ties.every(t => t.played), 'every Cup tie played').toBe(true);
    expect(s.leagueCup?.winner, 'League Cup winner').toBeTruthy();
    for (const t of [s.championsCup, s.shieldCup, s.conferenceCup]) {
      expect(t?.currentPhase, `${t?.competition} finished`).toBe('complete');
      expect(t?.winnerId, `${t?.competition} winner`).toBeTruthy();
    }
    expect(s.domesticSuperCup?.played).toBe(true);
    expect(s.domesticSuperCup?.winnerId).toBeTruthy();
    expect(s.continentalSuperCup?.played).toBe(true);

    // …and every division — the 46-round lower tiers included — has finished
    // its league season on the 38-week calendar (S9: midweek double rounds).
    for (const [leagueId, fixtures] of Object.entries(s.divisionFixtures)) {
      expect(fixtures.filter(m => !m.played).length, `${leagueId}: unplayed fixtures`).toBe(0);
    }

    // Nobody is managed, so the competitions post nothing: the only new inbox
    // traffic is the unemployed branch's own weekly "Between Jobs" note plus
    // AI-world news. No "Cup:", "Eliminated" or "Winners!" message may appear.
    const posted = s.messages.slice(0, s.messages.length - inboxBefore);
    expect(posted.filter(m => /Eliminated|Winners!|Knockout!|^Cup:|^League Cup:/.test(m.title))).toEqual([]);

    // And the rollover that follows starts a new season normally.
    await useGameStore.getState().advanceWeek();
    expect(useGameStore.getState().season).toBe(season + 1);
  });
});
