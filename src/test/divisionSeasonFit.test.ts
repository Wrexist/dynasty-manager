/**
 * `fitDivisionFixturesToSeason` — every division finishes inside the season
 * the user actually plays (audit 2026-09-25, S9).
 *
 * Each division's fixtures are generated over its OWN length, but the season
 * ends on the user's calendar. A Premier League save (38 weeks) left the last 8
 * of the Championship / League One / League Two's 46 rounds unplayed every
 * season, and the season-end catch-up invented scorelines for them. The fit
 * re-schedules outstanding rounds onto the remaining weeks with midweek double
 * rounds, preferring weeks with no knockout football.
 *
 * The full-season integration check lives in divisionSeasonCalendar.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { fitDivisionFixturesToSeason, generateDivisionFixtures, getCompetitionBusyWeeks } from '@/data/league';
import type { Match } from '@/types/game';

const clubs = (n: number) => Array.from({ length: n }, (_, i) => `c${i + 1}`);

/** original week → fitted week, asserting each original round moved as one unit. */
function roundMap(before: Match[], after: Match[]): Map<number, number> {
  const map = new Map<number, number>();
  before.forEach((m, i) => {
    const w = after[i].week;
    if (map.has(m.week)) expect(map.get(m.week), `round ${m.week} split`).toBe(w);
    else map.set(m.week, w);
  });
  return map;
}

describe('fitDivisionFixturesToSeason', () => {
  it('fits a 46-round division into a 38-week season with 8 midweek doubles on quiet weeks', () => {
    const fixtures = generateDivisionFixtures(clubs(24), 46);
    expect(Math.max(...fixtures.map(m => m.week))).toBe(46);

    const fitted = fitDivisionFixturesToSeason(fixtures, 38, 1);
    expect(fitted).not.toBe(fixtures);
    expect(fitted).toHaveLength(fixtures.length);
    for (const m of fitted) {
      expect(m.week).toBeGreaterThanOrEqual(1);
      expect(m.week).toBeLessThanOrEqual(38);
    }

    // Rounds stay intact and in calendar order.
    const map = roundMap(fixtures, fitted);
    const ordered = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, w]) => w);
    for (let i = 1; i < ordered.length; i++) expect(ordered[i]).toBeGreaterThanOrEqual(ordered[i - 1]);

    // Exactly 8 weeks carry two rounds, none carry more, and all of them are
    // weeks with no Cup / League Cup / continental / Super Cup football.
    const roundsPerWeek = new Map<number, number>();
    for (const w of map.values()) roundsPerWeek.set(w, (roundsPerWeek.get(w) || 0) + 1);
    const doubled = [...roundsPerWeek.entries()].filter(([, n]) => n === 2).map(([w]) => w);
    expect(doubled).toHaveLength(8);
    expect(Math.max(...roundsPerWeek.values())).toBe(2);
    const busy = getCompetitionBusyWeeks(38);
    for (const w of doubled) expect(busy.has(w), `week ${w} is a cup week`).toBe(false);

    // A club plays at most twice in a week, and once per round.
    const perClubWeek = new Map<string, number>();
    for (const m of fitted) {
      for (const c of [m.homeClubId, m.awayClubId]) {
        const k = `${c}@${m.week}`;
        perClubWeek.set(k, (perClubWeek.get(k) || 0) + 1);
      }
    }
    expect(Math.max(...perClubWeek.values())).toBe(2);
  });

  it('is a no-op (same array) when the division already fits the season', () => {
    const fixtures = generateDivisionFixtures(clubs(20), 38);
    expect(fitDivisionFixturesToSeason(fixtures, 38, 1)).toBe(fixtures);
    // A shorter division inside a longer season is left alone as well.
    const bundesliga = generateDivisionFixtures(clubs(18), 34);
    expect(fitDivisionFixturesToSeason(bundesliga, 46, 1)).toBe(bundesliga);
  });

  it('is idempotent: a fitted division is returned unchanged next week', () => {
    const fitted = fitDivisionFixturesToSeason(generateDivisionFixtures(clubs(24), 46), 38, 1);
    expect(fitDivisionFixturesToSeason(fitted, 38, 2)).toBe(fitted);
    expect(fitDivisionFixturesToSeason(fitted, 38, 30)).toBe(fitted);
  });

  it('moves only the outstanding rounds of a save resumed mid-season', () => {
    // An existing save at week 20: rounds 1-19 already played on the old calendar.
    const fixtures = generateDivisionFixtures(clubs(24), 46).map(m =>
      m.week < 20 ? { ...m, played: true, homeGoals: 1, awayGoals: 0 } : m);
    const fitted = fitDivisionFixturesToSeason(fixtures, 38, 20);
    fixtures.forEach((m, i) => {
      if (m.played) expect(fitted[i]).toBe(m);
      else {
        expect(fitted[i].week).toBeGreaterThanOrEqual(20);
        expect(fitted[i].week).toBeLessThanOrEqual(38);
      }
    });
    // 27 rounds (20..46) into 19 weeks (20..38): 8 doubles.
    const outstanding = new Set(fitted.filter(m => !m.played).map(m => m.week));
    expect(outstanding.size).toBe(19);
  });

  it('packs a 38-round league into an 18-week season with at most three rounds a week', () => {
    // The living world in an 18-week (Croatian) save carries the Premier League.
    const fixtures = generateDivisionFixtures(clubs(20), 38);
    const fitted = fitDivisionFixturesToSeason(fixtures, 18, 1);
    const map = roundMap(fixtures, fitted);
    const perWeek = new Map<number, number>();
    for (const w of map.values()) perWeek.set(w, (perWeek.get(w) || 0) + 1);
    expect(Math.max(...fitted.map(m => m.week))).toBeLessThanOrEqual(18);
    expect(perWeek.size).toBe(18);
    expect(Math.max(...perWeek.values())).toBe(3);
  });

  it('spreads a gapped schedule evenly when there are enough weeks', () => {
    // 38 rounds scheduled over 46 weeks (gaps), played in a 38-week season.
    const fixtures = generateDivisionFixtures(clubs(20), 46);
    expect(Math.max(...fixtures.map(m => m.week))).toBe(46);
    const fitted = fitDivisionFixturesToSeason(fixtures, 38, 1);
    expect(new Set(fitted.map(m => m.week)).size).toBe(38);
    expect(Math.max(...fitted.map(m => m.week))).toBe(38);
  });
});
