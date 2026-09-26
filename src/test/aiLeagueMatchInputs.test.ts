/**
 * Every AI-vs-AI league fixture goes through the engine with the same inputs.
 *
 * `advanceWeek` simulates three families of AI league fixtures: the player's own
 * division, every other initialised division, and (while unemployed) all of them.
 * The first and third passed each side's bench, counter-tactics, derby intensity
 * and the season. The second — every league the player is NOT in — passed the two
 * XIs and nothing else, so those divisions played without substitutes (an
 * in-match injury left a side a man down for the rest of the game), never had a
 * derby, and always kicked off on the profile's default tactics.
 *
 * This pins the other-divisions call to the full input set.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { Club, Match, Player, TacticalInstructions } from '@/types/game';

interface Captured {
  match: Match;
  home: Club;
  away: Club;
  homeTactics?: TacticalInstructions;
  awayTactics?: TacticalInstructions;
  derbyIntensity?: number;
  season?: number;
  homeBench?: Player[];
  awayBench?: Player[];
}
const captured: Captured[] = [];

vi.mock('@/engine/match', async (orig) => {
  const mod = await orig<typeof import('@/engine/match')>();
  return {
    ...mod,
    simulateMatch: (...args: Parameters<typeof mod.simulateMatch>) => {
      const [match, home, away, , , homeTactics, awayTactics, , , derbyIntensity, , season, , homeBench, awayBench] = args;
      captured.push({ match, home, away, homeTactics, awayTactics, derbyIntensity, season, homeBench, awayBench });
      return mod.simulateMatch(...args);
    },
  };
});

// Imported after the mock is registered so the store sees the wrapper.
const { useGameStore } = await import('@/store/gameStore');
const { getDerbyIntensity } = await import('@/data/league');

describe('AI league fixtures outside the player\'s division', () => {
  let otherLeagueCalls: Captured[] = [];

  beforeAll(async () => {
    await useGameStore.getState().initGame('arsenal');
    captured.length = 0;
    await useGameStore.getState().advanceWeek();
    const st = useGameStore.getState();
    const otherFixtureIds = new Set<string>();
    for (const [div, fixtures] of Object.entries(st.divisionFixtures)) {
      if (div === st.playerDivision) continue;
      for (const f of fixtures) otherFixtureIds.add(f.id);
    }
    otherLeagueCalls = captured.filter(c => otherFixtureIds.has(c.match.id));
  }, 120_000);

  it('simulates a full round of other-division fixtures', () => {
    // eng-2/3/4 alone play 36 fixtures in round one.
    expect(otherLeagueCalls.length).toBeGreaterThan(30);
  });

  it('gives both sides a bench', () => {
    for (const c of otherLeagueCalls) {
      expect(c.homeBench?.length ?? 0, `${c.match.id} home bench`).toBeGreaterThan(0);
      expect(c.awayBench?.length ?? 0, `${c.match.id} away bench`).toBeGreaterThan(0);
    }
  });

  it('passes derby intensity and the season', () => {
    const season = useGameStore.getState().season;
    for (const c of otherLeagueCalls) {
      expect(c.derbyIntensity, c.match.id).toBe(getDerbyIntensity(c.match.homeClubId, c.match.awayClubId));
      expect(c.season, c.match.id).toBe(season);
    }
  });

  it('passes counter-tactics whenever both managers have a profile', () => {
    const withProfiles = otherLeagueCalls.filter(c => c.home.aiManagerProfile && c.away.aiManagerProfile);
    expect(withProfiles.length).toBeGreaterThan(0);
    for (const c of withProfiles) {
      expect(c.homeTactics, c.match.id).toBeDefined();
      expect(c.awayTactics, c.match.id).toBeDefined();
    }
  });
});
