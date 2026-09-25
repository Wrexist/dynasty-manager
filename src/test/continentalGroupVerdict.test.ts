/**
 * The continental group-stage verdict ("X Knockout!" / "X Eliminated") is only
 * posted to a club that was actually drawn into that tournament.
 *
 * `generateContinentalDraw` sets `playerEliminated` for every tournament the
 * user's club is NOT in, and the verdict read that flag alone — so a manager was
 * told they had been "eliminated from the group stage" of each tournament their
 * club never entered, and the unemployed week (which now runs the same code
 * with no managed club, see unemployedCompetitions.test.ts) would have posted
 * all three. Found while extracting `progressCompetitionsWeek` (audit
 * 2026-09-25, S5).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { generateContinentalDraw } from '@/data/continentalDraw';
import { getCompetitionCalendar } from '@/config/continental';
import { progressCompetitionsWeek } from '@/store/slices/orchestration/competitionWeek';

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

function rankedRivals(): string[] {
  const s = useGameStore.getState();
  return Object.values(s.clubs)
    .filter(c => c.id !== CLUB)
    .sort((a, b) => b.reputation - a.reputation || a.id.localeCompare(b.id))
    .map(c => c.id);
}

describe('continental group-stage verdict', () => {
  beforeEach(async () => {
    Math.random = mulberry32(0xC0DE);
    useGameStore.getState().resetGame();
    localStorage.clear();
    await useGameStore.getState().initGame(CLUB);
  });
  afterEach(() => { Math.random = realRandom; });

  it('is only posted to a club that was drawn into that tournament', () => {
    const s = useGameStore.getState();
    const ranked = rankedRivals();
    const draw = (comp: 'champions_cup' | 'shield_cup' | 'conference_cup', ids: string[]) =>
      generateContinentalDraw(comp, s.season, ids, {}, CLUB, {}, s.totalWeeks);
    const lastGroupWeek = getCompetitionCalendar(s.totalWeeks).groupWeeks[5];
    // Play every group matchday in one call (past-due matchdays are caught up).
    const result = progressCompetitionsWeek({
      state: {
        ...s,
        championsCup: draw('champions_cup', ranked.slice(0, 32)),
        shieldCup: draw('shield_cup', ranked.slice(32, 64)),
        conferenceCup: draw('conference_cup', ranked.slice(64, 96)),
        cup: { ...s.cup, currentRound: null }, leagueCup: null, domesticSuperCup: null, continentalSuperCup: null,
      },
      clubs: s.clubs, players: { ...s.players }, week: lastGroupWeek + 1, season: s.season,
      playerClubId: CLUB, eloRankings: {}, messages: [],
    });
    for (const t of [result.championsCup, result.shieldCup, result.conferenceCup]) {
      expect(t?.currentPhase).toBe('knockout');
    }
    // Manchester City is in none of the three draws — no verdict at all.
    expect(result.messages.filter(m => /Eliminated|Knockout!/.test(m.title))).toEqual([]);
  });

  it('still tells a drawn club whether it went through', () => {
    const s = useGameStore.getState();
    const ranked = rankedRivals();
    const championsCup = generateContinentalDraw('champions_cup', s.season, [CLUB, ...ranked.slice(0, 31)], {}, CLUB, {}, s.totalWeeks);
    const lastGroupWeek = getCompetitionCalendar(s.totalWeeks).groupWeeks[5];
    const result = progressCompetitionsWeek({
      state: { ...s, championsCup, shieldCup: null, conferenceCup: null, cup: { ...s.cup, currentRound: null }, leagueCup: null },
      clubs: s.clubs, players: { ...s.players }, week: lastGroupWeek + 1, season: s.season,
      playerClubId: CLUB, eloRankings: {}, messages: [],
    });
    const verdicts = result.messages.filter(m => /Champions Cup (Eliminated|Knockout!)/.test(m.title));
    expect(verdicts).toHaveLength(1);
  });
});
